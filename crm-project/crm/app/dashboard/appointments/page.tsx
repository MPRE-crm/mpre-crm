'use client'

import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  Search,
  ShieldAlert,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react'
import { getSupabaseBrowser } from '../../../lib/supabase-browser'

dayjs.extend(relativeTime)

const supabase = getSupabaseBrowser()

type Role = 'agent' | 'admin' | 'platform_admin'

type Profile = {
  id: string
  email: string | null
  role: Role
  org_id: string | null
}

type ApprovalStatus = 'pending' | 'accepted' | 'declined' | 'expired' | string

type ApprovalRow = {
  id: string
  lead_id: string
  org_id: string | null
  requested_by_agent_id: string | null
  current_agent_id: string | null
  slot_iso: string | null
  slot_human: string | null
  status: ApprovalStatus
  expires_at: string | null
  accepted_at: string | null
  declined_at: string | null
  expired_at: string | null
  decline_reason: string | null
  rotation_attempt: number | null
  created_at: string | null
  updated_at: string | null
}

type LeadRow = {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  phone: string | null
  agent_id: string | null
  org_id: string | null
  appointment_status: string | null
}

type QueueRow = ApprovalRow & {
  lead: LeadRow | null
}

type AgentOption = {
  id: string
  email: string | null
  org_id: string | null
}

function getLeadName(lead: LeadRow | null) {
  if (!lead) return 'Unknown Lead'
  return (
    lead.name ||
    [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() ||
    lead.email ||
    lead.id
  )
}

function getAgentLabel(agent: AgentOption) {
  return agent.email || agent.id
}

function getStatusClasses(status: string | null) {
  const s = (status || '').toLowerCase()

  if (s === 'pending') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (s === 'accepted') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (s === 'declined') return 'border-red-200 bg-red-50 text-red-700'
  if (s === 'expired') return 'border-slate-200 bg-slate-100 text-slate-700'

  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function StatCard({
  title,
  value,
  tone = 'blue',
  icon,
}: {
  title: string
  value: string | number
  tone?: 'blue' | 'orange' | 'gray'
  icon: React.ReactNode
}) {
  const toneClasses =
    tone === 'orange'
      ? 'border-orange-200 bg-orange-50/70'
      : tone === 'gray'
      ? 'border-slate-200 bg-slate-50'
      : 'border-blue-200 bg-blue-50/70'

  const iconWrapClasses =
    tone === 'orange'
      ? 'bg-orange-100 text-orange-700'
      : tone === 'gray'
      ? 'bg-slate-200 text-slate-700'
      : 'bg-blue-100 text-blue-700'

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
  )
}

function QueueCard({
  row,
  isPending,
  actionLoadingId,
  onApprove,
  onDecline,
  showActions,
  assignSection,
}: {
  row: QueueRow
  isPending: boolean
  actionLoadingId: string | null
  onApprove: (id: string) => void
  onDecline: (id: string) => void
  showActions: boolean
  assignSection?: React.ReactNode
}) {
  const leadName = getLeadName(row.lead)
  const expiresText = row.expires_at ? dayjs(row.expires_at).fromNow() : '—'

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">{leadName}</div>
            <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(row.status)}`}>
              {row.status || 'unknown'}
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <span className="font-medium text-slate-900">Slot:</span>{' '}
              {row.slot_human || (row.slot_iso ? dayjs(row.slot_iso).format('ddd, MMM D h:mm A') : '-')}
            </div>
            <div>
              <span className="font-medium text-slate-900">Expires:</span> {expiresText}
            </div>
            <div>
              <span className="font-medium text-slate-900">Phone:</span> {row.lead?.phone || '-'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Email:</span> {row.lead?.email || '-'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Rotation Attempt:</span> {row.rotation_attempt ?? 0}
            </div>
            <div>
              <span className="font-medium text-slate-900">Lead Status:</span> {row.lead?.appointment_status || '-'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Created:</span>{' '}
              {row.created_at ? dayjs(row.created_at).fromNow() : '-'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Reason:</span> {row.decline_reason || '-'}
            </div>
          </div>

          {assignSection ? <div className="mt-4">{assignSection}</div> : null}
        </div>

        <div className="flex flex-wrap gap-3 xl:justify-end">
          {showActions && isPending ? (
            <>
              <button
                type="button"
                onClick={() => onApprove(row.id)}
                disabled={actionLoadingId === row.id}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {actionLoadingId === row.id ? 'Working...' : 'Approve'}
              </button>

              <button
                type="button"
                onClick={() => onDecline(row.id)}
                disabled={actionLoadingId === row.id}
                className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                {actionLoadingId === row.id ? 'Working...' : 'Decline'}
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-600">
              No actions available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AppointmentsQueuePage() {
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [assignLoadingId, setAssignLoadingId] = useState<string | null>(null)
  const [reassignLoadingId, setReassignLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<QueueRow[]>([])
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([])
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})
  const [reassignSelections, setReassignSelections] = useState<Record<string, string>>({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'accepted' | 'declined' | 'expired'>('pending')

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()

      if (userErr || !userRes?.user) {
        throw new Error(userErr?.message || 'Not authenticated')
      }

      const userId = userRes.user.id

      const { data: me, error: meErr } = await supabase
        .from('profiles')
        .select('id, email, role, org_id')
        .eq('id', userId)
        .single()

      if (meErr || !me) {
        throw new Error(meErr?.message || 'Profile not found')
      }

      const typedProfile = me as Profile
      setProfile(typedProfile)

      let approvalsQuery = supabase
        .from('appointment_approvals')
        .select(`
          id,
          lead_id,
          org_id,
          requested_by_agent_id,
          current_agent_id,
          slot_iso,
          slot_human,
          status,
          expires_at,
          accepted_at,
          declined_at,
          expired_at,
          decline_reason,
          rotation_attempt,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (typedProfile.role === 'agent') {
        approvalsQuery = approvalsQuery.eq('current_agent_id', typedProfile.id)
      } else if (typedProfile.role === 'admin' && typedProfile.org_id) {
        approvalsQuery = approvalsQuery.eq('org_id', typedProfile.org_id)
      }

      const { data: approvalData, error: approvalErr } = await approvalsQuery

      if (approvalErr) {
        throw new Error(approvalErr.message)
      }

      const approvals = (approvalData || []) as ApprovalRow[]
      const leadIds = Array.from(new Set(approvals.map((a) => a.lead_id).filter(Boolean)))

      let leadMap = new Map<string, LeadRow>()

      if (leadIds.length > 0) {
        let leadsQuery = supabase
          .from('leads')
          .select(`
            id,
            first_name,
            last_name,
            name,
            email,
            phone,
            agent_id,
            org_id,
            appointment_status
          `)
          .in('id', leadIds)

        if (typedProfile.role === 'agent') {
          leadsQuery = leadsQuery.eq('agent_id', typedProfile.id)
        } else if (typedProfile.role === 'admin' && typedProfile.org_id) {
          leadsQuery = leadsQuery.eq('org_id', typedProfile.org_id)
        }

        const { data: leadData, error: leadErr } = await leadsQuery

        if (leadErr) {
          throw new Error(leadErr.message)
        }

        leadMap = new Map(((leadData || []) as LeadRow[]).map((lead) => [lead.id, lead]))
      }

      const merged: QueueRow[] = approvals.map((approval) => ({
        ...approval,
        lead: leadMap.get(approval.lead_id) || null,
      }))

      setRows(merged)

      if (typedProfile.role === 'admin' || typedProfile.role === 'platform_admin') {
        let agentQuery = supabase
          .from('profiles')
          .select('id, email, org_id, role')
          .eq('role', 'agent')
          .order('email', { ascending: true })

        if (typedProfile.role === 'admin' && typedProfile.org_id) {
          agentQuery = agentQuery.eq('org_id', typedProfile.org_id)
        }

        const { data: agentData, error: agentErr } = await agentQuery

        if (agentErr) {
          throw new Error(agentErr.message)
        }

        const agents = ((agentData || []) as Array<AgentOption & { role?: string }>).map((agent) => ({
          id: agent.id,
          email: agent.email,
          org_id: agent.org_id,
        }))

        setAgentOptions(agents)
      } else {
        setAgentOptions([])
      }
    } catch (err: any) {
      setRows([])
      setAgentOptions([])
      setError(err?.message || 'Failed to load appointments queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleApprove(id: string) {
    try {
      setActionLoadingId(id)
      setError(null)
      setMessage(null)

      const res = await fetch(`/api/appointments/agent-accept?id=${encodeURIComponent(id)}`, {
        method: 'GET',
      })

      if (!res.ok) {
        throw new Error('Failed to approve appointment request')
      }

      setMessage('Appointment approved.')
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to approve appointment')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDecline(id: string) {
    const reason = window.prompt('Enter a decline reason:', 'Agent declined')

    if (reason === null) return

    try {
      setActionLoadingId(id)
      setError(null)
      setMessage(null)

      const res = await fetch(
        `/api/appointments/agent-decline?id=${encodeURIComponent(id)}&reason=${encodeURIComponent(reason)}`,
        {
          method: 'GET',
        }
      )

      if (!res.ok) {
        throw new Error('Failed to decline appointment request')
      }

      setMessage('Appointment declined.')
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to decline appointment')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleAssign(approvalId: string) {
    const agentId = assignSelections[approvalId]

    if (!agentId) {
      setError('Select an agent first.')
      return
    }

    try {
      setAssignLoadingId(approvalId)
      setError(null)
      setMessage(null)

      const res = await fetch('/api/appointments/admin-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_id: approvalId,
          agent_id: agentId,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to assign floating appointment')
      }

      setMessage('Floating appointment assigned.')
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to assign floating appointment')
    } finally {
      setAssignLoadingId(null)
    }
  }

  async function handleReassign(approvalId: string) {
    const agentId = reassignSelections[approvalId]

    if (!agentId) {
      setError('Select an agent first.')
      return
    }

    try {
      setReassignLoadingId(approvalId)
      setError(null)
      setMessage(null)

      const res = await fetch('/api/appointments/admin-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_id: approvalId,
          agent_id: agentId,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to reassign appointment')
      }

      setMessage('Appointment reassigned.')
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to reassign appointment')
    } finally {
      setReassignLoadingId(null)
    }
  }

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rows.filter((row) => {
      const leadName = getLeadName(row.lead).toLowerCase()
      const email = (row.lead?.email || '').toLowerCase()
      const phone = (row.lead?.phone || '').toLowerCase()
      const status = (row.status || '').toLowerCase()

      const matchesStatus = statusFilter === 'ALL' || status === statusFilter
      const matchesSearch =
        !term ||
        leadName.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        (row.slot_human || '').toLowerCase().includes(term)

      return matchesStatus && matchesSearch
    })
  }, [rows, search, statusFilter])

  const pendingRows = filteredRows.filter((r) => (r.status || '').toLowerCase() === 'pending' && !!r.current_agent_id)
  const floatingRows = filteredRows.filter((r) => (r.status || '').toLowerCase() === 'pending' && !r.current_agent_id)
  const acceptedRows = filteredRows.filter((r) => (r.status || '').toLowerCase() === 'accepted')
  const declinedRows = filteredRows.filter((r) => (r.status || '').toLowerCase() === 'declined')
  const expiredRows = filteredRows.filter((r) => (r.status || '').toLowerCase() === 'expired')
  const recentDecisionRows = [...acceptedRows, ...declinedRows, ...expiredRows]
    .sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bTime - aTime
    })
    .slice(0, 12)

  const isAgent = profile?.role === 'agent'
  const isAdmin = profile?.role === 'admin'
  const isPlatformAdmin = profile?.role === 'platform_admin'
  const canManageFloating = isAdmin || isPlatformAdmin
  const canReassign = isAdmin || isPlatformAdmin

  if (loading) {
    return <div className="text-sm text-slate-500">Loading appointments queue…</div>
  }

  if (error && !profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <CalendarClock className="h-3.5 w-3.5" />
              Appointments Queue
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Appointments</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review appointment requests, monitor exceptions, and keep routing clean.
            </p>
          </div>

          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">Role:</span>{' '}
            {profile?.role?.replace('_', ' ') || 'unknown'}
          </div>
        </div>
      </header>

      {isAgent && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 shadow-sm">
          You are viewing only appointment requests assigned to you.
        </div>
      )}

      {(isAdmin || isPlatformAdmin) && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700 shadow-sm">
          You can supervise org-wide appointment routing and monitor floating/unassigned exceptions.
        </div>
      )}

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 shadow-sm">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Pending" value={pendingRows.length} tone="orange" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard title="Floating" value={floatingRows.length} tone="orange" icon={<Users className="h-5 w-5" />} />
        <StatCard title="Accepted" value={acceptedRows.length} tone="blue" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Declined" value={declinedRows.length} tone="gray" icon={<XCircle className="h-5 w-5" />} />
        <StatCard title="Expired" value={expiredRows.length} tone="gray" icon={<ShieldAlert className="h-5 w-5" />} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <p className="mt-1 text-sm text-slate-500">Search and narrow the queue.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lead, email, phone, slot..."
                className="rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'ALL' | 'pending' | 'accepted' | 'declined' | 'expired')
                }
                className="rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Pending Approvals</h2>
          <p className="mt-1 text-sm text-slate-500">
            Active requests that are currently assigned and waiting on a response.
          </p>
        </div>

        {pendingRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No assigned pending approvals right now.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRows.map((row) => (
              <QueueCard
                key={row.id}
                row={row}
                isPending
                actionLoadingId={actionLoadingId}
                onApprove={handleApprove}
                onDecline={handleDecline}
                showActions
                assignSection={
                  canReassign ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                      <div className="mb-2 text-sm font-semibold text-slate-900">Reassign to Agent</div>
                      <div className="flex flex-col gap-3 lg:flex-row">
                        <select
                          value={reassignSelections[row.id] || ''}
                          onChange={(e) =>
                            setReassignSelections((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select agent...</option>
                          {agentOptions
                            .filter((agent) => agent.id !== row.current_agent_id)
                            .map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {getAgentLabel(agent)}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleReassign(row.id)}
                          disabled={reassignLoadingId === row.id || !reassignSelections[row.id]}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reassignLoadingId === row.id ? 'Reassigning...' : 'Reassign'}
                        </button>
                      </div>
                    </div>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {canManageFloating && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Floating / Unassigned</h2>
            <p className="mt-1 text-sm text-slate-500">
              Exception bucket for items not currently assigned to an agent.
            </p>
          </div>

          {floatingRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No floating/unassigned items right now.
            </div>
          ) : (
            <div className="space-y-4">
              {floatingRows.map((row) => (
                <QueueCard
                  key={row.id}
                  row={row}
                  isPending
                  actionLoadingId={actionLoadingId}
                  onApprove={handleApprove}
                  onDecline={handleDecline}
                  showActions={false}
                  assignSection={
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
                      <div className="mb-2 text-sm font-semibold text-slate-900">Assign to Agent</div>
                      <div className="flex flex-col gap-3 lg:flex-row">
                        <select
                          value={assignSelections[row.id] || ''}
                          onChange={(e) =>
                            setAssignSelections((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select agent...</option>
                          {agentOptions.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {getAgentLabel(agent)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleAssign(row.id)}
                          disabled={assignLoadingId === row.id || !assignSelections[row.id]}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {assignLoadingId === row.id ? 'Assigning...' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Decisions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recently accepted, declined, or expired appointment requests.
          </p>
        </div>

        {recentDecisionRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No recent decisions found.
          </div>
        ) : (
          <div className="space-y-4">
            {recentDecisionRows.map((row) => (
              <QueueCard
                key={row.id}
                row={row}
                isPending={false}
                actionLoadingId={actionLoadingId}
                onApprove={handleApprove}
                onDecline={handleDecline}
                showActions={false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}