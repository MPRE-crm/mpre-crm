'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Leads', href: '/leads' },
  { label: 'Call Logs', href: '/dashboard/call-logs' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-gray-100 p-4 shadow">
      <h2 className="text-xl font-bold mb-6">CRM</h2>
      <nav className="flex flex-col space-y-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hover:underline ${
              pathname === item.href ? 'text-blue-600 font-semibold' : 'text-gray-700'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
