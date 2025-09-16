// app/api/twilio/inbound/buyer-intake/route.ts
// One file handles both TwiML (POST) and the Media Stream bridge (GET -> WS).
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Relative imports (no @lib)
import BUYER_INTAKE_PROMPT from '../../../../../lib/prompts/buyer-intake';
import { getMarketSummaryText } from '../../../../../lib/market/summary';

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
type IntakeAnswers = {
  intent?: 'buy' | 'sell' | 'invest';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  from_location?: string | null;

  // Buyer-specific
  area?: string | null;
  timeline?: string | null;
  price?: string | null;
  financing?: 'cash' | 'finance' | null;
  has_agent?: boolean | null;
  consent_sms?: boolean | null;
  consent_email?: boolean | null;
  appointment_at?: string | null; // ISO
  notes?: string | null;
};

// ----- Utils -----
function extractPriceMinMax(text?: string): { price_min: number | null; price_max: number | null } {
  if (!text) return { price_min: null, price_max: null };
  const nums = (text.match(/\$?\s?(\d{2,3}(?:[.,]?\d{3})*)/g) || [])
    .map(s => Number(s.replace(/[^0-9]/g, '')))
    .filter(n => Number.isFinite(n));
  if (!nums.length) return { price_min: null, price_max: null };
  if (nums.length === 1) return { price_min: nums[0], price_max: null };
  return { price_min: Math.min(...nums), price_max: Math.max(...nums) };
}

// Pull per-org branding (name + brokerage) for the “powered by …” line
async function getOrgBranding(org_id?: string | null) {
  const supabase = getSupabaseAdmin();
  if (!org_id) return { org_display: 'MPRE Boise', brokerage_name: 'Your Brokerage', reviews_url: 'https://mpre.homes/reviews' };

  // organizations: id, name
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id,name')
    .eq('id', org_id)
    .maybeSingle();

  // orgs: id, name, brokerage_name  (your schema includes brokerage_name here)
  const { data: org2, error: org2Err } = await supabase
    .from('orgs')
    .select('id,name,brokerage_name')
    .eq('id', org_id)
    .maybeSingle();

  // (Optional) store reviews_url in orgs later; default for now:
  const reviews_url = 'https://mpre.homes/reviews';

  const org_display = org2?.name || org?.name || 'MPRE Boise';
  const brokerage_name = org2?.brokerage_name || 'Your Brokerage';
  return { org_display, brokerage_name, reviews_url };
}

function renderPrompt(p: {
  lead_id: string;
  org_name: string;
  org_display: string;
  brokerage_name: string;
  slotA_human?: string;
  slotB_human?: string;
  market_summary_text?: string;
  reviews_url?: string;
}) {
  let s = BUYER_INTAKE_PROMPT;
  s = s.replaceAll('{{org_name}}', p.org_name || 'MPRE Residential');
  s = s.replaceAll('{{lead_id}}', p.lead_id || '');
  s = s.replaceAll('{{two_slot_a_human}}', p.slotA_human || 'tomorrow 10:00–10:20 AM (MST)');
  s = s.replaceAll('{{two_slot_b_human}}', p.slotB_human || 'tomorrow 3:30–3:50 PM (MST)');
  s = s.replaceAll('{{market_summary_text}}', p.market_summary_text || 'Ada/Canyon: latest data unavailable');
  s = s.replaceAll('{{reviews_url}}', p.reviews_url || 'https://mpre.homes/reviews');
  // NEW: dynamic branding placeholders used by the shared opening
  s = s.replaceAll('{{org_display}}', p.org_display || 'MPRE Boise');
  s = s.replaceAll('{{brokerage_name}}', p.brokerage_name || 'Your Brokerage');
  return s;
}

// ----- Persistence -----
async function persistResults(
  answers: IntakeAnswers,
  lead_id: string,
  org_id: string | null,
  call_sid: string | null
) {
  const supabase = getSupabaseAdmin();

  // 1) Update LEADS with newly captured contact info (id is uuid)
  const leadPatch: any = {
    first_name: answers.first_name ?? undefined,
    last_name: answers.last_name ?? undefined,
    email: answers.email ?? undefined,
    phone: answers.phone ?? undefined,
    city: answers.from_location ?? undefined,
    updated_at: new Date().toISOString()
  };
  Object.keys(leadPatch).forEach(k => leadPatch[k] === undefined && delete leadPatch[k]);

  if (Object.keys(leadPatch).length > 0) {
    const { error: leadErr } = await supabase.from('leads').update(leadPatch).eq('id', lead_id);
    if (leadErr) console.error('❌ leads update error:', leadErr.message);
  }

  // 2) Buyer intake table (only when they are buyers or unsure)
  if (!answers.intent || answers.intent === 'buy') {
    const { price_min, price_max } = extractPriceMinMax(answers.price || undefined);

    const intakeRecord: any = {
      lead_id,
      org_id,
      call_sid,
      area: answers.area ?? null,
      timeline: answers.timeline ?? null,
      price_min,
      price_max,
      beds: null,
      baths: null,
      sqft_min: null,
      lot_min: null,
      financing: answers.financing ?? null,
      has_agent: answers.has_agent ?? null,
      notes: answers.notes ?? null,
      created_at: new Date().toISOString()
    };

    const { error: intakeErr } = await supabase
      .from('buyer_intake')
      .upsert(intakeRecord, { onConflict: 'lead_id' });
    if (intakeErr) console.error('❌ buyer_intake upsert error:', intakeErr.message);

    // IDX request seed
    const { error: idxErr } = await supabase.from('idx_search_requests').insert([
      {
        lead_id,
        org_id,
        params: { area: answers.area ?? null, price_min, price_max },
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ]);
    if (idxErr) console.error('❌ idx_search_requests insert error:', idxErr.message);
  }

  // 3) Lead assignment record (generic)
  const { error: assignErr } = await supabase.from('lead_assignments').upsert(
    {
      lead_id,
      org_id,
      assigned_user_id: null,
      source: 'inbound_call',
      status: 'pending',
      ack_deadline_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      notes: answers.intent ? `Intent: ${answers.intent}` : 'Samantha completed intake'
    },
    { onConflict: 'lead_id' }
  );
  if (assignErr) console.error('❌ lead_assignments upsert error:', assignErr.message);
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
    const wsUrl = `${publicUrl.replace(/\/$/, '')}/api/twilio/inbound/buyer-intake?id=${encodeURIComponent(lead_id)}&org_id=${encodeURIComponent(org_id)}&call_sid=${encodeURIComponent(call_sid)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}"/>
  </Connect>
</Response>`;

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (err: any) {
    console.error('❌ inbound buyer-intake POST error', err);
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

  // Two appointment slots (replace with real picks from your calendar service)
  const slotA_human = 'Tue 3:30–3:50 PM (MST)';
  const slotB_human = 'Wed 10:00–10:20 AM (MST)';

  // WebSocketPair (Edge runtime)
  const pair = new (globalThis as any).WebSocketPair();
  const twilioSocket = pair[0] as WebSocket; // exposed to Twilio
  const serverSide = pair[1] as WebSocket;   // our server-side handle

  // --- OPENAI REALTIME WS ---
  const oaSocket = new WebSocket(
    'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
    [
      `openai-insecure-api-key.${openaiKey}`,
      'openai-beta.realtime-v1'
    ]
  );

  // When OpenAI connects, send system instructions (branding + market + slots)
  oaSocket.addEventListener('open', () => {
    Promise.all([
      getMarketSummaryText().catch((e) => {
        console.error('market summary failed', e);
        return 'Ada/Canyon: latest data unavailable';
      }),
      getOrgBranding(org_id).catch((e) => {
        console.error('branding fetch failed', e);
        return { org_display: 'MPRE Boise', brokerage_name: 'Your Brokerage', reviews_url: 'https://mpre.homes/reviews' };
      })
    ]).then(([marketSummary, branding]) => {
      const instructions = renderPrompt({
        lead_id,
        org_name: 'MPRE Residential',
        org_display: branding.org_display,
        brokerage_name: branding.brokerage_name,
        slotA_human,
        slotB_human,
        market_summary_text: marketSummary as string,
        reviews_url: (branding as any).reviews_url
      });

      oaSocket.send(JSON.stringify({
        type: 'response.create',
        response: {
          instructions,
          modalities: ['audio', 'text'],
          audio: { voice: 'alloy' }
        }
      }));
    });
  });

  // Twilio -> OpenAI
  twilioSocket.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '{}');

    // Media frames
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

  // OpenAI -> Twilio AND tool capture
  oaSocket.addEventListener('message', (ev) => {
    let data: any;
    try { data = JSON.parse(ev.data.toString()); } catch { /* binary frames possible */ }

    // Handle tool-like result envelopes
    try {
      const maybeItems = data?.response?.output || data?.item || data;
      const items = Array.isArray(maybeItems) ? maybeItems : [maybeItems];

      for (const item of items) {
        // Accept both names for backwards-compat
        const isTool = item?.type === 'tool' && (item?.name === 'intake.capture' || item?.name === 'lpmama.capture');
        if (isTool) {
          const content = item?.content?.[0];
          if (content?.type === 'input_text' && content?.text) {
            try {
              const answers: IntakeAnswers = JSON.parse(content.text);
              persistResults(answers, lead_id, org_id, call_sid).catch((e) => console.error('persistResults error', e));
            } catch (e) {
              console.error('JSON parse from intake.capture failed', e);
            }
          }
        }
      }
    } catch { /* non-fatal */ }

    // Stream audio back to Twilio
    if (data?.type === 'output_audio.delta' && data?.audio) {
      twilioSocket.send(JSON.stringify({ event: 'media', media: { payload: data.audio } }));
    }

    if (data?.type === 'response.completed') {
      twilioSocket.send(JSON.stringify({ event: 'mark', name: 'call_end' }));
      try { oaSocket.close(); } catch {}
      try { twilioSocket.close(); } catch {}
    }
  });

  oaSocket.addEventListener('close', () => {
    try { twilioSocket.close(); } catch {}
  });
  oaSocket.addEventListener('error', (err) => {
    console.error('OpenAI WS error:', err);
    try { twilioSocket.close(); } catch {}
  });

  // Accept the server-side socket (Edge adds .accept() at runtime)
  (serverSide as any).accept();

  // Return upgraded response
  return new Response(null, { status: 101, webSocket: twilioSocket } as any);
}
