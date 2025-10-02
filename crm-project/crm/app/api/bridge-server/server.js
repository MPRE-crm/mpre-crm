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
  if (req.url === "/bridge") {
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

  // 🔹 Opening prompt (& source) — default to opening.js
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

    // 🔧 prime OA stream with an empty commit
    oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  });

  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "session.created") {
        console.log("[oa] session.created");
      }

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

        // ✅ FIX: ensure `voice` is under response.audio
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

      if (data.type === "response.created") console.log("[oa] response.created");
      if (data.type === "response.output_audio.delta")
        console.log(`[oa][audio] delta received → ${data.delta?.length || 0} bytes`);
      if (data.type === "response.output_audio.done")
        console.log("[oa][audio] output_audio DONE");
      if (data.type === "response.done") console.log("[oa] response.done");
      if (data.type === "error")
        console.error("[oa] error", JSON.stringify(data, null, 2));
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
      console.log("[twilio] start", data.start);

      const custom = data.start?.customParameters || {};
      if (custom.meta_b64) {
        const decoded = decodeB64(custom.meta_b64);
        try {
          const meta = JSON.parse(decoded);
          if (meta?.opening) {
            openingPrompt = meta.opening;
            openingSource = "meta_b64 (ai-stream)";
            console.log("✅ [bridge] Opening overridden by meta_b64 (ai-stream).");
          }
        } catch {
          console.warn("[bridge] failed to parse meta_b64 JSON. Using fallback.");
        }
      }
    }

    if (data.event === "media") {
      const len = data.media?.payload?.length ?? 0;
      console.log(`[twilio][media] payload length=${len}`);

      if (oaReady && len > 0) {
        const chunk = Buffer.from(data.media.payload, "base64");
        ulawBuffer = Buffer.concat([ulawBuffer, chunk]);

        // commit after 1600 bytes (~100ms μ-law)
        if (ulawBuffer.length >= 1600) {
          const commitBuf = ulawBuffer.slice(0, 1600);
          ulawBuffer = ulawBuffer.slice(1600);

          console.log(
            `[commit:LIVE] μ-law bytes=${commitBuf.length}, remaining=${ulawBuffer.length}`
          );

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
      console.log("[twilio] stop");
      if (ulawBuffer.length > 0) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: ulawBuffer.toString("base64"),
          })
        );
      }
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      console.log(`[commit:FINAL] Sent ${ulawBuffer.length} bytes`);
      ulawBuffer = Buffer.alloc(0);
    }
  });

  ws.on("close", () => {
    console.log("[bridge] client disconnected");
    oa.close();
  });
});

server.listen(8081, () => {
  console.log("WS bridge listening on :8081");
});
