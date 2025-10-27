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

// --- μ-law → PCM16 decode ---
const MULAW_DECODE_TABLE = new Int16Array(256);
(function buildMuLawTable() {
  for (let i = 0; i < 256; i++) {
    let u = ~i;
    let sign = (u & 0x80) ? -1 : 1;
    let exponent = (u >> 4) & 7;
    let mantissa = u & 0x0f;
    let magnitude = ((mantissa << 4) + 8) << (exponent + 3);
    MULAW_DECODE_TABLE[i] = sign * magnitude;
  }
})();
function ulawToPCM16(buf) {
  const out = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++)
    out.writeInt16LE(MULAW_DECODE_TABLE[buf[i]], i * 2);
  return out;
}

function decodeB64(s) {
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
}

const SAMPLE_RATE = 8000;
const BYTES_PER_SAMPLE = 2;
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

  // ✅ Updated batching window (300 ms ≈ 4800 bytes)
  function appendAndMaybeCommit(buf) {
    if (buf?.length) pcmBuffer = Buffer.concat([pcmBuffer, buf]);
    const ms = bytesToMs(pcmBuffer.length);
    const MIN_MS = 500;
    const MIN_BYTES = 8000;

    if (oaReady && pcmBuffer.length > 0 && pcmBuffer.length >= MIN_BYTES && ms >= MIN_MS && !commitInFlight) {
      console.log(`[bridge] committing ${pcmBuffer.length} bytes (~${ms.toFixed(0)}ms)`);
      oa.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: pcmBuffer.toString("base64"),
        })
      );
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      commitInFlight = true;
      pcmBuffer = Buffer.alloc(0);
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

        // ✅ Correct: wrap in `response` object
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
      }

      if (data.type === "input_audio_buffer.committed") {
        commitInFlight = false;
        const pendingMs = bytesToMs(pcmBuffer.length);
        if (pendingMs >= 120) appendAndMaybeCommit(Buffer.alloc(0));
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

      if (data.type === "error") {
        console.error("[oa] error", data.error?.message || data);
      }
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

    if (data.event === "media") {
      const uLaw = Buffer.from(data.media?.payload ?? "", "base64");
      if (!uLaw.length) return;
      const pcm16 = ulawToPCM16(uLaw);
      let rms = 0;
      for (let i = 0; i < pcm16.length; i += 2)
        rms += Math.abs(pcm16.readInt16LE(i)) / 32768;
      rms = rms / (pcm16.length / 2);
      console.log(`🎧 audio detected (RMS=${rms.toFixed(3)})`);

      if (!oaReady) {
        preBuffer.push(pcm16);
        return;
      }

      appendAndMaybeCommit(pcm16);
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      const ms = bytesToMs(pcmBuffer.length);
      if (ms >= 120 && !commitInFlight && pcmBuffer.length >= 1920) {
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
        commitInFlight = true;
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
