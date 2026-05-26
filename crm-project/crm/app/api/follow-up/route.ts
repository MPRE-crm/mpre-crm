import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { sendText } from '../../../lib/sendText';
import { evaluateLeadContactState } from '../../../src/lib/samantha/contactGovernor';
import { applyGovernorDecision } from '../../../src/lib/samantha/applyGovernorDecision';

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { id, from_number, call_sid } = data;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Missing lead id' },
      { status: 400 }
    );
  }

  if (!from_number) {
    return NextResponse.json(
      { success: false, error: 'Missing from_number' },
      { status: 400 }
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json(
      { success: false, error: leadError?.message || 'Lead not found' },
      { status: 404 }
    );
  }

  if (call_sid) {
    const { data: existing, error: fetchError } = await supabase
      .from('follow_ups')
      .select('id')
      .eq('call_sid', call_sid)
      .limit(1);

    if (fetchError) {
      console.error('❌ Supabase lookup error:', fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Follow-up already sent for this call' },
        { status: 200 }
      );
    }
  }

  try {
    const now = new Date();
    const decision = evaluateLeadContactState(lead, { now });

    await applyGovernorDecision({
      db: supabase,
      leadId: id,
      decision,
      now,
      orgId: lead.org_id ?? null,
      statusAtEscalation: lead.status ?? null,
    });

    if (decision.action !== 'text_now') {
      return NextResponse.json({
        success: true,
        sent: false,
        action: decision.action,
        heat_status: decision.heat_status,
        next_contact_at: decision.next_contact_at,
        reason_codes: decision.reason_codes,
        escalate_to_agent: decision.escalate_to_agent,
      });
    }

    await supabase.from('follow_ups').insert({
      lead_id: id,
      lead_number: from_number,
      call_sid: call_sid ?? null,
      method: 'sms',
      sent_at: now.toISOString(),
      created_at: now.toISOString(),
    });

    const smsResult = await sendText({
      to: from_number,
      message:
        decision.heat_status === 'hot'
          ? `Sorry we missed your call. This is Samantha with MPRE Boise. Are you still looking for help with Boise area real estate?`
          : `Hi, this is Samantha with MPRE Boise following up in case you still need help with Boise area real estate.`,
      leadId: id,
    });

    if (!smsResult.success) {
      return NextResponse.json(
        { success: false, error: smsResult.error || 'SMS failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: true,
      action: decision.action,
      heat_status: decision.heat_status,
      next_contact_at: decision.next_contact_at,
      reason_codes: decision.reason_codes,
      escalate_to_agent: decision.escalate_to_agent,
    });
  } catch (err: any) {
    console.error('❌ Follow-up send error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}