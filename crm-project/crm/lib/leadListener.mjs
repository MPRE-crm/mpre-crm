import { createClient } from "@supabase/supabase-js";

// Read env safely (bracket access avoids TS/ESLint complaints in JS)
const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] || process.env["SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const TWILIO_FROM_NUMBER = process.env["TWILIO_FROM_NUMBER"];
const TWILIO_ACCOUNT_SID = process.env["TWILIO_ACCOUNT_SID"];
const TWILIO_AUTH_TOKEN = process.env["TWILIO_AUTH_TOKEN"];

const FLOW_MAP = {
  relocation_guide: process.env["TWILIO_FLOW_SID_RELOCATION"],
  home_search: process.env["TWILIO_FLOW_SID_HOME_SEARCH"],
  fsbo: process.env["TWILIO_FLOW_SID_FSBO"],
};
const DEFAULT_FLOW_SID = process.env["TWILIO_FLOW_SID_DEFAULT"];

// If critical env is missing, bail gracefully (don’t crash dev server)
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠️ leadListener: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Listener not started.");
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  const normalizePhone = (raw) => {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.startsWith("+")) return digits;
    return `+${digits}`;
  };

  async function runTwilioFlow(lead) {
    const flowSid = FLOW_MAP[lead.lead_source] || DEFAULT_FLOW_SID;
    console.log("🎯 New lead detected:", lead);
    console.log("Lead Source:", lead.lead_source);
    console.log("Chosen Flow SID:", flowSid);
    if (!flowSid) return;

    const to = normalizePhone(lead.phone);
    const from = TWILIO_FROM_NUMBER;
    if (!to || !from) {
      console.error("❌ Missing To/From");
      return;
    }

    const url = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const parameters = JSON.stringify(lead);
    const form = new URLSearchParams({ To: to, From: from, Parameters: parameters });

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error("❌ Twilio error", j);
    } else {
      const j = await res.json().catch(() => ({}));
      console.log("✅ Twilio flow executed. Execution SID:", j?.sid ?? null);
    }
  }

  function start() {
    if (globalThis._leadListenerStarted) return;
    globalThis._leadListenerStarted = true;

    console.log("📡 Listening for new leads via Supabase Realtime...");
    supabase
      .channel("public:leads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        runTwilioFlow(payload.new);
      })
      .subscribe((status) => console.log("Realtime subscription status:", status));
  }

  start();
}
