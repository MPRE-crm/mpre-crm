// crm-project/crm/app/api/twilio/ai-stream/route.ts
// Routes Twilio to the correct AI media stream endpoint based on lead_source
// Example Twilio URL:  https://YOUR_DOMAIN/api/twilio/ai-stream?lead_id=123

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs'; // ensure Node runtime (not edge) for TwiML responses

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');

  if (!lead_id) {
    return new Response('Missing lead_id', { status: 400 });
  }

  // Pull just what we need to route
  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, lead_source')
    .eq('id', lead_id)
    .single();

  if (error || !lead) {
    return new Response('Lead not found', { status: 404 });
  }

  // Decide which sub-endpoint to use
  let subPath = 'buyer-intake'; // default
  if (lead.lead_source === 'Relocation leads') subPath = 'relocation-guide';

  const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, '');
  if (!publicUrl) {
    return new Response('PUBLIC_URL not configured', { status: 500 });
  }

  // TwiML that connects the call’s audio to our chosen media stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${publicUrl}/api/twilio/ai-media-stream/${subPath}?lead_id=${lead_id}"/>
  </Connect>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}

