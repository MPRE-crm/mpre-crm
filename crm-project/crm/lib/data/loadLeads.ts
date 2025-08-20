// crm/lib/data/loadLeads.ts

import { supabaseServer } from '../supabaseServer';

const USE_VIEW = process.env.NEXT_PUBLIC_USE_LEADS_VIEW !== 'false';

export async function loadLeadsForPage() {
  const supabase = supabaseServer;

  // 1) auth + profile
  const {
    data: { user },
    error: ue,
  } = await supabase.auth.getUser();
  if (ue || !user) throw ue || new Error('No user');

  const { data: profile, error: pe } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();
  if (pe || !profile) throw pe || new Error('No profile');

  // 2) primary path: query the view (lets RLS decide)
  if (USE_VIEW) {
    const { data: leads, error } = await supabase
      .from('leads_visible_to_me')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) return { leads, profile };

    console.warn('leads_visible_to_me error, falling back:', error?.message);
  }

  // 3) fallback path: direct-table fetch with minimal, role-aware filters
  let q = supabase
    .from('leads')
    .select(
      'id, first_name, last_name, email, phone, agent_id, org_id, created_at'
    )
    .order('created_at', { ascending: false });

  if (profile.role === 'agent') {
    q = q.eq('agent_id', user.id); // agents: own leads only
  } else if (profile.role === 'admin') {
    q = q.eq('org_id', profile.org_id); // admins: org scope
  } else if (profile.role === 'platform_admin') {
    // platform_admin: no extra filter
  }

  const { data: leads, error: le } = await q;
  if (le) throw le;

  return { leads, profile };
}
