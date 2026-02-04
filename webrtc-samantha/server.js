import "dotenv/config";
import express from "express";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import fetch from "node-fetch";

import ST from "./config/states.js";
import { playPcmToClient } from "./lib/audio/pcmPlayer.js";
import { loadAllPcms } from "./lib/audio/pcms.js";
import { sendSessionUpdate } from "./lib/openai/session.js";
import {
  createCaptureContext,
  handleCompletedTranscription,
} from "./lib/capture/captureHandlers.js";
import { createFlowControllers } from "./lib/flows/flows.js";

import { createMicController } from "./mic/micController.js";
import { handleOpenAIMessage } from "./oa/oaHandlers.js";
import { handleClientMessage } from "./ws/clientHandlers.js";

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
  console.log("✅ Samantha running at https://localhost:8080")
);

/* ------------------------------------------------------------------ */
/* LOAD PCM AUDIO */
/* ------------------------------------------------------------------ */
const {
  opening1Pcm,
  opening2Pcm,
  buyerPcms,
  sellerPcms,
  investorPcms,
} = loadAllPcms(__dirname);

/* ------------------------------------------------------------------ */
/* CONNECTION */
/* ------------------------------------------------------------------ */
wss.on("connection", (ws) => {
  console.log("🌐 WebRTC client connected");

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
  let state = ST.PLAY_OPENING1;
  let allowOASpeech = false;
  let oaReady = false;
  let micQueue = [];

  const mic = createMicController(ws, oa);

  const captureCtx = createCaptureContext();

  const buyerData = {};
  const sellerData = {};
  const investorData = {};

  let phoneDigitBuffer = "";

  /* ---------------- OFF-TOPIC ---------------- */
  let buyerOffTopicCount = 0;
  const MAX_OFF_TOPIC_QUESTIONS = 5;

  function setState(s) {
    state = s;
    console.log("🧭 STATE →", s);
  }

  /* ------------------------------------------------------------------ */
  /* 🔧 FIX: unlock mic ONLY after PCM finishes (no race)                */
  /* ------------------------------------------------------------------ */
  function playBuffer(buf, label, nextState) {
    mic.lockMic();
    playPcmToClient(ws, buf, label, () => {
      setState(nextState);
      mic.unlockMic(); // ✅ REQUIRED for PCM
    });
  }

  const flows = createFlowControllers({
    ST,
    playBuffer,
    buyerPcms,
    sellerPcms,
    investorPcms,
    insertBuyerIntake: async () => {},
    insertSellerIntake: async () => {},
    insertInvestorIntake: async () => {},
    unlockMic: mic.unlockMic,
  });

  function detectIntentFromTranscript(t) {
    const s = (t || "").toLowerCase();
    if (s.includes("sell")) return "seller";
    if (s.includes("invest")) return "investor";
    return "buyer";
  }

  /* ------------------------------------------------------------------ */
  /* OFF-TOPIC RESPONSE */
  /* ------------------------------------------------------------------ */
function triggerOffTopicResponse(transcriptText) {
  const step = buyerPcms[flows.refs.buyerIdx];

  // ✅ HARD GUARD: OA may ONLY speak during contact4-questions
  if (step?.key !== "contact4-questions") {
    return; // 🚫 no freelancing
  }

  mic.lockMic();

  oa.send(
    JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        max_output_tokens: 1600,
        instructions: `
Answer clearly and completely like a knowledgeable Boise real estate professional.
After answering, ask exactly:
"Do you have any other questions before we move forward?"

Question: ${transcriptText}
          `.trim(),
      },
    })
  );
}

  /* ------------------------------------------------------------------ */
  /* OPENAI EVENTS */
  /* ------------------------------------------------------------------ */
  oa.on("open", () => {
    console.log("[Samantha] OpenAI connected");
    sendSessionUpdate(oa);
    oaReady = true;

    micQueue.forEach((pkt) => oa.send(pkt));
    micQueue = [];

    setState(ST.PLAY_OPENING1);

    playBuffer(opening1Pcm, "Opening1", ST.WAIT_AREA);
    // ✅ removed setTimeout unlock (handled by playBuffer completion)
});

  oa.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    handleOpenAIMessage({
      data,
      ws,
      oa,
      mic,
      state,
      setState,
      allowOASpeech,
      playPcmToClient,          // ✅ ADD
      onTranscript: (transcript) => {
        console.log("📝 TRANSCRIPT:", { state, transcript });

/* ------------------------------------------------------------------ */
/* ✅ FIX: off-topic loop supports MULTIPLE questions, not just one     */
/* ------------------------------------------------------------------ */
if (state === ST.WAIT_AREA) {
  allowOASpeech = false;

  setState(ST.PLAY_OPENING2);
  playBuffer(opening2Pcm, "Opening2", ST.WAIT_INTENT);
  return;
}

if (state === ST.WAIT_INTENT) {
  allowOASpeech = false;

  const intent = detectIntentFromTranscript(transcript);
  if (intent === "seller") return flows.startSellerFlow(setState);
  if (intent === "investor") return flows.startInvestorFlow(setState);
  return flows.startBuyerFlow(setState);
}

if (state === ST.WAIT_BUYER_ANSWER) {
  const step = buyerPcms[flows.refs.buyerIdx];
  
  if (step?.key !== "contact3-phone") phoneDigitBuffer = "";

  if (step?.key === "contact1-name") {
    buyerData.name = transcript;
    flows.refs.buyerIdx++;
    return flows.playNextBuyerStep(setState);
  }

  if (step?.key === "contact2-email") {
    buyerData.email = transcript;
    flows.refs.buyerIdx++;
    return flows.playNextBuyerStep(setState);
  }

  if (step?.key === "contact3-phone") {
    phoneDigitBuffer += transcript.replace(/\D/g, "");
    if (phoneDigitBuffer.length < 10) return;
    buyerData.phone = phoneDigitBuffer;
    phoneDigitBuffer = "";
    flows.refs.buyerIdx++;
    return flows.playNextBuyerStep(setState);
  }

if (step?.key === "contact4-questions") {
  const s = transcript.toLowerCase();

  // ✅ NO-QUESTION SHORT-CIRCUIT → go straight to lp-1
  if (
    s.includes("no questions") ||
    s.includes("don't have any") ||
    s.includes("do not have any") ||
    s.includes("none") ||
    s.includes("nope") ||
    s.includes("i'm good") ||
    s.includes("all set")
  ) {
    buyerOffTopicCount = 0;
    allowOASpeech = false;
    return flows.advanceBuyerStep(setState); // → lp-1
  }

  // existing logic stays intact
  buyerOffTopicCount++;

  if (buyerOffTopicCount >= MAX_OFF_TOPIC_QUESTIONS) {
    buyerOffTopicCount = 0;
    allowOASpeech = false;
    return flows.advanceBuyerStep(setState); // → lp-1
  }

  allowOASpeech = true;
  return triggerOffTopicResponse(transcript);
  }
}

handleCompletedTranscription({
  data,
  state,
  ST,
  ctx: captureCtx,
  setState,

  buyerData,
  sellerData,
  investorData,

  buyerPcms,
  sellerPcms,
  investorPcms,

  refs: flows.refs,

  // 🔑 THESE WERE MISSING
  playNextBuyerStep: flows.playNextBuyerStep,
  playNextSellerStep: flows.playNextSellerStep,
  playNextInvestorStep: flows.playNextInvestorStep,

  startBuyerFlow: flows.startBuyerFlow,
  startSellerFlow: flows.startSellerFlow,
  startInvestorFlow: flows.startInvestorFlow,

  triggerOffTopicResponse,
      });
    },
    });
  });

  /* ------------------------------------------------------------------ */
  /* CLIENT AUDIO */
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
    console.log("❌ Client disconnected");
    try {
      oa.close();
    } catch {}
  });
});
