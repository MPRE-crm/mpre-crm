// crm/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import Sidebar from '../components/Sidebar'  // matches your Sidebar.tsx filename

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
