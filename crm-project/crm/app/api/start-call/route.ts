import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { evaluateLeadContactState } from '../../../src/lib/samantha/contactGovernor';
import { applyGovernorDecision } from '../../../src/lib/samantha/applyGovernorDecision';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .maybeSingle();

    if (error || !lead?.phone) {
      return NextResponse.json(
        { error: 'Lead not found or missing phone number' },
        { status: 404 }
      );
    }

    const now = new Date();
    const decision = evaluateLeadContactState(lead, { now });

    await applyGovernorDecision({
      db: supabaseAdmin,
      leadId: lead_id,
      decision,
      now,
      orgId: lead.org_id ?? null,
      statusAtEscalation: lead.status ?? null,
    });

    if (decision.action !== 'call_now') {
      return NextResponse.json(
        {
          ok: true,
          placed: false,
          action: decision.action,
          heat_status: decision.heat_status,
          next_contact_at: decision.next_contact_at,
          reason_codes: decision.reason_codes,
          escalate_to_agent: decision.escalate_to_agent,
        },
        { status: 200 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

    const client = twilio(accountSid, authToken);

    const voiceUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/voice?lead_id=${lead_id}`;

    const call = await client.calls.create({
      url: voiceUrl,
      to: lead.phone,
      from: fromNumber,
      machineDetection: 'Enable',
    });

    await supabaseAdmin.from('follow_ups').insert({
      lead_id,
      call_sid: call.sid,
      method: 'call',
      created_at: now.toISOString(),
      sent_at: now.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      placed: true,
      callSid: call.sid,
      action: decision.action,
      heat_status: decision.heat_status,
      next_contact_at: decision.next_contact_at,
      reason_codes: decision.reason_codes,
      escalate_to_agent: decision.escalate_to_agent,
    });
  } catch (err: any) {
    console.error('❌ start-call error', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}