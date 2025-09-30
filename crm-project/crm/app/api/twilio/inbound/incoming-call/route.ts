// crm-project/crm/app/api/twilio/inbound/incoming-call/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Defaults if org not found
const DEFAULT_ORG_ID = "2486c9e9-d0bc-4a3d-be91-9406c52d178c";
const DEFAULT_ORG_NAME = "MPRE Boise";
const DEFAULT_BROKERAGE = "NextHome Treasure Valley";

async function parseFormData(req: NextRequest): Promise<Record<string, string>> {
  const body = await req.text();
  return Object.fromEntries(new URLSearchParams(body).entries());
}

function normalizePhone(phone: string) {
  return (phone || "").replace(/\D/g, "");
}

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

async function getOrgMeta(org_id: string) {
  const { data } = await supabase
    .from("orgs")
    .select("name, brokerage_name")
    .eq("id", org_id)
    .single();

  return {
    org_name: data?.name || DEFAULT_ORG_NAME,
    brokerage_name: data?.brokerage_name || DEFAULT_BROKERAGE,
  };
}

export async function POST(req: NextRequest) {
  try {
    const p = await parseFormData(req);
    const stage = p["stage"] || "menu";
    const from = p["From"] || "";
    const to = p["To"] || "";
    const callSid = p["CallSid"] || "";

    const baseUrl =
      (process.env.PUBLIC_URL && process.env.PUBLIC_URL.replace(/\/$/, "")) ||
      new URL(req.url).origin;

    // Only stage we care about → handoff to Samantha via bridge
    if (stage === "to_ai") {
      const org_id = p["org_id"] || DEFAULT_ORG_ID;
      const { org_name, brokerage_name } = await getOrgMeta(org_id);

      // find or create lead
      const fromDigits = normalizePhone(from);
      const { data: leads } = await supabase
        .from("leads")
        .select("id, phone")
        .ilike("phone", `%${fromDigits}%`)
        .limit(1);

      let id = leads?.[0]?.id || null;
      if (!id) {
        const { data: created } = await supabase
          .from("leads")
          .insert([
            {
              phone: from,
              name: "Incoming Caller",
              source: "inbound_call",
              status: "new",
              org_id,
            },
          ])
          .select("id")
          .single();
        id = created?.id || null;
      }

      // Always prefer current ngrok bridge
      const streamUrl = process.env.PUBLIC_BRIDGE_WSS_URL!;
      const meta = {
        lead_id: id,
        org_id,
        call_sid: callSid,
        from,
        to,
        direction: "inbound",
        flow: "buyer",
      };
      const meta_b64 = Buffer.from(JSON.stringify(meta), "utf8").toString("base64");

      console.log("🔗 incoming-call handing off to bridge:", {
        streamUrl,
        meta,
      });

      return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thanks for calling ${org_name}. Connecting you with Samantha now.</Say>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="meta_b64" value="${meta_b64}"/>
    </Stream>
  </Connect>
</Response>`);
    }

    // Default → menu prompt
    const actionUrl = new URL(`${baseUrl}/api/twilio/inbound/incoming-call`);
    actionUrl.searchParams.set("stage", "to_ai");
    return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Welcome to M P R E Homes. Connecting you to Samantha now.
  </Say>
  <Redirect method="POST">${actionUrl.toString()}</Redirect>
</Response>`);
  } catch (err: any) {
    console.error("❌ incoming-call error", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong. Please try again later.</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" }, status: 200 }
    );
  }
}

export const GET = POST;
