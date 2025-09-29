require("dotenv").config({ path: "../../../.env.local" }); // ✅ Load env vars

const http = require("http");
const WebSocket = require("ws");
const OPENING_PROMPT = require("../../../lib/prompts/opening");

const PORT = process.env.PORT || 8081;
const MODEL = "gpt-4o-realtime-preview-2024-12-17";
const OA_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}`;

// ---- Audio constants (μ-law @ 8kHz) ----
const INPUT_CODEC = "g711_ulaw";         // <-- use μ-law end-to-end
const OUTPUT_CODEC = "g711_ulaw";
const MIN_BYTES_100MS_ULAW = 800;        // 100ms * 8000 samples/s * 1 byte/sample

// ---- Heartbeats ----
const BRIDGE_PING_MS = 15000;            // ping Twilio WS
const OA_PING_MS = 15000;                // ping OpenAI WS

function b64ToBytesLen(b64) {
  const len = b64?.length || 0;
  if (!len) return 0;
  const pad = b64.endsWith("==") ? 2 : (b64.endsWith("=") ? 1 : 0);
  return (len * 3) / 4 - pad;
}
function bufToB64(buf) { return buf.toString("base64"); }

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

  // stats + buffering
  let inputFrames = 0;
  let inputBytes = 0;
  let outputDeltas = 0;

  // accumulate raw μ-law bytes here, slice in ≥800B chunks
  let ulawBuffer = Buffer.alloc(0);

  function safeSend(sock, obj) {
    if (sock.readyState === WebSocket.OPEN) {
      try { sock.send(JSON.stringify(obj)); } catch (e) {
        console.error("[safeSend] send error:", e?.message || e);
      }
    }
  }

  const oa = connectOpenAI(apiKey);

  // ---- Heartbeats ----
  let bridgePing;       // native WS ping to Twilio
  let oaPingTimer;      // JSON ping to OpenAI (plus native ping if supported)

  function startHeartbeats() {
    stopHeartbeats();
    bridgePing = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.ping(); } catch {}
      }
    }, BRIDGE_PING_MS);

    oaPingTimer = setInterval(() => {
      if (oa.readyState === WebSocket.OPEN) {
        // Some gateways drop native ping; send API-level ping, too.
        safeSend(oa, { type: "ping", timestamp: Date.now() });
        try { oa.ping?.(); } catch {}
      }
    }, OA_PING_MS);
  }
  function stopHeartbeats() {
    if (bridgePing) { clearInterval(bridgePing); bridgePing = null; }
    if (oaPingTimer) { clearInterval(oaPingTimer); oaPingTimer = null; }
  }

  oa.on("open", () => {
    console.log("[oa] connected");
    startHeartbeats();
    // Tell OpenAI we speak and want μ-law in/out (8 kHz)
    safeSend(oa, {
      type: "session.update",
      session: {
        input_audio_format: INPUT_CODEC,
        output_audio_format: OUTPUT_CODEC,
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
      return;
    }

    if (data.type === "output_audio.delta" && data.audio && streamSid && ws.readyState === WebSocket.OPEN) {
      outputDeltas += 1;
      // data.audio is base64 g711_ulaw — forward directly to Twilio
      safeSend(ws, { event: "media", streamSid, media: { payload: data.audio } });
      return;
    }

    if (data.type === "response.completed") {
      safeSend(ws, { event: "mark", streamSid, name: "response_completed" });
      return;
    }
  });

  oa.on("close", (code, reason) => {
    console.log("[oa] close", code, reason?.toString());
    stopHeartbeats();
    try { ws.close(); } catch {}
  });
  oa.on("error", (err) => console.error("[oa] error", err?.message || err));

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
        const payloadB64 = frame.media?.payload;
        if (!payloadB64) return;

        inputFrames += 1;
        // accumulate raw μ-law bytes
        const chunk = Buffer.from(payloadB64, "base64");
        ulawBuffer = Buffer.concat([ulawBuffer, chunk]);
        inputBytes += chunk.length;

        if (!formatReady) return;

        while (ulawBuffer.length >= MIN_BYTES_100MS_ULAW) {
          const sendBuf = ulawBuffer.slice(0, MIN_BYTES_100MS_ULAW);
          ulawBuffer = ulawBuffer.slice(MIN_BYTES_100MS_ULAW);

          safeSend(oa, { type: "input_audio_buffer.append", audio: bufToB64(sendBuf) });
          safeSend(oa, { type: "input_audio_buffer.commit" });
          console.log(`[commit:LIVE] UL bytes=${sendBuf.length}`);
        }
        break;
      }

      case "stop": {
        console.log("[twilio] stop");
        // flush ≥100ms only
        if (ulawBuffer.length >= MIN_BYTES_100MS_ULAW) {
          safeSend(oa, { type: "input_audio_buffer.append", audio: bufToB64(ulawBuffer) });
          safeSend(oa, { type: "input_audio_buffer.commit" });
          console.log(`[commit:FINAL] sent ${ulawBuffer.length} UL bytes`);
        } else if (ulawBuffer.length > 0) {
          console.log(`[commit:SKIP] Dropping tiny leftover ${ulawBuffer.length} UL bytes`);
        }
        ulawBuffer = Buffer.alloc(0);

        console.log(`[stats] IN: frames=${inputFrames}, ulaw_bytes=${inputBytes} | OUT: deltas=${outputDeltas}`);
        try { oa.close(); } catch {}
        try { ws.close(); } catch {}
        break;
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log("[bridge] client closed", code, reason?.toString());
    stopHeartbeats();
    try { oa.close(); } catch {}
  });

  ws.on("error", (err) => {
    console.error("[bridge] ws error", err?.message || err);
    stopHeartbeats();
    try { oa.close(); } catch {}
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
