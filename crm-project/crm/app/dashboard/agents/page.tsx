// crm/app/dashboard/agents/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser'; // ✅ corrected path
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

// ----- Supabase (singleton) -----
const supabase = getSupabaseBrowser();

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
  appointment_type: string | null;
  agent_id: number | null;
};

type Agent = {
  id: number;
  name: string | null;
  email: string | null;
};

type IdxAgg = { lead_id: string; max: string | null; count: number | null };
type MsgAgg = { lead_id: string; max: string | null };

type Row = {
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

export default function AgentsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Record<number, Agent>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<number | 'ALL'>('ALL');

  const [idxAgg, setIdxAgg] = useState<Record<string, { last: string | null; count: number }>>({});
  const [msgAgg, setMsgAgg] = useState<Record<string, string | null>>({});

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const since30dISO = useMemo(() => dayjs().subtract(30, 'day').toISOString(), []);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data: leadsData, error: leadsErr } = await supabase
        .from('leads')
        .select(
          `id, created_at, first_name, last_name, name, email, phone, status, appointment_type, agent_id`
        )
        .order('created_at', { ascending: false })
        .limit(2000);

      if (!mounted) return;

      if (leadsErr) {
        setError(leadsErr.message);
        setLeads([]);
        setIdxAgg({});
        setMsgAgg({});
        setAgents({});
        setLoading(false);
        return;
      }

      const list = (leadsData || []) as Lead[];
      setLeads(list);

      const agentIds = Array.from(
        new Set(list.map((l) => l.agent_id).filter((v): v is number => typeof v === 'number'))
      );

      let agentMap: Record<number, Agent> = {};
      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsErr } = await supabase
          .from('agents')
          .select('id, name, email')
          .in('id', agentIds);

        if (!agentsErr && agentsData) {
          for (const a of agentsData as Agent[]) {
            agentMap[a.id] = a;
          }
        } else {
          for (const id of agentIds) {
            agentMap[id] = { id, name: null, email: null };
          }
        }
      }
      setAgents(agentMap);

      const leadIds = list.map((l) => l.id);
      let idxMap: Record<string, { last: string | null; count: number }> = {};
      let msgMap: Record<string, string | null> = {};

      if (leadIds.length > 0) {
        const { data: idxData } = await supabase
          .from('idx_views')
          .select('lead_id, max:viewed_at, count:id')
          .gte('viewed_at', since30dISO)
          .in('lead_id', leadIds);

        if (idxData) {
          (idxData as unknown as IdxAgg[]).forEach((r) => {
            idxMap[r.lead_id] = { last: r.max, count: Number(r.count || 0) };
          });
        }

        const { data: msgData } = await supabase
          .from('messages')
          .select('lead_id, max:created_at')
          .in('lead_id', leadIds);

        if (msgData) {
          (msgData as unknown as MsgAgg[]).forEach((m) => {
            msgMap[m.lead_id] = m.max || null;
          });
        }
      }

      if (!mounted) return;
      setIdxAgg(idxMap);
      setMsgAgg(msgMap);
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel('realtime:leads-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [since30dISO]);

  const agentOptions = useMemo(() => {
    const ids = Array.from(
      new Set(leads.map((l) => l.agent_id).filter((v): v is number => typeof v === 'number'))
    ).sort((a, b) => a - b);

    return [
      { value: 'ALL' as const, label: 'All Agents' },
      ...ids.map((id) => {
        const a = agents[id];
        const label = a?.name || a?.email || `Agent #${id}`;
        return { value: id, label };
      }),
    ];
  }, [leads, agents]);

  const rowsByAgent: Record<number, Row[]> = useMemo(() => {
    const byAgent: Record<number, Row[]> = {};
    const norm = (s?: string | null) => (s || '').trim();

    for (const l of leads) {
      if (typeof l.agent_id !== 'number') continue;
      const first = norm(l.first_name) || (norm(l.name).split(' ')[0] || '');
      const last =
        norm(l.last_name) ||
        (norm(l.name).split(' ').length > 1 ? norm(l.name).split(' ').slice(1).join(' ') : '');
      const idx = idxAgg[l.id] || { last: null, count: 0 };
      const latest = msgAgg[l.id] || null;

      const row: Row = {
        id: l.id,
        first,
        last,
        phone: norm(l.phone),
        status: norm(l.status),
        type: norm(l.appointment_type) || '-',
        lastIdxVisit: idx.last,
        idxViews30d: idx.count,
        latestComm: latest,
      };

      if (!byAgent[l.agent_id]) byAgent[l.agent_id] = [];
      byAgent[l.agent_id].push(row);
    }
    return byAgent;
  }, [leads, idxAgg, msgAgg]);

  const agentSummaries = useMemo(() => {
    const sums: Record<number, { total: number; active30d: number; contacted: number }> = {};
    for (const [agentIdStr, rows] of Object.entries(rowsByAgent)) {
      const agentId = Number(agentIdStr);
      let total = rows.length;
      let active30d = rows.filter((r) => r.idxViews30d > 0).length;
      let contacted = rows.filter((r) => r.latestComm != null).length;
      sums[agentId] = { total, active30d, contacted };
    }
    return sums;
  }, [rowsByAgent]);

  const visibleRows = useMemo(() => {
    let rows: Row[] =
      selectedAgentId === 'ALL'
        ? Object.values(rowsByAgent).flat()
        : rowsByAgent[selectedAgentId] || [];

    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (r) =>
          r.first.toLowerCase().includes(term) ||
          r.last.toLowerCase().includes(term) ||
          r.phone.toLowerCase().includes(term) ||
          r.status.toLowerCase().includes(term) ||
          r.type.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'ALL') {
      const s = statusFilter.toLowerCase();
      rows = rows.filter((r) => r.status.toLowerCase() === s || r.status.toLowerCase().includes(s));
    }

    return rows;
  }, [rowsByAgent, selectedAgentId, search, statusFilter]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Agents & Leads</h1>

        <div className="flex gap-2 flex-wrap">
          {/* Agent picker */}
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={String(selectedAgentId)}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedAgentId(v === 'ALL' ? 'ALL' : Number(v));
            }}
          >
            {agentOptions.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Status quick filter */}
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title="Filter by lead status"
          >
            <option value="ALL">All statuses</option>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="client">Client</option>
            <option value="under contract">Under Contract</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>

          {/* Search */}
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Search name, phone, status, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* Agent summary cards (hidden when ALL) */}
      {selectedAgentId !== 'ALL' && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Leads</div>
            <div className="text-2xl font-bold">
              {agentSummaries[selectedAgentId]?.total ?? 0}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">IDX Active (30d)</div>
            <div className="text-2xl font-bold">
              {agentSummaries[selectedAgentId]?.active30d ?? 0}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Leads with Recent Comm</div>
            <div className="text-2xl font-bold">
              {agentSummaries[selectedAgentId]?.contacted ?? 0}
            </div>
          </div>
        </section>
      )}

      {/* Leads table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Agent</th>
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
            {visibleRows.map((r) => {
              const lead = leads.find((l) => l.id === r.id);
              const agentLabel =
                typeof lead?.agent_id === 'number'
                  ? (agents[lead.agent_id]?.name ||
                      agents[lead.agent_id]?.email ||
                      `Agent #${lead.agent_id}`)
                  : '—';

              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{agentLabel}</td>
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
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={9}>
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
