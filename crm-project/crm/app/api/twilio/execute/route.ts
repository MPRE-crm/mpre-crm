import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeStudioFlow, getFlowSidFromEnvVar } from "../../../../lib/twilio";

// Supabase Client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

// Helper function to split full name into first and last names
function splitName(fullName?: string) {
  if (!fullName) return { first_name: null, last_name: null };
  const [first_name, ...last_name] = fullName.trim().split(/\s+/);
  return { first_name: first_name || null, last_name: last_name.join(" ") || null };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      to,
      lead_source,
      lead_id,
      variables = {},
      channels = { phone: true, sms: true, email: true }, // Trigger phone via Studio, SMS/Email via CRM
    } = body as {
      to: string;
      lead_source: string;
      lead_id?: string;
      variables?: Record<string, any>;
      channels?: { phone?: boolean; sms?: boolean; email?: boolean };
    };

    if (!to || !lead_source) {
      return NextResponse.json({ ok: false, error: "Missing 'to' or 'lead_source'." }, { status: 400 });
    }

    // Map lead_source to flow_key
    const { data: mapRow, error: mapErr } = await supabase
      .from("lead_source_flow_map")
      .select("flow_key")
      .eq("lead_source", lead_source)
      .maybeSingle();

    if (mapErr) throw mapErr;
    const flowKey = mapRow?.flow_key ?? "HOME_SEARCH"; // Default to "HOME_SEARCH" if not found

    // Lookup flow SID from the corresponding environment variable
    const { data: flowRow, error: flowErr } = await supabase
      .from("twilio_flows")
      .select("env_var, active")
      .eq("key", flowKey)
      .maybeSingle();

    if (flowErr) throw flowErr;
    if (!flowRow?.active) {
      return NextResponse.json({ ok: false, error: `Flow ${flowKey} is inactive` }, { status: 409 });
    }

    const flowSid = getFlowSidFromEnvVar(flowRow.env_var);

    // PHONE: Trigger Twilio Studio flow
    let execution: any = null;
    if (channels.phone !== false) {
      execution = await executeStudioFlow({
        flowSid,
        to,
        variables: { lead_id, lead_source, ...variables },
      });

      await supabase.from("lead_interactions").insert({
        lead_id,
        flow_key: flowKey,
        lead_source,
        to_number: to,
        channel: "phone",
        status: "initiated",
        payload: execution,
      });
    }

    // SMS: Trigger SMS for the lead
    if (channels.sms) {
      await supabase.from("lead_interactions").insert({
        lead_id,
        flow_key: flowKey,
        lead_source,
        to_number: to,
        channel: "sms",
        status: "queued",
        payload: { note: "SMS handled by Studio (recommended) or custom sender." },
      });
    }

    // EMAIL: Trigger email for the lead
    if (channels.email) {
      await supabase.from("lead_interactions").insert({
        lead_id,
        flow_key: flowKey,
        lead_source,
        to_number: to,
        channel: "email",
        status: "queued",
        payload: { note: "Email triggered by CRM / ESP webhook or /api/email/send." },
      });
    }

    return NextResponse.json({ ok: true, flowKey, flowSid, execution });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
