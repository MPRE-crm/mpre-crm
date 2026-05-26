import type { ReactNode } from 'react'
import Sidebar from '../components/Sidebar'
import MfaGate from '../components/MfaGate'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <MfaGate>
      <div className="min-h-screen flex bg-[var(--color-background)] text-[var(--color-foreground)]">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </MfaGate>
  )
}