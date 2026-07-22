'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type EnrichmentRow = {
  id: string;
  listing_id: string;
  status: string;
  research_version: number;
  samantha_summary: string | null;
  research_notes: string | null;
  research_error: string | null;
  generation_model: string | null;
  researched_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
};

type HighlightRow = {
  id: string;
  listing_id: string;
  photo_media_id: string | null;
  headline: string;
  summary: string;
  bullet_points: string[];
  source_facts: string[];
  sort_order: number;
  is_visible: boolean;
  manual_override: boolean;
};

type PhotoRow = {
  id: string;
  public_url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  title: string | null;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
};

type WebsiteReviewMode =
  | 'samantha_managed'
  | 'full_review';

type ListingWebsiteEnrichmentPanelProps = {
  listingId: string;
  listingTitle: string;
  listingReviewStatus: string;
  initiallyExpanded?: boolean;
  reviewMode?: WebsiteReviewMode;
};

function cleanBulletArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      String(item || '').trim()
    )
    .filter(Boolean)
    .slice(0, 3);
}

function enrichmentStatusLabel(
  status: string | null | undefined
) {
  switch (status) {
    case 'researching':
      return 'Researching';

    case 'needs_review':
      return 'Needs Review';

    case 'approved':
      return 'Approved';

    case 'failed':
      return 'Research Failed';

    case 'stale':
      return 'Needs Refresh';

    case 'draft':
      return 'Draft';

    default:
      return 'Not Prepared';
  }
}

function enrichmentStatusClasses(
  status: string | null | undefined
) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700';

    case 'needs_review':
      return 'bg-amber-100 text-amber-800';

    case 'researching':
      return 'bg-blue-100 text-blue-700';

    case 'failed':
      return 'bg-red-100 text-red-700';

    case 'stale':
      return 'bg-orange-100 text-orange-700';

    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function photoLabel(
  photo: PhotoRow,
  index: number
) {
  return (
    photo.title ||
    photo.caption ||
    photo.file_name ||
    `Photo ${index + 1}`
  );
}

export default function ListingWebsiteEnrichmentPanel({
  listingId,
  listingTitle,
  listingReviewStatus,
  initiallyExpanded = false,
  reviewMode = 'full_review',
}: ListingWebsiteEnrichmentPanelProps) {
  const [expanded, setExpanded] =
    useState(initiallyExpanded);

  const [
    showFullDetails,
    setShowFullDetails,
  ] = useState(
    reviewMode === 'full_review'
  );

  const [hasLoaded, setHasLoaded] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [researching, setResearching] =
    useState(false);

  const [approving, setApproving] =
    useState(false);

  const [
    savingHighlightId,
    setSavingHighlightId,
  ] = useState<string | null>(null);

  const [
    dirtyHighlightIds,
    setDirtyHighlightIds,
  ] = useState<string[]>([]);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [
    enrichment,
    setEnrichment,
  ] = useState<EnrichmentRow | null>(
    null
  );

  const [
    highlights,
    setHighlights,
  ] = useState<HighlightRow[]>([]);

  const [photos, setPhotos] =
    useState<PhotoRow[]>([]);

  const sortedHighlights =
    useMemo(
      () =>
        [...highlights].sort(
          (left, right) =>
            left.sort_order -
            right.sort_order
        ),
      [highlights]
    );

  const hasManualOverrides =
    useMemo(
      () =>
        highlights.some(
          (highlight) =>
            highlight.manual_override
        ),
      [highlights]
    );

  useEffect(() => {
    setShowFullDetails(
      reviewMode ===
        'full_review'
    );
  }, [reviewMode]);

  const loadEnrichment =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          enrichmentResult,
          highlightResult,
          photoResult,
        ] = await Promise.all([
          supabase
            .from(
              'listing_website_enrichment'
            )
            .select(`
              id,
              listing_id,
              status,
              research_version,
              samantha_summary,
              research_notes,
              research_error,
              generation_model,
              researched_at,
              approved_at,
              approved_by
            `)
            .eq(
              'listing_id',
              listingId
            )
            .maybeSingle(),

          supabase
            .from(
              'listing_website_highlights'
            )
            .select(`
              id,
              listing_id,
              photo_media_id,
              headline,
              summary,
              bullet_points,
              source_facts,
              sort_order,
              is_visible,
              manual_override
            `)
            .eq(
              'listing_id',
              listingId
            )
            .order(
              'sort_order',
              {
                ascending: true,
              }
            ),

          supabase
            .from('listing_media')
            .select(`
              id,
              public_url,
              thumbnail_url,
              file_name,
              title,
              caption,
              sort_order,
              is_primary
            `)
            .eq(
              'listing_id',
              listingId
            )
            .eq(
              'media_type',
              'photo'
            )
            .eq(
              'use_in_marketing',
              true
            )
            .order(
              'sort_order',
              {
                ascending: true,
              }
            ),
        ]);

        if (enrichmentResult.error) {
          throw enrichmentResult.error;
        }

        if (highlightResult.error) {
          throw highlightResult.error;
        }

        if (photoResult.error) {
          throw photoResult.error;
        }

        setEnrichment(
          (
            enrichmentResult.data ||
            null
          ) as EnrichmentRow | null
        );

        setHighlights(
          (
            highlightResult.data ||
            []
          ).map((row: any) => ({
            ...row,

            bullet_points:
              cleanBulletArray(
                row.bullet_points
              ),

            source_facts:
              Array.isArray(
                row.source_facts
              )
                ? row.source_facts
                : [],
          })) as HighlightRow[]
        );

        setPhotos(
          (
            photoResult.data ||
            []
          ) as PhotoRow[]
        );

        setDirtyHighlightIds([]);
        setHasLoaded(true);
      } catch (loadError: any) {
        setError(
          loadError?.message ||
            'Could not load the website content draft.'
        );
      } finally {
        setLoading(false);
      }
    }, [listingId]);

  useEffect(() => {
    if (
      expanded &&
      !hasLoaded
    ) {
      void loadEnrichment();
    }
  }, [
    expanded,
    hasLoaded,
    loadEnrichment,
  ]);

  function updateLocalHighlight(
    highlightId: string,
    patch: Partial<HighlightRow>
  ) {
    setHighlights((current) =>
      current.map((highlight) =>
        highlight.id === highlightId
          ? {
              ...highlight,
              ...patch,
            }
          : highlight
      )
    );

    setDirtyHighlightIds(
      (current) =>
        current.includes(highlightId)
          ? current
          : [
              ...current,
              highlightId,
            ]
    );
  }

  async function getCurrentUserId() {
    const {
      data: userResult,
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !userResult.user
    ) {
      throw new Error(
        userError?.message ||
          'Your CRM session expired.'
      );
    }

    return userResult.user.id;
  }

  async function markNeedsReview() {
    const {
      error: enrichmentError,
    } = await supabase
      .from(
        'listing_website_enrichment'
      )
      .update({
        status:
          'needs_review',

        approved_at:
          null,

        approved_by:
          null,
      })
      .eq(
        'listing_id',
        listingId
      );

    if (enrichmentError) {
      throw enrichmentError;
    }

    setEnrichment((current) =>
      current
        ? {
            ...current,

            status:
              'needs_review',

            approved_at:
              null,

            approved_by:
              null,
          }
        : current
    );
  }

  async function startResearch() {
    if (
      listingReviewStatus !==
      'confirmed'
    ) {
      setError(
        'Review and confirm the listing facts before asking Samantha to prepare website content.'
      );

      return;
    }

    if (hasManualOverrides) {
      setError(
        'This draft contains manual edits. Samantha regeneration is disabled so those edits are not duplicated or overwritten.'
      );

      return;
    }

    try {
      setResearching(true);
      setError(null);
      setNotice(null);

      const {
        data: sessionResult,
        error: sessionError,
      } = await supabase.auth.getSession();

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
          '/api/marketing/listing-websites/research',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${sessionResult.session.access_token}`,
            },

            body:
              JSON.stringify({
                listing_id:
                  listingId,
              }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            'Samantha could not prepare the website content.'
        );
      }

      setNotice(
        result?.message ||
          'Samantha prepared six property highlights for review.'
      );

      await loadEnrichment();
    } catch (researchError: any) {
      setError(
        researchError?.message ||
          'Samantha could not prepare the website content.'
      );

      await loadEnrichment();
    } finally {
      setResearching(false);
    }
  }

  async function saveHighlight(
    highlightId: string
  ) {
    const highlight =
      highlights.find(
        (item) =>
          item.id === highlightId
      );

    if (!highlight) {
      return;
    }

    const headline =
      highlight.headline.trim();

    const summary =
      highlight.summary.trim();

    const bulletPoints =
      cleanBulletArray(
        highlight.bullet_points
      );

    if (!headline) {
      setError(
        'Each visible highlight needs a headline.'
      );

      return;
    }

    if (!summary) {
      setError(
        'Each visible highlight needs a summary.'
      );

      return;
    }

    try {
      setSavingHighlightId(
        highlightId
      );

      setError(null);
      setNotice(null);

      const userId =
        await getCurrentUserId();

      const {
        error: updateError,
      } = await supabase
        .from(
          'listing_website_highlights'
        )
        .update({
          headline,
          summary,

          bullet_points:
            bulletPoints,

          photo_media_id:
            highlight.photo_media_id,

          is_visible:
            highlight.is_visible,

          sort_order:
            highlight.sort_order,

          manual_override:
            true,

          updated_by:
            userId,
        })
        .eq(
          'id',
          highlight.id
        )
        .eq(
          'listing_id',
          listingId
        );

      if (updateError) {
        throw updateError;
      }

      await markNeedsReview();

      setHighlights((current) =>
        current.map((item) =>
          item.id === highlightId
            ? {
                ...item,

                headline,
                summary,

                bullet_points:
                  bulletPoints,

                manual_override:
                  true,
              }
            : item
        )
      );

      setDirtyHighlightIds(
        (current) =>
          current.filter(
            (id) =>
              id !== highlightId
          )
      );

      setNotice(
        'Highlight changes saved. Website content requires approval again.'
      );
    } catch (saveError: any) {
      setError(
        saveError?.message ||
          'Could not save the highlight.'
      );
    } finally {
      setSavingHighlightId(null);
    }
  }

  async function toggleVisibility(
    highlight: HighlightRow
  ) {
    try {
      setSavingHighlightId(
        highlight.id
      );

      setError(null);
      setNotice(null);

      const userId =
        await getCurrentUserId();

      const nextVisibility =
        !highlight.is_visible;

      const {
        error: updateError,
      } = await supabase
        .from(
          'listing_website_highlights'
        )
        .update({
          is_visible:
            nextVisibility,

          manual_override:
            true,

          updated_by:
            userId,
        })
        .eq(
          'id',
          highlight.id
        )
        .eq(
          'listing_id',
          listingId
        );

      if (updateError) {
        throw updateError;
      }

      await markNeedsReview();

      setHighlights((current) =>
        current.map((item) =>
          item.id === highlight.id
            ? {
                ...item,

                is_visible:
                  nextVisibility,

                manual_override:
                  true,
              }
            : item
        )
      );

      setDirtyHighlightIds(
        (current) =>
          current.filter(
            (id) =>
              id !== highlight.id
          )
      );

      setNotice(
        nextVisibility
          ? 'Highlight restored to the website draft.'
          : 'Highlight hidden from the website draft.'
      );
    } catch (visibilityError: any) {
      setError(
        visibilityError?.message ||
          'Could not change highlight visibility.'
      );
    } finally {
      setSavingHighlightId(null);
    }
  }

  async function moveHighlight(
    highlightId: string,
    direction:
      | 'up'
      | 'down'
  ) {
    const ordered =
      [...sortedHighlights];

    const currentIndex =
      ordered.findIndex(
        (highlight) =>
          highlight.id ===
          highlightId
      );

    const targetIndex =
      direction === 'up'
        ? currentIndex - 1
        : currentIndex + 1;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >=
        ordered.length
    ) {
      return;
    }

    const currentHighlight =
      ordered[currentIndex];

    const targetHighlight =
      ordered[targetIndex];

    try {
      setSavingHighlightId(
        highlightId
      );

      setError(null);
      setNotice(null);

      const userId =
        await getCurrentUserId();

      const {
        error:
          currentUpdateError,
      } = await supabase
        .from(
          'listing_website_highlights'
        )
        .update({
          sort_order:
            targetHighlight
              .sort_order,

          manual_override:
            true,

          updated_by:
            userId,
        })
        .eq(
          'id',
          currentHighlight.id
        )
        .eq(
          'listing_id',
          listingId
        );

      if (
        currentUpdateError
      ) {
        throw currentUpdateError;
      }

      const {
        error:
          targetUpdateError,
      } = await supabase
        .from(
          'listing_website_highlights'
        )
        .update({
          sort_order:
            currentHighlight
              .sort_order,

          manual_override:
            true,

          updated_by:
            userId,
        })
        .eq(
          'id',
          targetHighlight.id
        )
        .eq(
          'listing_id',
          listingId
        );

      if (
        targetUpdateError
      ) {
        throw targetUpdateError;
      }

      await markNeedsReview();

      setHighlights((current) =>
        current.map((item) => {
          if (
            item.id ===
            currentHighlight.id
          ) {
            return {
              ...item,

              sort_order:
                targetHighlight
                  .sort_order,

              manual_override:
                true,
            };
          }

          if (
            item.id ===
            targetHighlight.id
          ) {
            return {
              ...item,

              sort_order:
                currentHighlight
                  .sort_order,

              manual_override:
                true,
            };
          }

          return item;
        })
      );

      setDirtyHighlightIds([]);

      setNotice(
        'Highlight order updated. Website content requires approval again.'
      );
    } catch (moveError: any) {
      setError(
        moveError?.message ||
          'Could not reorder the highlights.'
      );

      await loadEnrichment();
    } finally {
      setSavingHighlightId(null);
    }
  }

  async function approveEnrichment() {
    const visibleHighlights =
      sortedHighlights.filter(
        (highlight) =>
          highlight.is_visible
      );

    if (
      dirtyHighlightIds.length >
      0
    ) {
      setError(
        'Save every edited highlight before approving the website content.'
      );

      return;
    }

    if (
      visibleHighlights.length !==
      6
    ) {
      setError(
        'Exactly six visible highlights are required before approval.'
      );

      return;
    }

    const incompleteHighlight =
      visibleHighlights.find(
        (highlight) =>
          !highlight.headline.trim() ||
          !highlight.summary.trim() ||
          !highlight.photo_media_id ||
          cleanBulletArray(
            highlight.bullet_points
          ).length < 2
      );

    if (incompleteHighlight) {
      setError(
        'Each visible highlight needs a headline, summary, selected photo, and at least two bullet points.'
      );

      return;
    }

    if (
      !window.confirm(
        `Approve the six website highlights for ${listingTitle}?`
      )
    ) {
      return;
    }

    try {
      setApproving(true);
      setError(null);
      setNotice(null);

      const userId =
        await getCurrentUserId();

      const approvedAt =
        new Date().toISOString();

      const {
        error: approvalError,
      } = await supabase
        .from(
          'listing_website_enrichment'
        )
        .update({
          status:
            'approved',

          approved_at:
            approvedAt,

          approved_by:
            userId,

          research_error:
            null,
        })
        .eq(
          'listing_id',
          listingId
        );

      if (approvalError) {
        throw approvalError;
      }

      setEnrichment((current) =>
        current
          ? {
              ...current,

              status:
                'approved',

              approved_at:
                approvedAt,

              approved_by:
                userId,

              research_error:
                null,
            }
          : current
      );

      setNotice(
        'Website highlights approved. They are ready for the public property-page integration.'
      );
    } catch (approvalError: any) {
      setError(
        approvalError?.message ||
          'Could not approve the website content.'
      );
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        onClick={() =>
          setExpanded(
            (current) =>
              !current
          )
        }
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />

          <span className="font-semibold text-slate-800">
            Website Content
          </span>
        </span>

        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${enrichmentStatusClasses(
              enrichment?.status
            )}`}
          >
            {enrichmentStatusLabel(
              enrichment?.status
            )}
          </span>

          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-3">
          {loading && (
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />

              Loading website content...
            </div>
          )}

          {!loading && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={
                    startResearch
                  }
                  disabled={
                    researching ||
                    listingReviewStatus !==
                      'confirmed' ||
                    hasManualOverrides
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {researching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}

                  {researching
                    ? 'Samantha Is Preparing...'
                    : enrichment
                    ? 'Regenerate Samantha Draft'
                    : 'Ask Samantha to Prepare Highlights'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadEnrichment()
                  }
                  disabled={
                    loading ||
                    researching
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />

                  Refresh
                </button>
              </div>

              {listingReviewStatus !==
                'confirmed' && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Review and confirm the listing facts before asking Samantha to prepare website content.
                </div>
              )}

              {hasManualOverrides && (
                <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  This draft contains manual edits. Samantha regeneration is disabled so the edits are not overwritten or duplicated.
                </div>
              )}

              {error && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              {notice && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  {notice}
                </div>
              )}

              {enrichment?.research_error && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {enrichment.research_error}
                </div>
              )}

              {enrichment?.samantha_summary && (
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-900">
                  <div className="font-semibold">
                    Samantha’s Summary
                  </div>

                  <div className="mt-1">
                    {
                      enrichment.samantha_summary
                    }
                  </div>
                </div>
              )}

              {reviewMode ===
                'samantha_managed' &&
                sortedHighlights.length >
                  0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white p-4">
                    <div>
                      <div className="font-semibold text-slate-900">
                        Samantha prepared the complete highlight draft.
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        Review the summary above and approve once, or open every card for detailed inspection.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowFullDetails(
                          (current) =>
                            !current
                        )
                      }
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      {showFullDetails
                        ? 'Hide Full Details'
                        : 'Review All Details'}
                    </button>
                  </div>
                )}

              {(reviewMode ===
                'full_review' ||
                showFullDetails) &&
                sortedHighlights.length >
                  0 && (
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {sortedHighlights.map(
                    (
                      highlight,
                      index
                    ) => {
                      const selectedPhoto =
                        photos.find(
                          (photo) =>
                            photo.id ===
                            highlight.photo_media_id
                        ) || null;

                      const displayBullets =
                        [
                          ...highlight
                            .bullet_points,
                        ];

                      while (
                        displayBullets.length <
                        3
                      ) {
                        displayBullets.push(
                          ''
                        );
                      }

                      const isDirty =
                        dirtyHighlightIds.includes(
                          highlight.id
                        );

                      return (
                        <article
                          key={
                            highlight.id
                          }
                          className={`rounded-2xl border bg-white p-3 ${
                            highlight.is_visible
                              ? 'border-slate-200'
                              : 'border-dashed border-slate-300 opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
                                {index +
                                  1}
                              </span>

                              {isDirty && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                  Unsaved
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Move up"
                                disabled={
                                  index ===
                                    0 ||
                                  savingHighlightId ===
                                    highlight.id
                                }
                                onClick={() =>
                                  void moveHighlight(
                                    highlight.id,
                                    'up'
                                  )
                                }
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Move down"
                                disabled={
                                  index ===
                                    sortedHighlights.length -
                                      1 ||
                                  savingHighlightId ===
                                    highlight.id
                                }
                                onClick={() =>
                                  void moveHighlight(
                                    highlight.id,
                                    'down'
                                  )
                                }
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                title={
                                  highlight.is_visible
                                    ? 'Hide highlight'
                                    : 'Show highlight'
                                }
                                disabled={
                                  savingHighlightId ===
                                  highlight.id
                                }
                                onClick={() =>
                                  void toggleVisibility(
                                    highlight
                                  )
                                }
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                              >
                                {highlight.is_visible ? (
                                  <Eye className="h-3.5 w-3.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                            {selectedPhoto ? (
                              <img
                                src={
                                  selectedPhoto.thumbnail_url ||
                                  selectedPhoto.public_url ||
                                  ''
                                }
                                alt={
                                  selectedPhoto.title ||
                                  highlight.headline ||
                                  'Listing highlight'
                                }
                                className="h-32 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-slate-500">
                                Select a marketing photo for this highlight.
                              </div>
                            )}
                          </div>

                          <label className="mt-3 block text-[11px] font-semibold text-slate-700">
                            Highlight Photo

                            <select
                              value={
                                highlight.photo_media_id ||
                                ''
                              }
                              onChange={(
                                event
                              ) =>
                                updateLocalHighlight(
                                  highlight.id,
                                  {
                                    photo_media_id:
                                      event
                                        .target
                                        .value ||
                                      null,
                                  }
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs"
                            >
                              <option value="">
                                Select a photo
                              </option>

                              {photos.map(
                                (
                                  photo,
                                  photoIndex
                                ) => (
                                  <option
                                    key={
                                      photo.id
                                    }
                                    value={
                                      photo.id
                                    }
                                  >
                                    {photoLabel(
                                      photo,
                                      photoIndex
                                    )}
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          <label className="mt-3 block text-[11px] font-semibold text-slate-700">
                            Headline

                            <input
                              value={
                                highlight.headline
                              }
                              maxLength={
                                120
                              }
                              onChange={(
                                event
                              ) =>
                                updateLocalHighlight(
                                  highlight.id,
                                  {
                                    headline:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                            />
                          </label>

                          <label className="mt-3 block text-[11px] font-semibold text-slate-700">
                            Summary

                            <textarea
                              value={
                                highlight.summary
                              }
                              maxLength={
                                600
                              }
                              rows={
                                4
                              }
                              onChange={(
                                event
                              ) =>
                                updateLocalHighlight(
                                  highlight.id,
                                  {
                                    summary:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-xs leading-5"
                            />
                          </label>

                          <div className="mt-3">
                            <div className="text-[11px] font-semibold text-slate-700">
                              Supporting Highlights
                            </div>

                            <div className="mt-1 space-y-2">
                              {[
                                0,
                                1,
                                2,
                              ].map(
                                (
                                  bulletIndex
                                ) => (
                                  <input
                                    key={
                                      bulletIndex
                                    }
                                    value={
                                      displayBullets[
                                        bulletIndex
                                      ] ||
                                      ''
                                    }
                                    maxLength={
                                      180
                                    }
                                    placeholder={`Bullet ${
                                      bulletIndex +
                                      1
                                    }`}
                                    onChange={(
                                      event
                                    ) => {
                                      const bullets =
                                        [
                                          ...displayBullets,
                                        ];

                                      bullets[
                                        bulletIndex
                                      ] =
                                        event
                                          .target
                                          .value;

                                      updateLocalHighlight(
                                        highlight.id,
                                        {
                                          bullet_points:
                                            bullets,
                                        }
                                      );
                                    }}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                                  />
                                )
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void saveHighlight(
                                highlight.id
                              )
                            }
                            disabled={
                              savingHighlightId ===
                              highlight.id
                            }
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {savingHighlightId ===
                            highlight.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}

                            Save Card
                          </button>
                        </article>
                      );
                    }
                  )}
                </div>
              )}

              {enrichment &&
                sortedHighlights.length ===
                  0 &&
                enrichment.status !==
                  'researching' && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    No property highlights have been saved yet.
                  </div>
                )}

              {enrichment &&
                sortedHighlights.length >
                  0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-600">
                      {
                        sortedHighlights.filter(
                          (highlight) =>
                            highlight.is_visible
                        ).length
                      }{' '}
                      visible cards
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void approveEnrichment()
                      }
                      disabled={
                        approving ||
                        enrichment.status ===
                          'approved'
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {approving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}

                      {enrichment.status ===
                      'approved'
                        ? 'Website Content Approved'
                        : 'Approve Website Content'}
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
