'use client';

import {
  useEffect,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  MapPinned,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

import RulePacksPanel from './RulePacksPanel';
import LicenseValidationPanel from './LicenseValidationPanel';

const supabase =
  getSupabaseBrowser();

type JurisdictionRow = {
  id: string;
  code: string;
  stateCode: string | null;
  name: string;
  jurisdictionType: string;
  launchStatus: string;
  marketingEnabled: boolean;
  currentRuleVersion: string | null;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  checklistRequired: number;
  checklistCompleted: number;
};

type ComplianceOverview = {
  ok: true;

  summary: {
    totalJurisdictions: number;
    states: number;
    federal: number;
    pendingReview: number;
    inReview: number;
    approved: number;
    enabled: number;
  };

  jurisdictions:
    JurisdictionRow[];
};

const complianceSections = [
  {
    title: 'State Launches',
    description:
      'Review federal and state readiness, statewide checklists, approval status, and activation locks.',
    icon: MapPinned,
    connected: true,
  },
  {
    title: 'Rule Packs',
    description:
      'Manage versioned requirements, official sources, effective dates, and review history.',
    icon: BookOpenCheck,
    connected: true,
  },
  {
    title: 'License Validation',
    description:
      'Review organization brokerage licenses, responsible brokers, and agent state licenses.',
    icon: BadgeCheck,
    connected: true,
  },
  {
    title: 'MLS Profiles',
    description:
      'Manage organization-specific MLS permissions, attribution, media rights, and data freshness.',
    icon: Database,
    connected: false,
  },
  {
    title: 'Approval Queue',
    description:
      'Review organization-admin, platform-admin, broker, legal, compliance, and MLS approvals.',
    icon: ClipboardCheck,
    connected: false,
  },
  {
    title: 'Review Reminders',
    description:
      'Track upcoming rule reviews, expiring licenses, stale MLS rules, and overdue approvals.',
    icon: BellRing,
    connected: false,
  },
];

function formatStatus(
  value: string
) {
  return value
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'Not scheduled';
  }

  const date =
    new Date(`${value}T00:00:00`);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );
}

function statusClasses(
  status: string
) {
  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'in_review') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (status === 'suspended') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function CompliancePage() {
  const router = useRouter();

  const [
    checkingAccess,
    setCheckingAccess,
  ] = useState(true);

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [
    loadingOverview,
    setLoadingOverview,
  ] = useState(true);

  const [
    overviewError,
    setOverviewError,
  ] =
    useState<string | null>(
      null
    );

  const [
    overview,
    setOverview,
  ] =
    useState<ComplianceOverview | null>(
      null
    );

  async function loadOverview() {
    try {
      setLoadingOverview(true);
      setOverviewError(null);

      const {
        data: sessionResult,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const response =
        await fetch(
          '/api/compliance/overview',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,
            },
            cache: 'no-store',
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            'Could not load compliance overview.'
        );
      }

      setOverview(
        result as ComplianceOverview
      );
    } catch (error: any) {
      console.error(
        'Compliance overview load failed:',
        error
      );

      setOverview(null);

      setOverviewError(
        error?.message ||
          'Could not load compliance data.'
      );
    } finally {
      setLoadingOverview(false);
    }
  }

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

        await loadOverview();
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

  const stateRows =
    overview?.jurisdictions.filter(
      (jurisdiction) =>
        jurisdiction.code ===
          'US-FED' ||
        jurisdiction.code ===
          'US-ID'
    ) || [];

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
        {complianceSections.map(
          (section) => {
            const Icon =
              section.icon;

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

                {section.connected ? (
                  <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {section.title === 'Rule Packs'
                      ? 'Live read-only rule-pack data connected'
                      : section.title === 'License Validation'
                      ? 'Live read-only license data connected'
                      : loadingOverview
                      ? 'Loading live Supabase data...'
                      : overview
                      ? `${overview.summary.states} states • ${overview.summary.approved} approved • ${overview.summary.enabled} enabled`
                      : 'Live connection needs attention'}
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                    Read-only connection coming next
                  </div>
                )}
              </article>
            );
          }
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-blue-700" />

              <h2 className="text-lg font-semibold text-slate-950">
                Live State Launch Readiness
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Read-only data from the federal and statewide
              compliance launch tables.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOverview}
            disabled={loadingOverview}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loadingOverview
                  ? 'animate-spin'
                  : ''
              }`}
            />

            Refresh
          </button>
        </div>

        {overviewError ? (
          <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {overviewError}
          </div>
        ) : null}

        {loadingOverview &&
        !overview ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading state-launch data...
          </div>
        ) : null}

        {overview ? (
          <>
            <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Jurisdictions
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {
                        overview.summary
                          .totalJurisdictions
                      }
                    </p>
                  </div>

                  <MapPinned className="h-6 w-6 text-blue-700" />
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Pending Review
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {
                        overview.summary
                          .pendingReview
                      }
                    </p>
                  </div>

                  <Clock3 className="h-6 w-6 text-amber-700" />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Approved
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {
                        overview.summary
                          .approved
                      }
                    </p>
                  </div>

                  <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Marketing Enabled
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {
                        overview.summary
                          .enabled
                      }
                    </p>
                  </div>

                  <ShieldCheck className="h-6 w-6 text-slate-600" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Jurisdiction
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Launch Status
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Rule Version
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Checklist
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Next Review
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Marketing
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stateRows.map(
                    (jurisdiction) => (
                      <tr
                        key={
                          jurisdiction.id
                        }
                        className="border-t border-slate-100"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {
                              jurisdiction.name
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {
                              jurisdiction.code
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                              jurisdiction
                                .launchStatus
                            )}`}
                          >
                            {formatStatus(
                              jurisdiction
                                .launchStatus
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {jurisdiction
                            .currentRuleVersion ||
                            'Not approved'}
                        </td>

                        <td className="px-5 py-4">
                          {jurisdiction
                            .jurisdictionType ===
                          'federal'
                            ? 'Federal baseline'
                            : `${jurisdiction.checklistCompleted} / ${jurisdiction.checklistRequired}`}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(
                            jurisdiction
                              .nextReviewDue
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              jurisdiction
                                .marketingEnabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                            }`}
                          >
                            {jurisdiction
                              .marketingEnabled
                              ? 'Enabled'
                              : 'Locked'}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <RulePacksPanel />

      <LicenseValidationPanel />
    </div>
  );
}



