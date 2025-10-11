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
  let firstAudio = false;
  let openingPrompt = SAMANTHA_OPENING_TRIAGE;

  oa.on("open", () => {
    console.log("[oa] connected — initializing Samantha session");
    oa.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          model: "gpt-4o-realtime-preview-2024-12-17",
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 8000 }, // ✅ replaces old input_audio_sample_rate_hz
            },
            output: {
              format: { type: "audio/pcmu" }, // g711 μ-law
              voice: "alloy",
            },
          },
          instructions: openingPrompt,
        },
      })
    );
  });

  // --- Handle OpenAI responses ---
  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "session.updated") {
        console.log("🌟 [oa] SESSION UPDATED — now ready");
        oaReady = true;
        if (preBuffer.length > 0) {
          console.log(`🔊 Flushing ${preBuffer.length} pre-buffered chunks`);
          for (const b of preBuffer) {
            oa.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: b.toString("base64"),
              })
            );
          }
          oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
          preBuffer = [];
        }
        oa.send(
          JSON.stringify({
            type: "response.create",
            response: {
              conversation: "none",
              instructions: openingPrompt,
              metadata: { phase: "greeting" },
            },
          })
        );
        console.log("🎤 [oa] Greeting sent");
      }

      if (
        data.type === "response.output_audio.delta" &&
        currentStreamSid &&
        data.delta
      ) {
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

  // --- Handle Twilio inbound stream ---
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

      // ✅ Decode μ-law to PCM16 (8kHz)
      const pcm16 = ulawToPCM16(uLaw);

      // log signal strength
      let rms = 0;
      for (let i = 0; i < pcm16.length; i += 2)
        rms += Math.abs(pcm16.readInt16LE(i)) / 32768;
      rms = rms / (pcm16.length / 2);
      console.log(`🎧 audio detected (RMS=${rms.toFixed(3)})`);

      if (!oaReady) {
        preBuffer.push(pcm16);
        return;
      }

      pcmBuffer = Buffer.concat([pcmBuffer, pcm16]);
      if (pcmBuffer.length >= 16000) {
        console.log(`[bridge] sending frame (${pcmBuffer.length} bytes)`);
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcmBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        pcmBuffer = Buffer.alloc(0);
        if (!firstAudio) {
          firstAudio = true;
          oa.send(JSON.stringify({ type: "response.create" }));
        }
      }
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      if (pcmBuffer.length > 0) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcmBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
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
