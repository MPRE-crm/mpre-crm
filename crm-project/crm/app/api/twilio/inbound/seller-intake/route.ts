// app/api/twilio/inbound/seller-intake/route.ts
// One file handles both TwiML (POST) and the Media Stream bridge (GET -> WS).
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Relative import (no @lib)
import SELLER_INTAKE_PROMPT from '../../../../../lib/prompts/seller-intake';

/** ENV
 * NEXT_PUBLIC_SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 * OPENAI_API_KEY
 * PUBLIC_URL
 */

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env (URL or SERVICE ROLE KEY)');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ----- Types -----
type SellerAnswers = {
  intent?: 'sell' | 'buy' | 'invest';
  first_name?: string;
  last_name?: string;
  name?: string;             // convenience if Samantha emits full name
  email?: string;
  phone?: string;
  from_location?: string | null;

  property_address?: string | null;
  city?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  timeline?: string | null;
  motivation?: string | null;
  has_agent?: boolean | null;

  consent_sms?: boolean | null;
  consent_email?: boolean | null;
  appointment_at?: string | null; // ISO
  appointment_human?: string | null;
  notes?: string | null;
};

// ----- Branding helpers -----
async function getOrgBranding(org_id?: string | null) {
  const supabase = getSupabaseAdmin();
  if (!org_id) return { org_display: 'MPRE Boise', brokerage_name: 'Your Brokerage', reviews_url: 'https://mpre.homes/reviews' };

  const { data: org } = await supabase
    .from('organizations')
    .select('id,name')
    .eq('id', org_id)
    .maybeSingle();

  const { data: org2 } = await supabase
    .from('orgs')
    .select('id,name,brokerage_name,reviews_url')
    .eq('id', org_id)
    .maybeSingle();

  const org_display = org2?.name || org?.name || 'MPRE Boise';
  const brokerage_name = org2?.brokerage_name || 'Your Brokerage';
  const reviews_url = org2?.reviews_url || 'https://mpre.homes/reviews';
  return { org_display, brokerage_name, reviews_url };
}

function renderPrompt(p: {
  lead_id: string;
  org_name: string;
  org_display: string;
  brokerage_name: string;
  slotA_human?: string;
  slotB_human?: string;
  reviews_url?: string;
}) {
  let s = SELLER_INTAKE_PROMPT;
  s = s.replaceAll('{{org_name}}', p.org_name || 'MPRE Residential');
  s = s.replaceAll('{{lead_id}}', p.lead_id || '');
  s = s.replaceAll('{{two_slot_a_human}}', p.slotA_human || 'tomorrow 10:00–10:20 AM (MST)');
  s = s.replaceAll('{{two_slot_b_human}}', p.slotB_human || 'tomorrow 3:30–3:50 PM (MST)');
  s = s.replaceAll('{{reviews_url}}', p.reviews_url || 'https://mpre.homes/reviews');
  s = s.replaceAll('{{org_display}}', p.org_display || 'MPRE Boise');
  s = s.replaceAll('{{brokerage_name}}', p.brokerage_name || 'Your Brokerage');
  return s;
}

// ----- Persistence (final full payload) -----
async function persistResults(
  a: SellerAnswers,
  lead_id: string,
  org_id: string | null,
  call_sid: string | null
) {
  const supabase = getSupabaseAdmin();

  const leadPatch: any = {
    first_name: a.first_name ?? (a.name ? a.name.split(' ').slice(0, -1).join(' ') || undefined : undefined),
    last_name: a.last_name ?? (a.name ? a.name.split(' ').slice(-1).join(' ') || undefined : undefined),
    email: a.email ?? undefined,
    phone: a.phone ?? undefined,
    city: a.city ?? undefined,
    motivation: a.motivation ?? undefined,
    notes: a.property_address ? `Address: ${a.property_address}${a.notes ? ` | ${a.notes}` : ''}` : a.notes ?? undefined,
    updated_at: new Date().toISOString(),
    purchase_type: a.intent === 'buy' ? 'buy' : a.intent === 'invest' ? 'invest' : 'sell'
  };
  Object.keys(leadPatch).forEach(k => leadPatch[k] === undefined && delete leadPatch[k]);

  if (Object.keys(leadPatch).length > 0) {
    const { error: leadErr } = await supabase.from('leads').update(leadPatch).eq('id', lead_id);
    if (leadErr) console.error('❌ leads update error:', leadErr.message);
  }

  const { error: assignErr } = await supabase.from('lead_assignments').upsert(
    {
      lead_id,
      org_id,
      assigned_user_id: null,
      source: 'inbound_seller',
      status: a.has_agent ? 'closed_other_agent' : 'pending',
      ack_deadline_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      notes: 'Samantha completed seller intake',
      appointment_at: a.appointment_at ?? null
    },
    { onConflict: 'lead_id' }
  );
  if (assignErr) console.error('❌ lead_assignments upsert error:', assignErr.message);
}

// ----- Incremental persistence (from <STATE> & <APPOINTMENT>) -----
async function persistPartialState(
  state: SellerAnswers,
  lead_id: string,
  org_id: string | null
) {
  const supabase = getSupabaseAdmin();

  const patch: any = {
    first_name: state.first_name ?? (state.name ? state.name.split(' ').slice(0, -1).join(' ') || undefined : undefined),
    last_name: state.last_name ?? (state.name ? state.name.split(' ').slice(-1).join(' ') || undefined : undefined),
    email: state.email ?? undefined,
    phone: state.phone ?? undefined,
    city: state.city ?? undefined,
    motivation: state.motivation ?? undefined,
    updated_at: new Date().toISOString(),
    purchase_type: state.intent === 'buy' ? 'buy' : state.intent === 'invest' ? 'invest' : 'sell'
  };
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('leads').update(patch).eq('id', lead_id);
    if (error) console.error('❌ partial leads update error:', error.message);
  }

  // If appointment_at present, tuck it into assignments early
  if (state.appointment_at) {
    const { error: assignErr } = await supabase.from('lead_assignments').upsert(
      {
        lead_id,
        org_id,
        assigned_user_id: null,
        source: 'inbound_seller',
        status: 'pending',
        ack_deadline_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        appointment_at: state.appointment_at
      },
      { onConflict: 'lead_id' }
    );
    if (assignErr) console.error('❌ partial lead_assignments upsert error:', assignErr.message);
  }
}

// Simple extractors for Samantha’s inline markers
function extractBlocks(raw: string) {
  const blocks: Array<{ kind: 'STATE' | 'APPOINTMENT' | 'END'; json: string }> = [];
  const add = (kind: 'STATE' | 'APPOINTMENT' | 'END', re: RegExp) => {
    for (const m of raw.matchAll(re)) {
      if (m[1]) blocks.push({ kind, json: m[1] });
    }
  };
  add('STATE', /<STATE>\s*(\{[\s\S]*?\})\s*<\/STATE>/g);
  add('APPOINTMENT', /<APPOINTMENT>\s*(\{[\s\S]*?\})\s*<\/APPOINTMENT>/g);
  add('END', /<END>\s*(\{[\s\S]*?\})\s*<\/END>/g);
  return blocks;
}

function safeParse<T = any>(s?: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

/** --------------------
 * POST -> Return TwiML
 * ------------------- */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lead_id = searchParams.get('id') || '';
    const org_id = searchParams.get('org_id') || '';
    const call_sid = searchParams.get('call_sid') || '';
    if (!lead_id) return new NextResponse('Missing lead_id', { status: 400 });

    const publicUrl = process.env.PUBLIC_URL!;
    const wsUrl = `${publicUrl.replace(/\/$/, '')}/api/twilio/inbound/seller-intake?id=${encodeURIComponent(lead_id)}&org_id=${encodeURIComponent(org_id)}&call_sid=${encodeURIComponent(call_sid)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}"/>
  </Connect>
</Response>`;

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (err: any) {
    console.error('❌ inbound seller-intake POST error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

/** -----------------------------------------
 * GET (Upgrade: websocket)
 * Twilio Media Streams <-> OpenAI Realtime
 * ---------------------------------------- */
export async function GET(req: Request) {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket', { status: 426 });
  }

  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('id') || 'unknown';
  const org_id = searchParams.get('org_id');
  const call_sid = searchParams.get('call_sid');

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return new Response('OPENAI_API_KEY not configured', { status: 500 });

  // Two appointment slots (replace with picks from your calendar service)
  const slotA_human = 'Tue 1:00–1:20 PM (MST)';
  const slotB_human = 'Wed 9:30–9:50 AM (MST)';

  // WebSocketPair (Edge runtime)
  const pair = new (globalThis as any).WebSocketPair();
  const twilioSocket = pair[0] as WebSocket;
  const serverSide = pair[1] as WebSocket;

  // --- OPENAI REALTIME WS ---
  const oaSocket = new WebSocket(
    'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
    [
      `openai-insecure-api-key.${openaiKey}`,
      'openai-beta.realtime-v1'
    ]
  );

  // When OpenAI connects, send system instructions (branding + slots)
  oaSocket.addEventListener('open', () => {
    getOrgBranding(org_id)
      .then((branding) => {
        const instructions = renderPrompt({
          lead_id,
          org_name: 'MPRE Residential',
          org_display: branding.org_display,
          brokerage_name: branding.brokerage_name,
          slotA_human,
          slotB_human,
          reviews_url: branding.reviews_url
        });

        oaSocket.send(JSON.stringify({
          type: 'response.create',
          response: {
            instructions,
            modalities: ['audio', 'text'],
            audio: { voice: 'alloy' }
          }
        }));
      })
      .catch((e) => {
        console.error('branding fetch failed', e);
        const instructions = renderPrompt({
          lead_id,
          org_name: 'MPRE Residential',
          org_display: 'MPRE Boise',
          brokerage_name: 'Your Brokerage',
          slotA_human,
          slotB_human
        });
        oaSocket.send(JSON.stringify({
          type: 'response.create',
          response: { instructions, modalities: ['audio','text'], audio: { voice: 'alloy' } }
        }));
      });
  });

  // Twilio -> OpenAI
  twilioSocket.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '{}');

      if (msg?.event === 'media' && msg.media?.payload) {
        oaSocket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: msg.media.payload }));
        oaSocket.send(JSON.stringify({ type: 'response.create' }));
      }

      if (msg?.event === 'stop') {
        try { oaSocket.close(); } catch {}
        try { twilioSocket.close(); } catch {}
      }
    } catch (e) {
      console.error('Twilio->OpenAI parse error', e);
    }
  });

  // OpenAI -> Twilio AND capture markers/tool events
  oaSocket.addEventListener('message', (ev) => {
    // 1) Forward audio deltas to Twilio
    try {
      const data: any = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data?.toString?.() || '{}');

      // Audio streaming out
      if (data?.type === 'output_audio.delta' && data?.audio) {
        twilioSocket.send(JSON.stringify({ event: 'media', media: { payload: data.audio } }));
      }

      // Handle tool event "intake.capture" (final payload)
      const maybeItems = data?.response?.output || data?.item || data;
      const items = Array.isArray(maybeItems) ? maybeItems : [maybeItems];

      for (const item of items) {
        const isTool = item?.type === 'tool' && item?.name === 'intake.capture';
        if (isTool) {
          const content = item?.content?.[0];
          if (content?.type === 'input_text' && content?.text) {
            try {
              const answers: SellerAnswers = JSON.parse(content.text);
              persistResults(answers, lead_id, org_id, call_sid).catch((e) => console.error('persistResults error', e));
            } catch (e) {
              console.error('JSON parse from intake.capture failed', e);
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors; we also scan raw text below
    }

    // 2) Scan raw frame for our inline markers <STATE>/<APPOINTMENT>/<END>
    try {
      const raw = typeof ev.data === 'string' ? ev.data : ev.data?.toString?.() || '';
      const blocks = extractBlocks(raw);

      for (const b of blocks) {
        if (b.kind === 'STATE') {
          const state = safeParse<SellerAnswers>(b.json);
          if (state) {
            // Persist partial contact & other known fields
            persistPartialState(state, lead_id, org_id || null).catch((e) =>
              console.error('persistPartialState error', e)
            );
          }
        }

        if (b.kind === 'APPOINTMENT') {
          const appt = safeParse<{ slot_iso?: string; slot_human?: string; choice?: 'A' | 'B' }>(b.json);
          if (appt?.slot_iso || appt?.slot_human) {
            persistPartialState(
              { intent: 'sell', appointment_at: appt.slot_iso || null, appointment_human: appt.slot_human || null },
              lead_id,
              org_id || null
            ).catch((e) => console.error('persistPartialState (appt) error', e));
          }
        }

        if (b.kind === 'END') {
          // noop here; final tool event still handles full persistence
        }
      }
    } catch (e) {
      console.error('Marker scan error:', e);
    }

    // Close behavior when OpenAI indicates completion
    try {
      const data: any = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data?.toString?.() || '{}');
      if (data?.type === 'response.completed') {
        twilioSocket.send(JSON.stringify({ event: 'mark', name: 'call_end' }));
        try { oaSocket.close(); } catch {}
        try { twilioSocket.close(); } catch {}
      }
    } catch {}
  });

  oaSocket.addEventListener('close', () => {
    try { twilioSocket.close(); } catch {}
  });
  oaSocket.addEventListener('error', (err) => {
    console.error('OpenAI WS error:', err);
    try { twilioSocket.close(); } catch {}
  });

  (serverSide as any).accept();

  return new Response(null, { status: 101, webSocket: twilioSocket } as any);
}
