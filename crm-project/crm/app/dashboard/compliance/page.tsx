'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

import ComplianceAuditPanel from './ComplianceAuditPanel';
import ComplianceManagerPanel from './ComplianceManagerPanel';
import LicenseValidationPanel from './LicenseValidationPanel';

const supabase =
  getSupabaseBrowser();

export default function CompliancePage() {
  const router =
    useRouter();

  const [
    checkingAccess,
    setCheckingAccess,
  ] = useState(true);

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const {
          data: userResult,
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !userResult.user
        ) {
          router.replace(
            '/login'
          );
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('role')
          .eq(
            'id',
            userResult.user.id
          )
          .single();

        if (!mounted) {
          return;
        }

        if (
          profileError ||
          profile?.role !==
            'platform_admin'
        ) {
          router.replace(
            '/dashboard/home'
          );
          return;
        }

        setAuthorized(true);
      } catch (error) {
        console.error(
          'Compliance access check failed:',
          error
        );

        router.replace(
          '/dashboard/home'
        );
      } finally {
        if (mounted) {
          setCheckingAccess(false);
        }
      }
    }

    void checkAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (
    checkingAccess ||
    !authorized
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Checking platform-admin access...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Platform Admin
            </div>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Compliance
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Select a state, complete its launch checklist, approve its rule
              package, and clearly see which states are ready.
            </p>
          </div>
        </div>
      </header>

      <ComplianceAuditPanel />

      <ComplianceManagerPanel />

      <details className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-5">
          <div className="inline-flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
              <BadgeCheck className="h-5 w-5" />
            </div>

            <div>
              <div className="font-bold text-slate-950">
                Organization and Individual License Validation
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Open only when reviewing brokerage, broker, administrator or
                agent licenses.
              </div>
            </div>
          </div>
        </summary>

        <div className="border-t border-slate-200">
          <LicenseValidationPanel />
        </div>
      </details>
    </div>
  );
}