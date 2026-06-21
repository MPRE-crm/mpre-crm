'use client'

import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Flame,
  GitBranch,
  Home,
  MapPin,
  SearchCheck,
  TrendingUp,
  UserRound,
  XCircle,
} from 'lucide-react'
import { getSupabaseBrowser } from '../../../lib/supabase-browser'

dayjs.extend(relativeTime)

const supabase = getSupabaseBrowser()

type Lead = {
  id: string
  name: string | null
  email: string | null
}

type ViewRow = {
  id: string
  lead_id: string
  mls_id: string | null
  address: string | null
  city: string | null
  price: number | null
  beds: number | null
  baths: number | null
  thumbnail_url: string | null
  property_url: string | null
  viewed_at: string
  leads: Lead | null
}

type RawIdxRow = {
  id: string
  lead_id: string
  mls_id: string | null
  address: string | null
  city: string | null
  price: number | null
  beds: number | null
  baths: number | null
  thumbnail_url: string | null
  property_url: string | null
  viewed_at: string
}

type TimeRange = '24h' | '7d' | '30d'

type AppointmentRow = {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  phone: string | null
  appointment_date: string | null
  appointment_time: string | null
  appointment_requested_slot_iso: string | null
  appointment_requested_slot_human: string | null
  appointment_status: string | null
  appointment_type: string | null
  ai_summary: string | null
  notes: string | null
}

type Profile = {
  role: 'agent' | 'admin' | 'platform_admin'
  org_id: string | null
}

type ApprovalRow = {
  id: string
  lead_id: string
  org_id: string | null
  current_agent_id: string | null
  slot_iso: string | null
  slot_human: string | null
  status: string | null
  expires_at: string | null
  created_at: string | null
  decline_reason: string | null
  rotation_attempt: number | null
}

type ApprovalLead = {
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

type PendingApprovalRow = ApprovalRow & {
  lead: ApprovalLead | null
}

type FairnessAgentUser = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  org_id: string | null
}

type FairnessApprovalRow = {
  id: string
  org_id: string | null
  current_agent_id: string | null
  status: string | null
  created_at: string | null
  rotation_attempt: number | null
}

type FairnessRow = {
  agentId: string
  label: string
  total: number
  pending: number
  accepted: number
  declined: number
  expired: number
  avgRotationAttempt: number
  lastAssignedAt: string | null
}

type SlaWarningRow = {
  key: string
  title: string
  count: number
  tone: 'red' | 'orange' | 'blue' | 'gray'
  subtext: string
}

function getStatusClasses(status: string | null) {
  const s = (status || '').toLowerCase()

  if (s === 'confirmed') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (s === 'pending') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (s === 'completed') return 'border-slate-200 bg-slate-100 text-slate-700'
  if (s === 'missed') return 'border-red-200 bg-red-50 text-red-700'
  if (s === 'rescheduled') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  if (s === 'canceled') return 'border-gray-200 bg-gray-100 text-gray-700'

  return 'border-gray-200 bg-gray-100 text-gray-700'
}

function getApprovalStatusClasses(status: string | null) {
  const s = (status || '').toLowerCase()

  if (s === 'pending') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (s === 'accepted') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (s === 'declined') return 'border-red-200 bg-red-50 text-red-700'
  if (s === 'expired') return 'border-slate-200 bg-slate-100 text-slate-700'

  return 'border-gray-200 bg-gray-100 text-gray-700'
}

function getAppointmentDayKey(appt: AppointmentRow) {
  if (appt.appointment_requested_slot_iso) {
    return dayjs(appt.appointment_requested_slot_iso).format('YYYY-MM-DD')
  }

  return appt.appointment_date || null
}

function getAppointmentTimeLabel(appt: AppointmentRow) {
  if (appt.appointment_requested_slot_iso) {
    return dayjs(appt.appointment_requested_slot_iso).format('h:mm A')
  }

  return appt.appointment_time || null
}

function getAppointmentDisplayDate(appt: AppointmentRow) {
  if (appt.appointment_requested_slot_iso) {
    return dayjs(appt.appointment_requested_slot_iso).format('ddd, MMM D')
  }

  return appt.appointment_date || '-'
}

function getApprovalLeadName(lead: ApprovalLead | null) {
  if (!lead) return 'Unknown Lead'
  return (
    lead.name ||
    [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() ||
    lead.email ||
    lead.id
  )
}

function formatAgentLabel(agentId: string, userMap: Map<string, FairnessAgentUser>) {
  const user = userMap.get(agentId)
  if (!user) return `Agent ${agentId.slice(0, 8)}`
  return user.name || user.email || `Agent ${agentId.slice(0, 8)}`
}


function getMinutesUntil(iso: string | null) {
  if (!iso) return null
  const diffMs = new Date(iso).getTime() - Date.now()
  return Math.floor(diffMs / 60000)
}

function StatCard({
  title,
  value,
  icon,
  tone = 'blue',
  subtext,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  tone?: 'blue' | 'orange' | 'gray'
  subtext?: string
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
          {subtext ? <div className="mt-1 text-xs text-slate-500">{subtext}</div> : null}
        </div>
        <div className={`rounded-xl p-2 ${iconWrapClasses}`}>{icon}</div>
      </div>
    </div>
  )
}

export default function HomeIDXActivity() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [idxLoading, setIdxLoading] = useState(true)
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [approvalsLoading, setApprovalsLoading] = useState(true)
  const [fairnessLoading, setFairnessLoading] = useState(true)
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)

  const [rows, setRows] = useState<ViewRow[]>([])
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRow[]>([])
  const [fairnessRows, setFairnessRows] = useState<FairnessRow[]>([])

  const [slaWarnings, setSlaWarnings] = useState<SlaWarningRow[]>([])
  const [slaLoading, setSlaLoading] = useState(true)
  const [slaError, setSlaError] = useState<string | null>(null)

  const [idxError, setIdxError] = useState<string | null>(null)
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null)
  const [approvalsError, setApprovalsError] = useState<string | null>(null)
  const [fairnessError, setFairnessError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null)

  const sinceISO = useMemo(() => {
    const now = dayjs()
    if (timeRange === '24h') return now.subtract(24, 'hour').toISOString()
    if (timeRange === '30d') return now.subtract(30, 'day').toISOString()
    return now.subtract(7, 'day').toISOString()
  }, [timeRange])

  useEffect(() => {
    let mounted = true

    ;(async () => {
      setProfileLoading(true)
      setProfileError(null)

      const { data: userRes, error: userErr } = await supabase.auth.getUser()

      if (!mounted) return

      if (userErr || !userRes?.user) {
        setProfile(null)
        setProfileError(userErr?.message || 'Not authenticated')
        setProfileLoading(false)
        return
      }

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', userRes.user.id)
        .single()

      if (!mounted) return

      if (profileErr || !profileData) {
        setProfile(null)
        setProfileError(profileErr?.message || 'Profile not found')
        setProfileLoading(false)
        return
      }

      setProfile(profileData as Profile)
      setProfileLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    if (profileLoading) return

    ;(async () => {
      setAppointmentsLoading(true)
      setAppointmentsError(null)

      if (!profile) {
        if (!mounted) return
        setAppointments([])
        setAppointmentsLoading(false)
        return
      }

      const { data: userRes, error: userErr } = await supabase.auth.getUser()

      if (!mounted) return

      if (userErr || !userRes?.user) {
        setAppointments([])
        setAppointmentsError(userErr?.message || 'Not authenticated')
        setAppointmentsLoading(false)
        return
      }

      let apptQuery = supabase
        .from('leads')
        .select(`
          id,
          first_name,
          last_name,
          name,
          email,
          phone,
          appointment_date,
          appointment_time,
          appointment_requested_slot_iso,
          appointment_requested_slot_human,
          appointment_status,
          appointment_type,
          ai_summary,
          notes,
          agent_id,
          org_id
        `)
        .or('appointment_date.not.is.null,appointment_requested_slot_iso.not.is.null')
        .order('appointment_requested_slot_iso', { ascending: true })
        .order('appointment_date', { ascending: true })
        .limit(10)

      if (profile.org_id) {
        apptQuery = apptQuery.eq('org_id', profile.org_id)
      }

      const { data: apptData, error: apptError } = await apptQuery

      if (!mounted) return

      if (apptError) {
        setAppointments([])
        setAppointmentsError(apptError.message)
        setAppointmentsLoading(false)
        return
      }

const today = dayjs().startOf('day')
const allowedUpcomingStatuses = new Set(['pending', 'confirmed', 'rescheduled'])

const filtered = ((apptData || []) as AppointmentRow[]).filter((a) => {
  const status = String(a.appointment_status || '').toLowerCase()

  if (!allowedUpcomingStatuses.has(status)) {
    return false
  }

  const dayKey = getAppointmentDayKey(a)
  if (!dayKey) return false

  const apptDay = dayjs(dayKey)
  return apptDay.isSame(today, 'day') || apptDay.isAfter(today, 'day')
})

      setAppointments(filtered)
      setAppointmentsLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [profile, profileLoading])

  useEffect(() => {
    let mounted = true

    if (profileLoading) return

    ;(async () => {
      setApprovalsLoading(true)
      setApprovalsError(null)

      if (!profile) {
        if (!mounted) return
        setPendingApprovals([])
        setApprovalsLoading(false)
        return
      }

      const { data: userRes, error: userErr } = await supabase.auth.getUser()

      if (!mounted) return

      if (userErr || !userRes?.user) {
        setPendingApprovals([])
        setApprovalsError(userErr?.message || 'Not authenticated')
        setApprovalsLoading(false)
        return
      }

      let approvalsQuery = supabase
        .from('appointment_approvals')
        .select(`
          id,
          lead_id,
          org_id,
          current_agent_id,
          slot_iso,
          slot_human,
          status,
          expires_at,
          created_at,
          decline_reason,
          rotation_attempt
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(6)

      if (profile.role === 'agent') {
        approvalsQuery = approvalsQuery.eq('current_agent_id', userRes.user.id)
      } else if (profile.role === 'admin' && profile.org_id) {
        approvalsQuery = approvalsQuery.eq('org_id', profile.org_id)
      }

      const { data: approvalsData, error: approvalsErr } = await approvalsQuery

      if (!mounted) return

      if (approvalsErr) {
        setPendingApprovals([])
        setApprovalsError(approvalsErr.message)
        setApprovalsLoading(false)
        return
      }

      const approvals = (approvalsData || []) as ApprovalRow[]
      const leadIds = Array.from(new Set(approvals.map((a) => a.lead_id).filter(Boolean)))

      let leadMap = new Map<string, ApprovalLead>()

      if (leadIds.length > 0) {
        let leadQuery = supabase
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

        if (profile.role === 'agent') {
          leadQuery = leadQuery.eq('agent_id', userRes.user.id)
        } else if (profile.role === 'admin' && profile.org_id) {
          leadQuery = leadQuery.eq('org_id', profile.org_id)
        }

        const { data: leadData, error: leadErr } = await leadQuery

        if (!mounted) return

        if (leadErr) {
          setPendingApprovals([])
          setApprovalsError(leadErr.message)
          setApprovalsLoading(false)
          return
        }

        leadMap = new Map(((leadData || []) as ApprovalLead[]).map((lead) => [lead.id, lead]))
      }

      const merged: PendingApprovalRow[] = approvals.map((approval) => ({
        ...approval,
        lead: leadMap.get(approval.lead_id) || null,
      }))

      setPendingApprovals(merged)
      setApprovalsLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [profile, profileLoading])

 useEffect(() => {
  let mounted = true

  if (profileLoading) return

  ;(async () => {
    setFairnessLoading(true)
    setFairnessError(null)

    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionErr || !sessionRes?.session?.access_token) {
        setFairnessRows([])
        setFairnessError(sessionErr?.message || 'Not authenticated')
        setFairnessLoading(false)
        return
      }

      const res = await fetch(`/api/dashboard/fairness?range=${encodeURIComponent(timeRange)}`, {
        headers: {
          Authorization: `Bearer ${sessionRes.session.access_token}`,
        },
      })

      const json = await res.json()

      if (!mounted) return

      if (!res.ok || !json?.ok) {
        setFairnessRows([])
        setFairnessError(json?.error || 'Failed to load fairness snapshot')
        setFairnessLoading(false)
        return
      }

      setFairnessRows(Array.isArray(json.rows) ? json.rows : [])
      setFairnessLoading(false)
    } catch (err: any) {
      if (!mounted) return
      setFairnessRows([])
      setFairnessError(err?.message || 'Failed to load fairness snapshot')
      setFairnessLoading(false)
    }
  })()

  return () => {
    mounted = false
  }
}, [profileLoading, timeRange])

useEffect(() => {
  let mounted = true

  if (profileLoading) return

  ;(() => {
    setSlaLoading(true)
    setSlaError(null)

    try {
      const expiringSoon = pendingApprovals.filter((row) => {
        const minutes = getMinutesUntil(row.expires_at)
        return minutes !== null && minutes >= 0 && minutes <= 30
      }).length

      const overdueApprovals = pendingApprovals.filter((row) => {
        const minutes = getMinutesUntil(row.expires_at)
        return minutes !== null && minutes < 0
      }).length

      const missedAppointmentsNeedingAction = appointments.filter((appt) => {
        return String(appt.appointment_status || '').toLowerCase() === 'missed'
      }).length

      const viewsByLead = new Map<string, number>()

for (const row of rows) {
  if (!row.lead_id) continue
  viewsByLead.set(row.lead_id, (viewsByLead.get(row.lead_id) || 0) + 1)
}

const appointmentLeadIds = new Set(
  appointments.map((appt) => appt.id).filter(Boolean)
)

const pendingApprovalLeadIds = new Set(
  pendingApprovals.map((row) => row.lead_id).filter(Boolean)
)

const hotLeadsNeedingAttention = Array.from(viewsByLead.entries()).filter(
  ([leadId, count]) =>
    count >= 2 &&
    !appointmentLeadIds.has(leadId) &&
    !pendingApprovalLeadIds.has(leadId)
).length

      const nextWarnings: SlaWarningRow[] = [
        {
          key: 'expiring_soon',
          title: 'Approvals Expiring Soon',
          count: expiringSoon,
          tone: expiringSoon > 0 ? 'orange' : 'gray',
          subtext: 'Pending approvals expiring in 30 minutes or less',
        },
        {
          key: 'overdue_approvals',
          title: 'Overdue Approvals',
          count: overdueApprovals,
          tone: overdueApprovals > 0 ? 'red' : 'gray',
          subtext: 'Pending approvals already past expiration',
        },
        {
          key: 'missed_appointments',
          title: 'Missed Appointments',
          count: missedAppointmentsNeedingAction,
          tone: missedAppointmentsNeedingAction > 0 ? 'red' : 'gray',
          subtext: 'Appointments marked missed and needing follow-up',
        },
        {
          key: 'hot_leads_followup',
          title: 'Hot Leads Needing Follow-Up',
          count: hotLeadsNeedingAttention,
          tone: hotLeadsNeedingAttention > 0 ? 'orange' : 'gray',
          subtext: '2+ views in range with no appointment or pending approval',
        },
      ]

      if (!mounted) return
      setSlaWarnings(nextWarnings)
      setSlaLoading(false)
    } catch (err: any) {
      if (!mounted) return
      setSlaWarnings([])
      setSlaError(err?.message || 'Failed to calculate SLA warnings')
      setSlaLoading(false)
    }
  })()

  return () => {
    mounted = false
  }
}, [profileLoading, pendingApprovals, appointments, rows])

  useEffect(() => {
    let mounted = true

    if (profileLoading) return

    ;(async () => {
      setIdxLoading(true)
      setIdxError(null)

      if (!profile) {
        if (!mounted) return
        setRows([])
        setIdxLoading(false)
        return
      }

      const { data: userRes, error: userErr } = await supabase.auth.getUser()

      if (!mounted) return

      if (userErr || !userRes?.user) {
        setRows([])
        setIdxError(userErr?.message || 'Not authenticated')
        setIdxLoading(false)
        return
      }

      const { data: idxData, error: idxErrorResult } = await supabase
        .from('idx_views')
        .select(`
          id,
          lead_id,
          mls_id,
          address,
          city,
          price,
          beds,
          baths,
          thumbnail_url,
          property_url,
          viewed_at
        `)
        .gte('viewed_at', sinceISO)
        .order('viewed_at', { ascending: false })
        .limit(500)

      if (!mounted) return

      if (idxErrorResult) {
        setRows([])
        setIdxError(idxErrorResult.message)
        setIdxLoading(false)
        return
      }

      const rawRows = (idxData || []) as RawIdxRow[]
      const leadIds = Array.from(new Set(rawRows.map((r) => r.lead_id).filter(Boolean)))

      let leadMap = new Map<string, Lead>()

      if (leadIds.length > 0) {
        let leadQuery = supabase
          .from('leads')
          .select('id, name, email, agent_id, org_id')
          .in('id', leadIds)

        if (profile.role === 'agent') {
          leadQuery = leadQuery.eq('agent_id', userRes.user.id)
        } else if (profile.role === 'admin' && profile.org_id) {
          leadQuery = leadQuery.eq('org_id', profile.org_id)
        }

        const { data: leadData, error: leadError } = await leadQuery

        if (!mounted) return

        if (leadError) {
          setRows([])
          setIdxError(leadError.message)
          setIdxLoading(false)
          return
        }

        leadMap = new Map(
          ((leadData || []) as Array<Lead & { agent_id?: string | null; org_id?: string | null }>).map((lead) => [
            lead.id,
            { id: lead.id, name: lead.name, email: lead.email },
          ])
        )
      }

      const mergedRows: ViewRow[] = rawRows
        .filter((row) => leadMap.has(row.lead_id))
        .map((row) => ({
          ...row,
          leads: leadMap.get(row.lead_id) || null,
        }))

      setRows(mergedRows)
      setIdxLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [profile, profileLoading, sinceISO])

  async function refreshApprovals() {
    if (profileLoading) return
    setApprovalsLoading(true)
    setApprovalsError(null)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()

      if (userErr || !userRes?.user) {
        throw new Error(userErr?.message || 'Not authenticated')
      }

      if (!profile) {
        setPendingApprovals([])
        return
      }

      let approvalsQuery = supabase
        .from('appointment_approvals')
        .select(`
          id,
          lead_id,
          org_id,
          current_agent_id,
          slot_iso,
          slot_human,
          status,
          expires_at,
          created_at,
          decline_reason,
          rotation_attempt
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(6)

      if (profile.role === 'agent') {
        approvalsQuery = approvalsQuery.eq('current_agent_id', userRes.user.id)
      } else if (profile.role === 'admin' && profile.org_id) {
        approvalsQuery = approvalsQuery.eq('org_id', profile.org_id)
      }

      const { data: approvalsData, error: approvalsErr } = await approvalsQuery

      if (approvalsErr) throw new Error(approvalsErr.message)

      const approvals = (approvalsData || []) as ApprovalRow[]
      const leadIds = Array.from(new Set(approvals.map((a) => a.lead_id).filter(Boolean)))

      let leadMap = new Map<string, ApprovalLead>()

      if (leadIds.length > 0) {
        let leadQuery = supabase
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

        if (profile.role === 'agent') {
          leadQuery = leadQuery.eq('agent_id', userRes.user.id)
        } else if (profile.role === 'admin' && profile.org_id) {
          leadQuery = leadQuery.eq('org_id', profile.org_id)
        }

        const { data: leadData, error: leadErr } = await leadQuery

        if (leadErr) throw new Error(leadErr.message)

        leadMap = new Map(((leadData || []) as ApprovalLead[]).map((lead) => [lead.id, lead]))
      }

      const merged: PendingApprovalRow[] = approvals.map((approval) => ({
        ...approval,
        lead: leadMap.get(approval.lead_id) || null,
      }))

      setPendingApprovals(merged)
    } catch (err: any) {
      setApprovalsError(err?.message || 'Failed to refresh approvals')
    } finally {
      setApprovalsLoading(false)
    }
  }

  async function handleApprove(id: string) {
    try {
      setApprovalActionId(id)
      setApprovalsError(null)
      setApprovalMessage(null)

      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession()
      const accessToken = sessionRes?.session?.access_token

      if (sessionErr || !accessToken) {
        throw new Error(sessionErr?.message || 'Not authenticated')
      }

      const res = await fetch(`/api/appointments/agent-accept?id=${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to approve appointment request')
      }

      setApprovalMessage('Appointment approved.')
      await refreshApprovals()
    } catch (err: any) {
      setApprovalsError(err?.message || 'Failed to approve appointment')
    } finally {
      setApprovalActionId(null)
    }
  }

  async function handleDecline(id: string) {
    const reason = window.prompt('Enter a decline reason:', 'Agent declined')
    if (reason === null) return

    try {
      setApprovalActionId(id)
      setApprovalsError(null)
      setApprovalMessage(null)

      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession()
      const accessToken = sessionRes?.session?.access_token

      if (sessionErr || !accessToken) {
        throw new Error(sessionErr?.message || 'Not authenticated')
      }

      const res = await fetch(
        `/api/appointments/agent-decline?id=${encodeURIComponent(id)}&reason=${encodeURIComponent(reason)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!res.ok) {
        throw new Error('Failed to decline appointment request')
      }

      setApprovalMessage('Appointment declined.')
      await refreshApprovals()
    } catch (err: any) {
      setApprovalsError(err?.message || 'Failed to decline appointment')
    } finally {
      setApprovalActionId(null)
    }
  }

  const hotLeads = useMemo(() => {
    const map = new Map<string, { lead: Lead; count: number }>()
    for (const r of rows) {
      if (!r.leads) continue
      const key = r.leads.id
      if (!map.has(key)) map.set(key, { lead: r.leads, count: 0 })
      map.get(key)!.count += 1
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [rows])

  const topProperties = useMemo(() => {
    type PropKey = string
    const map = new Map<
      PropKey,
      {
        mls_id: string | null
        address: string | null
        city: string | null
        price: number | null
        beds: number | null
        baths: number | null
        thumbnail_url: string | null
        property_url: string | null
        count: number
        lastViewed: string
      }
    >()

    for (const r of rows) {
      const key = r.mls_id || r.address || r.id
      if (!map.has(key)) {
        map.set(key, {
          mls_id: r.mls_id,
          address: r.address,
          city: r.city,
          price: r.price,
          beds: r.beds,
          baths: r.baths,
          thumbnail_url: r.thumbnail_url,
          property_url: r.property_url,
          count: 0,
          lastViewed: r.viewed_at,
        })
      }
      const item = map.get(key)!
      item.count += 1
      if (dayjs(r.viewed_at).isAfter(item.lastViewed)) item.lastViewed = r.viewed_at
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || dayjs(b.lastViewed).valueOf() - dayjs(a.lastViewed).valueOf())
      .slice(0, 9)
  }, [rows])

  const totalViews = rows.length
  const uniqueLeadCount = hotLeads.length
  const upcomingAppointmentCount = appointments.length
  const propertyCount = topProperties.length
  const pendingApprovalCount = pendingApprovals.length
  const fairnessAgentCount = fairnessRows.length
  const activeSlaWarningCount = slaWarnings.filter((w) => w.count > 0).length

  const combinedError = profileError || appointmentsError
  const idxDisplayError = idxError

  const appointmentsSectionLoading = profileLoading || appointmentsLoading
  const approvalsSectionLoading = profileLoading || approvalsLoading
  const fairnessSectionLoading = profileLoading || fairnessLoading
  const idxSectionLoading = profileLoading || idxLoading

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <Activity className="h-3.5 w-3.5" />
              Dashboard Activity
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">IDX & Appointment Activity</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Watch what leads are viewing, what appointments are coming up, and where activity is heating up.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <label className="text-sm font-medium text-slate-600">Range</label>
            <select
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none ring-0"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
      </header>

      {combinedError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {combinedError}
        </div>
      )}

      {approvalsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {approvalsError}
        </div>
      )}

      {fairnessError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {fairnessError}
        </div>
      )}

      {slaError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {slaError}
        </div>
      )}

      {approvalMessage && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 shadow-sm">
          {approvalMessage}
        </div>
      )}

      {idxDisplayError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {idxDisplayError}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard
          title="IDX Views"
          value={totalViews}
          tone="blue"
          icon={<Eye className="h-5 w-5" />}
          subtext={timeRange === '24h' ? 'In the last 24 hours' : timeRange === '30d' ? 'In the last 30 days' : 'In the last 7 days'}
        />
        <StatCard
          title="Hot Leads"
          value={uniqueLeadCount}
          tone="orange"
          icon={<Flame className="h-5 w-5" />}
          subtext="Most engaged leads"
        />
        <StatCard
          title="Upcoming Appointments"
          value={upcomingAppointmentCount}
          tone="gray"
          icon={<CalendarDays className="h-5 w-5" />}
          subtext="Today and ahead"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovalCount}
          tone="orange"
          icon={<CalendarClock className="h-5 w-5" />}
          subtext="Needs action"
        />
        <StatCard
          title="Fairness Agents"
          value={fairnessAgentCount}
          tone="gray"
          icon={<GitBranch className="h-5 w-5" />}
          subtext="Agents in rotation snapshot"
        />

        <StatCard
          title="SLA Warnings"
          value={activeSlaWarningCount}
          tone={activeSlaWarningCount > 0 ? 'orange' : 'gray'}
          icon={<Clock3 className="h-5 w-5" />}
          subtext="Items needing attention"
        />

        <StatCard
          title="Top Properties"
          value={propertyCount}
          tone="blue"
          icon={<TrendingUp className="h-5 w-5" />}
          subtext="Most viewed listings"
        />
      </section>

<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">SLA Warnings</h2>
      <p className="text-sm text-slate-500">
        Things that need attention before they turn into avoidable messes.
      </p>
    </div>
  </div>

  {slaLoading ? (
    <div className="text-xs text-slate-500">Loading SLA warnings…</div>
  ) : slaWarnings.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
      No SLA warnings right now.
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {slaWarnings.map((warning) => {
        const toneClasses =
          warning.tone === 'red'
            ? 'border-red-200 bg-red-50'
            : warning.tone === 'orange'
            ? 'border-orange-200 bg-orange-50'
            : warning.tone === 'blue'
            ? 'border-blue-200 bg-blue-50'
            : 'border-slate-200 bg-slate-50'

        const numberClasses =
          warning.tone === 'red'
            ? 'text-red-700'
            : warning.tone === 'orange'
            ? 'text-orange-700'
            : warning.tone === 'blue'
            ? 'text-blue-700'
            : 'text-slate-700'

        return (
          <div
            key={warning.key}
            className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {warning.title}
            </div>
            <div className={`mt-2 text-3xl font-bold ${numberClasses}`}>
              {warning.count}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {warning.subtext}
            </div>
          </div>
        )
      })}
    </div>
  )}
</section>

<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Fairness / Rotation Snapshot</h2>
      <p className="text-sm text-slate-500">
        Quick look at how appointment approvals are distributing across agents in the selected range.
      </p>
    </div>
  </div>

        {fairnessSectionLoading ? (
          <div className="text-xs text-slate-500">Loading fairness snapshot…</div>
        ) : fairnessRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No fairness data in this range yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {fairnessRows.map((row) => (
              <div
                key={row.agentId}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{row.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Last assignment {row.lastAssignedAt ? dayjs(row.lastAssignedAt).fromNow() : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                    {row.total} total
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">Pending</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{row.pending}</div>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Accepted</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{row.accepted}</div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Declined</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{row.declined}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Expired</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{row.expired}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Avg Try</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{row.avgRotationAttempt}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pending Approvals</h2>
            <p className="text-sm text-slate-500">
              Quick action on appointment requests without leaving the dashboard.
            </p>
          </div>
          <a
            href="/dashboard/appointments"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            Open Appointments Queue
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {approvalsSectionLoading ? (
          <div className="text-xs text-slate-500">Loading pending approvals…</div>
        ) : pendingApprovals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No pending approvals right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingApprovals.map((row) => {
              const leadName = getApprovalLeadName(row.lead)
              const expiresText = row.expires_at ? dayjs(row.expires_at).fromNow() : '—'

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
                          <SearchCheck className="h-4 w-4" />
                        </div>
                        <div className="truncate text-lg font-semibold text-slate-900">{leadName}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-blue-600" />
                          {row.slot_human || (row.slot_iso ? dayjs(row.slot_iso).format('ddd, MMM D') : '-')}
                        </div>
                        <div className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4 text-orange-600" />
                          {row.slot_iso ? dayjs(row.slot_iso).format('h:mm A') : '—'}
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getApprovalStatusClasses(row.status)}`}>
                      {row.status || 'pending'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <span className="font-medium text-slate-900">Email:</span> {row.lead?.email || '-'}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900">Phone:</span> {row.lead?.phone || '-'}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900">Expires:</span> {expiresText}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900">Attempt:</span> {row.rotation_attempt ?? 0}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(row.id)}
                      disabled={approvalActionId === row.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {approvalActionId === row.id ? 'Working...' : 'Approve'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDecline(row.id)}
                      disabled={approvalActionId === row.id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      {approvalActionId === row.id ? 'Working...' : 'Decline'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upcoming Appointments</h2>
            <p className="text-sm text-slate-500">Your next booked conversations and strategy calls.</p>
          </div>
          <a
            href="/dashboard/calendar"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            Open Calendar
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {appointments.map((appt) => {
            const leadName =
              appt.name ||
              [appt.first_name, appt.last_name].filter(Boolean).join(' ') ||
              appt.email ||
              appt.id

            return (
              <div
                key={appt.id}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="truncate text-lg font-semibold text-slate-900">{leadName}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <div className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-blue-600" />
                        {getAppointmentDisplayDate(appt)}
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4 text-orange-600" />
                        {getAppointmentTimeLabel(appt) || '-'}
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(appt.appointment_status)}`}>
                    {appt.appointment_status || 'Pending'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-slate-900">Type:</span> {appt.appointment_type || '-'}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Email:</span> {appt.email || '-'}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-medium text-slate-900">Phone:</span> {appt.phone || '-'}
                  </div>
                </div>

                {(appt.ai_summary || appt.notes) && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700 whitespace-pre-line">
                    {appt.ai_summary || appt.notes}
                  </div>
                )}
              </div>
            )
          })}

          {appointments.length === 0 && !appointmentsSectionLoading && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No upcoming appointments found.
            </div>
          )}
        </div>

        {appointmentsSectionLoading && (
          <div className="mt-3 text-xs text-slate-500">Loading appointments…</div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Hot Leads</h2>
              <p className="text-sm text-slate-500">Most engaged people in this range.</p>
            </div>
          </div>

          <div className="space-y-3">
            {hotLeads.map(({ lead, count }) => (
              <div
                key={lead.id}
                className="rounded-2xl border border-slate-200 bg-gradient-to-r from-orange-50 to-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{lead.name || lead.email || '(no name)'}</div>
                    <div className="text-xs text-slate-500">Lead engagement</div>
                  </div>
                  <div className="rounded-xl bg-orange-100 px-3 py-2 text-sm font-bold text-orange-700">
                    {count} views
                  </div>
                </div>
              </div>
            ))}

            {hotLeads.length === 0 && !idxSectionLoading && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No activity in this range.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <Home className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Most Viewed Properties</h2>
              <p className="text-sm text-slate-500">Listings getting the most attention.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {topProperties.map((p, idx) => (
              <a
                key={idx}
                href={p.property_url || '#'}
                target={p.property_url ? '_blank' : undefined}
                rel={p.property_url ? 'noopener noreferrer' : undefined}
                className="group flex gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.address || 'Property'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{p.address || p.mls_id || 'Property'}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.city || '-'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {p.price ? `$${Number(p.price).toLocaleString()}` : '-'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {p.beds ?? '-'} bd • {p.baths ?? '-'} ba
                  </div>
                  <div className="mt-2 text-xs font-semibold text-blue-700">{p.count} views</div>
                  <div className="text-xs text-slate-500">last {dayjs(p.lastViewed).fromNow()}</div>
                </div>
              </a>
            ))}

            {topProperties.length === 0 && !idxSectionLoading && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No property views in this range.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-xl bg-slate-200 p-2 text-slate-700">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent Views</h2>
            <p className="text-sm text-slate-500">Latest IDX activity coming through the system.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{dayjs(r.viewed_at).fromNow()}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                    {r.leads?.name || r.leads?.email || r.lead_id}
                  </td>
                  <td className="px-4 py-3">
                    {r.property_url ? (
                      <a
                        href={r.property_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      >
                        {r.address || r.mls_id || 'View'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      r.address || r.mls_id || '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.city || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">${r.price ? Number(r.price).toLocaleString() : '-'}</td>
                </tr>
              ))}

              {rows.length === 0 && !idxSectionLoading && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    No recent activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {idxSectionLoading && <div className="mt-3 text-xs text-slate-500">Loading IDX activity…</div>}
      </section>
    </div>
  )
}