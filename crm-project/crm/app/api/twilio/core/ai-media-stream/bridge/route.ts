// app/api/twilio/core/ai-media-stream/bridge/route.ts
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
      return new TextDecoder().decode(Uint8Array.from(atob(s), (c: string) => c.charCodeAt(0)));
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

// ---------------- Investor Intake inline persistence ----------------
type InvestorState = {
  intent?: "invest";
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  price_cap?: number | null;
  min_cap_rate?: number | null;
  cash_or_finance?: string | null; // 'cash' | 'finance' | 'mixed'
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
  // Align to your investor_intake columns (no name/email/phone columns there)
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

async function maybeUpdateLeadContact(leadId?: string | null, state?: InvestorState | null) {
  if (!leadId || !state) return;
  const patch: Record<string, any> = {};
  if (state.name) patch.name = state.name; // your leads table has `name`
  if (state.email) patch.email = state.email;
  if (state.phone) patch.phone = toE164(state.phone);

  if (Object.keys(patch).length) {
    const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
    if (error) console.warn("❌ leads update (investor) failed:", error.message);
  }
}

// ---------------- Buyer/Seller intake (existing) ----------------
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
  consent_sms?: boolean | null;
  consent_email?: boolean | null;
  appointment_at?: string | null; // ISO
  notes?: string | null;
};

async function persistIntake(leadId: string, orgId: string | null, intake: IntakeCapture) {
  const patch: Record<string, any> = {
    first_name: intake.first_name ?? undefined,
    last_name: intake.last_name ?? undefined,
    email: intake.email ?? undefined,
    phone: intake.phone ? toE164(intake.phone) : undefined,
    city: intake.from_location ?? undefined,
    motivation: intake.motivation ?? undefined,
    agent_status:
      intake.has_agent === true
        ? "has_our_agent"
        : intake.represented_elsewhere
        ? "represented_elsewhere"
        : undefined,
    purchase_type: intake.intent ?? undefined,
    updated_at: new Date().toISOString(),
  };

  const priceNote =
    intake.price_expectation || intake.price ? `Price: ${intake.price_expectation || intake.price}` : null;

  const { d: apptDate, t: apptTime } = splitIso(intake.appointment_at || undefined);
  if (apptDate) patch.appointment_date = apptDate;
  if (apptTime) patch.appointment_time = apptTime;

  const extraNotes: string[] = [];
  if (!patch.city && intake.area) patch.city = intake.area;
  else if (intake.area) extraNotes.push(`Area: ${intake.area}`);
  if (intake.timeline) extraNotes.push(`Timeline: ${intake.timeline}`);
  if (priceNote) extraNotes.push(priceNote);
  if (intake.notes) extraNotes.push(intake.notes);

  if (extraNotes.length) {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("notes")
      .eq("id", leadId)
      .maybeSingle();
    const merged = [leadRow?.notes, extraNotes.join(" | ")].filter(Boolean).join(" | ").slice(0, 1000);
    patch.notes = merged;
  }

  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  if (Object.keys(patch).length) {
    const { error: leadErr } = await supabase.from("leads").update(patch).eq("id", leadId);
    if (leadErr) console.error("❌ leads update error:", leadErr.message);
  }

  if (!intake.intent || intake.intent === "buy") {
    const nums = (intake.price || "").match(/\$?\s?(\d{2,3}(?:[.,]?\d{3})*)/g) || [];
    const parsed = nums.map((s) => Number(s.replace(/[^0-9]/g, ""))).filter((n) => Number.isFinite(n));
    const price_min = parsed.length ? Math.min(...parsed) : null;
    const price_max = parsed.length > 1 ? Math.max(...parsed) : null;

    const { error: idxErr } = await supabase.from("idx_search_requests").insert([
      {
        lead_id: leadId,
        org_id: orgId,
        params: { area: intake.area ?? null, price_min, price_max },
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);
    if (idxErr) console.error("❌ idx_search_requests insert error:", idxErr.message);
  }

  const { error: assignErr } = await supabase.from("lead_assignments").upsert(
    {
      lead_id: leadId,
      org_id: orgId,
      assigned_user_id: null,
      source: "inbound_call",
      status: "pending",
      ack_deadline_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      notes: intake.intent ? `Intent: ${intake.intent}` : "Samantha completed intake",
      created_at: new Date().toISOString(),
    },
    { onConflict: "lead_id" }
  );
  if (assignErr) console.error("❌ lead_assignments upsert error:", assignErr.message);
}

// ---------------- Route: WebSocket bridge ----------------
export async function GET(req: Request) {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { searchParams } = new URL(req.url);
  let leadId = searchParams.get("id") || "";
  let orgId: string | null = searchParams.get("org_id");
  let systemPromptB64 = searchParams.get("systemPrompt") || undefined;

  let callSid: string | null = null;
  let flow: string | null = null;

  const apiKey = process.env.OPENAI_API_KEY!;
  if (!apiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

  const pair = new (globalThis as any).WebSocketPair();
  const twilioSocket = pair[0] as WebSocket;
  const serverSide = pair[1] as WebSocket;

  const oaSocket = getOpenAIWS(apiKey);

  // --- text assembly for marker parsing ---
  let currentTextBuffer = "";

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

  oaSocket.addEventListener("open", () => {
    const prompt = decodeB64(systemPromptB64);
    if (prompt) {
      oaSocket.send(
        JSON.stringify({
          type: "response.create",
          response: { instructions: prompt, modalities: ["audio", "text"], audio: { voice: "alloy" } },
        })
      );
    }
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
      twilioSocket.send(JSON.stringify({ event: "media", media: { payload: data.audio } }));
    }

    const textDelta =
      (data?.type === "response.output_text.delta" && data?.delta) ||
      (data?.type === "response.delta" && data?.delta);
    if (typeof textDelta === "string" && textDelta.length) {
      currentTextBuffer += textDelta;
    }

    if (data?.type === "response.completed") {
      try {
        const states = extractJsonBlocks("STATE", currentTextBuffer) as InvestorState[];
        if (states.length) {
          const last = states[states.length - 1];
          await upsertInvestorIntake({
            org_id: orgId || null,
            lead_id: leadId || null,
            call_sid: callSid,
            state: last,
          });
          await maybeUpdateLeadContact(leadId, last);
        }

        const appts = extractJsonBlocks("APPOINTMENT", currentTextBuffer) as InvestorAppt[];
        if (appts.length) {
          const last = appts[appts.length - 1];
          await upsertInvestorIntake({
            org_id: orgId || null,
            lead_id: leadId || null,
            call_sid: callSid,
            appointment: last,
          });
          if (last.slot_iso) {
            const { d, t } = splitIso(last.slot_iso);
            const patch: Record<string, any> = {};
            if (d) patch.appointment_date = d;
            if (t) patch.appointment_time = t;
            if (Object.keys(patch).length) {
              await supabase.from("leads").update(patch).eq("id", leadId || "");
            }
          }
        }

        const ends = extractJsonBlocks("END", currentTextBuffer) as Array<{ result?: string }>;
        if (ends.length) {
          const last = ends[ends.length - 1];
          await upsertInvestorIntake({
            org_id: orgId || null,
            lead_id: leadId || null,
            call_sid: callSid,
            end_result: last?.result || null,
          });
        }
      } catch (e) {
        console.error("Marker parse/persist failed:", e);
      } finally {
        twilioSocket.send(JSON.stringify({ event: "mark", name: "response_completed" }));
        currentTextBuffer = "";
      }
    }

    // Tool events (buyer/seller)
    try {
      const maybeItems = data?.response?.output || data?.item || data;
      const items = Array.isArray(maybeItems) ? maybeItems : [maybeItems];

      for (const item of items) {
        const isTool =
          item?.type === "tool" &&
          (item?.name === "intake.capture" || item?.name === "lpmama.capture");

        if (isTool) {
          const content = item?.content?.[0];
          if (content?.type === "input_text" && typeof content?.text === "string") {
            try {
              const parsed: IntakeCapture = JSON.parse(content.text);
              await persistIntake(leadId, orgId, parsed);
            } catch (e) {
              console.error("intake.capture JSON parse failed", e);
            }
          }
        }
      }
    } catch {}
  });

  oaSocket.addEventListener("close", () => {
    try {
      twilioSocket.close();
    } catch {}
  });

  oaSocket.addEventListener("error", () => {
    try {
      twilioSocket.close();
    } catch {}
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

      const metaRaw = custom.meta || custom.Meta || null;
      const metaB64 = custom.meta_b64 || custom.MetaB64 || null;

      let meta: any = null;
      if (typeof metaRaw === "string") {
        try { meta = JSON.parse(metaRaw); } catch {}
      }
      if (!meta && typeof metaB64 === "string") {
        const decoded = decodeB64(metaB64);
        if (decoded) {
          try { meta = JSON.parse(decoded); } catch {}
        }
      }

      if (meta && typeof meta === "object") {
        if (meta.lead_id) leadId = String(meta.lead_id);
        if (meta.org_id) orgId = String(meta.org_id);
        if (meta.call_sid) callSid = String(meta.call_sid);
        if (meta.flow) flow = String(meta.flow);

        if (meta.prompt && oaSocket.readyState === WebSocket.OPEN) {
          oaSocket.send(
            JSON.stringify({
              type: "response.create",
              response: { instructions: String(meta.prompt), modalities: ["audio", "text"], audio: { voice: "alloy" } },
            })
          );
        }

        upsertInvestorIntake({
          org_id: orgId || null,
          lead_id: leadId || null,
          call_sid: callSid || null,
          state: meta.lead_prefill || null,
        }).catch(() => {});
      }

      if (custom.systemPrompt && oaSocket.readyState === WebSocket.OPEN) {
        const prompt = decodeB64(custom.systemPrompt);
        if (prompt) {
          oaSocket.send(
            JSON.stringify({
              type: "response.create",
              response: { instructions: prompt, modalities: ["audio", "text"], audio: { voice: "alloy" } },
            })
          );
        }
      }
    }

    if (msg.event === "media" && msg.media?.payload) {
      oaSocket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: msg.media.payload }));
      oaSocket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      oaSocket.send(JSON.stringify({ type: "response.create" }));
    }

    if (msg.event === "stop") {
      try {
        oaSocket.close();
        twilioSocket.close();
      } catch {}
    }
  });

  (serverSide as any).accept();
  return new Response(null, { status: 101, webSocket: twilioSocket } as any);
}
