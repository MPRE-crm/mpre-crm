import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Expect fields you POST from Twilio Studio: lead_id, flow_key, channel, to_number, status, payload
    const { lead_id, flow_key, channel, to_number, status, payload } = body;

    const { error } = await supabaseAdmin.from('lead_interactions').insert({
      lead_id,
      flow_key,
      channel,
      to_number,
      status,
      payload,
      lead_source: payload?.lead_source,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Update status error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
