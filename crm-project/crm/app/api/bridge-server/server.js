import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import express from "express";
import SAMANTHA_OPENING_TRIAGE from "../../lib/prompts/opening.js";
import SAMANTHA_BUYER_INTAKE from "../../lib/prompts/buyer-intake.js";
import SAMANTHA_SELLER_INTAKE from "../../lib/prompts/seller-intake.js";
import SAMANTHA_INVESTOR_INTAKE from "../../lib/prompts/investor-intake.js";

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
    let sign = u & 0x80 ? -1 : 1;
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

// --- 8 kHz → 16 kHz upsampler ---
function upsample8kTo16k(pcm8k) {
  const out = Buffer.alloc(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length / 2; i++) {
    const s = pcm8k.readInt16LE(i * 2);
    out.writeInt16LE(s, i * 4);
    out.writeInt16LE(s, i * 4 + 2);
  }
  return out;
}

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const APPEND_COMMIT_DELAY_MS = 200;
const RMS_SILENCE_THRESHOLD = 0.02;
const REQUIRED_SILENCE_MS = 3500;
const CHECK_INTERVAL_MS = 250;

function bytesToMs(bytes) {
  return (bytes / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000;
}
function decodeB64(s) {
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
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
  let lastRMS = 0;
  let silenceTimer = null;
  let quietFor = 0;
  let isSamanthaSpeaking = false;

  function commitBuffer() {
    if (!oaReady || pcmBuffer.length === 0) return;
    const ms = bytesToMs(pcmBuffer.length);
    console.log(`[bridge] committing ${pcmBuffer.length} bytes (~${ms.toFixed(0)} ms)`);
    oa.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: pcmBuffer.toString("base64"),
      })
    );
    setTimeout(() => {
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      pcmBuffer = Buffer.alloc(0);
    }, APPEND_COMMIT_DELAY_MS);
  }

  function handleSilence() {
    if (isSamanthaSpeaking) return;
    if (lastRMS < RMS_SILENCE_THRESHOLD) {
      quietFor += CHECK_INTERVAL_MS;
      if (quietFor >= REQUIRED_SILENCE_MS) {
        clearInterval(silenceTimer);
        silenceTimer = null;
        quietFor = 0;
        console.log("🔇 Silence detected — committing caller audio");
        commitBuffer();
      }
    } else {
      quietFor = 0;
    }
  }

  function appendAudio(buf) {
    if (!buf?.length || isSamanthaSpeaking) return;
    pcmBuffer = Buffer.concat([pcmBuffer, buf]);
    if (!silenceTimer) silenceTimer = setInterval(handleSilence, CHECK_INTERVAL_MS);
  }

  function switchPrompt(openingPrompt) {
    if (!oaReady) return;
    console.log(`[bridge] switching prompt → ${openingPrompt.name}`);
    oa.send(
      JSON.stringify({
        type: "session.update",
        session: { instructions: openingPrompt },
      })
    );
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
          modalities: ["audio", "text"],
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
        console.log("🌟 [oa] SESSION UPDATED — ready");
        oaReady = true;
        if (preBuffer.length) {
          const merged = Buffer.concat(preBuffer);
          preBuffer = [];
          appendAudio(merged);
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
        }, 100);
      }

      if (data.type === "response.audio.delta" && currentStreamSid && data.delta) {
        isSamanthaSpeaking = true;
        const len = Buffer.from(data.delta, "base64").length;
        ws.send(
          JSON.stringify({
            event: "media",
            streamSid: currentStreamSid,
            media: { payload: data.delta },
          })
        );
        console.log(`[oa] 🔊 Samantha speaking — ${len} bytes`);
      }

      if (data.type === "response.completed") {
        setTimeout(() => {
          isSamanthaSpeaking = false;
          console.log("🎧 Samantha finished speaking — now listening...");
        }, REQUIRED_SILENCE_MS);
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
      console.log(`[bridge] stream started — track: ${data.start?.track || "unknown"}`);
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
      const pcm16 = upsample8kTo16k(ulawToPCM16(uLaw));
      let rms = 0;
      for (let i = 0; i < pcm16.length; i += 2)
        rms += Math.abs(pcm16.readInt16LE(i)) / 32768;
      rms /= pcm16.length / 2;
      lastRMS = rms;
      console.log(`🎧 audio detected (RMS=${rms.toFixed(3)})`);
      if (!oaReady) preBuffer.push(pcm16);
      else appendAudio(pcm16);
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      commitBuffer();
      pcmBuffer = Buffer.alloc(0);
    }
  });

  ws.on("close", () => {
    console.log("[bridge] client disconnected");
    if (silenceTimer) clearInterval(silenceTimer);
    oa.close();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ WS bridge listening on :${PORT}`)
);
