require("dotenv").config({ path: "../../../.env.local" }); // ✅ Load env vars

const http = require("http");
const WebSocket = require("ws");
const path = require("path");

// ✅ Import opening.js (CommonJS export)
const OPENING_PROMPT = require("../../../lib/prompts/opening");

const PORT = process.env.PORT || 8081;
const MODEL = "gpt-4o-realtime-preview-2024-12-17";
const OA_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}`;

// ~100ms of PCM16 @ 8kHz: 1600 bytes
const PCM16_MIN_BYTES = 1600;

// ---------- μ-law → PCM16 decoder ----------
const MULAW_BIAS = 0x84;
function ulawByteToLinear(u_val) {
  u_val = (~u_val) & 0xff;
  const sign = u_val & 0x80;
  const exponent = (u_val >> 4) & 0x07;
  const mantissa = u_val & 0x0f;
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  return sign ? -sample : sample;
}
function mulawB64ToPcm16Buf(b64) {
  const ulawBuf = Buffer.from(b64, "base64");
  const out = Buffer.alloc(ulawBuf.length * 2);
  for (let i = 0, j = 0; i < ulawBuf.length; i++, j += 2) {
    const s = ulawByteToLinear(ulawBuf[i]);
    out.writeInt16LE(s, j);
  }
  return out;
}
function bufToB64(buf) {
  return buf.toString("base64");
}

function connectOpenAI(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "OpenAI-Beta": "realtime=v1",
  };
  return new WebSocket(OA_URL, "realtime", { headers });
}

function handleBridge(ws, req) {
  console.log("────────────────────────────────────────────────────────");
  console.log("[bridge] client connected from", req.socket.remoteAddress);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[bridge] Missing OPENAI_API_KEY");
    ws.close(1011, "no api key");
    return;
  }

  let streamSid = null;
  let meta = null;
  let formatReady = false;
  let greetingQueued = false;

  // Buffers
  let pcmBuffer = Buffer.alloc(0);

  // Stats
  let inputFrames = 0;
  let inputPcmBytes = 0;
  let outputDeltas = 0;

  function safeSend(sock, obj) {
    if (sock.readyState === WebSocket.OPEN) {
      try {
        sock.send(JSON.stringify(obj));
      } catch (e) {
        console.error("[safeSend] send error:", e?.message || e);
      }
    }
  }

  function commitIfReady(final = false) {
    if (pcmBuffer.length >= PCM16_MIN_BYTES) {
      const sendBuf = pcmBuffer.slice(0, pcmBuffer.length);
      pcmBuffer = Buffer.alloc(0);

      safeSend(oa, {
        type: "input_audio_buffer.append",
        audio: bufToB64(sendBuf),
      });
      safeSend(oa, { type: "input_audio_buffer.commit" });

      console.log(
        `[commit:${final ? "FINAL" : "LIVE"}] PCM bytes=${sendBuf.length} (~${Math.round(
          (sendBuf.length / PCM16_MIN_BYTES) * 100
        )}ms)`
      );
    } else if (final) {
      console.log(
        `[commit:SKIP] Dropping leftover ${pcmBuffer.length} bytes (<100ms)`
      );
    }
  }

  const oa = connectOpenAI(apiKey);

  oa.on("open", () => {
    console.log("[oa] connected");
    safeSend(oa, {
      type: "session.update",
      session: {
        input_audio_format: "pcm16",
        output_audio_format: "g711_ulaw",
      },
    });
  });

  oa.on("message", (buf) => {
    let data;
    try {
      data = JSON.parse(buf.toString());
    } catch {
      return;
    }

    if (data.type && !["output_audio.delta"].includes(data.type)) {
      console.log("[oa]", data.type);
    }

    if (data.type === "error") {
      console.error("[oa] error:", data);
      return;
    }

    if (data.type === "session.updated") {
      formatReady = true;
      console.log("[oa] session.updated (formats ready)");
      if (!greetingQueued) {
        greetingQueued = true;
        const instructions = (meta && meta.opening) || OPENING_PROMPT;
        console.log("[oa] sending greeting (first 160 chars):");
        console.log((instructions || "").slice(0, 160), "…");
        safeSend(oa, {
          type: "response.create",
          response: {
            instructions,
            modalities: ["audio", "text"],
            voice: "alloy",
          },
        });
      }
    }

    if (data.type === "response.created") {
      console.log("[oa] response.created");
    }

    if (data.type === "output_audio.delta" && data.audio && streamSid) {
      outputDeltas++;
      safeSend(ws, { event: "media", streamSid, media: { payload: data.audio } });
    }

    if (data.type === "response.completed") {
      console.log("[oa] response.completed (sending mark)");
      safeSend(ws, { event: "mark", streamSid, name: "response_completed" });
    }
  });

  oa.on("close", (code, reason) => {
    console.log("[oa] close", code, reason?.toString());
    try {
      ws.close();
    } catch {}
  });
  oa.on("error", (err) => console.error("[oa] error", err?.message || err));

  ws.on("message", (msg) => {
    let frame;
    try {
      frame = JSON.parse(msg.toString());
    } catch {
      return;
    }

    switch (frame.event) {
      case "connected":
        console.log("[twilio] connected");
        break;

      case "start":
        streamSid = frame.start?.streamSid || null;
        const cp = frame.start?.customParameters || {};
        if (cp.meta_b64) {
          try {
            meta = JSON.parse(Buffer.from(cp.meta_b64, "base64").toString("utf8"));
          } catch {}
        }
        console.log("[twilio] start", {
          streamSid,
          mediaFormat: frame.start?.mediaFormat,
          hasPrompt: !!meta?.opening,
        });
        break;

      case "media": {
        const payloadMulawB64 = frame.media?.payload;
        if (!payloadMulawB64) return;

        inputFrames++;
        const pcm16buf = mulawB64ToPcm16Buf(payloadMulawB64);
        pcmBuffer = Buffer.concat([pcmBuffer, pcm16buf]);
        inputPcmBytes += pcm16buf.length;

        if (formatReady && pcmBuffer.length >= PCM16_MIN_BYTES) {
          commitIfReady(false);
        }
        break;
      }

      case "stop":
        console.log("[twilio] stop");
        commitIfReady(true);
        console.log(
          `[stats] IN: frames=${inputFrames}, pcm_bytes=${inputPcmBytes} | OUT: deltas=${outputDeltas}`
        );
        try {
          oa.close();
        } catch {}
        try {
          ws.close();
        } catch {}
        break;
    }
  });

  ws.on("close", (code, reason) => {
    console.log("[bridge] client closed", code, reason?.toString());
    try {
      oa.close();
    } catch {}
  });

  ws.on("error", (err) => {
    console.error("[bridge] ws error", err?.message || err);
    try {
      oa.close();
    } catch {}
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname;
  console.log("[upgrade] incoming", path);

  const wss = new WebSocket.Server({ noServer: true });

  const accept = (handler) =>
    wss.handleUpgrade(req, socket, head, (ws) => handler(ws, req));

  if (path === "/bridge" || path === "/bridge/") {
    console.log("[upgrade] routing to /bridge");
    accept(handleBridge);
  } else {
    console.log("[upgrade] unknown path:", path);
    try {
      socket.destroy();
    } catch {}
  }
});

server.listen(PORT, () => console.log(`WS bridge listening on :${PORT}`));
