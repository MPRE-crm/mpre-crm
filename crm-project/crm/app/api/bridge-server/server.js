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
const OA_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime-preview";

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

  oa.on("open", () => {
    console.log("[oa] connected — initializing Samantha session");

    // ✅ Session configuration (no unsupported params)
    oa.send(
      JSON.stringify({
        type: "session.update",
        session: {
          model: "gpt-realtime-preview",
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          voice: "alloy",
          instructions: openingPrompt,
        },
      })
    );

    // Fallback if no session.updated received
    setTimeout(() => {
      if (!oaReady) {
        console.log("🌟 [oa] Fallback — sending greeting manually");
        oa.send(
          JSON.stringify({
            type: "response.create",
            response: {
              conversation: "none",
              instructions: openingPrompt,
            },
          })
        );
      }
    }, 800);
  });

  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "session.updated") {
        console.log("🌟 [oa] SESSION UPDATED — now ready");
        oaReady = true;

        // ✅ Trigger Samantha greeting (no unsupported keys)
        oa.send(
          JSON.stringify({
            type: "response.create",
            response: {
              conversation: "none",
              instructions: openingPrompt,
            },
          })
        );
        console.log("🎤 [oa] Greeting sent (response.create)");
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

    // Stream caller audio → OpenAI
    if (data.event === "media" && oaReady) {
      const chunk = Buffer.from(data.media?.payload ?? "", "base64");
      if (!chunk.length) return;
      ulawBuffer = Buffer.concat([ulawBuffer, chunk]);
      firstAudio = true;

      if (ulawBuffer.length >= 1600) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: ulawBuffer.toString("base64"),
          })
        );
        ulawBuffer = Buffer.alloc(0);
      }
    }

    // Commit audio when Twilio signals end of speech
    if (data.event === "stop") {
      console.log("[bridge] stop received");
      if (firstAudio) {
        if (ulawBuffer.length > 0) {
          oa.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: ulawBuffer.toString("base64"),
            })
          );
        }
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        oa.send(JSON.stringify({ type: "response.create" }));
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
