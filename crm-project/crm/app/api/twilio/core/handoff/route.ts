// crm-project/crm/app/api/twilio/core/handoff/route.ts
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

// ✅ Force Node runtime so "net", "tls", "crypto" are available
export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(req: NextRequest) {
  try {
    const { agent_id, call_sid, lead_id, escalation_reason } = await req.json();

    // 1. Log escalation
    if (lead_id && escalation_reason) {
      await supabase.from("escalation_logs").insert({
        lead_id,
        escalation_reason,
        created_at: new Date().toISOString(),
      });
    }

    // 2. Lookup agent phone
    let agentNumber: string | null = null;
    let orgId: string | null = null;

    if (agent_id) {
      const { data, error } = await supabase
        .from("users")
        .select("phone, org_id")
        .eq("id", agent_id)
        .single();

      if (error) {
        console.error("Supabase error fetching agent phone:", error.message);
      } else {
        agentNumber = data?.phone || null;
        orgId = data?.org_id || null;
      }

      // 3. Fallback: org fallback number
      if (!agentNumber && orgId) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("fallback_number")
          .eq("id", orgId)
          .single();

        if (orgError) {
          console.error("Error fetching fallback number:", orgError.message);
        } else {
          agentNumber = orgData?.fallback_number || null;
        }
      }
    }

    // 4. Fallback: env var
    if (!agentNumber) {
      agentNumber = process.env.FALLBACK_AGENT_NUMBER || null;
    }

    if (!agentNumber) {
      return NextResponse.json(
        { error: "No agent number found and no fallback configured." },
        { status: 400 }
      );
    }

    // 5. Redirect call
    await twilioClient.calls(call_sid).update({
      method: "POST",
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/twilio/voice/forward?to=${encodeURIComponent(
        agentNumber
      )}`,
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

// GET -> same as POST
export const GET = POST;
