// webrtc-samantha/opening1.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------
// ENV + CONSTANTS
// ------------------------
const OA_API_KEY = process.env.OPENAI_API_KEY;
const OA_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

const OA_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

const OPENING1_TEXT =
  "Hi, this is Samantha with MPRE Residential. Thanks for calling in — may I ask which area of Idaho you’re calling about today?";

const outPcmPath = path.join(
  __dirname,
  "greetings",
  "opening1-mpre-residential.pcm"
);

// ------------------------
// PCM TRIM HELPER (SAFE)
// ------------------------
function trimTrailingSilence(pcm, threshold = 300, minKeepMs = 200) {
  // PCM16 @ 24kHz  ✅ FIXED
  const SAMPLE_RATE = 24000;
  const sampleCount = pcm.length / 2;
  const minSamples = Math.floor((SAMPLE_RATE * minKeepMs) / 1000);

  let silentSamples = 0;

  for (let i = sampleCount - 1; i >= 0; i--) {
    const sample = pcm.readInt16LE(i * 2);
    if (Math.abs(sample) < threshold) {
      silentSamples++;
    } else {
      break;
    }
  }

  const keepSamples = Math.max(sampleCount - silentSamples, minSamples);
  return pcm.slice(0, keepSamples * 2);
}

// ------------------------
// MAIN
// ------------------------
async function main() {
  if (!OA_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  console.log("🎧 Connecting to OpenAI Realtime TTS for Opening1…");

  const ws = new WebSocket(OA_URL, {
    headers: {
      Authorization: `Bearer ${OA_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
      ...(OA_PROJECT_ID ? { "OpenAI-Project": OA_PROJECT_ID } : {}),
    },
  });

  const chunks = [];
  let finished = false;

  ws.on("open", () => {
    console.log("🔌 Realtime websocket open, sending session.update…");

    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          voice: "verse",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          modalities: ["audio", "text"],
          instructions:
            "You are Samantha, a warm Boise, Idaho real estate assistant. " +
            "For this request, you must read the provided sentence exactly as written.",
        },
      })
    );

    console.log("➡️ Sending response.create for strict Opening1 text…");

    const strictScript = `
For this turn, say exactly the following sentence once and nothing else.
Do NOT change any words, do NOT rephrase, and do NOT add extra commentary.

Sentence:
"${OPENING1_TEXT}"
`.trim();

    ws.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          voice: "verse",
          instructions: strictScript,
        },
      })
    );
  });

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    if (data.type === "error") {
      console.error("❌ OA ERROR:", data);
    }

    if (data.type === "response.audio.delta" && data.delta) {
      chunks.push(Buffer.from(data.delta, "base64"));
    }

    if (data.type === "response.audio.done") {
      console.log("✅ Realtime audio finished — trimming PCM tail…");
      finished = true;

      const raw = Buffer.concat(chunks);
      const trimmed = trimTrailingSilence(raw);

      fs.mkdirSync(path.join(__dirname, "greetings"), { recursive: true });
      fs.writeFileSync(outPcmPath, trimmed);

      console.log(
        `💾 Saved ${trimmed.length} bytes to ${outPcmPath} (tail trimmed)`
      );

      ws.close();
    }
  });

  ws.on("close", () => {
    if (!finished) {
      const total = chunks.reduce((n, b) => n + b.length, 0);
      console.error(
        `⚠️ WebSocket closed before Opening1 finished. Bytes captured: ${total}`
      );
      process.exit(1);
    } else {
      console.log("🔚 Opening1 PCM generation complete.");
      process.exit(0);
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err);
  });
}

main().catch((err) => {
  console.error("❌ Unhandled error in Opening1 generator:", err);
  process.exit(1);
});
