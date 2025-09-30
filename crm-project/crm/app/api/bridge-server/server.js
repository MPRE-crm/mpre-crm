// crm-project/crm/app/api/bridge-server/server.js
import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// 🔹 Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 Import Samantha’s opening triage prompt
import OPENING from "../../../../lib/prompts/opening.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const OA_API_KEY = process.env.OPENAI_API_KEY;
const OA_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

function ulawToPcm16(uLawSample) {
  // ITU-T G.711 μ-law decode
  uLawSample = ~uLawSample & 0xff;
  const sign = uLawSample & 0x80;
  const exponent = (uLawSample >> 4) & 0x07;
  const mantissa = uLawSample & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

function ulawBufferToPCM16(buffer) {
  const pcm = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    pcm[i] = ulawToPcm16(buffer[i]);
  }
  return Buffer.from(pcm.buffer);
}

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
  let pcmBuffer = Buffer.alloc(0);

  oa.on("open", () => {
    console.log("[oa] connected");
  });

  oa.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "session.created") {
        console.log("[oa] session.created");
      }

      if (data.type === "session.updated") {
        console.log("[oa] session.updated (formats ready)");
        oaReady = true;

        // 🔹 Inject Samantha’s opening triage
        oa.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions: OPENING,
              modalities: ["audio", "text"],
              audio: { voice: "alloy" },
            },
          })
        );
      }

      if (data.type === "response.created")
        console.log("[oa] response.created");
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
    }

    if (data.event === "media" && oaReady) {
      const chunk = Buffer.from(data.media.payload, "base64");
      const pcm = ulawBufferToPCM16(chunk);
      pcmBuffer = Buffer.concat([pcmBuffer, pcm]);

      // Commit every 3200 bytes (~100ms @ 16-bit, 8kHz)
      if (pcmBuffer.length >= 3200) {
        const commitBuf = pcmBuffer.slice(0, 3200);
        pcmBuffer = pcmBuffer.slice(3200);

        console.log(
          `[commit:LIVE] PCM bytes=${commitBuf.length}, remaining=${pcmBuffer.length}`
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

    if (data.event === "stop") {
      console.log("[twilio] stop");
      if (pcmBuffer.length > 0) {
        oa.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcmBuffer.toString("base64"),
          })
        );
        oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        console.log(`[commit:FINAL] Sent ${pcmBuffer.length} bytes`);
        pcmBuffer = Buffer.alloc(0);
      }
      // Close out gracefully
      oa.send(JSON.stringify({ type: "response.create" }));
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
