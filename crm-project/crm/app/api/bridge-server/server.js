// crm-project/crm/app/api/bridge-server/server.js
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
const OA_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime-preview";

// --- helpers ---
function decodeB64(s) {
  try { return Buffer.from(s, "base64").toString("utf8"); } catch { return null; }
}

// μ-law math (8kHz, 1 byte/sample) → 100ms = 800 bytes
const MIN_COMMIT_BYTES = 800;
const APPEND_CHUNK_BYTES = 1600;

server.on("upgrade", (req, socket, head) => {
  if (req.url?.includes("/bridge")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else socket.destroy();
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
  let currentStreamSid = null;
  let ulawBuffer = Buffer.alloc(0);
  let preBuffer = [];
  let appendedBytesSinceLastCommit = 0;
  let openingPrompt = SAMANTHA_OPENING_TRIAGE;

  oa.on("open", () => {
    console.log("[oa] connected — initializing Samantha session");
    oa.send(JSON.stringify({
      type: "session.update",
      session: {
        model: "gpt-realtime-preview",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        voice: "alloy",
        instructions: openingPrompt,
      },
    }));

    setTimeout(() => {
      if (!oaReady) {
        console.log("🌟 [oa] Fallback — sending greeting manually");
        oa.send(JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            instructions: "Hi, this is Samantha with MPRE Boise — can you hear me okay?",
          },
        }));
      }
    }, 800);
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
          ulawBuffer = Buffer.concat([ulawBuffer, merged]);
          while (ulawBuffer.length >= APPEND_CHUNK_BYTES) {
            const chunk = ulawBuffer.subarray(0, APPEND_CHUNK_BYTES);
            oa.send(JSON.stringify({ type: "input_audio_buffer.append", audio: chunk.toString("base64") }));
            appendedBytesSinceLastCommit += chunk.length;
            ulawBuffer = ulawBuffer.subarray(APPEND_CHUNK_BYTES);
          }
        }

        oa.send(JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            instructions: "Hi, this is Samantha with MPRE Boise — can you hear me okay?",
          },
        }));
        console.log("🎤 [oa] Greeting sent");
      }

      if (data.type === "response.output_audio.delta" && currentStreamSid && data.delta) {
        ws.send(JSON.stringify({
          event: "media",
          streamSid: currentStreamSid,
          media: { payload: data.delta },
        }));
        console.log(`[oa] 🔊 Samantha speaking — ${Buffer.from(data.delta, "base64").length} bytes`);
      }

      if (data.type === "error") console.error("[oa] error", data.error?.message || data);
    } catch (e) {
      console.error("[oa] parse error", e);
    }
  });

  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg.toString()); } catch { return; }

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
      console.log(`[bridge] stream started — ${currentStreamSid}`);
    }

    if (data.event === "media") {
      const chunk = Buffer.from(data.media?.payload ?? "", "base64");
      if (!chunk.length) return;

      if (!oaReady) {
        preBuffer.push(chunk);
      } else {
        ulawBuffer = Buffer.concat([ulawBuffer, chunk]);
        while (ulawBuffer.length >= APPEND_CHUNK_BYTES) {
          const part = ulawBuffer.subarray(0, APPEND_CHUNK_BYTES);
          oa.send(JSON.stringify({ type: "input_audio_buffer.append", audio: part.toString("base64") }));
          appendedBytesSinceLastCommit += part.length;
          ulawBuffer = ulawBuffer.subarray(APPEND_CHUNK_BYTES);
        }
      }
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");

      if (ulawBuffer.length > 0) {
        oa.send(JSON.stringify({ type: "input_audio_buffer.append", audio: ulawBuffer.toString("base64") }));
        appendedBytesSinceLastCommit += ulawBuffer.length;
        ulawBuffer = Buffer.alloc(0);
      }

      // ✅ Fixed line: allow commit even if firstAudio never flipped
      if (appendedBytesSinceLastCommit >= MIN_COMMIT_BYTES) {
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        appendedBytesSinceLastCommit = 0;
        oa.send(JSON.stringify({ type: "response.create" }));
      } else {
        appendedBytesSinceLastCommit = 0;
      }
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
