// app/api/incoming/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import twilio from 'twilio';
import { supabase } from '../../../lib/supabase'; // from app/api/incoming → ../../../lib/supabase

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let from: string | undefined;
  let to: string | undefined;
  let incomingMessage: string | undefined;

  try {
    if (ct.includes('application/x-www-form-urlencoded')) {
      const raw = await req.text();
      const params = new URLSearchParams(raw);
      from = params.get('From') ?? undefined;
      to = params.get('To') ?? undefined;
      incomingMessage = params.get('Body') ?? undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      from = body.From || body.from;
      to = body.To || body.to;
      incomingMessage = body.Body || body.body;
    }

    if (!from || !incomingMessage) {
      return NextResponse.json(
        { error: 'Missing parameters from Twilio' },
        { status: 400 }
      );
    }

    // Log incoming message
    await supabase.from('messages').insert({
      lead_phone: from,
      direction: 'incoming',
      body: incomingMessage,
    });

    // AI reply
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful and friendly real estate assistant for Boise, Idaho. Respond in a natural, engaging tone.',
        },
        { role: 'user', content: incomingMessage },
      ],
    });

    const replyText = aiResponse.choices[0]?.message?.content?.trim();
    if (!replyText) throw new Error('AI failed to generate a response');

    // Send SMS reply
    await twilioClient.messages.create({
      from: to, // reply from the number Twilio used
      to: from,
      body: replyText,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`,
    });

    // Log outgoing message
    await supabase.from('messages').insert({
      lead_phone: from,
      direction: 'outgoing',
      body: replyText,
      status: 'pending',
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error in incoming handler:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
