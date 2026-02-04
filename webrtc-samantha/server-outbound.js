// webrtc-samantha/server-outbound.js
import "dotenv/config";
import express from "express";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";

// ✅ OUTBOUND-ONLY states
import ST from "./config/statesOutbound.js";

// ✅ Core shared systems
import { playPcmToClient } from "./lib/audio/pcmPlayer.js";
import { sendSessionUpdate } from "./lib/openai/session.js";
import { createMicController } from "./mic/micController.js";
import { handleOpenAIMessage } from "./oa/oaHandlers.js";
import { handleClientMessage } from "./ws/clientHandlers.js";

// ✅ OUTBOUND campaign registry
import { getOutboundCampaign } from "./lib/outbound/campaignRegistry.js";

/* ------------------------------------------------------------------ */
/* PATH */
/* ------------------------------------------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/* EXPRESS + HTTPS */
/* ------------------------------------------------------------------ */
const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = https.createServer(
  {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
  },
  app
);

const wss = new WebSocketServer({ server });

server.listen(8080, () =>
  console.log("✅ OUTBOUND Samantha running at https://localhost:8080")
);

/* ------------------------------------------------------------------ */
/* SELECT OUTBOUND CAMPAIGN                                             */
/* ------------------------------------------------------------------ */
// 🔧 Change this ONE value to debug another campaign later
const CAMPAIGN_NAME = "cancelled";

const { pcms, createFlow } = getOutboundCampaign(CAMPAIGN_NAME);

/* ------------------------------------------------------------------ */
/* CONNECTION                                                          */
/* ------------------------------------------------------------------ */
wss.on("connection", (ws) => {
  console.log(`🌐 WebRTC client connected (OUTBOUND | ${CAMPAIGN_NAME})`);

  const oa = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  /* ---------------- STATE ---------------- */
  let state = ST.PLAY_OUTBOUND_STEP;
  let allowOASpeech = false; // 🔒 PCM-only for now
  let oaReady = false;
  let micQueue = [];

  const mic = createMicController(ws, oa);

  function setState(s) {
    state = s;
    console.log("🧭 STATE →", s);
  }

  /* ------------------------------------------------------------------ */
  /* PCM playback helper                                                 */
  /* ------------------------------------------------------------------ */
  function playBuffer(buf, label, nextState) {
    mic.lockMic();
    playPcmToClient(ws, buf, label, () => {
      setState(nextState);
      mic.unlockMic();
    });
  }

  /* ------------------------------------------------------------------ */
  /* OUTBOUND FLOW (CAMPAIGN-DRIVEN)                                    */
  /* ------------------------------------------------------------------ */
  const outboundFlow = createFlow({
    ST,
    playBuffer,
    outboundCancelledPcms: pcms, // name kept for compatibility
  });

  /* ------------------------------------------------------------------ */
  /* OPENAI EVENTS                                                       */
  /* ------------------------------------------------------------------ */
  oa.on("open", () => {
    console.log(`[Samantha OUTBOUND] OpenAI connected (${CAMPAIGN_NAME})`);
    sendSessionUpdate(oa);
    oaReady = true;

    micQueue.forEach((pkt) => oa.send(pkt));
    micQueue = [];

    // ▶️ Start campaign flow
    outboundFlow.startCancelledFlow(setState);
  });

  oa.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch (e) {
      console.log("❌ OUTBOUND: failed to parse OA message", e);
      return;
    }

    handleOpenAIMessage({
      data,
      ws,
      oa,
      mic,
      state,
      setState,
      allowOASpeech,
      playPcmToClient,
      onTranscript: (transcript) => {
        console.log("📝 TRANSCRIPT (OUTBOUND):", { state, transcript });

        if (state === ST.WAIT_OUTBOUND_ANSWER) {
          // ✅ FIX: correct flow handler
          return outboundFlow.handleTranscript(setState, transcript);
        }
      },
    });
  });

  /* ------------------------------------------------------------------ */
  /* CLIENT AUDIO                                                        */
  /* ------------------------------------------------------------------ */
  ws.on("message", (msg) => {
    handleClientMessage({
      msg,
      oa,
      mic,
      micQueue,
      oaReady,
    });
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected (OUTBOUND)");
    try {
      oa.close();
    } catch {}
  });
});
