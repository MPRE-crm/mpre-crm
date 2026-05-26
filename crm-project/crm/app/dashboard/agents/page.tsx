'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  BadgeCheck,
  Building2,
  Filter,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

dayjs.extend(relativeTime);

const supabase = getSupabaseBrowser();

type Role = 'agent' | 'admin' | 'platform_admin';

type Profile = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
  created_at?: string | null;
};

type Lead = {
  id: string;
  created_at: string | null;
  status: string | null;
  agent_id: string | null;
};

type UserRow = {
  id: string;
  email: string;
  role: Role;
  org_id: string | null;
  totalLeads: number;
  newLeads: number;
  underContract: number;
  closed: number;
  lastLeadAssignedAt: string | null;
};

function norm(v?: string | null) {
  return (v || '').trim();
}

function lower(v?: string | null) {
  return norm(v).toLowerCase();
}

function isNew(status?: string | null) {
  const s = lower(status);
  return s === 'new' || s.includes('new');
}

function isUnderContract(status?: string | null) {
  const s = lower(status);
  return s === 'under contract' || s.includes('under contract');
}

function isClosed(status?: string | null) {
  const s = lower(status);
  return s === 'closed' || s.includes('closed');
}

function getRoleBadgeClasses(role: Role) {
  if (role === 'platform_admin') {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }

  if (role === 'admin') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function getRoleIcon(role: Role) {
  if (role === 'platform_admin') return <ShieldCheck className="h-4 w-4" />;
  if (role === 'admin') return <BadgeCheck className="h-4 w-4" />;
  return <UserRound className="h-4 w-4" />;
}

function StatCard({
  title,
  value,
  icon,
  tone = 'blue',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'blue' | 'orange' | 'gray';
}) {
  const toneClasses =
    tone === 'orange'
      ? 'border-orange-200 bg-orange-50/70'
      : tone === 'gray'
      ? 'border-slate-200 bg-slate-50'
      : 'border-blue-200 bg-blue-50/70';

  const iconWrapClasses =
    tone === 'orange'
      ? 'bg-orange-100 text-orange-700'
      : tone === 'gray'
      ? 'bg-slate-200 text-slate-700'
      : 'bg-blue-100 text-blue-700';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        <div className={`rounded-xl p-2 ${iconWrapClasses}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function AgentsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
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

      const { data: me, error: meErr } = await supabase
        .from('profiles')
        .select('id, email, role, org_id, created_at')
        .eq('id', userId)
        .single();

      if (!mounted) return;

      if (meErr || !me) {
        setError(meErr?.message || 'Profile not found');
        setLoading(false);
        return;
      }

      const typedMe = me as Profile;
      setMyProfile(typedMe);

      if (typedMe.role === 'agent') {
        setProfiles([]);
        setLeads([]);
        setLoading(false);
        return;
      }

      let profilesQuery = supabase
        .from('profiles')
        .select('id, email, role, org_id, created_at')
        .order('email', { ascending: true });

      if (typedMe.role === 'admin') {
        profilesQuery = profilesQuery.eq('org_id', typedMe.org_id);
      }

      const { data: profilesData, error: profilesErr } = await profilesQuery;

      if (!mounted) return;

      if (profilesErr) {
        setError(profilesErr.message);
        setLoading(false);
        return;
      }

      const profileRows = ((profilesData || []) as Profile[]).filter(
        (p) => p.role === 'agent' || p.role === 'admin' || p.role === 'platform_admin'
      );

      setProfiles(profileRows);

      let leadsQuery = supabase
        .from('leads')
        .select('id, created_at, status, agent_id')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (typedMe.role === 'admin') {
        leadsQuery = leadsQuery.eq('org_id', typedMe.org_id);
      }

      const { data: leadsData, error: leadsErr } = await leadsQuery;

      if (!mounted) return;

      if (leadsErr) {
        setError(leadsErr.message);
        setLoading(false);
        return;
      }

      setLeads((leadsData || []) as Lead[]);
      setLoading(false);
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo<UserRow[]>(() => {
    return profiles.map((profile) => {
      const assignedLeads = leads.filter((lead) => lead.agent_id === profile.id);

      const sortedAssigned = [...assignedLeads].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      return {
        id: profile.id,
        email: profile.email || '—',
        role: profile.role,
        org_id: profile.org_id,
        totalLeads: assignedLeads.length,
        newLeads: assignedLeads.filter((lead) => isNew(lead.status)).length,
        underContract: assignedLeads.filter((lead) => isUnderContract(lead.status)).length,
        closed: assignedLeads.filter((lead) => isClosed(lead.status)).length,
        lastLeadAssignedAt: sortedAssigned[0]?.created_at || null,
      };
    });
  }, [profiles, leads]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesRole = roleFilter === 'ALL' || row.role === roleFilter;
      const matchesSearch =
        !term ||
        row.email.toLowerCase().includes(term) ||
        row.role.toLowerCase().includes(term) ||
        (row.org_id || '').toLowerCase().includes(term);

      return matchesRole && matchesSearch;
    });
  }, [rows, search, roleFilter]);

  if (loading) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
        {error}
      </div>
    );
  }

  if (myProfile?.role === 'agent') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
        <p className="mt-2 text-sm text-slate-500">
          This page is only available to admins and platform admins.
        </p>
      </div>
    );
  }

  const canSeeAllOrgs = myProfile?.role === 'platform_admin';

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <Users className="h-3.5 w-3.5" />
              User Management
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {canSeeAllOrgs ? 'Users Across All Orgs' : 'Users in Your Org'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {canSeeAllOrgs
                ? 'Platform admin view of agents and admins across the full system.'
                : 'Org admin view of agents and admins inside your organization.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                placeholder="Search email, role, org id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                className="rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'ALL' | Role)}
              >
                <option value="ALL">All roles</option>
                <option value="agent">Agents</option>
                <option value="admin">Admins</option>
                <option value="platform_admin">Platform Admins</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Visible Users"
          value={filteredRows.length}
          tone="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Agents"
          value={filteredRows.filter((r) => r.role === 'agent').length}
          tone="gray"
          icon={<UserRound className="h-5 w-5" />}
        />
        <StatCard
          title="Admins"
          value={filteredRows.filter((r) => r.role === 'admin').length}
          tone="blue"
          icon={<BadgeCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Platform Admins"
          value={filteredRows.filter((r) => r.role === 'platform_admin').length}
          tone="orange"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">User Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Lead counts and recent assignment activity by user.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                {canSeeAllOrgs && <th className="px-4 py-3 font-semibold">Org ID</th>}
                <th className="px-4 py-3 font-semibold">Assigned Leads</th>
                <th className="px-4 py-3 font-semibold">New</th>
                <th className="px-4 py-3 font-semibold">Under Contract</th>
                <th className="px-4 py-3 font-semibold">Closed</th>
                <th className="px-4 py-3 font-semibold">Latest Lead Assigned</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                        {getRoleIcon(row.role)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{row.email}</div>
                        <div className="text-xs text-slate-500">{row.id}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeClasses(row.role)}`}>
                      {getRoleIcon(row.role)}
                      {row.role}
                    </span>
                  </td>

                  {canSeeAllOrgs && (
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <div className="inline-flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {row.org_id || '—'}
                      </div>
                    </td>
                  )}

                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                    {row.totalLeads}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-blue-700">{row.newLeads}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-orange-700">{row.underContract}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.closed}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {row.lastLeadAssignedAt ? dayjs(row.lastLeadAssignedAt).fromNow() : '—'}
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-slate-500"
                    colSpan={canSeeAllOrgs ? 8 : 7}
                  >
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}