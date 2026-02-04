// crm-project/crm/app/api/twilio/core/ai-media-stream/bridge/route.ts
export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";
// 🔹 Import Samantha’s opening prompt (corrected path)
import SAMANTHA_OPENING_TRIAGE from "../../../../../lib/prompts/opening.js";

// ---- Supabase (service role for server-side writes) ----
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- OpenAI Realtime WS ----
function getOpenAIWS(apiKey: string) {
  return new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
    ["openai-beta.realtime-v1", `openai-insecure-api-key.${apiKey}`]
  );
}

// ---- Helpers ----
function decodeB64(s?: string | null) {
  if (!s) return undefined;
  try {
    if (typeof atob === "function") {
      return new TextDecoder().decode(
        Uint8Array.from(atob(s), (c: string) => c.charCodeAt(0))
      );
    }
  } catch {}
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "base64").toString("utf8");
  }
  return s;
}

function toE164(p?: string | null) {
  if (!p) return null;
  const digits = String(p).replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+1${digits}`;
}

function extractJsonBlocks(tag: string, text: string): any[] {
  const re = new RegExp(`<${tag}>\\s*({[\\s\\S]*?})\\s*</${tag}>`, "g");
  const out: any[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {}
  }
  return out;
}

// ---------------- Route: WebSocket bridge ----------------
export async function GET(req: Request) {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { searchParams } = new URL(req.url);
  let leadId = searchParams.get("id") || "";
  let orgId: string | null = searchParams.get("org_id");
  let callSid: string | null = null;
  let flow: string | null = null;

  const apiKey = process.env.OPENAI_API_KEY!;
  if (!apiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

  const pair = new (globalThis as any).WebSocketPair();
  const twilioSocket = pair[0] as WebSocket;
  const serverSide = pair[1] as WebSocket;

  const oaSocket = getOpenAIWS(apiKey);
  let currentTextBuffer = "";

  // 🔹 Buffer audio from Twilio before sending to OA
  let pendingAudio: string[] = [];
  let frameCount = 0;

  // ---- Send Samantha opening immediately ----
  oaSocket.addEventListener("open", () => {
    console.log("[oa] connected, sending opening.js triage");
    oaSocket.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: SAMANTHA_OPENING_TRIAGE,
          modalities: ["audio", "text"],
          audio: { voice: "alloy" },
        },
      })
    );
  });

  // ---- OpenAI → Twilio ----
  oaSocket.addEventListener("message", async (ev) => {
    let data: any;
    try {
      data = JSON.parse(ev.data.toString());
    } catch {
      return;
    }

    if (data?.type === "output_audio.delta" && data?.audio) {
      // 🔊 Forward audio back to Twilio
      twilioSocket.send(
        JSON.stringify({ event: "media", media: { payload: data.audio } })
      );
    }

    const textDelta =
      (data?.type === "response.output_text.delta" && data?.delta) ||
      (data?.type === "response.delta" && data?.delta);
    if (typeof textDelta === "string" && textDelta.length)
      currentTextBuffer += textDelta;

    if (data?.type === "response.completed") {
      console.log(`[oa] response completed, flow=${flow}`);
      currentTextBuffer = "";
      twilioSocket.send(
        JSON.stringify({ event: "mark", name: "response_completed" })
      );
    }
  });

  // ---- Twilio → OpenAI ----
  twilioSocket.addEventListener("message", (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
    } catch {
      return;
    }

    if (msg.event === "start") {
      const custom = msg.start?.customParameters || {};
      const metaB64 = custom.meta_b64 || null;
      if (typeof metaB64 === "string") {
        const decoded = decodeB64(metaB64);
        if (decoded) {
          try {
            const meta = JSON.parse(decoded);
            if (meta.lead_id) leadId = String(meta.lead_id);
            if (meta.org_id) orgId = String(meta.org_id);
            if (meta.call_sid) callSid = String(meta.call_sid);
            if (meta.flow) flow = String(meta.flow);
          } catch {}
        }
      }
      console.log(`[twilio] start received, flow=${flow}`);
    }

    if (msg.event === "media" && msg.media?.payload) {
      pendingAudio.push(msg.media.payload);
      frameCount++;
      if (frameCount >= 5) {
        oaSocket.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pendingAudio.join(""),
          })
        );
        oaSocket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        frameCount = 0;
        pendingAudio = [];
      }
    }

    if (msg.event === "stop") {
      console.log("[twilio] stop received");
      try {
        oaSocket.close();
        twilioSocket.close();
      } catch {}
    }
  });

  (serverSide as any).accept();
  return new Response(null, {
    status: 101,
    webSocket: twilioSocket,
  } as any);
}
