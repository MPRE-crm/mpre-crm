import {
  supabaseAdmin,
} from "../supabaseAdmin";

export const
  REVERSE_PROSPECTING_SOURCE_TYPES = [
    "manual_upload",
    "manual_entry",
    "reso_web_api",
    "api",
    "rets",
    "vendor_feed",
    "other",
  ] as const;

export type ReverseProspectingSourceType =
  (typeof REVERSE_PROSPECTING_SOURCE_TYPES)[number];

const AUTOMATED_SOURCE_TYPES =
  new Set<ReverseProspectingSourceType>([
    "reso_web_api",
    "api",
    "rets",
    "vendor_feed",
  ]);

const SAFE_PROVIDER_METADATA_KEYS =
  new Set([
    "provider",
    "provider_name",
    "provider_record_id",
    "provider_batch_id",
    "source_created_at",
    "source_updated_at",
    "market",
    "market_id",
    "criteria_version",
    "match_type",
    "feed_name",
    "agent_mls_id",
    "office_mls_id",
    "metadata_version",
    "status",
  ]);

const MAX_IMPORT_ROWS =
  5000;

const CONTACT_QUERY_CHUNK =
  500;

const UPSERT_CHUNK =
  250;

type ListingScope = {
  id: string;
  org_id: string;
  owner_user_id: string;
};

type NormalizedMatch = {
  agent_email: string;
  agent_email_normalized: string;

  agent_first_name: string | null;
  agent_last_name: string | null;
  agent_display_name: string;
  agent_company: string | null;

  external_agent_id: string | null;
  external_office_id: string | null;
  external_match_id: string | null;

  buyer_match_count: number;
  match_reasons: string[];
  criteria_summary: string | null;
  match_score: number | null;

  source_payload: Record<
    string,
    string | number | boolean | null | Array<
      string | number | boolean | null
    >
  >;
};

export type ReverseProspectingImportResult = {
  batch_id: string;

  imported_rows: number;
  matched_rows: number;
  skipped_rows: number;

  invalid_rows: number;
  duplicate_rows: number;
  upserted_rows: number;

  directory_sync: {
    contacts_updated: number;
    reviews_created: number;
    reviews_resolved: number;
    ready_contacts: number;
    contacts_needing_review: number;
  };

  status:
    | "completed"
    | "partially_completed";
};

export class ReverseProspectingImportError
  extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);
    this.name =
      "ReverseProspectingImportError";
    this.status =
      status;
  }
}

function chunkValues<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

function objectValue(
  value: unknown
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

function limitedString(
  value: unknown,
  maximumLength: number
) {
  const normalized =
    String(
      value ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maximumLength
  );
}

function normalizedEmail(
  value: unknown
) {
  const email =
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase();

  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return null;
  }

  return email;
}

function positiveInteger(
  value: unknown
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return 1;
  }

  return Math.min(
    1000000,
    Math.max(
      1,
      Math.round(parsed)
    )
  );
}

function normalizedScore(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        parsed * 100
      ) / 100
    )
  );
}

function normalizedReasons(
  value: unknown
) {
  const source =
    Array.isArray(value)
      ? value
      : typeof value ===
          "string"
        ? value.split(
            /[|;,]+/
          )
        : [];

  const unique =
    new Set<string>();

  for (const item of source) {
    const reason =
      limitedString(
        item,
        200
      );

    if (reason) {
      unique.add(reason);
    }

    if (unique.size >= 20) {
      break;
    }
  }

  return Array.from(unique);
}

function safeProviderMetadata(
  value: unknown
) {
  const object =
    objectValue(value);

  const safe: Record<
    string,
    string | number | boolean | null | Array<
      string | number | boolean | null
    >
  > = {};

  if (!object) {
    return safe;
  }

  for (
    const [
      rawKey,
      rawValue,
    ] of Object.entries(object)
  ) {
    const key =
      rawKey
        .trim()
        .toLowerCase();

    if (
      !SAFE_PROVIDER_METADATA_KEYS
        .has(key)
    ) {
      continue;
    }

    if (
      rawValue === null ||
      typeof rawValue ===
        "boolean" ||
      typeof rawValue ===
        "number"
    ) {
      safe[key] =
        rawValue;
      continue;
    }

    if (
      typeof rawValue ===
        "string"
    ) {
      safe[key] =
        rawValue
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500);

      continue;
    }

    if (
      Array.isArray(rawValue)
    ) {
      safe[key] =
        rawValue
          .filter(
            (
              item
            ): item is
              | string
              | number
              | boolean
              | null =>
              item === null ||
              typeof item ===
                "string" ||
              typeof item ===
                "number" ||
              typeof item ===
                "boolean"
          )
          .slice(0, 25)
          .map((item) =>
            typeof item ===
              "string"
              ? item
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    300
                  )
              : item
          );
    }
  }

  return safe;
}

function combineCriteria(
  first: string | null,
  second: string | null
) {
  const values =
    Array.from(
      new Set(
        [
          first,
          second,
        ].filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
      )
    );

  if (values.length === 0) {
    return null;
  }

  return values
    .join(" | ")
    .slice(0, 2000);
}

function normalizeMatch(
  value: unknown
): NormalizedMatch | null {
  const row =
    objectValue(value);

  if (!row) {
    return null;
  }

  const email =
    normalizedEmail(
      row.agent_email ??
        row.email
    );

  if (!email) {
    return null;
  }

  const firstName =
    limitedString(
      row.agent_first_name ??
        row.first_name,
      150
    );

  const lastName =
    limitedString(
      row.agent_last_name ??
        row.last_name,
      150
    );

  const displayName =
    limitedString(
      row.agent_display_name ??
        row.display_name,
      300
    ) ||
    [
      firstName,
      lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    email;

  return {
    agent_email:
      email,

    agent_email_normalized:
      email,

    agent_first_name:
      firstName,

    agent_last_name:
      lastName,

    agent_display_name:
      displayName,

    agent_company:
      limitedString(
        row.agent_company ??
          row.company,
        300
      ),

    external_agent_id:
      limitedString(
        row.external_agent_id,
        300
      ),

    external_office_id:
      limitedString(
        row.external_office_id,
        300
      ),

    external_match_id:
      limitedString(
        row.external_match_id,
        300
      ),

    buyer_match_count:
      positiveInteger(
        row.buyer_match_count ??
          row.match_count
      ),

    match_reasons:
      normalizedReasons(
        row.match_reasons ??
          row.reasons
      ),

    criteria_summary:
      limitedString(
        row.criteria_summary,
        2000
      ),

    match_score:
      normalizedScore(
        row.match_score
      ),

    source_payload:
      safeProviderMetadata(
        row.provider_metadata ??
          row.source_payload
      ),
  };
}

function mergeMatch(
  current: NormalizedMatch,
  incoming: NormalizedMatch
): NormalizedMatch {
  return {
    agent_email:
      incoming.agent_email,

    agent_email_normalized:
      incoming
        .agent_email_normalized,

    agent_first_name:
      incoming
        .agent_first_name ||
      current
        .agent_first_name,

    agent_last_name:
      incoming
        .agent_last_name ||
      current
        .agent_last_name,

    agent_display_name:
      incoming
        .agent_display_name ||
      current
        .agent_display_name,

    agent_company:
      incoming
        .agent_company ||
      current
        .agent_company,

    external_agent_id:
      incoming
        .external_agent_id ||
      current
        .external_agent_id,

    external_office_id:
      incoming
        .external_office_id ||
      current
        .external_office_id,

    external_match_id:
      incoming
        .external_match_id ||
      current
        .external_match_id,

    buyer_match_count:
      Math.min(
        1000000,
        current
          .buyer_match_count +
        incoming
          .buyer_match_count
      ),

    match_reasons:
      Array.from(
        new Set([
          ...current
            .match_reasons,
          ...incoming
            .match_reasons,
        ])
      ).slice(0, 20),

    criteria_summary:
      combineCriteria(
        current
          .criteria_summary,
        incoming
          .criteria_summary
      ),

    match_score:
      Math.max(
        current.match_score ??
          0,
        incoming.match_score ??
          0
      ) || null,

    source_payload: {
      ...current
        .source_payload,

      ...incoming
        .source_payload,
    },
  };
}

export function
normalizeReverseProspectingSourceType(
  value: unknown
): ReverseProspectingSourceType | null {
  const normalized =
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase();

  const isAllowed =
    REVERSE_PROSPECTING_SOURCE_TYPES.some(
      (sourceType) =>
        sourceType === normalized
    );

  return isAllowed
    ? normalized as ReverseProspectingSourceType
    : null;
}

export function
isAutomatedReverseProspectingSource(
  value: ReverseProspectingSourceType
) {
  return AUTOMATED_SOURCE_TYPES
    .has(value);
}

export async function
importReverseProspectingMatches({
  listing,
  requesterId,
  sourceType,
  rows,
  sourceFileName,
  externalBatchId,
  mlsComplianceProfileId,
}: {
  listing: ListingScope;
  requesterId: string;

  sourceType:
    ReverseProspectingSourceType;

  rows: unknown[];

  sourceFileName?: string | null;
  externalBatchId?: string | null;
  mlsComplianceProfileId?: string | null;
}): Promise<
  ReverseProspectingImportResult
> {
  if (
    rows.length === 0
  ) {
    throw new ReverseProspectingImportError(
      "At least one Realtor-match row is required."
    );
  }

  if (
    rows.length >
    MAX_IMPORT_ROWS
  ) {
    throw new ReverseProspectingImportError(
      `A single import cannot exceed ${MAX_IMPORT_ROWS} rows.`
    );
  }

  const matches =
    new Map<
      string,
      NormalizedMatch
    >();

  let invalidRows = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    const normalized =
      normalizeMatch(row);

    if (!normalized) {
      invalidRows += 1;
      continue;
    }

    const existing =
      matches.get(
        normalized
          .agent_email_normalized
      );

    if (existing) {
      duplicateRows += 1;

      matches.set(
        normalized
          .agent_email_normalized,
        mergeMatch(
          existing,
          normalized
        )
      );

      continue;
    }

    matches.set(
      normalized
        .agent_email_normalized,
      normalized
    );
  }

  const normalizedMatches =
    Array.from(
      matches.values()
    );

  if (
    normalizedMatches.length === 0
  ) {
    throw new ReverseProspectingImportError(
      "No valid Realtor email rows were found."
    );
  }

  const contactIdsByEmail =
    new Map<string, string>();

  const contactIdsByMls =
    new Map<string, string>();

  function rememberContact(
    contact: {
      id: string;

      email_normalized:
        | string
        | null;

      mls_agent_id:
        | string
        | null;
    }
  ) {
    const email =
      String(
        contact
          .email_normalized ||
        ""
      )
        .trim()
        .toLowerCase();

    if (email) {
      contactIdsByEmail.set(
        email,
        contact.id
      );
    }

    const mlsAgentId =
      String(
        contact
          .mls_agent_id ||
        ""
      ).trim();

    if (mlsAgentId) {
      contactIdsByMls.set(
        mlsAgentId,
        contact.id
      );
    }
  }

  for (
    const emailChunk of
      chunkValues(
        normalizedMatches.map(
          (match) =>
            match
              .agent_email_normalized
        ),
        CONTACT_QUERY_CHUNK
      )
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("contacts")
        .select(
          "id, email_normalized, mls_agent_id"
        )
        .eq(
          "org_id",
          listing.org_id
        )
        .in(
          "email_normalized",
          emailChunk
        );

    if (error) {
      throw new Error(
        `Could not match imported Realtors to CRM contacts by email: ${error.message}`
      );
    }

    for (
      const contact of
        data || []
    ) {
      rememberContact(contact);
    }
  }

  const importedMlsAgentIds =
    Array.from(
      new Set(
        normalizedMatches
          .map(
            (match) =>
              match
                .external_agent_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      )
    );

  for (
    const mlsIdChunk of
      chunkValues(
        importedMlsAgentIds,
        CONTACT_QUERY_CHUNK
      )
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("contacts")
        .select(
          "id, email_normalized, mls_agent_id"
        )
        .eq(
          "org_id",
          listing.org_id
        )
        .in(
          "mls_agent_id",
          mlsIdChunk
        );

    if (error) {
      throw new Error(
        `Could not match imported Realtors to CRM contacts by MLS ID: ${error.message}`
      );
    }

    for (
      const contact of
        data || []
    ) {
      rememberContact(contact);
    }
  }

  function contactIdForMatch(
    match: NormalizedMatch
  ) {
    const emailContactId =
      contactIdsByEmail.get(
        match
          .agent_email_normalized
      ) ||
      null;

    const mlsContactId =
      match
        .external_agent_id
        ? contactIdsByMls.get(
            match
              .external_agent_id
          ) ||
          null
        : null;

    if (
      emailContactId &&
      mlsContactId &&
      emailContactId !==
        mlsContactId
    ) {
      return null;
    }

    return (
      emailContactId ||
      mlsContactId ||
      null
    );
  }

  const now =
    new Date().toISOString();

  const {
    data: batch,
    error: batchError,
  } =
    await supabaseAdmin
      .from(
        "mls_reverse_prospecting_batches"
      )
      .insert({
        org_id:
          listing.org_id,

        owner_user_id:
          listing
            .owner_user_id,

        listing_id:
          listing.id,

        mls_compliance_profile_id:
          mlsComplianceProfileId ||
          null,

        source_type:
          sourceType,

        status:
          "processing",

        external_batch_id:
          limitedString(
            externalBatchId,
            300
          ),

        source_file_name:
          limitedString(
            sourceFileName,
            500
          ),

        imported_rows:
          rows.length,

        matched_rows:
          0,

        skipped_rows:
          invalidRows +
          duplicateRows,

        started_at:
          now,

        metadata: {
          adapter_version:
            "reverse-prospecting-v1",

          input_format:
            "normalized_json",

          buyer_pii_allowed:
            false,
        },

        created_by:
          requesterId,
      })
      .select("id")
      .single();

  if (
    batchError ||
    !batch
  ) {
    throw new Error(
      batchError?.message ||
        "Could not create the reverse-prospecting import batch."
    );
  }

  let upsertedRows = 0;

  try {
    const databaseRows =
      normalizedMatches.map(
        (match) => ({
          org_id:
            listing.org_id,

          owner_user_id:
            listing
              .owner_user_id,

          listing_id:
            listing.id,

          batch_id:
            batch.id,

          mls_compliance_profile_id:
            mlsComplianceProfileId ||
            null,

          contact_id:
            contactIdForMatch(
              match
            ),

          external_agent_id:
            match
              .external_agent_id,

          external_office_id:
            match
              .external_office_id,

          external_match_id:
            match
              .external_match_id,

          agent_email:
            match.agent_email,

          agent_email_normalized:
            match
              .agent_email_normalized,

          agent_first_name:
            match
              .agent_first_name,

          agent_last_name:
            match
              .agent_last_name,

          agent_display_name:
            match
              .agent_display_name,

          agent_company:
            match
              .agent_company,

          match_source:
            sourceType,

          buyer_match_count:
            match
              .buyer_match_count,

          match_reasons:
            match
              .match_reasons,

          criteria_summary:
            match
              .criteria_summary,

          match_score:
            match.match_score,

          is_active:
            true,

          last_matched_at:
            now,

          source_payload: {
            adapter_version:
              "reverse-prospecting-v1",

            ...match
              .source_payload,
          },
        })
      );

    for (
      const upsertChunk of
        chunkValues(
          databaseRows,
          UPSERT_CHUNK
        )
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "listing_realtor_matches"
          )
          .upsert(
            upsertChunk,
            {
              onConflict:
                "listing_id,agent_email_normalized,match_source",
            }
          )
          .select("id");

      if (error) {
        throw new Error(
          `Could not save Realtor matches: ${error.message}`
        );
      }

      upsertedRows +=
        data?.length ||
        upsertChunk.length;
    }

    const {
      data:
        directorySyncData,

      error:
        directorySyncError,
    } =
      await supabaseAdmin
        .rpc(
          "sync_reverse_prospecting_contact_directory",
          {
            p_batch_id:
              batch.id,

            p_requester_id:
              requesterId,
          }
        );

    if (directorySyncError) {
      throw new Error(
        `Realtor matches were saved, but the contact directory could not be synchronized: ${directorySyncError.message}`
      );
    }

    const directorySyncObject =
      objectValue(
        directorySyncData
      ) ||
      {};

    function directorySyncCount(
      key: string
    ) {
      const value =
        Number(
          directorySyncObject[
            key
          ] ||
          0
        );

      return Number.isFinite(
        value
      )
        ? Math.max(
            0,
            Math.round(
              value
            )
          )
        : 0;
    }

    const directorySync = {
      contacts_updated:
        directorySyncCount(
          "contacts_updated"
        ),

      reviews_created:
        directorySyncCount(
          "reviews_created"
        ),

      reviews_resolved:
        directorySyncCount(
          "reviews_resolved"
        ),

      ready_contacts:
        directorySyncCount(
          "ready_contacts"
        ),

      contacts_needing_review:
        directorySyncCount(
          "contacts_needing_review"
        ),
    };

    const status =
      invalidRows > 0 ||
      duplicateRows > 0
        ? "partially_completed"
        : "completed";

    const {
      error: completionError,
    } =
      await supabaseAdmin
        .from(
          "mls_reverse_prospecting_batches"
        )
        .update({
          status,

          matched_rows:
            normalizedMatches
              .length,

          skipped_rows:
            invalidRows +
            duplicateRows,

          completed_at:
            new Date()
              .toISOString(),

          last_error:
            null,

          metadata: {
            adapter_version:
              "reverse-prospecting-v1",

            input_format:
              "normalized_json",

            buyer_pii_allowed:
              false,

            invalid_rows:
              invalidRows,

            duplicate_rows:
              duplicateRows,

            upserted_rows:
              upsertedRows,

            directory_sync:
              directorySync,
          },
        })
        .eq(
          "id",
          batch.id
        );

    if (completionError) {
      throw new Error(
        `The import completed, but its batch summary could not be updated: ${completionError.message}`
      );
    }

    return {
      batch_id:
        batch.id,

      imported_rows:
        rows.length,

      matched_rows:
        normalizedMatches
          .length,

      skipped_rows:
        invalidRows +
        duplicateRows,

      invalid_rows:
        invalidRows,

      duplicate_rows:
        duplicateRows,

      upserted_rows:
        upsertedRows,

      directory_sync:
        directorySync,

      status,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Reverse-prospecting import failed.";

    await supabaseAdmin
      .from(
        "mls_reverse_prospecting_batches"
      )
      .update({
        status:
          "failed",

        last_error:
          message.slice(
            0,
            2000
          ),

        completed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        batch.id
      );

    throw error;
  }
}