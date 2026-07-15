'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
  Link2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type RulePackSummary = {
  totalRulePacks: number;
  draft: number;
  approved: number;
  active: number;
  totalRequirements: number;
  totalSources: number;
  verifiedSources: number;
  unlinkedRequirements: number;
};

type RulePackRow = {
  id: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  jurisdictionType: string;
  name: string;
  version: string;
  status: string;
  isActive: boolean;
  effectiveDate: string | null;
  expirationDate: string | null;
  nextReviewDue: string | null;
  approvedAt: string | null;
  requiresBrokerApproval: boolean;
  requiresLegalReview: boolean;
  legalReviewedAt: string | null;
  brokerReviewedAt: string | null;
  requirementCount: number;
  requiredRequirementCount: number;
  linkedRequirementCount: number;
  unlinkedRequirementCount: number;
  sourceCount: number;
  verifiedSourceCount: number;
};

type RulePackResponse = {
  ok: true;
  summary: RulePackSummary;
  rulePacks: RulePackRow[];
};

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

function statusClasses(
  status: string
) {
  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'in_review') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (status === 'rejected') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function reviewLabel(
  required: boolean,
  reviewedAt: string | null
) {
  if (!required) {
    return 'Not required';
  }

  return reviewedAt
    ? 'Complete'
    : 'Pending';
}

export default function RulePacksPanel() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    result,
    setResult,
  ] =
    useState<RulePackResponse | null>(
      null
    );

  async function loadRulePacks() {
    try {
      setLoading(true);
      setError(null);

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
          '/api/compliance/rule-packs',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,
            },
            cache: 'no-store',
          }
        );

      const responseBody =
        await response.json();

      if (
        !response.ok ||
        !responseBody?.ok
      ) {
        throw new Error(
          responseBody?.error ||
            'Could not load rule packs.'
        );
      }

      setResult(
        responseBody as RulePackResponse
      );
    } catch (loadError: any) {
      console.error(
        'Rule-pack load failed:',
        loadError
      );

      setResult(null);

      setError(
        loadError?.message ||
          'Could not load rule-pack data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRulePacks();
  }, []);

  const featuredRulePacks =
    result?.rulePacks.filter(
      (rulePack) =>
        rulePack.jurisdictionCode ===
          'US-FED' ||
        rulePack.jurisdictionCode ===
          'US-ID'
    ) || [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-blue-700" />

            <h2 className="text-lg font-semibold text-slate-950">
              Live Rule Pack Readiness
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Read-only rule versions, requirements,
            sources, verification, reviews, and
            activation status.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRulePacks}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading
                ? 'animate-spin'
                : ''
            }`}
          />

          Refresh
        </button>
      </div>

      {error ? (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading &&
      !result ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Loading rule-pack data...
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Rule Packs
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {
                      result.summary
                        .totalRulePacks
                    }
                  </p>
                </div>

                <BookOpenCheck className="h-6 w-6 text-blue-700" />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Requirements
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {
                      result.summary
                        .totalRequirements
                    }
                  </p>
                </div>

                <FileCheck2 className="h-6 w-6 text-amber-700" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Official Sources
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {
                      result.summary
                        .totalSources
                    }
                  </p>
                </div>

                <Link2 className="h-6 w-6 text-slate-600" />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Active Packs
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {
                      result.summary
                        .active
                    }
                  </p>
                </div>

                <ShieldCheck className="h-6 w-6 text-emerald-700" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    Rule Pack
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Status
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Requirements
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Sources
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Reviews
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Activation
                  </th>
                </tr>
              </thead>

              <tbody>
                {featuredRulePacks.map(
                  (rulePack) => (
                    <tr
                      key={rulePack.id}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {
                            rulePack
                              .jurisdictionName
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {
                            rulePack.version
                          }
                          {' • '}
                          {
                            rulePack
                              .jurisdictionCode
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                            rulePack.status
                          )}`}
                        >
                          {formatStatus(
                            rulePack.status
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        <div>
                          {
                            rulePack
                              .requirementCount
                          } total
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {
                            rulePack
                              .linkedRequirementCount
                          } linked
                          {' • '}
                          {
                            rulePack
                              .unlinkedRequirementCount
                          } unlinked
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        <div>
                          {
                            rulePack
                              .sourceCount
                          } total
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {
                            rulePack
                              .verifiedSourceCount
                          } verified
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs leading-5 text-slate-600">
                        <div>
                          Legal:{' '}
                          {reviewLabel(
                            rulePack
                              .requiresLegalReview,
                            rulePack
                              .legalReviewedAt
                          )}
                        </div>

                        <div>
                          Broker:{' '}
                          {reviewLabel(
                            rulePack
                              .requiresBrokerApproval,
                            rulePack
                              .brokerReviewedAt
                          )}
                        </div>

                        <div>
                          Platform:{' '}
                          {rulePack.approvedAt
                            ? 'Approved'
                            : 'Pending'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                            rulePack.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rulePack.isActive ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : null}

                          {rulePack.isActive
                            ? 'Active'
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
  );
}
