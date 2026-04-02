'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
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
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (myProfile?.role === 'agent') {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="mt-2 text-sm text-gray-500">
          This page is only available to admins and platform admins.
        </p>
      </div>
    );
  }

  const canSeeAllOrgs = myProfile?.role === 'platform_admin';

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {canSeeAllOrgs ? 'Users Across All Orgs' : 'Users in Your Org'}
          </h1>
          <p className="text-sm text-gray-500">
            {canSeeAllOrgs
              ? 'Platform admin view of agents and admins across the system.'
              : 'Org admin view of agents and admins in your organization.'}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'ALL' | Role)}
          >
            <option value="ALL">All roles</option>
            <option value="agent">Agents</option>
            <option value="admin">Admins</option>
            <option value="platform_admin">Platform Admins</option>
          </select>

          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Search email, role, org id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Visible Users</div>
          <div className="text-2xl font-bold">{filteredRows.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Agents</div>
          <div className="text-2xl font-bold">
            {filteredRows.filter((r) => r.role === 'agent').length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Admins</div>
          <div className="text-2xl font-bold">
            {filteredRows.filter((r) => r.role === 'admin').length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Platform Admins</div>
          <div className="text-2xl font-bold">
            {filteredRows.filter((r) => r.role === 'platform_admin').length}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              {canSeeAllOrgs && <th className="px-4 py-2">Org ID</th>}
              <th className="px-4 py-2">Assigned Leads</th>
              <th className="px-4 py-2">New</th>
              <th className="px-4 py-2">Under Contract</th>
              <th className="px-4 py-2">Closed</th>
              <th className="px-4 py-2">Latest Lead Assigned</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap">{row.email}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.role}</td>
                {canSeeAllOrgs && (
                  <td className="px-4 py-2 whitespace-nowrap">{row.org_id || '—'}</td>
                )}
                <td className="px-4 py-2 whitespace-nowrap">{row.totalLeads}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.newLeads}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.underContract}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.closed}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {row.lastLeadAssignedAt ? dayjs(row.lastLeadAssignedAt).fromNow() : '—'}
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-gray-500"
                  colSpan={canSeeAllOrgs ? 8 : 7}
                >
                  No users match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}