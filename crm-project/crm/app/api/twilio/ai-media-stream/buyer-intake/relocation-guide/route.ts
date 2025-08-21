import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Normalize to wss:// base
function toWssBase(req: Request): string {
  const envBase = process.env.PUBLIC_WS_BASE_URL?.trim();
  if (envBase) {
    return envBase
      .replace(/^http:\/\//i, 'ws://')
      .replace(/^https:\/\//i, 'wss://')
      .replace(/\/+$/, '');
  }
  const u = new URL(req.url);
  const host = u.host;
  const isHttps = u.protocol === 'https:';
  return `${isHttps ? 'wss' : 'ws'}://${host}`;
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lead_id = searchParams.get('lead_id');
    
    if (!lead_id) {
      return new NextResponse('Missing lead_id', { status: 400 });
    }

    // Pull lead + agent context, including 'phone' property
    const { data: lead, error } = await supabase
      .from('leads')
      .select('name, price_range, move_timeline, notes, email, agent_id, city, county, motivation, agent_status, purchase_type, appointment_date, appointment_time, phone')  // Added 'phone' here
      .eq('id', lead_id)
      .single();

    if (error || !lead) {
      return new NextResponse('Lead not found', { status: 404 });
    }

    const { data: agent } = await supabase
      .from('users')
      .select('relocation_guide_url, phone, name')
      .eq('id', lead.agent_id)
      .single();

    const guideLink = agent?.relocation_guide_url || 'NO_LINK_FOUND';
    const agentPhone = agent?.phone || process.env.DEFAULT_AGENT_PHONE || '+12087157827';
    const agentName = agent?.name || 'Mike';
    const firstName = (lead.name || '').trim().split(/\s+/)[0] || 'there';

    const opener = [
      `Hi, is ${firstName} there? This is Samantha, your Boise, Idaho real estate assistant. I’m an AI-powered virtual caller with MPRE Boise — thank you for signing up for the relocation guide!`,
      `I’m simply calling to make sure you’ve received it. Were you able to obtain your copy? If not, I’m more than happy to resend it to you.`,
      lead.price_range || lead.move_timeline
        ? `My records show you’re looking around ${lead.price_range || 'your target range'} and planning to move in about ${lead.move_timeline || 'the timeframe you mentioned'}.`
        : ''
    ].filter(Boolean).join(' ');

    const systemPrompt = `
    You are Samantha, an AI real estate assistant for MPRE Boise.
    Lead: ${lead.name}
    Lead source: Relocation leads
    Price range: ${lead.price_range || 'Unknown'}
    Move timeline: ${lead.move_timeline || 'Unknown'}
    Email on file: ${lead.email || 'Unknown'}
    Relocation Guide: ${guideLink}
    Prior notes: ${lead.notes || 'None'}
    
    FIRST: Say exactly this, then pause for a response:
    "${opener}"
    
    === LPMAMA + T conversational plan ===
    [...full script same as before...]
    `.trim();

    const wssBase = toWssBase(req);
    const streamUrl = `${wssBase}/api/twilio/ai-media-stream/bridge?lead_id=${encodeURIComponent(lead_id)}`;
    const systemPromptB64 = Buffer.from(systemPrompt).toString('base64');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${streamUrl}">
          <Parameter name="systemPrompt" value="${systemPromptB64}"/>
          <Parameter name="leadId" value="${lead_id}"/>
        </Stream>
      </Connect>
    </Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (err) {
    console.error('Error in POST handler:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
