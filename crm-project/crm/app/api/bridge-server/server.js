require("dotenv").config({ path: "../../../.env.local" }); // ✅ Load env vars

const http = require("http");
const WebSocket = require("ws");

// ✅ Import opening.js (CommonJS export)
const OPENING_PROMPT = require("../../../lib/prompts/opening");

const PORT = process.env.PORT || 8081;
const MODEL = "gpt-4o-realtime-preview-2024-12-17";
const OA_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}`;

// ---------- Utilities ----------
function b64ToBytesLen(b64) {
  const len = b64?.length || 0;
  if (!len) return 0;
  const pad = (b64.endsWith("==") ? 2 : (b64.endsWith("=") ? 1 : 0));
  return (len * 3) / 4 - pad;
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

  let bytesSinceCommit = 0;
  let framesSinceCommit = 0;
  let commitTimer = null;

  let inputFrames = 0;
  let inputPcmBytes = 0;
  let outputDeltas = 0;
  let outputChars = 0;

  function clearCommitTimer() {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  }
  function startCommitTimer(ms) {
    clearCommitTimer();
    commitTimer = setTimeout(() => {
      if (bytesSinceCommit > 0 && formatReady) {
        safeSend(oa, { type: "input_audio_buffer.commit" });
        console.log(
          `[commit:TIMER] PCM bytes=${bytesSinceCommit} frames=${framesSinceCommit}`
        );
        bytesSinceCommit = 0;
        framesSinceCommit = 0;
        scheduleRespond();
      }
    }, ms);
  }

  function scheduleRespond() {
    clearTimeout(scheduleRespond._t);
    scheduleRespond._t = setTimeout(() => {
      safeSend(oa, { type: "response.create" });
      console.log("[oa] response.create (debounced)");
    }, 120);
  }

  function safeSend(sock, obj) {
    if (sock.readyState === WebSocket.OPEN) {
      try {
        sock.send(JSON.stringify(obj));
      } catch (e) {
        console.error("[safeSend] send error:", e?.message || e);
      }
    } else {
      console.log("[safeSend] socket not open for", obj?.type || obj?.event);
    }
  }

  const oa = connectOpenAI(apiKey);

  oa.on("open", () => {
    console.log("[oa] connected");
    safeSend(oa, {
      type: "session.update",
      session: {
        input_audio_format: "g711_ulaw",   // ✅ direct from Twilio
        output_audio_format: "g711_ulaw",  // ✅ Twilio can play this back
        voice: "alloy",
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
      return;
    }

    if (data.type === "response.created") {
      console.log("[oa] response.created");
      return;
    }

    if (
      data.type === "output_audio.delta" &&
      data.audio &&
      streamSid &&
      ws.readyState === WebSocket.OPEN
    ) {
      outputDeltas += 1;
      outputChars += data.audio.length;
      safeSend(ws, { event: "media", streamSid, media: { payload: data.audio } });
      return;
    }

    if (data.type === "response.completed" && ws.readyState === WebSocket.OPEN) {
      console.log("[oa] response.completed (sending mark)");
      safeSend(ws, { event: "mark", streamSid, name: "response_completed" });
      return;
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
      console.log("[twilio] non-JSON frame");
      return;
    }

    switch (frame.event) {
      case "connected":
        console.log("[twilio] connected");
        break;

      case "start": {
        streamSid = frame.start?.streamSid || null;
        const cp = frame.start?.customParameters || {};
        if (cp.meta_b64) {
          try {
            meta = JSON.parse(
              Buffer.from(cp.meta_b64, "base64").toString("utf8")
            );
          } catch {}
        }
        console.log("[twilio] start", {
          streamSid,
          mediaFormat: frame.start?.mediaFormat,
          hasPrompt: !!meta?.opening,
        });
        break;
      }

      case "media": {
        const payloadMulawB64 = frame.media?.payload;
        if (!payloadMulawB64) return;

        inputFrames += 1;
        const pcmBytes = b64ToBytesLen(payloadMulawB64);
        inputPcmBytes += pcmBytes;

        if (!formatReady) return;

        // ✅ Send Twilio’s μ-law base64 directly
        safeSend(oa, { type: "input_audio_buffer.append", audio: payloadMulawB64 });

        bytesSinceCommit += pcmBytes;
        framesSinceCommit += 1;

        if (bytesSinceCommit >= 1600) {
          safeSend(oa, { type: "input_audio_buffer.commit" });
          console.log(
            `[commit:LIVE] PCM bytes=${bytesSinceCommit} frames=${framesSinceCommit}`
          );
          bytesSinceCommit = 0;
          framesSinceCommit = 0;
          scheduleRespond();
        } else if (!commitTimer) {
          startCommitTimer(300);
        }
        break;
      }

      case "mark":
        console.log("[twilio] mark", frame?.name || "");
        break;

      case "stop": {
        console.log("[twilio] stop");
        if (formatReady && bytesSinceCommit > 0) {
          safeSend(oa, { type: "input_audio_buffer.commit" });
          console.log(
            `[commit:FINAL] PCM bytes=${bytesSinceCommit} frames=${framesSinceCommit}`
          );
          bytesSinceCommit = 0;
          framesSinceCommit = 0;
        }
        console.log(
          `[stats] IN: twilio_frames=${inputFrames}, pcm_bytes=${inputPcmBytes} | OUT: deltas=${outputDeltas}, b64chars=${outputChars}`
        );
        try {
          oa.close();
        } catch {}
        try {
          ws.close();
        } catch {}
        break;
      }

      default:
        console.log("[twilio] event", frame.event);
    }
  });

  ws.on("close", (code, reason) => {
    clearCommitTimer();
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
  console.log(
    "[upgrade] incoming",
    path,
    "protocol:",
    req.headers["sec-websocket-protocol"]
  );

  const wss = new WebSocket.Server({
    noServer: true,
    handleProtocols: (protocols) => {
      if (Array.isArray(protocols) && protocols.includes("audio.twilio.com"))
        return "audio.twilio.com";
      return false;
    },
  });

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
