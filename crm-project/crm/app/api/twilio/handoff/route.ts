import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  try {
    const { agent_id, call_sid, lead_id, escalation_reason } = await req.json();

    // 1. Log the escalation reason to Supabase
    if (lead_id && escalation_reason) {
      await supabase.from('escalation_logs').insert({
        lead_id,
        escalation_reason,
        created_at: new Date().toISOString(),
      });
    }

    // 2. Look up agent phone from Supabase
    let agentNumber: string | null = null;
    if (agent_id) {
      const { data, error } = await supabase
        .from("users")
        .select("phone, org_id")
        .eq("id", agent_id)
        .single();

      if (error) {
        console.error("Supabase error fetching agent phone:", error.message);
      } else if (data?.phone) {
        agentNumber = data.phone;
      }

      // 3. Fetch fallback number based on the agent's organization
      if (!agentNumber) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations") // Assuming you have a table named "organizations"
          .select("fallback_number")
          .eq("id", data?.org_id) // Using the agent's org_id
          .single();

        if (orgError) {
          console.error("Error fetching fallback number:", orgError.message);
        } else {
          agentNumber = orgData?.fallback_number || null;
        }
      }
    }

    // 4. Fallback to environment variable if no agent or org fallback number is found
    if (!agentNumber) {
      agentNumber = process.env.FALLBACK_AGENT_NUMBER || null;
    }

    if (!agentNumber) {
      return NextResponse.json(
        { error: "No agent number found and no fallback configured." },
        { status: 400 }
      );
    }

    // 5. Use Twilio to redirect the call
    await twilioClient.calls(call_sid).update({
      method: "POST",
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/twilio/voice/forward?to=${encodeURIComponent(agentNumber)}`
    });

    return NextResponse.json({ ok: true, forwardedTo: agentNumber });
  } catch (err: any) {
    console.error("Error in handoff route:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
