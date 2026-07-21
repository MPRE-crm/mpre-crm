'use client';

import {
  useState,
} from 'react';

import {
  CheckCircle2,
  ExternalLink,
  Scale,
  XCircle,
} from 'lucide-react';

type JsonRecord =
  Record<
    string,
    unknown
  >;

type ReviewDecision =
  | 'approve'
  | 'reject'
  | 'needs_legal_review';

type SuggestedUpdate = {
  action: string;
  requirementKey:
    string |
    null;
  title: string;
  rationale: string;
  proposedText:
    string |
    null;
};

function asRecord(
  value: unknown
):
  JsonRecord |
  null {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as
    JsonRecord;
}

function textValue(
  value: unknown
) {
  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  const result =
    value.trim();

  return result ||
    null;
}

function textArray(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .filter(
      (
        item
      ):
        item is string =>
        typeof item ===
        'string'
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(Boolean);
}

function suggestedUpdates(
  value: unknown
):
  SuggestedUpdate[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item
      ) =>
        asRecord(
          item
        )
    )
    .filter(
      (
        item
      ):
        item is JsonRecord =>
        Boolean(
          item
        )
    )
    .map(
      (
        item
      ) => ({
        action:
          textValue(
            item.action
          ) ||
          'review',

        requirementKey:
          textValue(
            item.requirement_key
          ),

        title:
          textValue(
            item.title
          ) ||
          'Human compliance review required',

        rationale:
          textValue(
            item.rationale
          ) ||
          'Samantha recommends human review.',

        proposedText:
          textValue(
            item.proposed_text
          ),
      })
    );
}

function formatLabel(
  value:
    string |
    null
) {
  if (!value) {
    return 'Not Available';
  }

  return value
    .replaceAll(
      '_',
      ' '
    )
    .replace(
      /\b\w/g,
      (
        letter
      ) =>
        letter.toUpperCase()
    );
}

function statusClasses(
  status:
    string |
    null
) {
  if (
    status ===
    'completed'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    status ===
      'failed'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function significanceClasses(
  value:
    string |
    null
) {
  if (
    value ===
    'likely'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (
    value ===
    'none'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function ComplianceAiFindingDetails({
  finding,
  onDecision,
  workingDecision,
}: {
  finding: unknown;

  onDecision?: (
    findingId: string,
    decision:
      ReviewDecision,
    resolutionNotes:
      string
  ) =>
    void |
    Promise<void>;

  workingDecision?:
    string |
    null;
}) {
  const [
    reviewNotes,
    setReviewNotes,
  ] =
    useState('');

  const row =
    asRecord(
      finding
    );

  if (!row) {
    return null;
  }

  const details =
    asRecord(
      row.change_details
    ) ||
    {};

  const findingId =
    textValue(
      row.id
    );

  const findingType =
    textValue(
      row.finding_type
    );

  const status =
    textValue(
      details.ai_analysis_status
    ) ||
    (
      details
        .requires_ai_analysis ===
      true
        ? 'pending'
        : null
    );

  const updates =
    suggestedUpdates(
      row.suggested_updates
    );

  if (
    findingType !==
      'content_change' &&
    !status &&
    updates.length ===
      0
  ) {
    return null;
  }

  const significance =
    textValue(
      details.ai_legal_significance
    );

  const model =
    textValue(
      details.ai_model
    );

  const effectiveDate =
    textValue(
      row.effective_date
    ) ||
    textValue(
      details.ai_effective_date
    );

  const error =
    textValue(
      details.ai_error
    );

  const impactAreas =
    textArray(
      details.ai_impact_areas
    );

  const evidenceNotes =
    textArray(
      details.ai_evidence_notes
    );

  const previousExcerpt =
    textValue(
      details.previous_excerpt
    );

  const currentExcerpt =
    textValue(
      details.current_excerpt
    );

  const officialSourceUrl =
    textValue(
      details.official_source_url
    ) ||
    textValue(
      details.final_url
    );

  const confidence =
    typeof row.confidence ===
      'number' &&
    Number.isFinite(
      row.confidence
    )
      ? Math.round(
          Math.min(
            1,
            Math.max(
              0,
              row.confidence
            )
          ) *
          100
        )
      : null;

  const canReview =
    findingType ===
      'content_change' &&
    Boolean(
      findingId &&
      onDecision
    );

  const isWorking =
    Boolean(
      workingDecision
    );

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            'rounded-full border px-2.5 py-1 text-xs font-semibold ' +
            statusClasses(
              status
            )
          }
        >
          Samantha Analysis:
          {' '}
          {formatLabel(
            status
          )}
        </span>

        {significance ? (
          <span
            className={
              'rounded-full border px-2.5 py-1 text-xs font-semibold ' +
              significanceClasses(
                significance
              )
            }
          >
            Legal Significance:
            {' '}
            {formatLabel(
              significance
            )}
          </span>
        ) : null}

        {confidence !==
        null ? (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Confidence:
            {' '}
            {confidence}%
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <strong>
            Analysis model:
          </strong>
          {' '}
          {model ||
            'Not recorded'}
        </div>

        <div>
          <strong>
            Effective date:
          </strong>
          {' '}
          {effectiveDate ||
            'Not identified'}
        </div>
      </div>

      {officialSourceUrl ? (
        <a
          href={
            officialSourceUrl
          }
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          Open Official Source
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}

      {previousExcerpt ||
      currentExcerpt ? (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            What Changed
          </div>

          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <details className="rounded-xl border border-red-200 bg-red-50">
              <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-red-800">
                Previous Official Text
              </summary>

              <div className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-red-200 bg-white p-3 text-xs leading-5 text-slate-700">
                {previousExcerpt ||
                  'Previous extracted text was not available.'}
              </div>
            </details>

            <details className="rounded-xl border border-emerald-200 bg-emerald-50">
              <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-emerald-800">
                Current Official Text
              </summary>

              <div className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-emerald-200 bg-white p-3 text-xs leading-5 text-slate-700">
                {currentExcerpt ||
                  'Current extracted text was not available.'}
              </div>
            </details>
          </div>
        </div>
      ) : null}

      {impactAreas.length >
      0 ? (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Marketing Channels Potentially Affected
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {impactAreas.map(
              (
                area
              ) => (
                <span
                  key={
                    area
                  }
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                >
                  {area}
                </span>
              )
            )}
          </div>
        </div>
      ) : null}

      {evidenceNotes.length >
      0 ? (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Samantha's Evidence Summary
          </div>

          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {evidenceNotes.map(
              (
                note,
                index
              ) => (
                <li
                  key={
                    index
                  }
                >
                  {note}
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}

      {updates.length >
      0 ? (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Samantha's Proposed Compliance Updates
          </div>

          <div className="mt-2 space-y-2">
            {updates.map(
              (
                update,
                index
              ) => (
                <div
                  key={
                    index
                  }
                  className="rounded-lg border border-blue-200 bg-blue-50 p-3"
                >
                  <div className="text-xs font-bold uppercase text-blue-700">
                    {formatLabel(
                      update.action
                    )}
                  </div>

                  <div className="mt-1 font-semibold text-slate-950">
                    {update.title}
                  </div>

                  {update.requirementKey ? (
                    <div className="mt-1 text-xs text-slate-500">
                      Requirement:
                      {' '}
                      {update.requirementKey}
                    </div>
                  ) : null}

                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {update.rationale}
                  </p>

                  {update.proposedText ? (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Proposed Wording
                      </div>

                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {update.proposedText}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {canReview &&
      findingId &&
      onDecision ? (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="font-bold text-slate-950">
            Review Samantha's Recommendation
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Add an optional note, then approve the recommendation, reject it,
            or require legal review. Your identity and review time will be
            recorded.
          </p>

          <label className="mt-3 block text-xs font-semibold text-slate-700">
            Review notes

            <textarea
              value={
                reviewNotes
              }
              onChange={(
                event
              ) =>
                setReviewNotes(
                  event.target.value
                )
              }
              rows={3}
              maxLength={4000}
              placeholder="Optional reason, source notes, or instructions for the next step"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                isWorking
              }
              onClick={() =>
                void onDecision(
                  findingId,
                  'approve',
                  reviewNotes.trim()
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {workingDecision?.endsWith(
                ':approve'
              )
                ? 'Approving...'
                : 'Approve Recommendation'}
            </button>

            <button
              type="button"
              disabled={
                isWorking
              }
              onClick={() =>
                void onDecision(
                  findingId,
                  'needs_legal_review',
                  reviewNotes.trim()
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              <Scale className="h-4 w-4" />
              {workingDecision?.endsWith(
                ':needs_legal_review'
              )
                ? 'Saving...'
                : 'Needs Legal Review'}
            </button>

            <button
              type="button"
              disabled={
                isWorking
              }
              onClick={() =>
                void onDecision(
                  findingId,
                  'reject',
                  reviewNotes.trim()
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              {workingDecision?.endsWith(
                ':reject'
              )
                ? 'Rejecting...'
                : 'Reject / No Change Needed'}
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            Approval records your authorization for the controlled rule-drafting
            step. This button does not silently rewrite a live rule or active
            marketing campaign.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          Samantha provides compliance research assistance. Active rules remain
          unchanged unless the controlled approval and rule-application
          workflow completes.
        </div>
      )}
    </div>
  );
}
