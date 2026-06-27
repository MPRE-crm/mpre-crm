'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '../../lib/supabase-browser'

const supabase = getSupabaseBrowser()

type Role = 'agent' | 'admin' | 'platform_admin' | 'org_admin'

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out`))
    }, ms)

    Promise.resolve(promiseLike)
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

export default function MfaGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''

  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState('Checking security requirements...')

  useEffect(() => {
    let mounted = true

    async function checkMfaRequirement() {
      try {
        setMessage('Checking security requirements...')

        const userResult = await withTimeout<any>(
          supabase.auth.getUser(),
          8000,
          'Get user'
        )

        if (!mounted) return

        const user = userResult?.data?.user
        const userErr = userResult?.error

        if (userErr || !user) {
          setMessage('Redirecting to login...')
          router.replace('/login')
          window.setTimeout(() => {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login'
            }
          }, 1000)
          return
        }

        const profileResult = await withTimeout<any>(
          supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single() as any,
          8000,
          'Load profile'
        )

        if (!mounted) return

        const profile = profileResult?.data
        const profileErr = profileResult?.error

        if (profileErr || !profile?.role) {
          console.error('MfaGate profile error:', profileErr)
          setMessage('Could not load your user profile. Please sign out and sign in again.')
          setChecking(false)
          return
        }

        const role = profile.role as Role
        const requiresMfa =
          role === 'admin' || role === 'platform_admin' || role === 'org_admin'

        if (!requiresMfa) {
          setChecking(false)
          return
        }

        const alreadyOnSecurityPage = pathname.startsWith('/dashboard/security')

        let hasMfa = false

        try {
          const factorsResult = await withTimeout<any>(
            supabase.auth.mfa.listFactors(),
            8000,
            'List MFA factors'
          )

          const factorsData = factorsResult?.data
          const factorsErr = factorsResult?.error

          if (factorsErr) {
            console.error('MfaGate factors error:', factorsErr)
          }

          const verifiedTotpFactors = factorsData?.totp?.filter(
            (factor: any) => factor.status === 'verified'
          )

          hasMfa = !!verifiedTotpFactors?.length
        } catch (factorError) {
          console.error('MfaGate factors timeout/error:', factorError)
          hasMfa = false
        }

        if (!mounted) return

        if (!hasMfa && !alreadyOnSecurityPage) {
          setMessage('Redirecting to security setup...')
          router.replace('/dashboard/security')
          window.setTimeout(() => {
            if (!window.location.pathname.startsWith('/dashboard/security')) {
              window.location.href = '/dashboard/security'
            }
          }, 1000)
          return
        }

        setChecking(false)
      } catch (error) {
        console.error('MfaGate security check error:', error)

        if (mounted) {
          setMessage('Security check failed. Please refresh or sign in again.')
          setChecking(false)
        }
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
        {message}
      </div>
    )
  }

  return <>{children}</>
}
