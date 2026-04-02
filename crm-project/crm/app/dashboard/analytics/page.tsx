'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Profile = {
  role: 'agent' | 'admin' | 'platform_admin';
  org_id: string | null;
};

type Lead = {
  id: string;
  created_at: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  phone: string | null;
  status: string | null;
  lead_status?: string | null;
  lead_type: string | null;
  lead_source: string | null;
  lead_source_detail: string | null;
  appointment_requested: boolean | null;
  appointment_attended: boolean | null;
  appointment_status: string | null;
  lead_heat: string | null;
  next_contact_at: string | null;
  agent_id: string | null;
  org_id: string | null;
};

type Message = {
  id: string;
  lead_id: string | null;
  created_at: string | null;
  direction: string | null;
  status: string | null;
};

type MissedCall = {
  id: string;
  lead_id: string;
  detected_at: string | null;
  callback_status: string | null;
};

type SourceRow = {
  source: string;
  detail: string;
  total: number;
  appointments_set: number;
  attended: number;
  under_contract: number;
  closed: number;
};

type PieRow = {
  name: string;
  value: number;
};

type PerformancePieRow = {
  name: string;
  total: number;
  closed: number;
  value: number;
};

function norm(v?: string | null) {
  return (v || '').trim();
}

function lower(v?: string | null) {
  return norm(v).toLowerCase();
}

function isUnderContract(status?: string | null) {
  const s = lower(status);
  return s === 'under contract' || s.includes('under contract');
}

function isClosed(status?: string | null) {
  const s = lower(status);
  return s === 'closed' || s.includes('closed');
}

function isHot(v?: string | null) {
  return lower(v) === 'hot';
}

function isWarm(v?: string | null) {
  return lower(v) === 'warm';
}

function isCold(v?: string | null) {
  return lower(v) === 'cold';
}

function card(title: string, value: number | string, sub?: string) {
  return { title, value, sub };
}

const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#059669',
  '#9333ea',
  '#0f766e',
];

function buildPieRows(values: string[]): PieRow[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = norm(value) || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function percentOf(total: number, value: number) {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(0)}%`;
}

function buildClosedPerformancePieRows(params: {
  leads: Lead[];
  groupBy: 'source' | 'detail';
}): PerformancePieRow[] {
  const map = new Map<string, PerformancePieRow>();

  for (const lead of params.leads) {
    const name =
      params.groupBy === 'source'
        ? norm(lead.lead_source) || 'Unknown'
        : norm(lead.lead_source_detail) || 'Unknown';

    if (!map.has(name)) {
      map.set(name, {
        name,
        total: 0,
        closed: 0,
        value: 0,
      });
    }

    const row = map.get(name)!;
    row.total += 1;

    if (isClosed(lead.status)) {
      row.closed += 1;
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      value: row.closed,
    }))
    .filter((row) => row.closed > 0)
    .sort((a, b) => b.closed - a.closed);
}

function pieLabel({
  name,
  percent,
}: {
  name?: string;
  percent?: number;
}) {
  return `${name ?? 'Unknown'} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);

  const now = useMemo(() => dayjs(), []);
  const sevenDaysAgo = useMemo(() => now.subtract(7, 'day'), [now]);
  const thirtyDaysAgo = useMemo(() => now.subtract(30, 'day'), [now]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        if (!mounted) return;
        setError(userErr?.message || 'Not authenticated');
        setLoading(false);
        return;
      }

      const userId = userRes.user.id;

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', userId)
        .single();

      if (!mounted) return;

      if (profErr || !prof) {
        setError(profErr?.message || 'Profile not found');
        setLoading(false);
        return;
      }

      const typedProfile = prof as Profile;
      setProfile(typedProfile);

      let leadsQuery = supabase
        .from('leads')
        .select(`
          id,
          created_at,
          first_name,
          last_name,
          name,
          phone,
          status,
          lead_type,
          lead_source,
          lead_source_detail,
          appointment_requested,
          appointment_attended,
          appointment_status,
          lead_heat,
          next_contact_at,
          agent_id,
          org_id
        `)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (typedProfile.role === 'agent') {
        leadsQuery = leadsQuery.eq('agent_id', userId);
      } else if (typedProfile.role === 'admin') {
        leadsQuery = leadsQuery.eq('org_id', typedProfile.org_id);
      }

      const { data: leadsData, error: leadsErr } = await leadsQuery;

      if (!mounted) return;

      if (leadsErr) {
        setError(leadsErr.message);
        setLoading(false);
        return;
      }

      const leadRows = (leadsData || []) as Lead[];
      setLeads(leadRows);

      const leadIds = leadRows.map((l) => l.id);

      if (leadIds.length === 0) {
        setMessages([]);
        setMissedCalls([]);
        setLoading(false);
        return;
      }

      const { data: msgData } = await supabase
        .from('messages')
        .select('id, lead_id, created_at, direction, status')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false })
        .limit(5000);

      const { data: missedData } = await supabase
        .from('missed_call_logs')
        .select('id, lead_id, detected_at, callback_status')
        .in('lead_id', leadIds)
        .order('detected_at', { ascending: false })
        .limit(2000);

      if (!mounted) return;

      setMessages((msgData || []) as Message[]);
      setMissedCalls((missedData || []) as MissedCall[]);
      setLoading(false);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const totalLeads = leads.length;
    const new7d = leads.filter((l) => l.created_at && dayjs(l.created_at).isAfter(sevenDaysAgo)).length;
    const new30d = leads.filter((l) => l.created_at && dayjs(l.created_at).isAfter(thirtyDaysAgo)).length;

    const appointmentsSet = leads.filter(
      (l) => l.appointment_requested === true || lower(l.appointment_status).includes('confirm')
    ).length;

    const appointmentsAttended = leads.filter((l) => l.appointment_attended === true).length;
    const underContract = leads.filter((l) => isUnderContract(l.status)).length;
    const closed = leads.filter((l) => isClosed(l.status)).length;

    const hot = leads.filter((l) => isHot(l.lead_heat)).length;
    const warm = leads.filter((l) => isWarm(l.lead_heat)).length;
    const cold = leads.filter((l) => isCold(l.lead_heat)).length;

    const followUpOverdue = leads.filter(
      (l) => l.next_contact_at && dayjs(l.next_contact_at).isBefore(dayjs())
    ).length;

    const msgs7d = messages.filter((m) => m.created_at && dayjs(m.created_at).isAfter(sevenDaysAgo)).length;
    const missed7d = missedCalls.filter((m) => m.detected_at && dayjs(m.detected_at).isAfter(sevenDaysAgo)).length;

    return {
      totalLeads,
      new7d,
      new30d,
      appointmentsSet,
      appointmentsAttended,
      underContract,
      closed,
      hot,
      warm,
      cold,
      followUpOverdue,
      msgs7d,
      missed7d,
    };
  }, [leads, messages, missedCalls, sevenDaysAgo, thirtyDaysAgo]);

  const sourceRows = useMemo<SourceRow[]>(() => {
    const map = new Map<string, SourceRow>();

    for (const lead of leads) {
      const source = norm(lead.lead_source) || 'Unknown';
      const detail = norm(lead.lead_source_detail) || 'Unknown';
      const key = `${source}__${detail}`;

      if (!map.has(key)) {
        map.set(key, {
          source,
          detail,
          total: 0,
          appointments_set: 0,
          attended: 0,
          under_contract: 0,
          closed: 0,
        });
      }

      const row = map.get(key)!;
      row.total += 1;

      if (lead.appointment_requested === true || lower(lead.appointment_status).includes('confirm')) {
        row.appointments_set += 1;
      }

      if (lead.appointment_attended === true) {
        row.attended += 1;
      }

      if (isUnderContract(lead.status)) {
        row.under_contract += 1;
      }

      if (isClosed(lead.status)) {
        row.closed += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [leads]);

  const sourcePieData = useMemo(() => {
    return buildPieRows(leads.map((lead) => lead.lead_source || 'Unknown'));
  }, [leads]);

  const hookPieData = useMemo(() => {
    return buildPieRows(leads.map((lead) => lead.lead_source_detail || 'Unknown'));
  }, [leads]);

  const closedSourcePieData = useMemo(() => {
    return buildClosedPerformancePieRows({
      leads,
      groupBy: 'source',
    });
  }, [leads]);

  const closedHookPieData = useMemo(() => {
    return buildClosedPerformancePieRows({
      leads,
      groupBy: 'detail',
    });
  }, [leads]);

  const topCards = useMemo(() => {
    return [
      card('Total Leads', summary.totalLeads),
      card('New Leads (7d)', summary.new7d),
      card('New Leads (30d)', summary.new30d),
      card('Appointments Set', summary.appointmentsSet),
      card('Appointments Attended', summary.appointmentsAttended),
      card('Under Contract', summary.underContract),
      card('Closed', summary.closed),
      card('Follow-Up Overdue', summary.followUpOverdue),
      card('Messages (7d)', summary.msgs7d),
      card('Missed Calls (7d)', summary.missed7d),
      card('Hot Leads', summary.hot),
      card('Warm / Cold', `${summary.warm} / ${summary.cold}`),
    ];
  }, [summary]);

  const isAdminView =
    profile?.role === 'admin' || profile?.role === 'platform_admin';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-500">
          {profile?.role === 'agent'
            ? 'Your pipeline and responsiveness metrics.'
            : 'Office-level source and funnel analytics.'}
        </p>
      </div>

      {loading ? (
        <div className="rounded-md border bg-white p-4">Loading...</div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {topCards.map((c) => (
              <div key={c.title} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm text-gray-500">{c.title}</div>
                <div className="mt-2 text-2xl font-semibold">{c.value}</div>
                {c.sub && <div className="mt-1 text-xs text-gray-400">{c.sub}</div>}
              </div>
            ))}
          </div>

          {isAdminView ? (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="font-semibold">Lead Sources</h2>
                    <p className="text-sm text-gray-500">
                      Which traffic sources are bringing in the most leads.
                    </p>
                  </div>

                  {sourcePieData.length === 0 ? (
                    <div className="text-sm text-gray-500">No source data found.</div>
                  ) : (
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sourcePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label={pieLabel}
                          >
                            {sourcePieData.map((entry, index) => (
                              <Cell
                                key={`source-cell-${entry.name}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, 'Leads']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="font-semibold">Hook / Offer</h2>
                    <p className="text-sm text-gray-500">
                      Which offers are pulling the most leads into the funnel.
                    </p>
                  </div>

                  {hookPieData.length === 0 ? (
                    <div className="text-sm text-gray-500">No hook / offer data found.</div>
                  ) : (
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={hookPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label={pieLabel}
                          >
                            {hookPieData.map((entry, index) => (
                              <Cell
                                key={`hook-cell-${entry.name}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, 'Leads']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="font-semibold">Closed Deals by Source</h2>
                    <p className="text-sm text-gray-500">
                      Which traffic sources are actually producing closings.
                    </p>
                  </div>

                  {closedSourcePieData.length === 0 ? (
                    <div className="text-sm text-gray-500">No closed-deal source data found.</div>
                  ) : (
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={closedSourcePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label={pieLabel}
                          >
                            {closedSourcePieData.map((entry, index) => (
                              <Cell
                                key={`closed-source-cell-${entry.name}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, _name, props) => {
                              const payload = props?.payload as PerformancePieRow | undefined;
                              return [
                                `${value} closed of ${payload?.total ?? 0} leads`,
                                payload?.name ?? 'Source',
                              ];
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="font-semibold">Closed Deals by Hook / Offer</h2>
                    <p className="text-sm text-gray-500">
                      Which offers are actually turning into closed business.
                    </p>
                  </div>

                  {closedHookPieData.length === 0 ? (
                    <div className="text-sm text-gray-500">No closed-deal hook data found.</div>
                  ) : (
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={closedHookPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label={pieLabel}
                          >
                            {closedHookPieData.map((entry, index) => (
                              <Cell
                                key={`closed-hook-cell-${entry.name}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, _name, props) => {
                              const payload = props?.payload as PerformancePieRow | undefined;
                              return [
                                `${value} closed of ${payload?.total ?? 0} leads`,
                                payload?.name ?? 'Hook / Offer',
                              ];
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3">
                  <h2 className="font-semibold">Lead Source Performance</h2>
                  <p className="text-sm text-gray-500">
                    Admin-only source funnel view for your office.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Hook / Offer</th>
                        <th className="px-4 py-3 font-medium">Leads</th>
                        <th className="px-4 py-3 font-medium">Appointments Set</th>
                        <th className="px-4 py-3 font-medium">Set %</th>
                        <th className="px-4 py-3 font-medium">Attended</th>
                        <th className="px-4 py-3 font-medium">Attend %</th>
                        <th className="px-4 py-3 font-medium">Under Contract</th>
                        <th className="px-4 py-3 font-medium">UC %</th>
                        <th className="px-4 py-3 font-medium">Closed</th>
                        <th className="px-4 py-3 font-medium">Close %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-500" colSpan={11}>
                            No lead source data found.
                          </td>
                        </tr>
                      ) : (
                        sourceRows.map((row) => (
                          <tr key={`${row.source}-${row.detail}`} className="border-t">
                            <td className="px-4 py-3">{row.source}</td>
                            <td className="px-4 py-3">{row.detail}</td>
                            <td className="px-4 py-3">{row.total}</td>
                            <td className="px-4 py-3">{row.appointments_set}</td>
                            <td className="px-4 py-3">{percentOf(row.total, row.appointments_set)}</td>
                            <td className="px-4 py-3">{row.attended}</td>
                            <td className="px-4 py-3">{percentOf(row.total, row.attended)}</td>
                            <td className="px-4 py-3">{row.under_contract}</td>
                            <td className="px-4 py-3">{percentOf(row.total, row.under_contract)}</td>
                            <td className="px-4 py-3">{row.closed}</td>
                            <td className="px-4 py-3">{percentOf(row.total, row.closed)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Agent View</h2>
              <p className="mt-1 text-sm text-gray-500">
                You see your assigned leads, your communication activity, and your own conversion metrics.
                Office-wide ad-source analytics stay with admin.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}