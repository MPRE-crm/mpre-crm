import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeStudioFlow, getFlowSidFromEnvVar } from "../../../../lib/twilio";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      to,
      lead_source,
      lead_id,
      variables = {},
      channels = { phone: true, sms: true, email: true } // we trigger phone via Studio, SMS/Email often via Studio or your CRM
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

    // map lead_source -> flow_key
    const { data: mapRow, error: mapErr } = await supabase
      .from("lead_source_flow_map")
      .select("flow_key")
      .eq("lead_source", lead_source)
      .maybeSingle();

    if (mapErr) throw mapErr;
    const flowKey = mapRow?.flow_key ?? "HOME_SEARCH"; // safe default

    // lookup env var for that flow key
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

    // PHONE: execute Twilio Studio flow (this can internally send SMS too)
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

    // SMS + EMAIL: you can do these inside Studio, or trigger here separately if needed.
    // Below just logs placeholders so you have end-to-end records on day 1.
    if (channels.sms) {
      await supabase.from("lead_interactions").insert({
        lead_id,
        flow_key: flowKey,
        lead_source,
        to_number: to,
        channel: "sms",
        status: "queued",
        payload: { note: "SMS handled by Studio (recommended) or add your own sender here." },
      });
    }

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
