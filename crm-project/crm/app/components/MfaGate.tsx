'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '../../lib/supabase-browser'

const supabase = getSupabaseBrowser()

type Role = 'agent' | 'admin' | 'platform_admin'

export default function MfaGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''

  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkMfaRequirement() {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()

        if (userErr || !userRes?.user) {
          router.replace('/login')
          return
        }

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userRes.user.id)
          .single()

        if (profileErr || !profile?.role) {
          if (mounted) setChecking(false)
          return
        }

        const role = profile.role as Role
        const requiresMfa = role === 'admin' || role === 'platform_admin'

        if (!requiresMfa) {
          if (mounted) setChecking(false)
          return
        }

        const { data: factorsData, error: factorsErr } =
          await supabase.auth.mfa.listFactors()

        if (factorsErr) {
          if (mounted) setChecking(false)
          return
        }

        const verifiedTotpFactors = factorsData?.totp?.filter(
          (factor) => factor.status === 'verified'
        )

        const hasMfa = !!verifiedTotpFactors?.length
        const alreadyOnSecurityPage = pathname.startsWith('/dashboard/security')

        if (!hasMfa && !alreadyOnSecurityPage) {
          router.replace('/dashboard/security')
          return
        }

        if (mounted) setChecking(false)
      } catch {
        if (mounted) setChecking(false)
      }
    }

    checkMfaRequirement()

    return () => {
      mounted = false
    }
  }, [pathname, router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Checking security requirements...
      </div>
    )
  }

  return <>{children}</>
}