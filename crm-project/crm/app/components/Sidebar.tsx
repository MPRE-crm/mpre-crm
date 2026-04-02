'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSupabaseBrowser } from '../../lib/supabase-browser'

type NavItem = { label: string; href: string }
type Role = 'agent' | 'admin' | 'platform_admin'

const supabase = getSupabaseBrowser()

const AGENT_NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard/home' },
  { label: 'Leads', href: '/dashboard/leads' },
  { label: 'Conversations', href: '/dashboard/conversations' },
  { label: 'Call Logs', href: '/dashboard/call-logs' },
  { label: 'Calendar', href: '/dashboard/calendar' },
  { label: 'Analytics', href: '/dashboard/analytics' },
]

const ADMIN_NAV: NavItem[] = [
  ...AGENT_NAV,
  { label: 'Samantha Actions', href: '/dashboard/samantha-actions' },
  { label: 'Escalations', href: '/dashboard/escalations' },
  { label: 'Follow-Up Queue', href: '/dashboard/follow-up-queue' },
  { label: 'Missed Call Queue', href: '/dashboard/missed-call-queue' },
  { label: 'Agents', href: '/dashboard/agents' },
  { label: 'Add User', href: '/dashboard/add-user' },
  { label: 'Preferences', href: '/dashboard/preferences' },
]

const PLATFORM_ADMIN_NAV: NavItem[] = [...ADMIN_NAV]

export default function Sidebar() {
  const pathname = usePathname() ?? ''

  const [role, setRole] = useState<Role>('agent')
  const [loadingRole, setLoadingRole] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()

        if (userErr || !userRes?.user) {
          if (!mounted) return
          setRole('agent')
          setLoadingRole(false)
          return
        }

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userRes.user.id)
          .single()

        if (!mounted) return

        if (profileErr || !profile?.role) {
          setRole('agent')
          setLoadingRole(false)
          return
        }

        const nextRole =
          profile.role === 'platform_admin'
            ? 'platform_admin'
            : profile.role === 'admin'
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
    if (role === 'platform_admin') return PLATFORM_ADMIN_NAV
    if (role === 'admin') return ADMIN_NAV
    return AGENT_NAV
  }, [role])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  async function handleLogout() {
    try {
      setLoggingOut(true)

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      await supabase.auth.signOut()

      window.location.href = '/login'
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <aside className="w-60 min-h-screen bg-gray-100 p-4 shadow flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold">CRM</h2>
        <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
          {loadingRole ? 'Loading role...' : role.replace('_', ' ')}
        </div>
      </div>

      <nav className="flex flex-col space-y-2 flex-1">
        {navItems.map((item) => {
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-6 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60"
      >
        {loggingOut ? 'Logging out...' : 'Logout'}
      </button>
    </aside>
  )
}