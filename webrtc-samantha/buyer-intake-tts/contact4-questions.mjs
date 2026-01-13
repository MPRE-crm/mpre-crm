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

// 🔊 OFF-TOPIC QUESTION WINDOW OPENING
const TEXT =
  "Perfect, thanks for that. Before we get started, do you have any questions I can answer for you right now? " +
  "I’m happy to help — and once we begin, I’ll ask a few quick questions to make sure we cover everything important.";

const outPcmPath = path.join(
  __dirname,
  "../greetings/buyer-intake/contact4-questions.pcm"
);

async function main() {
  if (!OA_API_KEY) throw new Error("Missing OPENAI_API_KEY");

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
          instructions: "Read the provided sentence exactly as written.",
        },
      })
    );

    const strictScript = `Say exactly this:\n"${TEXT}"`;

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

    // ✅ UPDATED REALTIME EVENT NAMES
    if (data.type === "response.output_audio.delta" && data.delta) {
      chunks.push(Buffer.from(data.delta, "base64"));
    }

    if (data.type === "response.output_audio.done") {
      finished = true;
      fs.mkdirSync(path.dirname(outPcmPath), { recursive: true });
      fs.writeFileSync(outPcmPath, Buffer.concat(chunks));
      ws.close();
    }
  });

  ws.on("close", () => {
    process.exit(finished ? 0 : 1);
  });
}

main();
