// src/lib/aiCall.ts - Updated for appointment prompt and Supabase logging

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const client = twilio(
  process.env.TWILIO_SID!,
  process.env.TWILIO_AUTH!
);

const questions = [
  { key: 'bedrooms', question: 'How many bedrooms would you prefer in your new home?' },
  { key: 'location', question: 'Do you have a specific area or neighborhood in mind?' },
  { key: 'home_type', question: 'Are you looking for a single-family home, townhouse, or something else?' },
  { key: 'timeline_confirm', question: 'Can you confirm your ideal move timeline?' },
  { key: 'preapproved', question: 'Have you already been pre-approved for a mortgage?' },
  { key: 'agent_check', question: 'Are you currently working with a real estate agent?' },
];

export async function initiateAICall(lead: any) {
  const { id, name, phone, move_timeline, price_range } = lead;
  const firstName = name?.split(' ')[0] || 'there';

  try {
    const response = await client.calls.create({
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="Polly.Joanna">
            Hi, ${firstName}, this is Samantha, your Boise, Idaho real estate assistant calling on behalf of MPRE Boise.
            I saw you're planning to move in the next ${move_timeline} with a budget around ${price_range}. Is now a good time to chat for about 60 seconds?
          </Say>
          <Pause length="2"/>
          ${questions
            .map(
              (q) => `
                <Say voice="Polly.Joanna">${q.question}</Say>
                <Pause length="3"/>
              `
            )
            .join('')}
          <Say voice="Polly.Joanna">
            Awesome — thanks for sharing that! I’d love to get you scheduled with one of MPRE's agents.
            What day or time this week works best for a quick 15-minute call or Zoom?
          </Say>
        </Response>`,
      to: phone,
      from: process.env.TWILIO_CALLER_ID!,
    });

    await supabase.from('calls').insert({
      lead_id: id,
      status: 'initiated',
      type: 'AI Follow-up',
      appointment_requested: true,
    });
  } catch (error) {
    console.error('Call failed, sending fallback SMS...', error);

    await client.messages.create({
      body: `Hi ${firstName}, this is Samantha from MPRE Boise. Tried calling to follow up on your $${price_range} home search. If you’d like to schedule a quick 15-min Zoom, reply with a day/time or visit mpre.homes/booking.`,
      to: phone,
      from: process.env.TWILIO_CALLER_ID!,
    });

    await supabase.from('calls').insert({
      lead_id: id,
      status: 'fallback_sms_sent',
      type: 'SMS',
    });
  }
}
