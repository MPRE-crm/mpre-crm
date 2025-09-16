// app/api/twilio/inbound/investor-intake/route.ts
export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import INVESTOR_INTAKE_PROMPT from "../../../../../lib/prompts/investor-intake";
import { getMarketSummaryText } from "../../../../../lib/market/summary";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    : (null as any);

function xml(strings: TemplateStringsArray, ...values: any[]) {
  const s = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
  return s.trim();
}

function getPublicBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// http(s) -> ws(s) for Twilio Media Streams
function toWSS(u: string) {
  return u.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
}

async function getOrgBranding(org_id: string) {
  if (!supabase) return { org_display: "Your MPRE Team", brokerage_name: "NextHome Treasure Valley", reviews_url: "" };
  const { data } = await supabase.from("orgs").select("*").eq("id", org_id).maybeSingle();
  const d: any = data || {};
  return {
    org_display: d.org_display ?? d.display_name ?? d.name ?? d.org_name ?? d.company_name ?? "Your MPRE Team",
    brokerage_name: d.brokerage_name ?? d.brokerage ?? d.brokerageTitle ?? d.company ?? "NextHome Treasure Valley",
    reviews_url: d.reviews_url ?? d.reviewsUrl ?? d.reviews ?? d.review_link ?? d.reviews_link ?? "",
  };
}

async function parseParams(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return new URLSearchParams(text);
  }
  try {
    const obj = await req.json();
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null) usp.set(k, String(v));
    return usp;
  } catch {
    return new URLSearchParams();
  }
}

export async function POST(req: NextRequest) {
  try {
    const params = await parseParams(req);

    const callSid = params.get("CallSid") || "";
    const to = params.get("To") || "";
    const from = params.get("From") || "";

    const url = new URL(req.url);
    const orgFromQuery = url.searchParams.get("org_id") || url.searchParams.get("OrgId");
    const leadFromQuery = url.searchParams.get("lead_id") || url.searchParams.get("LeadId");

    const org_id = params.get("org_id") || params.get("OrgId") || orgFromQuery || "";
    const lead_id = params.get("lead_id") || params.get("LeadId") || leadFromQuery || "";

    if (!org_id) return new NextResponse("Missing org_id", { status: 400 });

    const branding = await getOrgBranding(org_id);
    let marketSummary: string | null = null;
    try {
      marketSummary = await getMarketSummaryText();
    } catch {
      marketSummary = null;
    }

    const finalPrompt = INVESTOR_INTAKE_PROMPT
      .replaceAll("{{org_display}}", branding.org_display || "")
      .replaceAll("{{brokerage_name}}", branding.brokerage_name || "")
      .replaceAll("{{reviews_url}}", branding.reviews_url || "")
      .replaceAll("{{market_summary}}", marketSummary || "");

    const publicBase = getPublicBaseUrl();
    const streamUrl = toWSS(`${publicBase}/api/twilio/core/ai-media-stream/bridge?flow=investor-intake`);

    const meta = {
      org_id,
      lead_id: lead_id || null,
      call_sid: callSid,
      to,
      from,
      prompt: finalPrompt,
      market_summary: marketSummary,
      flow: "investor-intake",
    };
    const metaAttr = JSON.stringify(meta).replace(/'/g, "&apos;");

    // Use <Start><Stream> to keep call up; long Pause to allow streaming
    const twiml = xml`
      <Response>
        <Start>
          <Stream url="${streamUrl}">
            <Parameter name="meta" value='${metaAttr}' />
          </Stream>
        </Start>
        <Pause length="600"/>
      </Response>
    `;

    return new NextResponse(twiml, { status: 200, headers: { "content-type": "text/xml" } });
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
