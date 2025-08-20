'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; href: string }

const navItems: NavItem[] = [
  { label: 'Home', href: '/dashboard/home' },
  { label: 'Leads', href: '/dashboard/leads' },
  { label: 'Call Logs', href: '/dashboard/call-logs' },
]

export default function Sidebar() {
  // Guard against null
  const pathname = usePathname() ?? ''

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="w-60 min-h-screen bg-gray-100 p-4 shadow">
      <h2 className="text-xl font-bold mb-6">CRM</h2>
      <nav className="flex flex-col space-y-2">
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
    </aside>
  )
}

