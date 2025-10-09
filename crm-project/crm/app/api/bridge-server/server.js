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
  let ulawBuffer = Buffer.alloc(0);
  let currentStreamSid = null;
  let firstAudio = false;

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

      if (data.type === "session.updated") {
        console.log("🌟 [oa] READY — sending Samantha greeting");
        oaReady = true;

        const openingMsg = {
          type: "response.create",
          response: {
            instructions: openingPrompt,
            modalities: ["audio", "text"],
            output_audio: { voice: "alloy" },
          },
        };

        console.log(
          "➡️ [oa][send] response.create",
          JSON.stringify(openingMsg, null, 2)
        );
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

      if (data.type === "error") {
        console.error("[oa] error", JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error("[oa] parse error", e);
    }
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.event === "start") {
      currentStreamSid = data.start?.streamSid;
      const meta_b64 = data.start?.customParameters?.meta_b64;
      if (meta_b64) {
        try {
          const meta = JSON.parse(decodeB64(meta_b64));
          if (meta?.opening) {
            openingPrompt = meta.opening;
            openingSource = "meta_b64 (ai-stream)";
          }
        } catch {
          console.warn("[bridge] failed to parse meta_b64");
        }
      }
    }

    if (data.event === "media" && oaReady) {
      const chunk = Buffer.from(data.media?.payload ?? "", "base64");
      if (!chunk.length) return;
      firstAudio = true;
      ulawBuffer = Buffer.concat([ulawBuffer, chunk]);

      if (ulawBuffer.length >= 2400) {
        const sendBuf = ulawBuffer.slice(0, 2400);
        ulawBuffer = ulawBuffer.slice(2400);

        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: sendBuf.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
    }

    if (data.event === "stop") {
      console.log("[bridge] stop received");
      if (ulawBuffer.length > 0 && firstAudio) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: ulawBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      } else {
        console.log("[bridge] no buffered audio; skipping commit");
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
