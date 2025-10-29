// crm-project/crm/app/api/bridge-server/server.js
import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import express from "express";
import SAMANTHA_OPENING_TRIAGE from "../../lib/prompts/opening.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const OA_API_KEY = process.env.OPENAI_API_KEY;
const OA_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
const OA_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

function decodeB64(s) {
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
}

const SAMPLE_RATE = 8000;
const BYTES_PER_SAMPLE = 1; // μ-law is 1 byte/sample at 8 kHz
function bytesToMs(byteLen) {
  return (byteLen / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000;
}

server.on("upgrade", (req, socket, head) => {
  if (req.url?.includes("/bridge"))
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req)
    );
  else socket.destroy();
});

wss.on("connection", async (ws, req) => {
  console.log("[bridge] client connected from", req.socket.remoteAddress);

  const oa = new WebSocket(OA_URL, {
    headers: {
      Authorization: `Bearer ${OA_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
      "OpenAI-Project": OA_PROJECT_ID,
    },
  });

  let oaReady = false;
  let pcmBuffer = Buffer.alloc(0);
  let preBuffer = [];
  let currentStreamSid = null;
  let openingPrompt = SAMANTHA_OPENING_TRIAGE;
  let commitInFlight = false;

  // ✅ Updated batching window (500 ms ≈ 4000 bytes for μ-law)
  function appendAndMaybeCommit(buf) {
    if (buf?.length) pcmBuffer = Buffer.concat([pcmBuffer, buf]);
    const ms = bytesToMs(pcmBuffer.length);
    const MIN_MS = 500;
    const MIN_BYTES = 4000;

    if (oaReady && pcmBuffer.length >= MIN_BYTES && ms >= MIN_MS && !commitInFlight) {
      if (pcmBuffer.length > 0) {
        console.log(`[bridge] committing ${pcmBuffer.length} bytes (~${ms.toFixed(0)}ms)`);
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcmBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        commitInFlight = true;
        setTimeout(() => (commitInFlight = false), 300);
        pcmBuffer = Buffer.alloc(0);
      } else {
        console.log("[bridge] skipped commit — empty buffer");
      }
    }
  }

  oa.on("open", () => {
    console.log("[oa] connected — initializing Samantha session");
    oa.send(
      JSON.stringify({
        type: "session.update",
        session: {
          model: "gpt-4o-realtime-preview-2024-12-17",
          input_audio_format: "pcm16",
          output_audio_format: "g711_ulaw",
          voice: "alloy",
          instructions: openingPrompt,
        },
      })
    );
  });

  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "session.updated") {
        console.log("🌟 [oa] SESSION UPDATED — now ready");
        oaReady = true;

        if (preBuffer.length > 0) {
          const totalPreBytes = preBuffer.reduce((n, b) => n + b.length, 0);
          console.log(
            `🔊 Flushing ${preBuffer.length} pre-buffered chunks (${totalPreBytes} bytes ≈ ${bytesToMs(totalPreBytes).toFixed(0)}ms)`
          );
          const merged = Buffer.concat(preBuffer);
          preBuffer = [];
          appendAndMaybeCommit(merged);
        }

        setTimeout(() => {
          oa.send(
            JSON.stringify({
              type: "response.create",
              response: {
                conversation: "auto",
                instructions: openingPrompt,
                modalities: ["audio", "text"],
                voice: "alloy",
              },
            })
          );
          console.log("🎤 [oa] Greeting requested (wrapped response)");
        }, 500);
      }

      if (data.type === "input_audio_buffer.committed") {
        commitInFlight = false;
      }

      if (data.type === "response.output_audio.delta") {
        const len = data.delta ? Buffer.from(data.delta, "base64").length : 0;
        console.log(`[oa] 🔊 Samantha speaking — ${len} bytes`);
        if (currentStreamSid && data.delta) {
          ws.send(
            JSON.stringify({
              event: "media",
              streamSid: currentStreamSid,
              media: { payload: data.delta },
            })
          );
        }
      }

      if (data.type === "error") console.error("[oa] error", data.error?.message || data);
    } catch (e) {
      console.error("[oa] parse error", e);
    }
  });

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    if (data.event === "start") {
      currentStreamSid = data.start?.streamSid;
      const meta_b64 = data.start?.customParameters?.meta_b64;
      if (meta_b64) {
        try {
          const meta = JSON.parse(decodeB64(meta_b64));
          if (meta?.opening) openingPrompt = meta.opening;
        } catch {
          console.warn("[bridge] failed to parse meta_b64");
        }
      }
    }

    // ✅ Patched media handler — send raw μ-law to OpenAI
    if (data.event === "media") {
      const base64Audio = data.media?.payload ?? "";
      if (!base64Audio) return;

      // Simple RMS check (optional)
      const buf = Buffer.from(base64Audio, "base64");
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += Math.abs(buf[i] - 128);
      rms = rms / buf.length / 128;
      console.log(`🎧 audio detected (RMS≈${rms.toFixed(3)})`);

      if (!oaReady) {
        preBuffer.push(buf);
        return;
      }

      appendAndMaybeCommit(buf);
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      const ms = bytesToMs(pcmBuffer.length);
      const FINAL_MIN_BYTES = 4000;
      if (ms >= 120 && !commitInFlight && pcmBuffer.length >= FINAL_MIN_BYTES) {
        console.log(
          `[bridge] final commit ${pcmBuffer.length} bytes (~${ms.toFixed(0)}ms)`
        );
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcmBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      } else {
        console.log("[bridge] skipped final commit — insufficient audio data");
      }
      pcmBuffer = Buffer.alloc(0);
    }
  });

  ws.on("close", () => {
    console.log("[bridge] client disconnected");
    oa.close();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ WS bridge listening on :${PORT}`)
);
