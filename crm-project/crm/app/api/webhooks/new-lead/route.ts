import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// helper to split name
function splitName(full?: string) {
  if (!full) return { first_name: null, last_name: null };
  const [first, ...rest] = full.trim().split(/\s+/);
  return { first_name: first || null, last_name: rest.length ? rest.join(" ") : null };
}

//////////////////////
// Supabase Server Client
//////////////////////
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

//////////////////////
// Phone Normalization
//////////////////////
const normalizePhone = (raw?: string) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
};

//////////////////////
// Hook / Offer -> Twilio Flow Mapping
//////////////////////
const FLOW_MAP: Record<string, string | undefined> = {
  // canonical hook names
  "relocation guide": process.env.TWILIO_FLOW_SID_RELOCATION,
  "home search tool": process.env.TWILIO_FLOW_SID_HOME_SEARCH,
  "fsbo guide": process.env.TWILIO_FLOW_SID_FSBO,

  // legacy/fallback values
  relocation_guide: process.env.TWILIO_FLOW_SID_RELOCATION,
  home_search: process.env.TWILIO_FLOW_SID_HOME_SEARCH,
  fsbo: process.env.TWILIO_FLOW_SID_FSBO,
};

const DEFAULT_FLOW_SID = process.env.TWILIO_FLOW_SID_DEFAULT;

function normalizeHookValue(raw?: string | null) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

//////////////////////
// Core Twilio Execution
//////////////////////
async function runTwilioFlow(lead: any) {
  const {
    id,
    first_name,
    last_name,
    name,
    email,
    phone,
    price_range,
    city,
    county,
    motivation,
    agent_status,
    purchase_type,
    appointment_type,
    lead_source = "Unknown",
    lead_source_detail = "Unknown",
    created_at,
  } = lead ?? {};

  const hookValue = normalizeHookValue(lead_source_detail || lead_source);
  const flowSid = FLOW_MAP[hookValue] || DEFAULT_FLOW_SID;

  console.log("--------------------------------------------------");
  console.log("📥 Incoming Lead from Supabase Realtime");
  console.log("Lead Source:", lead_source);
  console.log("Lead Source Detail:", lead_source_detail);
  console.log("Chosen Hook Value:", hookValue);
  console.log("Chosen Twilio Flow SID:", flowSid);
  console.log("Lead Data:", lead);
  console.log("--------------------------------------------------");

  if (!flowSid) {
    console.error("❌ No Twilio flow SID for lead_source_detail", lead_source_detail);
    return;
  }

  const to = normalizePhone(phone);
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!to || !from) {
    console.error("❌ Missing 'to' or 'from' phone number");
    return;
  }

  const parameters = JSON.stringify({
    lead_id: id,
    first_name,
    last_name,
    name,
    email,
    phone: to,
    price_range,
    city,
    county,
    motivation,
    agent_status,
    purchase_type,
    appointment_type,
    lead_source,
    lead_source_detail,
    created_at,
  });

  const url = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions`;
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const form = new URLSearchParams({
    To: to,
    From: from,
    Parameters: parameters,
  });

  const twilioRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!twilioRes.ok) {
    const errJson = await twilioRes.json().catch(() => ({}));
    console.error("❌ Twilio error", errJson);
    return;
  }

  const twilioJson = await twilioRes.json().catch(() => ({}));
  console.log("✅ Twilio flow executed successfully. Execution SID:", twilioJson?.sid ?? null);
}

//////////////////////
// Supabase Realtime Listener
//////////////////////
async function startLeadListener() {
  console.log("📡 Listening for new leads via Supabase Realtime...");

  supabaseServer
    .channel("public:leads")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leads" },
      async (payload) => {
        console.log("🎯 New lead detected via Realtime");

        const { first_name, last_name } = splitName(payload.new.name);
        const leadWithNames = { ...payload.new, first_name, last_name };

        if (!payload.new.first_name && !payload.new.last_name) {
          await supabaseServer
            .from("leads")
            .update({ first_name, last_name })
            .eq("id", payload.new.id);
        }

        await runTwilioFlow(leadWithNames);
      }
    )
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
    });
}

if (process.env.NODE_ENV !== "production" && !(global as any)._leadListenerStarted) {
  startLeadListener();
  (global as any)._leadListenerStarted = true;
}

//////////////////////
// POST Handler (manual / fallback)
//////////////////////
export async function POST(req: NextRequest) {
  try {
    const tokenHeader = req.headers.get("x-webhook-token") ?? "";
    const expected = process.env.WEBHOOK_SHARED_SECRET ?? "";
    if (!expected || tokenHeader !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const { first_name, last_name } = splitName(body.name);
    const leadWithNames = { ...body, first_name, last_name };

    if (!body.first_name && !body.last_name && body.id) {
      await supabaseServer
        .from("leads")
        .update({ first_name, last_name })
        .eq("id", body.id);
    }

    await runTwilioFlow(leadWithNames);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "unknown" }, { status: 500 });
  }
}