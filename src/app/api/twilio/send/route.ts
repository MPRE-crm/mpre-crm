// src/app/api/twilio/send/route.ts

export const dynamic = 'force-dynamic';  // Keep the dynamic line as you had

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabase } from '@/lib/supabase';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

export async function POST(req: Request) {
  try {
    const { to, body } = await req.json();
    console.log("Received request:", { to, body });

    // Replace this URL with your ngrok URL
    const statusCallbackUrl = `https://a001-65-129-120-112.ngrok-free.app/api/twilio/status`;  // ngrok URL

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
      statusCallback: statusCallbackUrl,  // Use the ngrok URL here
    });

    console.log("Twilio message response:", message);

    const { error: dbError } = await supabase.from('messages').insert({
      lead_phone: to,
      direction: 'outgoing',
      body,
      status: 'queued',
      twilio_sid: message.sid,
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError.message);
    }

    return NextResponse.json({ success: true, sid: message.sid });
  } catch (error: any) {
    console.error("Send error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


