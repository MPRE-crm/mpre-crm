// crm-project/crm/app/api/twilio/ai-stream/route.ts
// Routes Twilio to the correct AI media stream endpoint based on lead_source
// Example Twilio URL: https://YOUR_DOMAIN/api/twilio/ai-stream?lead_id=123

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs'; // ensure Node runtime (not edge) for TwiML responses

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
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
      console.error('ai-stream error:', error);
      return new Response('Lead not found', { status: 404 });
    }

    // Decide which sub-endpoint to use
    let subPath = 'buyer-intake'; // default

    if (lead.lead_source === 'Relocation leads') {
      // Now routes to the nested buyer-intake/relocation-guide
      subPath = 'buyer-intake/relocation-guide';
    }

    const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, '');
    if (!publicUrl) {
      return new Response('PUBLIC_URL not configured', { status: 500 });
    }

    // TwiML response with <Start><Stream>
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${publicUrl}/api/twilio/ai-media-stream/${subPath}?lead_id=${lead_id}" />
  </Start>
</Response>`;

    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (err: any) {
    console.error('ai-stream unexpected error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
