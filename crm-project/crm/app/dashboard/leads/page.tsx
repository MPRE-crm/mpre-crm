// crm/app/dashboard/leads/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

// ----- Supabase (browser) -----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Toggle with NEXT_PUBLIC_USE_LEADS_VIEW=false to force fallback
const USE_VIEW = process.env.NEXT_PUBLIC_USE_LEADS_VIEW !== 'false';

// ----- Types -----
type Lead = {
  id: string;
  created_at: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  lead_source: string | null;
  appointment_type: string | null; // using as "Type" (buyer/seller/investor/renter) unless you have a dedicated field
};

type Profile = { role: 'agent' | 'admin' | 'platform_admin'; org_id: string };

type IdxAgg = { lead_id: string; max: string | null; count: number | null };
type MsgAgg = { lead_id: string; max: string | null };

type TableRow = {
  id: string;
  first: string;
  last: string;
  phone: string;
  status: string;
  type: string;
  lastIdxVisit: string | null;
  idxViews30d: number;
  latestComm: string | null;
};

type StatusFilter =
  | 'ALL'
  | 'NEW'
  | 'SPHERE'
  | 'ACTIVE'
  | 'CLIENT'
  | 'UNDER_CONTRACT'
  | 'CLOSED'
  | 'ARCHIVED';

const STATUS_BUTTONS: { key: StatusFilter; label: string; match: string | null }[] = [
  { key: 'ALL', label: 'All', match: null },
  { key: 'NEW', label: 'New Leads', match: 'new' },
  { key: 'SPHERE', label: 'Sphere', match: 'sphere' },
  { key: 'ACTIVE', label: 'Active Clients', match: 'active' },
  { key: 'CLIENT', label: 'Clients', match: 'client' },
  { key: 'UNDER_CONTRACT', label: 'Under Contract', match: 'under contract' },
  { key: 'CLOSED', label: 'Closed', match: 'closed' },
  { key: 'ARCHIVED', label: 'Archived', match: 'archived' },
];

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [idxAgg, setIdxAgg] = useState<Record<string, { last: string | null; count: number }>>({});
  const [msgAgg, setMsgAgg] = useState<Record<string, string | null>>({});

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [daysFilter, setDaysFilter] = useState<number | null>(null); // 7, 30, null=all

  const since30dISO = useMemo(() => dayjs().subtract(30, 'day').toISOString(), []);
  const sinceDaysISO = useMemo(
    () => (daysFilter ? dayjs().subtract(daysFilter, 'day').toISOString() : null),
    [daysFilter]
  );

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      // --- 0) who am I + my profile/role? ---
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        if (!mounted) return;
        setError(userErr?.message || 'Not authenticated');
        setLeads([]);
        setIdxAgg({});
        setMsgAgg({});
        setLoading(false);
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', userRes.user.id)
        .single();

      if (!mounted) return;

      if (profErr || !prof) {
        setError(profErr?.message || 'Profile not found');
        setLeads([]);
        setIdxAgg({});
        setMsgAgg({});
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      // --- 1) Leads: try view first, then fallback to table with minimal filters ---
      let leadsData: Lead[] | null = null;
      let leadsErrMsg: string | null = null;

      if (USE_VIEW) {
        const { data, error } = await supabase
          .from('leads_visible_to_me')
          .select(
            'id, created_at, first_name, last_name, name, email, phone, status, lead_source, appointment_type'
          )
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) {
          // View path failed; we’ll fall back
          leadsErrMsg = error.message;
        } else {
          leadsData = (data || []) as Lead[];
        }
      }

      if (!leadsData) {
        // Fallback path: minimal, role-aware filters (mirror RLS)
        let q = supabase
          .from('leads')
          .select(
            'id, created_at, first_name, last_name, name, email, phone, status, lead_source, appointment_type'
          )
          .order('created_at', { ascending: false })
          .limit(1000);

        if (prof.role === 'agent') {
          q = q.eq('agent_id', userRes.user.id);
        } else if (prof.role === 'admin') {
          q = q.eq('org_id', prof.org_id);
        } // platform_admin: no extra filter; RLS allows all

        const { data, error } = await q;
        if (error) {
          if (!mounted) return;
          setError(leadsErrMsg || error.message);
          setLeads([]);
          setIdxAgg({});
          setMsgAgg({});
          setLoading(false);
          return;
        }
        leadsData = (data || []) as Lead[];
      }

      if (!mounted) return;
      setLeads(leadsData);

      const ids = leadsData.map((l) => l.id);
      if (ids.length === 0) {
        setIdxAgg({});
        setMsgAgg({});
        setLoading(false);
        return;
      }

      // --- 2) IDX aggregation (last visit + count in last 30 days) ---
      const { data: idxData, error: idxErr } = await supabase
        .from('idx_views')
        .select('lead_id, max:viewed_at, count:id')
        .gte('viewed_at', since30dISO)
        .in('lead_id', ids);

      const idxMap: Record<string, { last: string | null; count: number }> = {};
      if (!idxErr && idxData) {
        (idxData as unknown as IdxAgg[]).forEach((r) => {
          idxMap[r.lead_id] = { last: r.max, count: Number(r.count || 0) };
        });
      }

      // --- 3) Latest comm (optional) from messages table ---
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .select('lead_id, max:created_at')
        .in('lead_id', ids);

      const msgMap: Record<string, string | null> = {};
      if (!msgErr && msgData) {
        (msgData as unknown as MsgAgg[]).forEach((m) => {
          msgMap[m.lead_id] = m.max || null;
        });
      }

      if (!mounted) return;
      setIdxAgg(idxMap);
      setMsgAgg(msgMap);
      setLoading(false);
    };

    fetchAll();

    // optional: live updates on leads table
    const channel = supabase
      .channel('realtime:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchAll)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [since30dISO]);

  // Merge to table rows
  const rows: TableRow[] = useMemo(() => {
    const norm = (s?: string | null) => (s || '').trim();
    return leads.map((l) => {
      const first = norm(l.first_name) || (norm(l.name).split(' ')[0] || '');
      const last =
        norm(l.last_name) ||
        (norm(l.name).split(' ').length > 1 ? norm(l.name).split(' ').slice(1).join(' ') : '');
      const idx = idxAgg[l.id] || { last: null, count: 0 };
      const latest = msgAgg[l.id] || null;

      return {
        id: l.id,
        first,
        last,
        phone: norm(l.phone),
        status: norm(l.status),
        type: norm(l.appointment_type) || '-', // swap to your real "type" field if you have one
        lastIdxVisit: idx.last,
        idxViews30d: idx.count,
        latestComm: latest,
      };
    });
  }, [leads, idxAgg, msgAgg]);

  // Apply filters/search/date locally
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const statusConf = STATUS_BUTTONS.find((b) => b.key === statusFilter);

    return rows.filter((r) => {
      const createdAt = leads.find((l) => l.id === r.id)?.created_at || null;

      const matchesDate =
        !sinceDaysISO || (createdAt ? dayjs(createdAt).isAfter(sinceDaysISO) : false);

      const matchesStatus =
        !statusConf?.match ||
        r.status.toLowerCase() === statusConf.match ||
        r.status.toLowerCase().includes(statusConf.match);

      const matchesSearch =
        term.length === 0 ||
        r.first.toLowerCase().includes(term) ||
        r.last.toLowerCase().includes(term) ||
        r.phone.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term) ||
        r.type.toLowerCase().includes(term);

      return matchesDate && matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter, sinceDaysISO, leads]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>

        {/* Quick status filters */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_BUTTONS.map((b) => (
            <button
              key={b.key}
              onClick={() => setStatusFilter(b.key)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                statusFilter === b.key ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
              }`}
              title={b.label}
            >
              {b.label}
            </button>
          ))}
        </div>
      </header>

      {/* Search + date range */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, status, type…"
          className="w-full sm:w-1/2 rounded-md border px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          {[7, 30, null].map((d) => (
            <button
              key={String(d)}
              onClick={() => setDaysFilter(d)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                daysFilter === d ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
              }`}
            >
              {d ? `Last ${d} Days` : 'All Time'}
            </button>
          ))}
          <span className="self-center text-xs text-gray-500">
            Showing {filteredRows.length} of {rows.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">First</th>
              <th className="px-4 py-2">Last</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Last IDX Visit</th>
              <th className="px-4 py-2">IDX Activity (30d)</th>
              <th className="px-4 py-2">Latest Communication</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap">{r.first || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.last || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.phone || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.status || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.type || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.lastIdxVisit ? dayjs(r.lastIdxVisit).fromNow() : '-'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{r.idxViews30d}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.latestComm ? dayjs(r.latestComm).fromNow() : '-'}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>
                  No leads match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {loading && <div className="text-xs text-gray-500">Loading…</div>}
    </div>
  );
}
