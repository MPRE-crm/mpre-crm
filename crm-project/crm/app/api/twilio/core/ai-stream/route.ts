// crm-project/crm/app/api/twilio/core/ai-stream/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge"; // TwiML must be public/fast

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

function toB64(s: string) {
  // @ts-ignore
  if (typeof btoa === "function") return btoa(s);
  // @ts-ignore
  return Buffer.from(s, "utf8").toString("base64");
}

async function readParams(req: Request): Promise<Record<string, string>> {
  if (req.method.toUpperCase() === "POST") {
    try {
      const form: any = await (req as any).formData?.();
      if (form && typeof form.entries === "function") {
        return Object.fromEntries(form.entries() as Iterable<[string, string]>);
      }
    } catch {}
    const bodyText = await req.text();
    return Object.fromEntries(new URLSearchParams(bodyText).entries());
  }
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function POST(req: NextRequest) {
  try {
    // DIAG: quick probe — if ?diag=1 is present, return a plain marker
    const url = new URL(req.url);
    if (url.searchParams.get("diag") === "1") {
      return new Response("AI-STREAM V2 LIVE", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const p = await readParams(req);

    // Twilio inbound params
    const callSid   = p["CallSid"] || p["call_sid"] || "";
    const fromNum   = p["From"] || p["from"] || "";
    const toNum     = p["To"] || p["to"] || "";
    const direction = (p["direction"] || "inbound").toLowerCase();

    // Optional CRM params (may be missing on inbound)
    const id       = p["id"] || p["lead_id"] || "";
    const org_id   = p["org_id"] || "";
    const agent_id = p["agent_id"] || "";

    // Decide flow (default when no id)
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
      else if (src.includes("relocation")) flow = "buyer";
    } else {
      flow = "buyer";
    }

    // Build WS target to the bridge
    const httpBase =
      process.env.PUBLIC_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;
    const wsBase = httpBase.replace(/^http/i, "ws");
    const streamUrl = `${wsBase}/api/twilio/core/ai-media-stream/bridge`;

    // Pass context to the bridge (Twilio → customParameters)
    const meta = {
      lead_id: id || null,
      org_id: org_id || null,
      agent_id: agent_id || null,
      call_sid: callSid || null,
      from: fromNum || null,
      to: toNum || null,
      direction,
      flow,
    };
    const meta_b64 = toB64(JSON.stringify(meta));

    // Always return valid TwiML (GET and POST)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="meta_b64" value="${meta_b64}"/>
    </Stream>
  </Connect>
</Response>`;

    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("ai-stream error:", err);
    const safe = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing difficulties. Please try again later.</Say></Response>`;
    return new Response(safe, { headers: { "Content-Type": "text/xml" }, status: 200 });
  }
}

export const GET = POST;
