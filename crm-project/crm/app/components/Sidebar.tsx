'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  PhoneMissed,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { getSupabaseBrowser } from '../../lib/supabase-browser'

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
}

type Role =
  | 'agent'
  | 'admin'
  | 'platform_admin'

const supabase =
  getSupabaseBrowser()

const AGENT_NAV: NavItem[] = [
  {
    label: 'Home',
    href: '/dashboard/home',
    icon: <Home className="h-4 w-4" />,
  },
  {
    label: 'Leads',
    href: '/dashboard/leads',
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    label: 'Email Marketing',
    href: '/dashboard/email-marketing',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    label: 'Contacts',
    href: '/dashboard/email-marketing/contacts',
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: 'Listings',
    href: '/dashboard/email-marketing/listings',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    label: 'Campaigns',
    href: '/dashboard/email-marketing/campaigns',
    icon: <Send className="h-4 w-4" />,
  },
  {
    label: 'Appointments',
    href: '/dashboard/appointments',
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    label: 'Conversations',
    href: '/dashboard/conversations',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    label: 'Call Logs',
    href: '/dashboard/call-logs',
    icon: <Phone className="h-4 w-4" />,
  },
  {
    label: 'Calendar',
    href: '/dashboard/calendar',
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    label: 'Analytics',
    href: '/dashboard/analytics',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    label: 'Preferences',
    href: '/dashboard/preferences',
    icon: <Settings className="h-4 w-4" />,
  },
]

const ADMIN_NAV: NavItem[] = [
  ...AGENT_NAV,
  {
    label: 'Samantha Actions',
    href: '/dashboard/samantha-actions',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    label: 'Escalations',
    href: '/dashboard/escalations',
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    label: 'Follow-Up Queue',
    href: '/dashboard/follow-up-queue',
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    label: 'Missed Call Queue',
    href: '/dashboard/missed-call-queue',
    icon: <PhoneMissed className="h-4 w-4" />,
  },
  {
    label: 'Agents',
    href: '/dashboard/agents',
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: 'Guides',
    href: '/dashboard/admin/guides',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: 'Add User',
    href: '/dashboard/add-user',
    icon: <UserPlus className="h-4 w-4" />,
  },
  {
    label: 'Security',
    href: '/dashboard/security',
    icon: <ShieldAlert className="h-4 w-4" />,
  },
]

const PLATFORM_ADMIN_NAV: NavItem[] = [
  ...ADMIN_NAV,
  {
    label: 'Compliance',
    href: '/dashboard/compliance',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
]

export default function Sidebar() {
  const pathname =
    usePathname() ?? ''

  const [role, setRole] =
    useState<Role>('agent')

  const [
    loadingRole,
    setLoadingRole,
  ] = useState(true)

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false)

  const [
    collapsed,
    setCollapsed,
  ] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      try {
        const {
          data: userRes,
          error: userErr,
        } =
          await supabase.auth.getUser()

        if (
          userErr ||
          !userRes?.user
        ) {
          if (!mounted) return

          setRole('agent')
          setLoadingRole(false)
          return
        }

        const {
          data: profile,
          error: profileErr,
        } = await supabase
          .from('profiles')
          .select('role')
          .eq(
            'id',
            userRes.user.id
          )
          .single()

        if (!mounted) return

        if (
          profileErr ||
          !profile?.role
        ) {
          setRole('agent')
          setLoadingRole(false)
          return
        }

        const nextRole =
          profile.role ===
          'platform_admin'
            ? 'platform_admin'
            : profile.role ===
              'admin'
            ? 'admin'
            : 'agent'

        setRole(nextRole)
        setLoadingRole(false)
      } catch {
        if (!mounted) return

        setRole('agent')
        setLoadingRole(false)
      }
    }

    loadRole()

    return () => {
      mounted = false
    }
  }, [])

  const navItems = useMemo(() => {
    if (
      role === 'platform_admin'
    ) {
      return PLATFORM_ADMIN_NAV
    }

    if (role === 'admin') {
      return ADMIN_NAV
    }

    return AGENT_NAV
  }, [role])

  function isActive(
    href: string
  ) {
    if (
      href ===
      '/dashboard/email-marketing'
    ) {
      return pathname === href
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    )
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)

      await fetch(
        '/api/auth/logout',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      )

      await supabase.auth.signOut()

      window.location.href =
        '/login'
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <aside
      className={`min-h-screen border-r border-slate-200 bg-gradient-to-b from-slate-100 via-white to-slate-100 p-4 shadow-sm transition-all duration-200 ${
        collapsed
          ? 'w-20'
          : 'w-64'
      } flex flex-col`}
    >
      <div
        className={`mb-6 flex items-start ${
          collapsed
            ? 'justify-center'
            : 'justify-between'
        } gap-2`}
      >
        {!collapsed ? (
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              CRM
            </h2>

            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {loadingRole
                ? 'Loading role...'
                : role.replace(
                    '_',
                    ' '
                  )}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() =>
            setCollapsed(
              (previous) =>
                !previous
            )
          }
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
          aria-label={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
          title={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {collapsed && (
        <div className="mb-6 text-center">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {loadingRole
              ? '...'
              : role.replace(
                  '_',
                  ' '
                )}
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col space-y-2">
        {navItems.map((item) => {
          const active =
            isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'border border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-700 hover:bg-orange-50 hover:text-orange-700'
              } ${
                collapsed
                  ? 'justify-center'
                  : 'gap-3'
              }`}
            >
              <span
                className={`shrink-0 ${
                  active
                    ? 'text-blue-700'
                    : 'text-slate-500 group-hover:text-orange-700'
                }`}
              >
                {item.icon}
              </span>

              {!collapsed ? (
                <span className="truncate">
                  {item.label}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        title="Logout"
        className={`mt-6 flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60 ${
          collapsed
            ? 'justify-center'
            : 'gap-3'
        }`}
      >
        <LogOut className="h-4 w-4 shrink-0" />

        {!collapsed ? (
          <span>
            {loggingOut
              ? 'Logging out...'
              : 'Logout'}
          </span>
        ) : null}
      </button>
    </aside>
  )
}


