// crm-project/crm/app/api/bridge-server/server.js
import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import express from "express";

// 🔹 Import Samantha’s opening triage prompt (default fallback)
import SAMANTHA_OPENING_TRIAGE from "../../lib/prompts/opening.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const OA_API_KEY = process.env.OPENAI_API_KEY;
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

// --- Upgrade to WS ---
server.on("upgrade", (req, socket, head) => {
  // 🔹 check for the mounted path under Next.js
  if (req.url && (req.url === "/bridge" || req.url === "/app/api/bridge-server/bridge")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", async (ws, req) => {
  console.log("[bridge] client connected from", req.socket.remoteAddress);

  // Connect to OpenAI Realtime
  const oa = new WebSocket(OA_URL, {
    headers: {
      Authorization: `Bearer ${OA_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  let oaReady = false;
  let ulawBuffer = Buffer.alloc(0);
  let currentStreamSid = null;

  // 🔹 Opening prompt
  let openingPrompt = SAMANTHA_OPENING_TRIAGE;
  let openingSource = "opening.js (fallback)";

  oa.on("open", () => {
    console.log("[oa] connected");

    oa.send(
      JSON.stringify({
        type: "session.update",
        session: {
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
        },
      })
    );

    oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  });

  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "session.created") console.log("[oa] session.created");

      if (data.type === "session.updated") {
        console.log("🌟 [oa] SESSION UPDATED → Samantha is READY to speak!");
        oaReady = true;

        console.log(`🔊 [bridge] Opening source → ${openingSource}`);
        const preview = (openingPrompt || "").replace(/\s+/g, " ").slice(0, 120);
        console.log(`📝 [bridge] Opening preview: "${preview}${openingPrompt.length > 120 ? "…" : ""}"`);

        const openingMsg = {
          type: "response.create",
          response: {
            instructions: openingPrompt,
            modalities: ["audio", "text"],
            audio: { voice: "alloy" },
          },
        };
        console.log("➡️ [oa][send] response.create", JSON.stringify(openingMsg, null, 2));
        oa.send(JSON.stringify(openingMsg));
      }

      if (data.type === "response.output_audio.delta") {
        if (currentStreamSid && data.delta) {
          const twilioFrame = {
            event: "media",
            streamSid: currentStreamSid,
            media: { payload: data.delta },
          };
          ws.send(JSON.stringify(twilioFrame));
        }
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
      currentStreamSid = data.start?.streamSid || null;
      const custom = data.start?.customParameters || {};
      if (custom.meta_b64) {
        const decoded = decodeB64(custom.meta_b64);
        try {
          const meta = JSON.parse(decoded);
          if (meta?.opening) {
            openingPrompt = meta.opening;
            openingSource = "meta_b64 (ai-stream)";
          }
        } catch {
          console.warn("[bridge] failed to parse meta_b64 JSON. Using fallback.");
        }
      }
    }

    if (data.event === "media") {
      const len = data.media?.payload?.length ?? 0;

      if (currentStreamSid && len > 0) {
        const echoFrame = {
          event: "media",
          streamSid: currentStreamSid,
          media: { payload: data.media.payload },
        };
        ws.send(JSON.stringify(echoFrame));
      }

      if (oaReady && len > 0) {
        const chunk = Buffer.from(data.media.payload, "base64");
        ulawBuffer = Buffer.concat([ulawBuffer, chunk]);

        if (ulawBuffer.length >= 1600) {
          const commitBuf = ulawBuffer.slice(0, 1600);
          ulawBuffer = ulawBuffer.slice(1600);

          oa.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: commitBuf.toString("base64"),
            })
          );
          oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        }
      }
    }

    if (data.event === "stop") {
      if (ulawBuffer.length > 0) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: ulawBuffer.toString("base64"),
          })
        );
      }
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      ulawBuffer = Buffer.alloc(0);
    }
  });

  ws.on("close", () => {
    oa.close();
  });
});

const PORT = process.env.PORT;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`WS bridge listening on :${PORT}`);
});

