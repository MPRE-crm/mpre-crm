// crm/app/api/twilio/inbound/investor-intake/route.ts
export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import INVESTOR_INTAKE_PROMPT from "../../../../../lib/prompts/investor-intake";
import { getMarketSummaryText } from "../../../../../lib/market/summary";

const BRIDGE_WSS_URL =
  process.env.PUBLIC_BRIDGE_WSS_URL || "wss://<your-ngrok>.ngrok-free.app/bridge";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
      })
    : (null as any);

function xml(strings: TemplateStringsArray, ...values: any[]) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "").trim();
}

function b64(s: string) {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return Buffer.from(s, "utf8").toString("base64");
  }
}

async function getOrgBranding(org_id: string) {
  if (!supabase)
    return {
      org_display: "Your MPRE Team",
      brokerage_name: "NextHome Treasure Valley",
      reviews_url: "",
    };
  const { data } = await supabase
    .from("orgs")
    .select("*")
    .eq("id", org_id)
    .maybeSingle();
  const d: any = data || {};
  return {
    org_display:
      d.org_display ??
      d.display_name ??
      d.name ??
      d.org_name ??
      d.company_name ??
      "Your MPRE Team",
    brokerage_name:
      d.brokerage_name ??
      d.brokerage ??
      d.brokerageTitle ??
      d.company ??
      "NextHome Treasure Valley",
    reviews_url:
      d.reviews_url ??
      d.reviewsUrl ??
      d.reviews ??
      d.review_link ??
      d.reviews_link ??
      "",
  };
}

async function buildMeta(urlOrReqUrl: string, callParams?: URLSearchParams) {
  const url = new URL(urlOrReqUrl);
  const org_id = callParams?.get("org_id") || url.searchParams.get("org_id") || "unknown";
  const lead_id = callParams?.get("lead_id") || url.searchParams.get("lead_id") || "";
  const callSid = callParams?.get("CallSid") || "";
  const to = callParams?.get("To") || "";
  const from = callParams?.get("From") || "";

  const branding = await getOrgBranding(org_id);
  let marketSummary: string | null = null;
  try {
    marketSummary = await getMarketSummaryText();
  } catch {}

  const finalPrompt = INVESTOR_INTAKE_PROMPT
    .replaceAll("{{org_display}}", branding.org_display)
    .replaceAll("{{brokerage_name}}", branding.brokerage_name)
    .replaceAll("{{reviews_url}}", branding.reviews_url)
    .replaceAll("{{market_summary}}", marketSummary || "");

  const meta = {
    org_id,
    lead_id,
    call_sid: callSid,
    to,
    from,
    prompt: finalPrompt,
    flow: "investor-intake",
  };
  const meta_b64 = b64(JSON.stringify(meta));
  return { meta, meta_b64, org_id };
}

// ✅ Twilio often calls your webhook with **POST**,
// but it can be configured to use **GET**. We support both.
// Both return the SAME TwiML (<Start><Stream>) and pass meta_b64 so Samantha greets immediately.

export async function GET(req: NextRequest) {
  const { meta_b64, org_id } = await buildMeta(req.url);

  const twiml = xml`
    <Response>
      <Start>
        <Stream url="${BRIDGE_WSS_URL}">
          <Parameter name="meta_b64" value="${meta_b64}" />
          <Parameter name="org_id" value="${org_id}" />
        </Stream>
      </Start>
      <Pause length="600"/>
    </Response>
  `;

  return new NextResponse(twiml, {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
}

async function parseParams(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(await req.text());
  }
  try {
    const obj = await req.json();
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(obj || {}))
      if (v !== undefined && v !== null) usp.set(k, String(v));
    return usp;
  } catch {
    return new URLSearchParams();
  }
}

export async function POST(req: NextRequest) {
  try {
    const params = await parseParams(req);
    const { meta_b64, org_id } = await buildMeta(req.url, params);

    const twiml = xml`
      <Response>
        <Start>
          <Stream url="${BRIDGE_WSS_URL}">
            <Parameter name="meta_b64" value="${meta_b64}" />
            <Parameter name="org_id" value="${org_id}" />
          </Stream>
        </Start>
        <Pause length="600"/>
      </Response>
    `;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "content-type": "text/xml" },
    });
  } catch (e) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
