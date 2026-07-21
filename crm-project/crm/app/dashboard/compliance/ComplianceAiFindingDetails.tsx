'use client';

type JsonRecord =
  Record<
    string,
    unknown
  >;

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
}: {
  finding: unknown;
}) {
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

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            'rounded-full border px-2.5 py-1 text-xs font-semibold ' +
            statusClasses(
              status
            )
          }
        >
          AI Analysis:
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
            Significance:
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
            Model:
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

      {impactAreas.length >
      0 ? (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Potential Impact Areas
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
            Evidence Notes
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
            Samantha Proposed Updates
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
                    <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2 text-sm leading-6 text-slate-700">
                      {update.proposedText}
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

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
        Human platform-admin review is required. Samantha cannot verify,
        approve, activate, replace or retire a compliance rule.
        Active rules remain unchanged.
      </div>
    </div>
  );
}