// app/api/incoming/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; // keep your existing client

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getOpenAI() {
  const { default: OpenAI } = await import('openai');
  const apiKey = requireEnv('OPENAI_API_KEY');
  return new OpenAI({ apiKey });
}

async function getTwilioClient() {
  const twilio = (await import('twilio')).default;
  const sid = requireEnv('TWILIO_ACCOUNT_SID');
  const token = requireEnv('TWILIO_AUTH_TOKEN');
  return twilio(sid, token);
}

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let from: string | undefined;
  let to: string | undefined;
  let incomingMessage: string | undefined;

  try {
    // Parse Twilio payload (form-encoded) or JSON
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

    // Log incoming
    await supabase.from('messages').insert({
      lead_phone: from,
      direction: 'incoming',
      body: incomingMessage,
    });

    // Lazy-load OpenAI at request time
    const openai = await getOpenAI();
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

    // Lazy-load Twilio at request time
    const twilioClient = await getTwilioClient();

    // Fallback: if Twilio didn't include "To", use our configured number
    const fromNumber = to || process.env.TWILIO_PHONE_NUMBER || undefined;
    if (!fromNumber) {
      throw new Error('No reply number available (missing To and TWILIO_PHONE_NUMBER)');
    }

    const statusCallback =
      process.env.TWILIO_STATUS_CALLBACK_URL ||
      process.env.VOICE_STATUS_WEBHOOK_URL ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`
        : undefined);

    await twilioClient.messages.create({
      from: fromNumber,
      to: from,
      body: replyText,
      ...(statusCallback ? { statusCallback } : {}),
    });

    // Log outgoing
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
