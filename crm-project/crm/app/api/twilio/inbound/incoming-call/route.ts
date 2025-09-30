// crm-project/crm/app/api/twilio/inbound/incoming-call/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

function orgByDigit(d: string): { id: string; name: string } | null {
  const map: Record<string, { id: string; name: string }> = {
    "1": { id: DEFAULT_ORG_ID, name: "MPRE Boise" },
    "2": { id: "REPLACE_WITH_TWINFALLS_ORG_ID", name: "MPRE Twin Falls" },
    "3": { id: "REPLACE_WITH_IDAHOFALLS_ORG_ID", name: "MPRE Idaho Falls" },
    "4": { id: "REPLACE_WITH_CDA_ORG_ID", name: "MPRE Coeur d'Alene" },
    "5": { id: "REPLACE_WITH_MCCALL_ORG_ID", name: "MPRE McCall" },
  };
  return map[d] || null;
}

function orgBySpeech(speech: string): { id: string; name: string } | null {
  const s = (speech || "").toLowerCase();
  if (!s) return null;
  if (s.includes("boise")) return { id: DEFAULT_ORG_ID, name: "MPRE Boise" };
  if (s.includes("twin")) return { id: "REPLACE_WITH_TWINFALLS_ORG_ID", name: "MPRE Twin Falls" };
  if (s.includes("idaho falls")) return { id: "REPLACE_WITH_IDAHOFALLS_ORG_ID", name: "MPRE Idaho Falls" };
  if (s.includes("coeur") || s.includes("alene")) return { id: "REPLACE_WITH_CDA_ORG_ID", name: "MPRE Coeur d'Alene" };
  if (s.includes("mccall")) return { id: "REPLACE_WITH_MCCALL_ORG_ID", name: "MPRE McCall" };
  return null;
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
    const digits = p["Digits"] || "";
    const speech = p["SpeechResult"] || "";

    const baseUrl =
      (process.env.PUBLIC_URL && process.env.PUBLIC_URL.replace(/\/$/, "")) ||
      new URL(req.url).origin;

    console.log("📞 [incoming-call] stage:", stage, {
      callSid,
      from,
      to,
      digits,
      speech,
    });

    // 1) IVR menu
    if (stage === "menu") {
      if (digits || speech) {
        const choice = digits ? orgByDigit(digits) : orgBySpeech(speech);
        const org_id = choice?.id || DEFAULT_ORG_ID;
        const { org_name, brokerage_name } = await getOrgMeta(org_id);

        console.log("➡️ [incoming-call] Choice detected:", { org_id, org_name });

        const nextUrl = new URL(`${baseUrl}/api/twilio/inbound/incoming-call`);
        nextUrl.searchParams.set("stage", "to_ai");
        nextUrl.searchParams.set("org_id", org_id);
        nextUrl.searchParams.set("org_name", org_name);
        nextUrl.searchParams.set("brokerage_name", brokerage_name);

        return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${nextUrl.toString()}</Redirect>
</Response>`);
      }

      console.log("🕑 [incoming-call] No input yet, prompting menu");

      const actionUrl = new URL(`${baseUrl}/api/twilio/inbound/incoming-call`);
      actionUrl.searchParams.set("stage", "menu");
      return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="6" numDigits="1" action="${actionUrl.toString()}" method="POST">
    <Say voice="alice">
      Welcome to M P R E Homes.
      For the Boise area, press 1.
      For the Twin Falls area, press 2.
      For the Idaho Falls area, press 3.
      For the Coeur d' Alene area, press 4.
      For the McCall area, press 5.
      Or just say your city now.
    </Say>
  </Gather>
  <Redirect method="POST">${actionUrl.toString()}</Redirect>
</Response>`);
    }

    // 2) Connect to AI
    if (stage === "to_ai") {
      const org_id = p["org_id"] || DEFAULT_ORG_ID;
      const org_name = p["org_name"] || DEFAULT_ORG_NAME;
      const brokerage_name = p["brokerage_name"] || DEFAULT_BROKERAGE;

      console.log("🤖 [incoming-call] Routing to AI", {
        callSid,
        org_id,
        org_name,
        brokerage_name,
      });

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
        console.log("🆕 [incoming-call] Lead created:", id);
      } else {
        console.log("📇 [incoming-call] Existing lead found:", id);
      }

      const ai = new URL(`${baseUrl}/api/twilio/core/ai-stream`);
      ai.searchParams.set("id", String(id));
      ai.searchParams.set("direction", "inbound");
      ai.searchParams.set("org_id", org_id);
      ai.searchParams.set("org_name", org_name);
      ai.searchParams.set("brokerage_name", brokerage_name);
      ai.searchParams.set("from", from);
      ai.searchParams.set("to", to);
      ai.searchParams.set("call_sid", callSid);
      ai.searchParams.set("flow", "buyer_intake_lpmama");

      console.log("➡️ [incoming-call] Redirecting to ai-stream:", ai.toString());

      return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thanks for calling ${org_name} area. Connecting you with Samantha now.</Say>
  <Redirect method="POST">${ai.toString()}</Redirect>
</Response>`);
    }

    const backToMenu = new URL(`${baseUrl}/api/twilio/inbound/incoming-call`);
    backToMenu.searchParams.set("stage", "menu");
    console.log("🔄 [incoming-call] Fallback to menu");
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${backToMenu.toString()}</Redirect></Response>`
    );
  } catch (err: any) {
    console.error("❌ incoming-call error", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong. Please try again later.</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" }, status: 200 }
    );
  }
}

export const GET = POST;
