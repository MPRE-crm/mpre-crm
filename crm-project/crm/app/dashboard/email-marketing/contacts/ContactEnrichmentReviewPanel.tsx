'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type ReviewAction =
  | 'approve'
  | 'reject'
  | 'ignore'
  | 'resolve';

type PrimaryView =
  | 'actionable'
  | 'conflicts';

type ReviewContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  mls_agent_id: string | null;
  mls_office_id: string | null;
  license_number: string | null;
  contact_review_status: string | null;
};

type RealtorMatch = {
  id: string;
  agent_display_name: string | null;
  agent_email: string | null;
  agent_company: string | null;
  external_agent_id: string | null;
  external_office_id: string | null;
};

type EnrichmentReview = {
  id: string;
  contact_id: string | null;
  realtor_match_id: string | null;
  issue_type: string;
  field_name: string | null;
  current_value: string | null;
  proposed_value: string | null;
  source: string;
  status: string;
  confidence: number | string | null;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  contact: ReviewContact | null;
  realtor_match: RealtorMatch | null;
};

type ContactEnrichmentReviewPanelProps = {
  onDirectoryChanged:
    () => void | Promise<void>;
};

const ISSUE_OPTIONS = [
  {
    value: 'all',
    label: 'All Issues',
  },
  {
    value: 'missing_phone',
    label: 'Missing Phone',
  },
  {
    value: 'missing_brokerage',
    label: 'Missing Brokerage',
  },
  {
    value: 'brokerage_conflict',
    label: 'Brokerage Conflict',
  },
  {
    value: 'email_conflict',
    label: 'Email Conflict',
  },
  {
    value: 'mls_id_conflict',
    label: 'MLS ID Conflict',
  },
  {
    value: 'possible_duplicate',
    label: 'Possible Duplicate',
  },
  {
    value: 'unlinked_match',
    label: 'Unlinked Match',
  },
  {
    value: 'stale_data',
    label: 'Stale Data',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

const STATUS_OPTIONS = [
  {
    value: 'pending',
    label: 'Pending',
  },
  {
    value: 'approved',
    label: 'Approved',
  },
  {
    value: 'rejected',
    label: 'Rejected',
  },
  {
    value: 'resolved',
    label: 'Resolved',
  },
  {
    value: 'ignored',
    label: 'Ignored',
  },
  {
    value: 'all',
    label: 'All Statuses',
  },
];

const APPROVABLE_FIELDS =
  new Set([
    'company',
    'phone',
    'mls_agent_id',
    'mls_office_id',
    'license_number',
  ]);

function titleCase(
  value: string
) {
  return value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function cleanComparable(
  value:
    | string
    | null
    | undefined
) {
  return String(
    value || ''
  )
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function contactName(
  review: EnrichmentReview
) {
  const contact =
    review.contact;

  if (contact) {
    return (
      contact.display_name ||
      [
        contact.first_name,
        contact.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      contact.email ||
      'Unnamed contact'
    );
  }

  return (
    review.realtor_match
      ?.agent_display_name ||
    review.realtor_match
      ?.agent_email ||
    'Unlinked Realtor match'
  );
}

function contactEmail(
  review: EnrichmentReview
) {
  return (
    review.contact?.email ||
    review.realtor_match
      ?.agent_email ||
    '-'
  );
}

function liveFieldValue(
  review: EnrichmentReview
) {
  const contact =
    review.contact;

  if (!contact) {
    return null;
  }

  switch (
    review.field_name
  ) {
    case 'company':
      return contact.company;

    case 'phone':
      return contact.phone;

    case 'mls_agent_id':
      return contact.mls_agent_id;

    case 'mls_office_id':
      return contact.mls_office_id;

    case 'license_number':
      return contact.license_number;

    default:
      return null;
  }
}

function canApprove(
  review: EnrichmentReview
) {
  return (
    review.status ===
      'pending' &&
    Boolean(
      review.contact_id
    ) &&
    Boolean(
      review.field_name &&
      APPROVABLE_FIELDS.has(
        review.field_name
      )
    ) &&
    Boolean(
      review.proposed_value
        ?.trim()
    )
  );
}

function canResolve(
  review: EnrichmentReview
) {
  if (
    review.status !==
      'pending' ||
    !review.contact
  ) {
    return false;
  }

  const liveValue =
    liveFieldValue(
      review
    );

  if (
    review.issue_type ===
      'missing_phone' ||
    review.issue_type ===
      'missing_brokerage'
  ) {
    return Boolean(
      String(
        liveValue || ''
      ).trim()
    );
  }

  if (
    review.issue_type ===
      'brokerage_conflict' ||
    review.issue_type ===
      'mls_id_conflict'
  ) {
    return (
      Boolean(
        review.proposed_value
          ?.trim()
      ) &&
      cleanComparable(
        liveValue
      ) ===
        cleanComparable(
          review.proposed_value
        )
    );
  }

  return false;
}

function isConflictReview(
  review: EnrichmentReview
) {
  return (
    review.issue_type
      .includes(
        'conflict'
      ) ||
    review.issue_type ===
      'possible_duplicate' ||
    review.issue_type ===
      'unlinked_match'
  );
}

function isAwaitingMlsReview(
  review: EnrichmentReview
) {
  return (
    review.status ===
      'pending' &&
    review.issue_type ===
      'missing_brokerage' &&
    review.source ===
      'legacy_import_cleanup' &&
    !review.proposed_value
      ?.trim()
  );
}

function isActionableReview(
  review: EnrichmentReview
) {
  return (
    canApprove(
      review
    ) ||
    canResolve(
      review
    )
  );
}

function matchesSearch(
  review: EnrichmentReview,
  term: string
) {
  if (!term) {
    return true;
  }

  return [
    contactName(
      review
    ),
    contactEmail(
      review
    ),
    review.issue_type,
    review.field_name,
    review.current_value,
    review.proposed_value,
    review.contact
      ?.company,
    review.realtor_match
      ?.agent_company,
    detailReason(
      review
    ),
  ]
    .filter(
      Boolean
    )
    .some(
      (value) =>
        String(
          value
        )
          .toLowerCase()
          .includes(
            term
          )
    );
}

function issueClasses(
  issueType: string
) {
  if (
    issueType.includes(
      'conflict'
    ) ||
    issueType ===
      'possible_duplicate'
  ) {
    return 'bg-red-50 text-red-700';
  }

  if (
    issueType.startsWith(
      'missing_'
    )
  ) {
    return 'bg-amber-50 text-amber-700';
  }

  if (
    issueType ===
      'unlinked_match'
  ) {
    return 'bg-violet-50 text-violet-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function statusClasses(
  status: string
) {
  switch (status) {
    case 'approved':
    case 'resolved':
      return 'bg-emerald-50 text-emerald-700';

    case 'rejected':
      return 'bg-red-50 text-red-700';

    case 'ignored':
      return 'bg-slate-100 text-slate-600';

    default:
      return 'bg-amber-50 text-amber-700';
  }
}

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
}

function detailReason(
  review: EnrichmentReview
) {
  const reason =
    review.details
      ?.reason;

  return typeof reason ===
    'string'
    ? reason
    : null;
}

async function accessToken() {
  const {
    data,
    error,
  } =
    await supabase
      .auth
      .getSession();

  if (
    error ||
    !data.session
      ?.access_token
  ) {
    throw new Error(
      error?.message ||
      'Your session has expired. Sign in again.'
    );
  }

  return data.session
    .access_token;
}

export default function ContactEnrichmentReviewPanel({
  onDirectoryChanged,
}: ContactEnrichmentReviewPanelProps) {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    actingReviewId,
    setActingReviewId,
  ] =
    useState<
      string | null
    >(null);

  const [
    reviews,
    setReviews,
  ] =
    useState<
      EnrichmentReview[]
    >([]);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      'pending'
    );

  const [
    issueFilter,
    setIssueFilter,
  ] =
    useState(
      'all'
    );

  const [
    primaryView,
    setPrimaryView,
  ] =
    useState<
      PrimaryView
    >(
      'actionable'
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(null);

  const loadReviews =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            null
          );

          const token =
            await accessToken();

          const params =
            new URLSearchParams({
              status:
                statusFilter,
            });

          if (
            issueFilter !==
            'all'
          ) {
            params.set(
              'issue_type',
              issueFilter
            );
          }

          const response =
            await fetch(
              `/api/marketing/contact-enrichment-reviews?${params.toString()}`,
              {
                method:
                  'GET',

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  'no-store',
              }
            );

          const payload =
            await response
              .json()
              .catch(
                () => ({})
              );

          if (
            !response.ok ||
            !payload?.ok
          ) {
            throw new Error(
              payload?.error ||
              'Could not load Samantha directory reviews.'
            );
          }

          setReviews(
            Array.isArray(
              payload.reviews
            )
              ? payload.reviews
              : []
          );
        } catch (
          err: any
        ) {
          setError(
            err?.message ||
            'Could not load Samantha directory reviews.'
          );

          setReviews(
            []
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        issueFilter,
        statusFilter,
      ]
    );

  useEffect(
    () => {
      void loadReviews();
    },
    [
      loadReviews,
    ]
  );

  const searchTerm =
    search
      .trim()
      .toLowerCase();

  const actionableReviews =
    useMemo(
      () =>
        reviews.filter(
          isActionableReview
        ),
      [
        reviews,
      ]
    );

  const conflictReviews =
    useMemo(
      () =>
        reviews.filter(
          (review) =>
            review.status ===
              'pending' &&
            isConflictReview(
              review
            )
        ),
      [
        reviews,
      ]
    );

  const awaitingMlsReviews =
    useMemo(
      () =>
        reviews.filter(
          isAwaitingMlsReview
        ),
      [
        reviews,
      ]
    );

  const otherAwaitingReviews =
    useMemo(
      () =>
        reviews.filter(
          (review) =>
            review.status ===
              'pending' &&
            !isActionableReview(
              review
            ) &&
            !isConflictReview(
              review
            ) &&
            !isAwaitingMlsReview(
              review
            )
        ),
      [
        reviews,
      ]
    );

  const primaryReviews =
    useMemo(
      () => {
        const source =
          statusFilter ===
            'pending'
            ? primaryView ===
                'actionable'
              ? actionableReviews
              : conflictReviews
            : reviews;

        return source.filter(
          (review) =>
            matchesSearch(
              review,
              searchTerm
            )
        );
      },
      [
        actionableReviews,
        conflictReviews,
        primaryView,
        reviews,
        searchTerm,
        statusFilter,
      ]
    );

  const visiblePrimaryReviews =
    useMemo(
      () =>
        primaryReviews.slice(
          0,
          250
        ),
      [
        primaryReviews,
      ]
    );

  const visibleAwaitingMlsReviews =
    useMemo(
      () =>
        awaitingMlsReviews
          .filter(
            (review) =>
              matchesSearch(
                review,
                searchTerm
              )
          )
          .slice(
            0,
            100
          ),
      [
        awaitingMlsReviews,
        searchTerm,
      ]
    );

  const visibleOtherAwaitingReviews =
    useMemo(
      () =>
        otherAwaitingReviews
          .filter(
            (review) =>
              matchesSearch(
                review,
                searchTerm
              )
          )
          .slice(
            0,
            100
          ),
      [
        otherAwaitingReviews,
        searchTerm,
      ]
    );

  async function performAction(
    review:
      EnrichmentReview,

    action:
      ReviewAction
  ) {
    const actionText =
      action ===
        'approve'
        ? 'approve and apply Samantha\'s proposed value'
        : action ===
            'reject'
          ? 'reject this suggestion'
          : action ===
              'ignore'
            ? 'ignore this review'
            : 'mark this review resolved';

    if (
      !window.confirm(
        `Are you sure you want to ${actionText}?`
      )
    ) {
      return;
    }

    try {
      setActingReviewId(
        review.id
      );

      setError(
        null
      );

      setNotice(
        null
      );

      const token =
        await accessToken();

      const response =
        await fetch(
          '/api/marketing/contact-enrichment-reviews',
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${token}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                review_id:
                  review.id,

                action,
              }),
          }
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !payload?.ok
      ) {
        throw new Error(
          payload?.error ||
          'Could not process the directory review.'
        );
      }

      setNotice(
        `${titleCase(
          action
        )} completed for ${contactName(
          review
        )}.`
      );

      await Promise.all([
        loadReviews(),
        Promise.resolve(
          onDirectoryChanged()
        ),
      ]);
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
        'Could not process the directory review.'
      );
    } finally {
      setActingReviewId(
        null
      );
    }
  }

  function renderReviewRows(
    rows:
      EnrichmentReview[]
  ) {
    return rows.map(
      (review) => {
        const approving =
          canApprove(
            review
          );

        const resolving =
          canResolve(
            review
          );

        const acting =
          actingReviewId ===
          review.id;

        const actionInProgress =
          Boolean(
            actingReviewId
          );

        return (
          <tr
            key={
              review.id
            }
            className="border-t border-slate-100 align-top"
          >
            <td className="px-4 py-4">
              <div className="font-semibold text-slate-900">
                {contactName(
                  review
                )}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {contactEmail(
                  review
                )}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                {formatDate(
                  review.created_at
                )}
              </div>
            </td>

            <td className="px-4 py-4">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${issueClasses(
                  review.issue_type
                )}`}
              >
                {titleCase(
                  review.issue_type
                )}
              </span>

              <div className="mt-2 text-xs text-slate-500">
                Field:{' '}
                {review.field_name
                  ? titleCase(
                      review.field_name
                    )
                  : '-'}
              </div>

              {detailReason(
                review
              ) && (
                <div className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                  {detailReason(
                    review
                  )}
                </div>
              )}
            </td>

            <td className="px-4 py-4">
              <div className="max-w-xs break-words text-slate-700">
                {review.current_value ||
                  liveFieldValue(
                    review
                  ) ||
                  '-'}
              </div>
            </td>

            <td className="px-4 py-4">
              {review.proposed_value ? (
                <div className="max-w-xs break-words font-medium text-violet-700">
                  {review.proposed_value}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  Awaiting verified data
                </span>
              )}
            </td>

            <td className="px-4 py-4">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                  review.status
                )}`}
              >
                {titleCase(
                  review.status
                )}
              </span>
            </td>

            <td className="px-4 py-4">
              {review.status ===
                'pending' &&
              (
                approving ||
                resolving
              ) ? (
                <div className="flex min-w-[220px] flex-wrap gap-2">
                  {approving && (
                    <>
                      <button
                        type="button"
                        disabled={
                          actionInProgress
                        }
                        onClick={() =>
                          void performAction(
                            review,
                            'approve'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {acting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}

                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={
                          actionInProgress
                        }
                        onClick={() =>
                          void performAction(
                            review,
                            'reject'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>

                      <button
                        type="button"
                        disabled={
                          actionInProgress
                        }
                        onClick={() =>
                          void performAction(
                            review,
                            'ignore'
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Ignore
                      </button>
                    </>
                  )}

                  {resolving && (
                    <button
                      type="button"
                      disabled={
                        actionInProgress
                      }
                      onClick={() =>
                        void performAction(
                          review,
                          'resolve'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  {review.status ===
                    'pending'
                    ? isConflictReview(
                        review
                      )
                      ? 'Manual review required'
                      : 'No action needed yet'
                    : 'Decision recorded'}
                </span>
              )}
            </td>
          </tr>
        );
      }
    );
  }

  function renderAwaitingRows(
    rows:
      EnrichmentReview[]
  ) {
    return rows.map(
      (review) => (
        <tr
          key={
            review.id
          }
          className="border-t border-slate-100"
        >
          <td className="px-4 py-3">
            <div className="font-medium text-slate-900">
              {contactName(
                review
              )}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {contactEmail(
                review
              )}
            </div>
          </td>

          <td className="px-4 py-3">
            {titleCase(
              review.issue_type
            )}
          </td>

          <td className="px-4 py-3 text-sm text-slate-600">
            {detailReason(
              review
            ) ||
              'Waiting for verified directory data.'}
          </td>

          <td className="px-4 py-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <Clock3 className="h-3.5 w-3.5" />
              Awaiting verified data
            </span>
          </td>
        </tr>
      )
    );
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-white shadow-sm">
      <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-white to-violet-50 px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Samantha Directory Review
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-900">
              Review only information that is ready for a decision
            </h2>

            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Samantha keeps unverified directory records out of your working queue. Your 28 buyer-match Realtors remain visible inside each listing&apos;s Buyer-Match panel.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadReviews()
            }
            disabled={
              loading ||
              Boolean(
                actingReviewId
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            Refresh Reviews
          </button>
        </div>
      </div>

      {notice && (
        <div className="mx-5 mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-5 mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            setPrimaryView(
              'actionable'
            )
          }
          className={`rounded-2xl border p-4 text-left transition ${
            primaryView ===
              'actionable'
              ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100'
              : 'border-emerald-200 bg-white hover:bg-emerald-50'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Actionable Reviews
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {actionableReviews.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Ready for approval or resolution
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setPrimaryView(
              'conflicts'
            )
          }
          className={`rounded-2xl border p-4 text-left transition ${
            primaryView ===
              'conflicts'
              ? 'border-red-300 bg-red-50 ring-2 ring-red-100'
              : 'border-red-200 bg-white hover:bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Conflicts / Unlinked
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {conflictReviews.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Kept separate from ordinary reviews
          </div>
        </button>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock3 className="h-4 w-4 text-blue-600" />
            Awaiting MLS Enrichment
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {awaitingMlsReviews.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Hidden until verified brokerage data arrives
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock3 className="h-4 w-4 text-slate-500" />
            Other Awaiting Data
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {otherAwaitingReviews.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Missing contact details or manual follow-up
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {statusFilter ===
              'pending'
              ? primaryView ===
                  'actionable'
                ? 'Actionable Review Queue'
                : 'Conflict and Unlinked Queue'
              : `${titleCase(
                  statusFilter
                )} Reviews`}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Showing {visiblePrimaryReviews.length} of {primaryReviews.length} matching reviews. Unverified records remain collapsed below.
          </div>
        </div>

        <div className="grid w-full gap-2 md:grid-cols-[minmax(220px,320px)_190px_220px] xl:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search reviews..."
              className="w-full rounded-2xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target
                  .value
              )
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            {STATUS_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <select
            value={
              issueFilter
            }
            onChange={(
              event
            ) =>
              setIssueFilter(
                event.target
                  .value
              )
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            {ISSUE_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">
                Realtor
              </th>

              <th className="px-4 py-3">
                Issue
              </th>

              <th className="px-4 py-3">
                Current
              </th>

              <th className="px-4 py-3">
                Samantha Suggestion
              </th>

              <th className="px-4 py-3">
                Status
              </th>

              <th className="px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {renderReviewRows(
              visiblePrimaryReviews
            )}

            {!loading &&
              visiblePrimaryReviews.length ===
                0 && (
                <tr>
                  <td
                    colSpan={
                      6
                    }
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    {statusFilter ===
                      'pending'
                      ? primaryView ===
                          'actionable'
                        ? 'Nothing needs your approval right now.'
                        : 'No conflicts or unlinked Realtor matches require attention.'
                      : 'No directory reviews match these filters.'}
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Samantha directory reviews...
        </div>
      )}

      {statusFilter ===
        'pending' && (
        <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-5">
          <details className="rounded-2xl border border-blue-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    Awaiting MLS Directory Enrichment
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    These {awaitingMlsReviews.length} legacy contacts are not actionable until verified brokerage data arrives.
                  </div>
                </div>

                <span className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:mt-0">
                  {awaitingMlsReviews.length} {awaitingMlsReviews.length === 1 ? 'record' : 'records'}
                </span>
              </div>
            </summary>

            <div className="border-t border-blue-100">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-50 text-left">
                    <tr>
                      <th className="px-4 py-3">
                        Realtor
                      </th>

                      <th className="px-4 py-3">
                        Waiting For
                      </th>

                      <th className="px-4 py-3">
                        Reason
                      </th>

                      <th className="px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {renderAwaitingRows(
                      visibleAwaitingMlsReviews
                    )}
                  </tbody>
                </table>
              </div>

              {awaitingMlsReviews.length >
                visibleAwaitingMlsReviews.length && (
                <div className="border-t border-blue-100 px-4 py-3 text-xs text-slate-500">
                  Showing the first 100 records. Use search or the Missing Brokerage issue filter to narrow the list.
                </div>
              )}
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    Other Records Awaiting Verified Data
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    These records need a phone number or another manually verified detail before Samantha can resolve them.
                  </div>
                </div>

                <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:mt-0">
                  {otherAwaitingReviews.length} {otherAwaitingReviews.length === 1 ? 'record' : 'records'}
                </span>
              </div>
            </summary>

            <div className="border-t border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-4 py-3">
                        Realtor
                      </th>

                      <th className="px-4 py-3">
                        Waiting For
                      </th>

                      <th className="px-4 py-3">
                        Reason
                      </th>

                      <th className="px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {renderAwaitingRows(
                      visibleOtherAwaitingReviews
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </div>
      )}

      {primaryReviews.length >
        visiblePrimaryReviews.length && (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          The working queue is limited to 250 rows for performance. Narrow the issue filter or search to reach a specific review.
        </div>
      )}
    </section>
  );
}
