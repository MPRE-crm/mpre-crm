// buyer-intake-tts/lp-5-mortgage.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OA_API_KEY = process.env.OPENAI_API_KEY;
const OA_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

const OA_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

const TEXT =
  "And for financing — will you be paying cash, or using a mortgage? If you’d like, I can also connect you with a trusted local lender. Just say sure and I will have one reach out to you for a simple, no information required conversation.";

const outPcmPath = path.join(
  __dirname,
  "../greetings/buyer-intake/lp-5-mortgage.pcm"
);

async function main() {
  if (!OA_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY");
    process.exit(1);
  }

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
          instructions: `Say exactly this:\n"${TEXT}"`,
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

    // ✅ CORRECT EVENTS FOR OFFLINE PCM
    if (data.type === "response.audio.delta" && data.delta) {
      chunks.push(Buffer.from(data.delta, "base64"));
    }

    if (data.type === "response.audio.done") {
      finished = true;
      fs.mkdirSync(path.dirname(outPcmPath), { recursive: true });
      fs.writeFileSync(outPcmPath, Buffer.concat(chunks));
      ws.close();
    }
  });

  ws.on("close", () => {
    process.exit(finished ? 0 : 1);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err);
    process.exit(1);
  });
}

main();
