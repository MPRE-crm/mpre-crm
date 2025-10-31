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

// --- μ-law → PCM16 decode table ---
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

// --- 🔹 Simple 8kHz → 24kHz upsampler ---
function upsamplePCM16(pcm8k) {
  const ratio = 3; // 8kHz → 24kHz
  const out = Buffer.alloc(pcm8k.length * ratio);
  for (let i = 0; i < pcm8k.length / 2 - 1; i++) {
    const sample = pcm8k.readInt16LE(i * 2);
    for (let j = 0; j < ratio; j++) out.writeInt16LE(sample, (i * ratio + j) * 2);
  }
  return out;
}

function decodeB64(s) {
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
}

const SAMPLE_RATE = 24000; // 🔹 was 8000
const BYTES_PER_SAMPLE = 2; // PCM16 = 2 bytes/sample
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

  function commitIfReady() {
    const ms = bytesToMs(pcmBuffer.length);
    const MIN_MS = 500;
    if (!oaReady || pcmBuffer.length === 0 || ms < MIN_MS || commitInFlight) return;

    const chunk = pcmBuffer;
    pcmBuffer = Buffer.alloc(0);
    commitInFlight = true;

    console.log(`[bridge] committing ${chunk.length} bytes (~${ms.toFixed(0)} ms)`);

    oa.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: chunk.toString("base64"),
      })
    );

    setTimeout(() => {
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }, 150);

    setTimeout(() => (commitInFlight = false), 500);
  }

  function appendAndMaybeCommit(buf) {
    if (buf?.length) pcmBuffer = Buffer.concat([pcmBuffer, buf]);
    commitIfReady();
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
          input_audio_sample_rate_hz: 24000, // 🔹 explicitly declare
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
          console.log("🎤 [oa] Greeting requested");
        }, 300);
      }

      if (data.type === "response.output_audio.delta" && currentStreamSid && data.delta) {
        const len = Buffer.from(data.delta, "base64").length;
        console.log(`[oa] 🔊 Samantha speaking — ${len} bytes`);
        ws.send(
          JSON.stringify({
            event: "media",
            streamSid: currentStreamSid,
            media: { payload: data.delta },
          })
        );
      }

      if (data.type === "error")
        console.error("[oa] error", data.error?.message || data);
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

    // --- μ-law → PCM16 + upsample 8kHz → 24kHz ---
    if (data.event === "media") {
      const uLaw = Buffer.from(data.media?.payload ?? "", "base64");
      if (!uLaw.length) return;
      const pcm16_8k = ulawToPCM16(uLaw);
      const pcm16_24k = upsamplePCM16(pcm16_8k);

      let rms = 0;
      for (let i = 0; i < pcm16_24k.length; i += 2)
        rms += Math.abs(pcm16_24k.readInt16LE(i)) / 32768;
      rms /= pcm16_24k.length / 2;
      console.log(`🎧 audio detected (RMS=${rms.toFixed(3)})`);

      if (!oaReady) preBuffer.push(pcm16_24k);
      else appendAndMaybeCommit(pcm16_24k);
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      commitIfReady();
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
