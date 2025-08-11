import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    // Fetch the lead's phone number from Supabase
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('phone')
      .eq('id', lead_id)
      .maybeSingle();

    if (error || !lead?.phone) {
      return NextResponse.json({ error: 'Lead not found or missing phone number' }, { status: 404 });
    }

    // Twilio credentials from env
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

    const client = twilio(accountSid, authToken);

    // URL to your voice script
    const voiceUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/voice?lead_id=${lead_id}`;

    // Make the call
    const call = await client.calls.create({
      url: voiceUrl,
      to: lead.phone,
      from: fromNumber,
      machineDetection: 'Enable', // so you can detect voicemail in call-status webhook
    });

    // Optionally store the call SID for tracking
    await supabaseAdmin
      .from('follow_ups')
      .insert({
        lead_id,
        call_sid: call.sid,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({ ok: true, callSid: call.sid });
  } catch (err: any) {
    console.error('❌ start-call error', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
