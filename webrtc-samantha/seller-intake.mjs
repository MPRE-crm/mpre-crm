// seller-intake.mjs
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

const inputText = process.argv[2]; // e.g. "Contact Name", "Property Address"
const outputPath = process.argv[4]; // e.g. "seller-intake/s01-contact-name.pcm"

// Seller intake steps (PCM-safe, one question per step)
const sellerIntakeSteps = {
  "Contact Name": "Before we get started, may I have your first and last name?",
  "Phone Number": "What’s the best mobile number to reach you on, and is it okay to text you there?",
  "Email Address": "What’s the best email address for you? I’ll spell it back to make sure I have it right.",
  "Property Address": "What’s the street address and city of the home you’re thinking about selling?",
  "Property Details": "How many bedrooms and bathrooms does the home have, and about how many square feet?",
  "Timeline": "Ideally, when would you like to list the home or make your move?",
  "Motivation": "What’s prompting the sale right now?",
  "Agent Status": "Are you currently listed with another agent or working with someone already?",
  "Appointment": "The next step is a short consultation with the listing specialist. Would option A or option B work better for you?",
  "Close": "Perfect. I’ll pass this along and you’ll be all set for the next step. Thanks for calling today."
};

// Resolve text
const inputTextForPCM = sellerIntakeSteps[inputText] || inputText;

// Output PCM path
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

    if (data.type === "response.audio.delta" && data.delta) {
      chunks.push(Buffer.from(data.delta, "base64"));
    }

    if (data.type === "response.audio.done") {
      console.log(`✅ Realtime audio for ${inputText} finished, writing file…`);
      finished = true;

      const pcm = Buffer.concat(chunks);
      fs.mkdirSync(path.dirname(outPcmPath), { recursive: true });
      fs.writeFileSync(outPcmPath, pcm);

      console.log(`💾 Saved ${pcm.length} bytes to ${outPcmPath}`);
      ws.close();
    }
  });

  ws.on("close", () => {
    if (!finished) {
      const total = chunks.reduce((n, b) => n + b.length, 0);
      console.error(
        `⚠️ WebSocket closed before ${inputText} finished. Bytes so far: ${total}`
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
  console.error("❌ Unhandled error in Seller Intake generator:", err);
  process.exit(1);
});
