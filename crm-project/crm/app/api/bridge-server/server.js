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

// --- Upgrade to WS ---
server.on("upgrade", (req, socket, head) => {
  if (
    req.url &&
    (req.url.startsWith("/bridge") ||
      req.url.startsWith("/app/api/bridge-server/bridge"))
  ) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    console.warn("[bridge] rejected upgrade for URL:", req.url);
    socket.destroy();
  }
});

wss.on("connection", async (ws, req) => {
  console.log("[bridge] client connected from", req.socket.remoteAddress);

  // ✅ Include Project header for sk-proj- keys
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
  let commitTimer = null;

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
        console.log(
          `📝 [bridge] Opening preview: "${preview}${
            openingPrompt.length > 120 ? "…" : ""
          }"`
        );

        const openingMsg = {
          type: "response.create",
          response: {
            instructions: openingPrompt,
            modalities: ["audio", "text"],
            output_audio: { voice: "alloy" },
          },
        };
        oa.send(JSON.stringify(openingMsg));
      }

      if (data.type === "response.output_audio.delta" && currentStreamSid && data.delta) {
        ws.send(
          JSON.stringify({
            event: "media",
            streamSid: currentStreamSid,
            media: { payload: data.delta },
          })
        );
      }

      if (data.type === "response.output_audio.done")
        console.log("[oa] response.output_audio.done");
      if (data.type === "response.done") console.log("[oa] response.done");
      if (data.type === "error")
        console.error("[oa] error", JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("[oa] parse error", e);
    }
  });

  // --- Twilio events ---
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

    if (data.event === "media" && oaReady) {
      const chunk = Buffer.from(data.media?.payload ?? "", "base64");
      if (chunk.length === 0) return;

      ulawBuffer = Buffer.concat([ulawBuffer, chunk]);

      // Commit every 150 ms or ≥1600 bytes (about 200 ms of audio)
      if (ulawBuffer.length >= 1600 && !commitTimer) {
        commitTimer = setTimeout(() => {
          const sendBuf = ulawBuffer;
          ulawBuffer = Buffer.alloc(0);
          commitTimer = null;

          oa.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: sendBuf.toString("base64"),
            })
          );
          oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        }, 150);
      }
    }

    if (data.event === "stop") {
      if (commitTimer) clearTimeout(commitTimer);
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
    console.log("[bridge] client disconnected");
    if (commitTimer) clearTimeout(commitTimer);
    oa.close();
  });
});

const PORT = process.env.PORT;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ WS bridge listening on :${PORT}`);
});
