require("dotenv").config({ path: "../../../.env.local" });

const http = require("http");
const WebSocket = require("ws");
const OPENING_PROMPT = require("../../../lib/prompts/opening");

const PORT = process.env.PORT || 8081;
const MODEL = "gpt-4o-realtime-preview-2024-12-17";
const OA_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}`;

const INPUT_FORMAT = "pcm16";       // send PCM16 to OpenAI
const OUTPUT_FORMAT = "g711_ulaw";  // receive μ-law back for Twilio

// ---- μ-law → PCM16 ----
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
function mulawB64ToPcm16Buffer(b64) {
  const ulawBuf = Buffer.from(b64, "base64");
  const out = Buffer.alloc(ulawBuf.length * 2);
  for (let i = 0, j = 0; i < ulawBuf.length; i++, j += 2) {
    const s = ulawByteToLinear(ulawBuf[i]);
    out.writeInt16LE(s, j);
  }
  return out;
}

// ---- thresholds ----
const PCM_FRAME_BYTES = 320;   // 20ms at 16-bit PCM/8kHz
const PCM_COMMIT_BYTES = 3200; // 200ms safe commit minimum

// ---- heartbeats ----
const BRIDGE_PING_MS = 15000;
const OA_PING_MS = 15000;

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

  let pcmBuffer = Buffer.alloc(0);
  let lastCommitTs = 0;

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

  const oa = connectOpenAI(apiKey);

  // heartbeats
  let bridgePing, oaPingTimer;
  function startHeartbeats() {
    stopHeartbeats();
    bridgePing = setInterval(() => { try { ws.ping(); } catch {} }, BRIDGE_PING_MS);
    oaPingTimer = setInterval(() => {
      safeSend(oa, { type: "ping", t: Date.now() });
      try { oa.ping?.(); } catch {}
    }, OA_PING_MS);
  }
  function stopHeartbeats() {
    if (bridgePing) clearInterval(bridgePing), bridgePing = null;
    if (oaPingTimer) clearInterval(oaPingTimer), oaPingTimer = null;
  }

  // commit helper
  function tryCommit(force = false) {
    const now = Date.now();
    if (!force && now - lastCommitTs < 100) return; // throttle ~10Hz
    if (pcmBuffer.length >= PCM_COMMIT_BYTES) {
      const toSend = pcmBuffer.slice(0, PCM_COMMIT_BYTES);
      pcmBuffer = pcmBuffer.slice(PCM_COMMIT_BYTES);
      safeSend(oa, { type: "input_audio_buffer.append", audio: toSend.toString("base64") });
      safeSend(oa, { type: "input_audio_buffer.commit" });
      lastCommitTs = now;
      console.log(`[commit:LIVE] PCM bytes=${toSend.length}, remaining=${pcmBuffer.length}`);
    }
  }

  oa.on("open", () => {
    console.log("[oa] connected");
    startHeartbeats();
    safeSend(oa, {
      type: "session.update",
      session: {
        input_audio_format: INPUT_FORMAT,
        output_audio_format: OUTPUT_FORMAT,
      },
    });
  });

  oa.on("message", (buf) => {
    let data;
    try { data = JSON.parse(buf.toString()); } catch { return; }

    if (data.type && !["output_audio.delta"].includes(data.type)) {
      console.log("[oa]", data.type);
    }
    if (data.type === "error") {
      console.error("[oa] error:", JSON.stringify(data, null, 2));
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
      return;
    }
    if (data.type === "output_audio.delta" && data.audio && streamSid && ws.readyState === WebSocket.OPEN) {
      outputDeltas += 1;
      console.log(`[oa] output_audio.delta (${data.audio.length} bytes)`);
      safeSend(ws, { event: "media", streamSid, media: { payload: data.audio } });
      return;
    }
  });

  ws.on("message", (msg) => {
    let frame;
    try { frame = JSON.parse(msg.toString()); } catch { return; }

    switch (frame.event) {
      case "connected":
        console.log("[twilio] connected");
        startHeartbeats();
        break;

      case "start": {
        streamSid = frame.start?.streamSid || null;
        const cp = frame.start?.customParameters || {};
        if (cp.meta_b64) {
          try { meta = JSON.parse(Buffer.from(cp.meta_b64, "base64").toString("utf8")); } catch {}
        }
        console.log("[twilio] start", {
          streamSid,
          mediaFormat: frame.start?.mediaFormat,
          hasPrompt: !!meta?.opening,
        });
        break;
      }

      case "media": {
        if (!formatReady) {
          console.log("[twilio] media ignored (format not ready)");
          return;
        }
        const payloadB64 = frame.media?.payload;
        if (!payloadB64) return;

        inputFrames += 1;
        const pcmChunk = mulawB64ToPcm16Buffer(payloadB64);
        inputPcmBytes += pcmChunk.length;
        pcmBuffer = Buffer.concat([pcmBuffer, pcmChunk]);

        console.log(`[twilio] frame ${inputFrames}, pcmBuffer=${pcmBuffer.length} bytes`);

        tryCommit(false);
        break;
      }

      case "stop": {
        console.log("[twilio] stop");
        while (pcmBuffer.length >= PCM_COMMIT_BYTES) {
          tryCommit(true);
        }
        if (pcmBuffer.length >= PCM_FRAME_BYTES) {
          safeSend(oa, { type: "input_audio_buffer.append", audio: pcmBuffer.toString("base64") });
          safeSend(oa, { type: "input_audio_buffer.commit" });
          console.log(`[commit:FINAL] Sent ${pcmBuffer.length} bytes`);
        } else if (pcmBuffer.length > 0) {
          console.log(`[commit:SKIP] Dropping leftover ${pcmBuffer.length} bytes (<20ms)`);
        }
        pcmBuffer = Buffer.alloc(0);

        console.log(`[stats] IN: frames=${inputFrames}, pcm_bytes=${inputPcmBytes} | OUT: deltas=${outputDeltas}`);
        try { oa.close(); } catch {}
        try { ws.close(); } catch {}
        break;
      }
    }
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
  if (url.pathname === "/bridge") {
    console.log("[upgrade] routing to /bridge");
    const wss = new WebSocket.Server({ noServer: true });
    wss.handleUpgrade(req, socket, head, (ws) => handleBridge(ws, req));
  } else {
    try { socket.destroy(); } catch {}
  }
});

server.listen(PORT, () => console.log(`WS bridge listening on :${PORT}`));
