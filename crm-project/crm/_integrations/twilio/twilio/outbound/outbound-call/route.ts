// crm-project/crm/app/api/twilio/outbound/outbound-call/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const TWILIO_PHONE_NUMBER = "+12082856773"; // Your Twilio phone number
const BASE_URL =
  (process.env.PUBLIC_URL && process.env.PUBLIC_URL.replace(/\/$/, "")) ||
  "https://easyrealtor.homes";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // --- Lead lookup
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, phone, org_id, agent_id")
      .eq("id", id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!lead.phone) {
      return NextResponse.json(
        { error: "Lead missing phone number" },
        { status: 400 }
      );
    }

    // --- Optional org + agent lookups
    let orgName = "";
    let agentName = "";

    if (lead.org_id) {
      const { data: org } = await supabase
        .from("orgs") // adjust if needed
        .select("name")
        .eq("id", lead.org_id)
        .single();
      orgName = org?.name || "";
    }

    if (lead.agent_id) {
      const { data: agent } = await supabase
        .from("agents")
        .select("name")
        .eq("id", lead.agent_id)
        .single();
      agentName = agent?.name || "";
    }

    // --- Build AI stream URL
    const aiStreamUrl = new URL(`${BASE_URL}/api/twilio/ai-stream`);
    aiStreamUrl.searchParams.set("id", String(lead.id));
    aiStreamUrl.searchParams.set("direction", "outbound");
    if (lead.org_id) aiStreamUrl.searchParams.set("org_id", String(lead.org_id));
    if (lead.agent_id) aiStreamUrl.searchParams.set("agent_id", String(lead.agent_id));
    if (lead.name) aiStreamUrl.searchParams.set("client_name", lead.name);
    if (orgName) aiStreamUrl.searchParams.set("org_name", orgName);
    if (agentName) aiStreamUrl.searchParams.set("agent_name", agentName);

    // --- Status callback URL
    const statusCbUrl = new URL(`${BASE_URL}/api/twilio/call-status`);
    statusCbUrl.searchParams.set("id", String(lead.id));
    if (lead.org_id) statusCbUrl.searchParams.set("org_id", String(lead.org_id));
    if (lead.agent_id) statusCbUrl.searchParams.set("agent_id", String(lead.agent_id));

    // --- Create the outbound call
    const call = await twilioClient.calls.create({
      to: lead.phone,
      from: TWILIO_PHONE_NUMBER,
      url: aiStreamUrl.toString(),
      statusCallback: statusCbUrl.toString(),
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      to: lead.phone,
      from: TWILIO_PHONE_NUMBER,
    });
  } catch (err: any) {
    console.error("❌ Error creating outbound call:", err);
    return NextResponse.json(
      { error: "Failed to create outbound call", details: err.message },
      { status: 500 }
    );
  }
}

// ✅ ensure both methods exported so Next.js treats as module
export const GET = POST;
