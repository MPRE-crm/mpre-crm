import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import twilio from 'twilio';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return NextResponse.json({ ok: false, error: 'Missing lead_id' }, { status: 400 });
    }

    // 1️⃣ Get lead details from Supabase
    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, price_point, move_timeline, notes')
      .eq('id', lead_id)
      .single();

    if (error || !lead) {
      return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
    }

    // 2️⃣ Build conversation prompt
    const prompt = `
You are Samantha, a warm, helpful Boise, Idaho real estate assistant for MPRE Boise.
Your job is to naturally speak with ${lead.first_name} ${lead.last_name} about their move.
You already know:
- Move timeline: ${lead.move_timeline || "Unknown"}
- Price point: ${lead.price_point || "Unknown"}
- Past conversation notes: ${lead.notes || "None"}

Start the call by referencing their moving plans and budget. Keep the conversation natural, handle objections, and aim to progress toward booking an appointment or sending the relocation guide if not already done.
If they sidetrack, gently bring them back to real estate.

At the end, summarize the key updates in bullet points.
`;

    // 3️⃣ Create outbound call using Twilio Programmable Voice
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const call = await client.calls.create({
      to: lead.phone,
      from: process.env.TWILIO_CALLER_ID!,
      // URL of TwiML that connects call to AI streaming endpoint
      url: `${process.env.PUBLIC_URL}/api/twilio/ai-stream?lead_id=${lead.id}`
    });

    return NextResponse.json({ ok: true, callSid: call.sid });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
