// crm/app/api/twilio/ai-call/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER!; // ✅ matches your .env
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;   // ✅ used to build webhook URL

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export async function POST(req: Request) {
  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return NextResponse.json({ ok: false, error: 'Missing lead_id' }, { status: 400 });
    }

    // 1) Get lead details (server-side, service role)
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('id, first_name, last_name, phone, price_point, move_timeline, notes')
      .eq('id', lead_id)
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
    }
    if (!lead.phone) {
      return NextResponse.json({ ok: false, error: 'Lead has no phone on file' }, { status: 400 });
    }
    if (!TWILIO_FROM || !BASE_URL) {
      return NextResponse.json(
        { ok: false, error: 'Server is missing TWILIO_PHONE_NUMBER or NEXT_PUBLIC_BASE_URL' },
        { status: 500 }
      );
    }

    // 2) Kick off outbound call to your AI stream endpoint
    const call = await twilioClient.calls.create({
      to: lead.phone,
      from: TWILIO_FROM,
      // TwiML or webhook that connects to your /api/twilio/ai-stream endpoint
      url: `${BASE_URL}/api/twilio/ai-stream?lead_id=${encodeURIComponent(lead.id)}`,
    });

    return NextResponse.json({ ok: true, callSid: call.sid });
  } catch (err: any) {
    console.error('ai-call error:', err);
    return NextResponse.json({ ok: false, error: err.message ?? 'Server error' }, { status: 500 });
  }
}
