// crm-project/crm/app/api/twilio/ai-stream/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge"; // ✅ Edge runtime works for TwiML generation

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function readParams(req: Request): Promise<Record<string, string>> {
  if (req.method.toUpperCase() === "POST") {
    try {
      const form: any = await (req as any).formData?.();
      if (form && typeof form.entries === "function") {
        return Object.fromEntries(form.entries() as Iterable<[string, string]>);
      }
    } catch {
      // ignore
    }
    const bodyText = await req.text();
    return Object.fromEntries(new URLSearchParams(bodyText).entries());
  }

  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function POST(req: NextRequest) {
  try {
    const p = await readParams(req);

    const id         = p["id"] || "";
    const direction  = (p["direction"] || "outbound").toLowerCase();
    const org_id     = p["org_id"] || "";
    const agent_id   = p["agent_id"] || "";
    const clientName = p["client_name"] || "";
    const orgName    = p["org_name"] || "";
    const agentName  = p["agent_name"] || "";
    const from       = p["from"] || "";
    const to         = p["to"] || "";
    const callSid    = p["call_sid"] || "";

    if (!id) return new Response("Missing id", { status: 400 });

    // Decide media-stream subpath
    let subPath = "buyer-intake"; // default
    if (direction === "outbound") {
      const { data: lead, error } = await supabase
        .from("leads")
        .select("id, lead_source")
        .eq("id", id)
        .single();

      if (error || !lead) return new Response("Lead not found", { status: 404 });

      if (lead.lead_source?.toLowerCase().includes("relocation")) {
        subPath = "buyer-intake/relocation-guide";
      }
    } else {
      subPath = "buyer-intake/relocation-guide";
    }

    // Base URL → ws(s)
    const httpBase =
      process.env.PUBLIC_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;

    const wsBase = httpBase.replace(/^http/i, "ws");

    // Build WS target with full context
    const target = new URL(`${wsBase}/api/twilio/ai-media-stream/${subPath}`);
    target.searchParams.set("id", id);
    target.searchParams.set("direction", direction);
    if (org_id)     target.searchParams.set("org_id", org_id);
    if (agent_id)   target.searchParams.set("agent_id", agent_id);
    if (clientName) target.searchParams.set("client_name", clientName);
    if (orgName)    target.searchParams.set("org_name", orgName);
    if (agentName)  target.searchParams.set("agent_name", agentName);
    if (from)       target.searchParams.set("from", from);
    if (to)         target.searchParams.set("to", to);
    if (callSid)    target.searchParams.set("call_sid", callSid);

    // TwiML: connect media stream
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${target.toString()}" />
  </Connect>
</Response>`;

    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch (err: any) {
    console.error("ai-stream error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export const GET = POST;
