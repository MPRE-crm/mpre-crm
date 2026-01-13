// investor-intake.mjs
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

const inputText = process.argv[2]; // e.g. "Contact Name", "Market Focus"
const outputPath = process.argv[4]; // e.g. "investor-intake/i01-contact-name.pcm"

// Investor intake steps (one-to-one with your PCM files)
const investorIntakeSteps = {
  "Contact Name": "Before we get started, may I have your first and last name?",
  "Phone Number": "What’s the best phone number to reach you on, and is it okay to call or text you there?",
  "Email Address": "What’s the best email address for confirmations and updates? I can spell it back if needed.",
  "Market Focus": "Which Idaho area are you focused on — Boise, Coeur d'Alene, Idaho Falls, Twin Falls, or another area?",
  "Property Type": "What type of properties are you looking for, such as single family rentals or multifamily?",
  "Units Budget": "How many units are you targeting, and do you have a general budget range in mind?",
  "Capital Structure": "Are you planning to purchase with cash, financing, a 1031 exchange, or a combination?",
  "Goals Returns": "What are your primary goals with this investment — cash flow, appreciation, tax strategy, or diversification?",
  "Timeline Experience": "What does your timeline look like, and do you have prior investing experience?",
  "Appointment": "The next step is a quick call with a local investment specialist. Would option A or option B work better for you?",
  "Close": "Perfect. I’ll pass this along and you’ll be connected with the right specialist. Thanks for calling today."
};

// Resolve correct text
const inputTextForPCM = investorIntakeSteps[inputText] || inputText;

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
            "You are Samantha, a warm Idaho real estate investment assistant. Please speak naturally and concisely. " +
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
  console.error("❌ Unhandled error in Investor Intake generator:", err);
  process.exit(1);
});
