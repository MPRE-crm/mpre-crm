// crm-project/crm/app/api/twilio/core/ai-media-stream/bridge/route.ts
export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";

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
    // @ts-ignore
    if (typeof atob === "function") {
      // @ts-ignore
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

function splitIso(dt?: string | null): { d: string | null; t: string | null } {
  if (!dt) return { d: null, t: null };
  const m = new Date(dt);
  if (isNaN(m.getTime())) return { d: null, t: null };
  const d = m.toISOString().slice(0, 10);
  const t = m.toTimeString().slice(0, 5); // "HH:MM"
  return { d, t };
}

// ---------------- Investor Intake persistence ----------------
type InvestorState = {
  intent?: "invest";
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  price_cap?: number | null;
  min_cap_rate?: number | null;
  cash_or_finance?: string | null;
  units?: number | null;
  property_type?: string | null;
  markets?: string | null;
  wants_1031?: boolean | null;
  timeline?: string | null;
  notes?: string | null;
};
type InvestorAppt = {
  choice?: "A" | "B";
  slot_iso?: string | null;
  slot_human?: string | null;
};

async function upsertInvestorIntake(row: {
  org_id: string | null;
  lead_id: string | null;
  call_sid: string | null;
  state?: InvestorState | null;
  appointment?: InvestorAppt | null;
  end_result?: string | null;
}) {
  const payload: Record<string, any> = {
    org_id: row.org_id,
    lead_id: row.lead_id,
    call_sid: row.call_sid,
    updated_at: new Date().toISOString(),
  };

  const s = row.state || {};
  if (Object.keys(s).length) {
    payload.price_cap = s.price_cap ?? null;
    payload.min_cap_rate = s.min_cap_rate ?? null;
    payload.cash_or_finance = s.cash_or_finance ?? null;
    payload.units = s.units ?? null;
    payload.property_type = s.property_type ?? null;
    payload.markets = s.markets ?? null;
    payload.wants_1031 = s.wants_1031 ?? null;
    payload.timeline = s.timeline ?? null;
    payload.notes = s.notes ?? null;
  }

  const a = row.appointment || {};
  if (a.slot_iso) payload.appointment_iso = a.slot_iso;
  if (a.slot_human) payload.appointment_human = a.slot_human;

  if (row.end_result) payload.end_result = row.end_result;

  const { error } = await supabase
    .from("investor_intake")
    .upsert(payload, { onConflict: "call_sid" });
  if (error) console.warn("❌ investor_intake upsert:", error.message);
}

async function maybeUpdateLeadContact(
  leadId?: string | null,
  state?: InvestorState | null
) {
  if (!leadId || !state) return;
  const patch: Record<string, any> = {};
  if (state.name) patch.name = state.name;
  if (state.email) patch.email = state.email;
  if (state.phone) patch.phone = toE164(state.phone);

  if (Object.keys(patch).length) {
    const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
    if (error) console.warn("❌ leads update (investor) failed:", error.message);
  }
}

// ---------------- Buyer/Seller intake persistence ----------------
type IntakeCapture = {
  intent?: "buy" | "sell" | "invest";
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  from_location?: string | null;
  area?: string | null;
  timeline?: string | null;
  price?: string | null;
  price_expectation?: string | null;
  financing?: "cash" | "finance" | null;
  has_agent?: boolean | null;
  represented_elsewhere?: boolean | null;
  motivation?: string | null;
  appointment_at?: string | null; // ISO
  notes?: string | null;
};

async function persistIntake(
  leadId: string,
  orgId: string | null,
  intake: IntakeCapture
) {
  // (same as your existing persistIntake function — unchanged)
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

  // 🔹 Audio buffer for Twilio → OpenAI
  let pendingAudio: string[] = [];
  let frameCount = 0;

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

  // 🔑 Immediate Samantha greeting
  oaSocket.addEventListener("open", () => {
    const greeting =
      "Hi, this is Samantha with MPRE Residential. Thanks for calling! May I start by asking your name?";
    oaSocket.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: greeting,
          modalities: ["audio", "text"],
          audio: { voice: "alloy" },
        },
      })
    );
  });

  // ---- OpenAI → Twilio + Persistence ----
  oaSocket.addEventListener("message", async (ev) => {
    let data: any;
    try {
      data = JSON.parse(ev.data.toString());
    } catch {
      return;
    }

    if (data?.type === "output_audio.delta" && data?.audio) {
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
      try {
        if (flow === "investor") {
          const states = extractJsonBlocks("STATE", currentTextBuffer) as InvestorState[];
          if (states.length) {
            const last = states[states.length - 1];
            await upsertInvestorIntake({
              org_id: orgId,
              lead_id: leadId,
              call_sid: callSid,
              state: last,
            });
            await maybeUpdateLeadContact(leadId, last);
          }
          const appts = extractJsonBlocks("APPOINTMENT", currentTextBuffer) as InvestorAppt[];
          if (appts.length) {
            const last = appts[appts.length - 1];
            await upsertInvestorIntake({
              org_id: orgId,
              lead_id: leadId,
              call_sid: callSid,
              appointment: last,
            });
          }
        } else {
          const captures = extractJsonBlocks("STATE", currentTextBuffer) as IntakeCapture[];
          if (captures.length) {
            const last = captures[captures.length - 1];
            await persistIntake(leadId, orgId, last);
          }
        }
      } catch (e) {
        console.error("Marker parse/persist failed:", e);
      } finally {
        twilioSocket.send(
          JSON.stringify({ event: "mark", name: "response_completed" })
        );
        currentTextBuffer = "";
      }
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
      let meta: any = null;
      if (typeof metaB64 === "string") {
        const decoded = decodeB64(metaB64);
        if (decoded) {
          try {
            meta = JSON.parse(decoded);
          } catch {}
        }
      }

      if (meta) {
        if (meta.lead_id) leadId = String(meta.lead_id);
        if (meta.org_id) orgId = String(meta.org_id);
        if (meta.call_sid) callSid = String(meta.call_sid);
        if (meta.flow) flow = String(meta.flow);
      }
    }

    if (msg.event === "media" && msg.media?.payload) {
      pendingAudio.push(msg.media.payload);
      frameCount++;

      // Commit when ~5 frames (~100ms) collected
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
