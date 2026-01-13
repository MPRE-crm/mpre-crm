// buyer-intake.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OA_API_KEY = process.env.OPENAI_API_KEY;
const OA_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

const OA_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

const inputText = process.argv[2]; // Getting the input (like "First Name", "Email Address", etc.)
const outputPath = process.argv[4]; // Path to save the PCM file

// Example input steps to convert (step by step)
const buyerIntakeSteps = {
  "First Name": "What is your first name?",
  "Email Address": "What is your email address?",
  "Phone Number": "What is your phone number?",
  "Confim": "Great, let me confirm I have that correct",
  "Location": "Which location are you interested in?",
  "Price Range": "What is your price range?",
  "Motivation": "What is your motivation for buying?",
  "Agent": "Are you already working with an agent?",
  "Mortgage": "Are you planning to pay in cash or finance the property?",
  "Appointment": "Can we schedule an appointment for you?",
  "Close": "Great, we will follow up with the details soon."
};

// Replace with correct text depending on the input received
const inputTextForPCM = buyerIntakeSteps[inputText] || inputText;

const outPcmPath = path.join(__dirname, "greetings", outputPath);

async function main() {
  if (!OA_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  console.log(`🎧 Connecting to OpenAI Realtime TTS for ${inputText}…`);

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
            "You are Samantha, a warm Boise, Idaho real estate assistant. Please speak naturally and concisely. " +
            `For this turn, say: "${inputTextForPCM}"`,
        },
      })
    );

    console.log(`➡️ Sending response.create for strict ${inputText} text…`);

    ws.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          voice: "verse",
          instructions: `Please say: "${inputTextForPCM}"`,
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

    // ✅ FIXED: updated Realtime event name
    if (data.type === "response.output_audio.delta" && data.delta) {
      const buf = Buffer.from(data.delta, "base64");
      chunks.push(buf);
    }

    // ✅ FIXED: updated Realtime event name
    if (data.type === "response.output_audio.done") {
      console.log(`✅ Realtime audio for ${inputText} finished, writing file…`);
      finished = true;

      const pcm = Buffer.concat(chunks);
      fs.mkdirSync(path.join(__dirname, "greetings"), { recursive: true });
      fs.writeFileSync(outPcmPath, pcm);

      console.log(
        `💾 Saved ${pcm.length} bytes to ${outPcmPath} (raw PCM16 from Realtime)`
      );

      ws.close();
    }
  });

  ws.on("close", () => {
    if (!finished) {
      const total = chunks.reduce((n, b) => n + b.length, 0);
      console.error(
        `⚠️ WebSocket closed before ${inputText} was finished. Bytes captured so far: ${total}`
      );
      process.exit(1);
    } else {
      console.log(`🔚 Realtime TTS capture complete for ${inputText}.`);
      process.exit(0);
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err);
  });
}

main().catch((err) => {
  console.error("❌ Unhandled error in Buyer Intake generator:", err);
  process.exit(1);
});
