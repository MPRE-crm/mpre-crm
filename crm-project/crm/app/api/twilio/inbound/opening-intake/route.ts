// crm-project/crm/app/api/twilio/inbound/opening-intake/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import SAMANTHA_OPENING_TRIAGE from "../../../../lib/prompts/opening.js";

export const runtime = "edge"; // Must be edge for Twilio latency

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

function toB64(s: string) {
  return Buffer.from(s, "utf8").toString("base64");
}

async function readParams(req: Request): Promise<Record<string, string>> {
  try {
    if (req.method === "POST") {
      const form: any = await (req as any).formData?.();
      if (form && typeof form.entries === "function") {
        return Object.fromEntries(form.entries() as Iterable<[string, string]>);
      }
      const bodyText = await req.text();
      return Object.fromEntries(new URLSearchParams(bodyText).entries());
    }
  } catch {}
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function POST(req: NextRequest) {
  try {
    console.log("📞 [opening-intake] Incoming Twilio webhook");

    const p = await readParams(req);

    const callSid   = p["CallSid"] || p["call_sid"] || "";
    const fromNum   = p["From"] || p["from"] || "";
    const toNum     = p["To"] || p["to"] || "";
    const direction = (p["Direction"] || p["direction"] || "inbound").toLowerCase();

    const id       = p["id"] || p["lead_id"] || "";
    const org_id   = p["org_id"] || "";
    const agent_id = p["agent_id"] || "";

    // Determine which flow to use
    let flow: "buyer" | "seller" | "investor" = "buyer";
    if (id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, lead_source")
        .eq("id", id)
        .maybeSingle();
      const src = lead?.lead_source?.toLowerCase() || "";
      if (src.includes("seller")) flow = "seller";
      else if (src.includes("investor")) flow = "investor";
    }

    const streamUrl =
      process.env.PUBLIC_BRIDGE_WSS_URL?.trim() ||
      "wss://charismatic-liberation.up.railway.app/bridge";

    const meta = {
      lead_id: id || null,
      org_id,
      agent_id,
      call_sid: callSid,
      from: fromNum,
      to: toNum,
      direction,
      flow,
      opening: SAMANTHA_OPENING_TRIAGE,
    };
    const meta_b64 = toB64(JSON.stringify(meta));

    // TwiML response for Twilio to start Samantha
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="meta_b64" value="${meta_b64}"/>
    </Stream>
  </Connect>
</Response>`;

    console.log("✅ [opening-intake] TwiML sent to Twilio:\n", twiml);

    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("❌ [opening-intake] error:", err);
    const safe = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing difficulties. Please try again later.</Say></Response>`;
    return new Response(safe, {
      headers: { "Content-Type": "text/xml" },
      status: 200,
    });
  }
}

export const GET = POST;
