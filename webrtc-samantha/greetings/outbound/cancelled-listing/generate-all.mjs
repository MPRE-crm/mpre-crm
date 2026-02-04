import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";

/* ------------------------------------------------------------------ */
/* PATHS */
/* ------------------------------------------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OA_API_KEY = process.env.OPENAI_API_KEY;
const OA_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

if (!OA_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}

const OA_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

/* ------------------------------------------------------------------ */
/* STEPS (CANCELLED LISTING) */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    file: "opening.pcm",
    text:
      "Hi, this is Samantha calling on behalf of MPRE Boise. I’m reaching out because your home was recently listed and then taken off the market. I’m not calling to pressure you — I just wanted to ask a quick question and see if I can be helpful.",
  },
  {
    file: "verify-owner.pcm",
    text:
      "Before I go any further, I just want to make sure I’m speaking with the owner of the property.",
  },
  {
    file: "empathy.pcm",
    text:
      "I know relisting decisions can be frustrating, especially after putting time and effort into the process.",
  },
  {
    file: "reason-for-cancel.pcm",
    text:
      "Do you mind sharing what ultimately led you to take the home off the market?",
  },
  {
    file: "timeline.pcm",
    text:
      "Have you decided if selling is still something you’re considering in the near future, or are you putting things on pause for now?",
  },
  {
    file: "motivation.pcm",
    text:
      "What would need to change for you to feel confident about moving forward again?",
  },
  {
    file: "value-prop.pcm",
    text:
      "What we’ve found is that most cancelled listings come down to strategy, not the home itself, and that’s something we help fix every day.",
  },
  {
    file: "appointment.pcm",
    text:
      "If it makes sense, I’d be happy to set up a quick, no-pressure call to walk through options and see if it’s even worth revisiting.",
  },
  {
    file: "objection-not-interested.pcm",
    text:
      "Totally fair — I appreciate you letting me know. If anything changes down the road, feel free to reach out.",
  },
  {
    file: "objection-already-sold.pcm",
    text:
      "Got it — congratulations on getting that taken care of. I appreciate your time today.",
  },
  {
    file: "objection-working-with-agent.pcm",
    text:
      "That makes sense. I’m not here to step on anyone’s toes — I just wanted to be respectful and check in.",
  },
  {
    file: "close.pcm",
    text:
      "Thanks again for taking a moment to talk with me. I hope the rest of your day goes great.",
  },
];

/* ------------------------------------------------------------------ */
/* GENERATOR */
/* ------------------------------------------------------------------ */
async function generateOne(step) {
  return new Promise((resolve, reject) => {
    console.log("🎙️ Generating", step.file);

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
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: "verse",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            modalities: ["audio", "text"],
            instructions:
              "Read the provided sentence exactly as written. Do not add or remove words.",
          },
        })
      );

      ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            voice: "verse",
            instructions: `Say exactly this:\n"${step.text}"`,
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

      if (data.type === "response.audio.delta" && data.delta) {
        chunks.push(Buffer.from(data.delta, "base64"));
      }

      if (data.type === "response.audio.done") {
        finished = true;
        const outPath = path.join(__dirname, step.file);
        fs.writeFileSync(outPath, Buffer.concat(chunks));
        ws.close();
      }
    });

    ws.on("close", () => {
      if (finished) {
        console.log("   bytes:", Buffer.concat(chunks).length);
        resolve();
      } else {
        reject(new Error("❌ Audio generation failed"));
      }
    });

    ws.on("error", reject);
  });
}

/* ------------------------------------------------------------------ */
/* RUN ALL */
/* ------------------------------------------------------------------ */
async function generateAll() {
  for (const step of STEPS) {
    await generateOne(step);
  }
  console.log("✅ All cancelled-listing PCM files generated (Realtime PCM16)");
}

generateAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
