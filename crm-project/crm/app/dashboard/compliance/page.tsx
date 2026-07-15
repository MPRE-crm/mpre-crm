'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  ClipboardCheck,
  Database,
  MapPinned,
  ShieldCheck,
} from 'lucide-react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

const supabase = getSupabaseBrowser();

const complianceSections = [
  {
    title: 'State Launches',
    description:
      'Review federal and state readiness, statewide checklists, approval status, and activation locks.',
    icon: MapPinned,
  },
  {
    title: 'Rule Packs',
    description:
      'Manage versioned requirements, official sources, effective dates, and review history.',
    icon: BookOpenCheck,
  },
  {
    title: 'License Validation',
    description:
      'Review organization brokerage licenses, responsible brokers, and agent state licenses.',
    icon: BadgeCheck,
  },
  {
    title: 'MLS Profiles',
    description:
      'Manage organization-specific MLS permissions, attribution, media rights, and data freshness.',
    icon: Database,
  },
  {
    title: 'Approval Queue',
    description:
      'Review organization-admin, platform-admin, broker, legal, compliance, and MLS approvals.',
    icon: ClipboardCheck,
  },
  {
    title: 'Review Reminders',
    description:
      'Track upcoming rule reviews, expiring licenses, stale MLS rules, and overdue approvals.',
    icon: BellRing,
  },
];

export default function CompliancePage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const {
          data: userResult,
          error: userError,
        } = await supabase.auth.getUser();

        if (
          userError ||
          !userResult?.user
        ) {
          router.replace('/login');
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

        if (!mounted) return;

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

    checkAccess();

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
              Control nationwide state launches, rule packs,
              licensing, MLS compliance, approvals, and review
              deadlines from one protected area.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="font-semibold text-amber-950">
          Compliance foundation installed
        </p>

        <p className="mt-1 text-sm leading-6 text-amber-900">
          Federal and Idaho requirements remain drafts.
          Marketing activation stays locked until sources,
          reviews, licenses, MLS permissions, and approvals
          are completed.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {complianceSections.map((section) => {
          const Icon = section.icon;

          return (
            <article
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-950">
                    {section.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {section.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                Read-only connection coming next
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
