// buyer-intake-tts/appointment.mjs
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

const TEXT =
  "Great. I’d love to connect you with the team. We have two available consult times: option A, {{two_slot_a_human}}, or option B, {{two_slot_b_human}}. Which works better for you?";

const outPcmPath = path.join(
  __dirname,
  "../greetings/buyer-intake/appointment.pcm"
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

  ws.on("close", () => process.exit(finished ? 0 : 1));
}

main();
