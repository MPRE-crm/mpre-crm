// app/api/twilio/inbound/seller-intake/route.ts
// One file handles both TwiML (POST) and the Media Stream bridge (GET -> WS).
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Fixed relative import for seller-intake prompt
import SELLER_INTAKE_PROMPT from '../../../../lib/prompts/seller-intake.js';

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
  name?: string;
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
  appointment_at?: string | null;
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

// … rest of file unchanged …
