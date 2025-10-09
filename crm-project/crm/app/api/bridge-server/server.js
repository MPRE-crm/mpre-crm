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

// --- Helpers ---
function decodeB64(s) {
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
}

// --- Upgrade handler ---
server.on("upgrade", (req, socket, head) => {
  if (req.url?.includes("/bridge")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else socket.destroy();
});

wss.on("connection", async (ws, req) => {
  console.log("[bridge] client connected from", req.socket.remoteAddress);

  // Create connection to OpenAI realtime API
  const oa = new WebSocket(OA_URL, {
    headers: {
      Authorization: `Bearer ${OA_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
      "OpenAI-Project": OA_PROJECT_ID,
    },
  });

  let oaReady = false;
  let ulawBuffer = Buffer.alloc(0);
  let currentStreamSid = null;
  let firstAudio = false;
  let openingPrompt = SAMANTHA_OPENING_TRIAGE;

  // --- OpenAI Handshake ---
  oa.on("open", () => {
    console.log("[oa] connected — initializing session");
    oa.send(
      JSON.stringify({
        type: "session.create",
        session: {
          voice: "alloy",
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
        },
      })
    );
  });

  // --- Handle OpenAI messages ---
  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // Session confirmation
      if (data.type === "session.created") {
        console.log("🌟 [oa] SESSION CREATED — ready to speak");
        oaReady = true;

        // Send the opening greeting
        const greeting = {
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: openingPrompt,
            audio: { voice: "alloy" },
          },
        };
        console.log("➡️ [oa][send] response.create (greeting)");
        oa.send(JSON.stringify(greeting));
      }

      // Stream Samantha’s audio back to Twilio
      if (data.type === "response.output_audio.delta" && currentStreamSid && data.delta) {
        ws.send(
          JSON.stringify({
            event: "media",
            streamSid: currentStreamSid,
            media: { payload: data.delta },
          })
        );
      }

      if (data.type === "error") console.error("[oa] error", data.error?.message);
    } catch (e) {
      console.error("[oa] parse error", e);
    }
  });

  // --- Handle Twilio stream events ---
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

    if (data.event === "media" && oaReady) {
      const chunk = Buffer.from(data.media?.payload ?? "", "base64");
      if (!chunk.length) return;

      ulawBuffer = Buffer.concat([ulawBuffer, chunk]);
      firstAudio = true;

      // Only commit when we have >= 2000 bytes (~100ms) of audio
      if (ulawBuffer.length >= 2000) {
        const sendBuf = ulawBuffer.slice(0, 2000);
        ulawBuffer = ulawBuffer.slice(2000);

        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: sendBuf.toString("base64"),
          })
        );

        // Commit only if buffer had real audio
        if (sendBuf.length >= 2000) {
          oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        }
      }
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      if (firstAudio && ulawBuffer.length > 0) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: ulawBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
      ulawBuffer = Buffer.alloc(0);
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
