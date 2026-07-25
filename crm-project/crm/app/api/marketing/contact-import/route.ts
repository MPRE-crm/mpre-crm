import {
  NextResponse,
} from "next/server";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

import {
  supabaseAdmin,
} from "../../../../lib/supabaseAdmin";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

const MAX_ROWS = 5000;
const QUERY_CHUNK = 500;
const UPDATE_CHUNK = 25;
const REVIEW_SOURCE =
  "contact_import";

const DIRECTORY_FIELDS = [
  "company",
  "phone",
  "mls_agent_id",
  "mls_office_id",
  "license_number",
] as const;

type DirectoryField =
  (typeof DIRECTORY_FIELDS)[number];

type IncomingRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  company: string | null;
  job_title: string | null;
  email: string;
  phone: string | null;
  mls_agent_id: string | null;
  mls_office_id: string | null;
  license_number: string | null;
  contact_type: string;
  lifecycle_stage: string;
  tags: string[];
  source: string;
};

type ContactRow = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  email: string | null;
  email_normalized: string | null;
  company: string | null;
  phone: string | null;
  mls_agent_id: string | null;
  mls_office_id: string | null;
  license_number: string | null;
  contact_review_status: string | null;
};

type ContactState = {
  contact: ContactRow;
  company: string | null;
  phone: string | null;
};

type ContactPatch = {
  id: string;
  patch: Record<string, unknown>;
  filledFields: DirectoryField[];
  expectedValues: Partial<
    Record<
      DirectoryField,
      string | null
    >
  >;
};

type ReviewInsert = {
  org_id: string;
  owner_user_id: string | null;
  contact_id: string;
  issue_type: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  source: string;
  confidence: number;
  details: Record<string, unknown>;
  created_by: string;
};

class ContactImportError
  extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);
    this.name =
      "ContactImportError";
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

function cleanText(
  value: unknown,
  maximumLength = 250
) {
  const normalized =
    String(
      value ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();

  return normalized
    ? normalized.slice(
        0,
        maximumLength
      )
    : null;
}

function cleanEmail(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function looksLikeEmail(
  value: string
) {
  return (
    value.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    )
  );
}

function normalizeCompany(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(
  value: unknown
) {
  return String(
    value ?? ""
  ).replace(/\D/g, "");
}

function normalizeComparable(
  field: DirectoryField,
  value: unknown
) {
  if (field === "company") {
    return normalizeCompany(
      value
    );
  }

  if (field === "phone") {
    return normalizePhone(
      value
    );
  }

  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function valuesAgree(
  field: DirectoryField,
  currentValue: unknown,
  incomingValue: unknown
) {
  return (
    normalizeComparable(
      field,
      currentValue
    ) ===
    normalizeComparable(
      field,
      incomingValue
    )
  );
}

function issueTypeForField(
  field: DirectoryField
) {
  if (field === "company") {
    return "brokerage_conflict";
  }

  if (field === "mls_agent_id") {
    return "mls_id_conflict";
  }

  return "other";
}

function cleanTags(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [
      "Listing advertisements",
    ];
  }

  const tags =
    Array.from(
      new Set(
        value
          .map((item) =>
            cleanText(
              item,
              100
            )
          )
          .filter(
            (item): item is string =>
              Boolean(item)
          )
      )
    ).slice(0, 25);

  return tags.length > 0
    ? tags
    : [
        "Listing advertisements",
      ];
}

function normalizeIncomingRow(
  value: unknown,
  defaultSource: string
): IncomingRow | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const email =
    cleanEmail(
      row.email
    );

  if (!looksLikeEmail(email)) {
    return null;
  }

  const firstName =
    cleanText(
      row.first_name,
      150
    );

  const lastName =
    cleanText(
      row.last_name,
      150
    );

  const displayName =
    cleanText(
      row.display_name,
      250
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
    first_name:
      firstName,
    last_name:
      lastName,
    display_name:
      displayName,
    company:
      cleanText(
        row.company,
        250
      ),
    job_title:
      cleanText(
        row.job_title,
        150
      ),
    email,
    phone:
      cleanText(
        row.phone,
        100
      ),
    mls_agent_id:
      cleanText(
        row.mls_agent_id,
        150
      ),
    mls_office_id:
      cleanText(
        row.mls_office_id,
        150
      ),
    license_number:
      cleanText(
        row.license_number,
        150
      ),
    contact_type:
      cleanText(
        row.contact_type,
        50
      ) ||
      "realtor",
    lifecycle_stage:
      cleanText(
        row.lifecycle_stage,
        50
      ) ||
      "prospect",
    tags:
      cleanTags(
        row.tags
      ),
    source:
      cleanText(
        row.source,
        300
      ) ||
      defaultSource,
  };
}

function canManageContact(
  profile: {
    id: string;
    org_id: string | null;
    role: string;
  },
  contact: ContactRow
) {
  if (
    profile.role ===
      "platform_admin" ||
    profile.role ===
      "admin" ||
    profile.role ===
      "org_admin"
  ) {
    return (
      profile.role ===
        "platform_admin" ||
      contact.org_id ===
        profile.org_id
    );
  }

  return (
    profile.role ===
      "agent" &&
    contact.org_id ===
      profile.org_id &&
    contact.owner_user_id ===
      profile.id
  );
}

function reviewForConflict(
  profileId: string,
  orgId: string,
  contact: ContactRow,
  field: string,
  issueType: string,
  currentValue: unknown,
  proposedValue: unknown,
  details: Record<string, unknown>
): ReviewInsert {
  return {
    org_id:
      orgId,
    owner_user_id:
      contact.owner_user_id ||
      profileId,
    contact_id:
      contact.id,
    issue_type:
      issueType,
    field_name:
      field,
    current_value:
      cleanText(
        currentValue,
        500
      ),
    proposed_value:
      cleanText(
        proposedValue,
        500
      ),
    source:
      REVIEW_SOURCE,
    confidence:
      100,
    details,
    created_by:
      profileId,
  };
}

function missingFieldReview(
  profileId: string,
  orgId: string,
  contact: ContactRow,
  issueType: "missing_brokerage" | "missing_phone"
): ReviewInsert {
  const fieldName =
    issueType ===
      "missing_brokerage"
      ? "company"
      : "phone";

  return {
    org_id:
      orgId,
    owner_user_id:
      contact.owner_user_id ||
      profileId,
    contact_id:
      contact.id,
    issue_type:
      issueType,
    field_name:
      fieldName,
    current_value:
      null,
    proposed_value:
      null,
    source:
      REVIEW_SOURCE,
    confidence:
      100,
    details: {
      reason:
        issueType ===
          "missing_brokerage"
          ? "The imported Realtor contact still has no verified brokerage."
          : "The imported Realtor contact still has no cell or home phone stored.",
    },
    created_by:
      profileId,
  };
}

export async function POST(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    if (!profile.org_id) {
      throw new ContactImportError(
        "Your profile is not assigned to an organization.",
        403
      );
    }

    if (
      ![
        "platform_admin",
        "admin",
        "org_admin",
        "agent",
      ].includes(
        profile.role
      )
    ) {
      throw new ContactImportError(
        "You cannot import marketing contacts.",
        403
      );
    }

    const body =
      await request.json();

    const rawRows =
      Array.isArray(
        body?.rows
      )
        ? body.rows
        : null;

    if (!rawRows) {
      throw new ContactImportError(
        "rows must be an array."
      );
    }

    if (
      rawRows.length === 0 ||
      rawRows.length > MAX_ROWS
    ) {
      throw new ContactImportError(
        `Import between 1 and ${MAX_ROWS} rows at a time.`
      );
    }

    const fileName =
      cleanText(
        body?.file_name,
        250
      );

    const defaultSource =
      fileName
        ? `Contact import: ${fileName}`
        : "Contact import: pasted data";

    const uniqueRows =
      new Map<
        string,
        IncomingRow
      >();

    let invalidRows = 0;

    for (const rawRow of rawRows) {
      const normalized =
        normalizeIncomingRow(
          rawRow,
          defaultSource
        );

      if (!normalized) {
        invalidRows += 1;
        continue;
      }

      uniqueRows.set(
        normalized.email,
        normalized
      );
    }

    const rows =
      Array.from(
        uniqueRows.values()
      );

    if (rows.length === 0) {
      throw new ContactImportError(
        "No valid email contacts were found."
      );
    }

    const importedRowsByMlsId =
      new Map<
        string,
        IncomingRow[]
      >();

    for (const row of rows) {
      const normalizedMlsId =
        String(
          row.mls_agent_id ||
          ""
        )
          .trim()
          .toLowerCase();

      if (!normalizedMlsId) {
        continue;
      }

      const matchingRows =
        importedRowsByMlsId.get(
          normalizedMlsId
        ) || [];

      matchingRows.push(
        row
      );

      importedRowsByMlsId.set(
        normalizedMlsId,
        matchingRows
      );
    }

    const duplicateImportedMls =
      Array.from(
        importedRowsByMlsId.entries()
      ).find(
        ([
          ,
          matchingRows,
        ]) =>
          matchingRows.length > 1
      );

    if (duplicateImportedMls) {
      const [
        ,
        matchingRows,
      ] =
        duplicateImportedMls;

      throw new ContactImportError(
        `MLS user ID "${matchingRows[0].mls_agent_id}" appears with multiple imported emails. Correct the duplicate before importing.`,
        409
      );
    }

    const contactSelect = `
      id,
      org_id,
      owner_user_id,
      email,
      email_normalized,
      company,
      phone,
      mls_agent_id,
      mls_office_id,
      license_number,
      contact_review_status
    `;

    const contactsByEmail =
      new Map<
        string,
        ContactRow
      >();

    const contactsByMls =
      new Map<
        string,
        ContactRow[]
      >();

    for (
      const emailChunk of
      chunkValues(
        rows.map(
          (row) =>
            row.email
        ),
        QUERY_CHUNK
      )
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from("contacts")
          .select(
            contactSelect
          )
          .eq(
            "org_id",
            profile.org_id
          )
          .in(
            "email_normalized",
            emailChunk
          );

      if (error) {
        throw new ContactImportError(
          `Could not match existing contacts by email: ${error.message}`,
          500
        );
      }

      for (
        const rawContact of
        data || []
      ) {
        const contact =
          rawContact as ContactRow;

        const email =
          cleanEmail(
            contact.email_normalized ||
            contact.email
          );

        if (email) {
          contactsByEmail.set(
            email,
            contact
          );
        }
      }
    }

    const importedMlsIds =
      Array.from(
        new Set(
          rows
            .map((row) =>
              row.mls_agent_id
            )
            .filter(
              (value): value is string =>
                Boolean(value)
            )
        )
      );

    for (
      const mlsChunk of
      chunkValues(
        importedMlsIds,
        QUERY_CHUNK
      )
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from("contacts")
          .select(
            contactSelect
          )
          .eq(
            "org_id",
            profile.org_id
          )
          .in(
            "mls_agent_id",
            mlsChunk
          );

      if (error) {
        throw new ContactImportError(
          `Could not match existing contacts by MLS ID: ${error.message}`,
          500
        );
      }

      for (
        const rawContact of
        data || []
      ) {
        const contact =
          rawContact as ContactRow;

        const mlsAgentId =
          cleanText(
            contact.mls_agent_id,
            150
          );

        if (!mlsAgentId) {
          continue;
        }

        const current =
          contactsByMls.get(
            mlsAgentId
          ) || [];

        current.push(
          contact
        );

        contactsByMls.set(
          mlsAgentId,
          current
        );
      }
    }

    const newRows: Record<
      string,
      unknown
    >[] = [];

    const patches: ContactPatch[] = [];
    const reviews: ReviewInsert[] = [];

    const contactStates =
      new Map<
        string,
        ContactState
      >();

    const companyFilledIds =
      new Set<string>();

    const phoneFilledIds =
      new Set<string>();

    let enrichedContacts = 0;
    let unchangedExisting = 0;
    let conflictCount = 0;
    let accessSkipped = 0;

    const now =
      new Date().toISOString();

    for (const row of rows) {
      const emailContact =
        contactsByEmail.get(
          row.email
        ) ||
        null;

      const mlsCandidates =
        row.mls_agent_id
          ? contactsByMls.get(
              row.mls_agent_id
            ) || []
          : [];

      const mlsContact =
        mlsCandidates.length === 1
          ? mlsCandidates[0]
          : null;

      if (
        emailContact &&
        mlsContact &&
        emailContact.id !==
          mlsContact.id
      ) {
        if (
          canManageContact(
            profile,
            emailContact
          )
        ) {
          reviews.push(
            reviewForConflict(
              profile.id,
              profile.org_id,
              emailContact,
              "contact_id",
              "email_conflict",
              emailContact.id,
              mlsContact.id,
              {
                reason:
                  "The imported email and MLS user ID identify different CRM contacts.",
                imported_email:
                  row.email,
                imported_mls_agent_id:
                  row.mls_agent_id,
                email_contact_id:
                  emailContact.id,
                mls_contact_id:
                  mlsContact.id,
                source:
                  row.source,
              }
            )
          );
        }

        conflictCount += 1;
        continue;
      }

      if (
        !emailContact &&
        mlsCandidates.length > 1
      ) {
        throw new ContactImportError(
          `MLS user ID "${row.mls_agent_id}" is already attached to multiple CRM contacts. Resolve that duplicate before importing ${row.email}.`,
          409
        );
      }

      const contact =
        emailContact ||
        mlsContact;

      if (!contact) {
        newRows.push({
          org_id:
            profile.org_id,
          owner_user_id:
            profile.id,
          created_by:
            profile.id,
          first_name:
            row.first_name,
          last_name:
            row.last_name,
          display_name:
            row.display_name,
          company:
            row.company,
          job_title:
            row.job_title,
          email:
            row.email,
          phone:
            row.phone,
          mls_agent_id:
            row.mls_agent_id,
          mls_office_id:
            row.mls_office_id,
          license_number:
            row.license_number,
          contact_type:
            row.contact_type,
          lifecycle_stage:
            row.lifecycle_stage,
          tags:
            row.tags,
          email_marketing_status:
            "active",
          sms_marketing_status:
            "not_consented",
          do_not_contact:
            false,
          source:
            row.source,
        });

        continue;
      }

      if (
        !canManageContact(
          profile,
          contact
        )
      ) {
        accessSkipped += 1;
        continue;
      }

      const patch: Record<
        string,
        unknown
      > = {};

      const expectedValues: Partial<
        Record<
          DirectoryField,
          string | null
        >
      > = {};

      const filledFields: DirectoryField[] = [];
      const conflictStart =
        conflictCount;

      if (
        !emailContact &&
        mlsContact &&
        cleanEmail(
          mlsContact.email_normalized ||
          mlsContact.email
        ) !== row.email
      ) {
        reviews.push(
          reviewForConflict(
            profile.id,
            profile.org_id,
            contact,
            "email",
            "email_conflict",
            contact.email,
            row.email,
            {
              reason:
                "The imported MLS user ID matched this contact, but the imported email differs from the stored email.",
              imported_email:
                row.email,
              imported_mls_agent_id:
                row.mls_agent_id,
              source:
                row.source,
            }
          )
        );

        conflictCount += 1;
      }

      for (const field of DIRECTORY_FIELDS) {
        const incomingValue =
          row[field];

        if (!incomingValue) {
          continue;
        }

        const currentValue =
          contact[field];

        if (
          field ===
            "mls_agent_id" &&
          mlsCandidates.some(
            (candidate) =>
              candidate.id !==
              contact.id
          )
        ) {
          reviews.push(
            reviewForConflict(
              profile.id,
              profile.org_id,
              contact,
              field,
              "mls_id_conflict",
              currentValue,
              incomingValue,
              {
                reason:
                  "The imported MLS user ID is already associated with another CRM contact.",
                source:
                  row.source,
              }
            )
          );

          conflictCount += 1;
          continue;
        }

        if (!cleanText(currentValue)) {
          patch[field] =
            incomingValue;

          expectedValues[field] =
            currentValue;

          filledFields.push(
            field
          );

          continue;
        }

        if (
          !valuesAgree(
            field,
            currentValue,
            incomingValue
          )
        ) {
          reviews.push(
            reviewForConflict(
              profile.id,
              profile.org_id,
              contact,
              field,
              issueTypeForField(
                field
              ),
              currentValue,
              incomingValue,
              {
                reason:
                  "The imported directory value differs from the existing CRM contact value.",
                field,
                source:
                  row.source,
              }
            )
          );

          conflictCount += 1;
        }
      }

      const finalCompany =
        (patch.company as string | undefined) ||
        contact.company;

      const finalPhone =
        (patch.phone as string | undefined) ||
        contact.phone;

      contactStates.set(
        contact.id,
        {
          contact,
          company:
            finalCompany,
          phone:
            finalPhone,
        }
      );

      if (
        filledFields.length > 0
      ) {
        patch.last_enriched_at =
          now;

        patch.last_enrichment_source =
          REVIEW_SOURCE;

        patches.push({
          id:
            contact.id,
          patch,
          filledFields,
          expectedValues,
        });

        if (
          filledFields.includes(
            "company"
          )
        ) {
          companyFilledIds.add(
            contact.id
          );
        }

        if (
          filledFields.includes(
            "phone"
          )
        ) {
          phoneFilledIds.add(
            contact.id
          );
        }

        enrichedContacts += 1;
      }
      else if (
        conflictCount ===
        conflictStart
      ) {
        unchangedExisting += 1;
      }
    }

    for (
      const patchChunk of
      chunkValues(
        patches,
        UPDATE_CHUNK
      )
    ) {
      await Promise.all(
        patchChunk.map(
          async (
            item
          ) => {
            let updateQuery =
              supabaseAdmin
                .from("contacts")
                .update(
                  item.patch
                )
                .eq(
                  "id",
                  item.id
                )
                .eq(
                  "org_id",
                  profile.org_id
                );

            for (
              const field of
              item.filledFields
            ) {
              const expectedValue =
                item.expectedValues[
                  field
                ];

              updateQuery =
                expectedValue === null
                  ? updateQuery.is(
                      field,
                      null
                    )
                  : updateQuery.eq(
                      field,
                      expectedValue
                    );
            }

            const {
              data,
              error,
            } =
              await updateQuery
                .select("id");

            if (
              error ||
              !data ||
              data.length !== 1
            ) {
              throw new ContactImportError(
                error?.message ||
                "A CRM contact changed before it could be safely enriched. No newer directory value was overwritten.",
                409
              );
            }
          }
        )
      );
    }

    const insertedContacts: ContactRow[] = [];

    for (
      const newChunk of
      chunkValues(
        newRows,
        250
      )
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from("contacts")
          .upsert(
            newChunk,
            {
              onConflict:
                "org_id,email_normalized",
              ignoreDuplicates:
                true,
            }
          )
          .select(
            contactSelect
          );

      if (error) {
        throw new ContactImportError(
          `Could not import new contacts: ${error.message}`,
          500
        );
      }

      for (
        const rawContact of
        data || []
      ) {
        insertedContacts.push(
          rawContact as ContactRow
        );
      }
    }

    for (
      const contact of
      insertedContacts
    ) {
      contactStates.set(
        contact.id,
        {
          contact,
          company:
            contact.company,
          phone:
            contact.phone,
        }
      );
    }

    for (
      const contactIdChunk of
      chunkValues(
        Array.from(
          companyFilledIds
        ),
        QUERY_CHUNK
      )
    ) {
      if (
        contactIdChunk.length === 0
      ) {
        continue;
      }

      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "contact_enrichment_reviews"
          )
          .update({
            status:
              "resolved",
            resolved_by:
              profile.id,
            resolved_at:
              now,
            updated_at:
              now,
          })
          .eq(
            "org_id",
            profile.org_id
          )
          .eq(
            "status",
            "pending"
          )
          .eq(
            "issue_type",
            "missing_brokerage"
          )
          .in(
            "contact_id",
            contactIdChunk
          );

      if (error) {
        throw new ContactImportError(
          `Could not resolve completed brokerage reviews: ${error.message}`,
          500
        );
      }
    }

    for (
      const contactIdChunk of
      chunkValues(
        Array.from(
          phoneFilledIds
        ),
        QUERY_CHUNK
      )
    ) {
      if (
        contactIdChunk.length === 0
      ) {
        continue;
      }

      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "contact_enrichment_reviews"
          )
          .update({
            status:
              "resolved",
            resolved_by:
              profile.id,
            resolved_at:
              now,
            updated_at:
              now,
          })
          .eq(
            "org_id",
            profile.org_id
          )
          .eq(
            "status",
            "pending"
          )
          .eq(
            "issue_type",
            "missing_phone"
          )
          .in(
            "contact_id",
            contactIdChunk
          );

      if (error) {
        throw new ContactImportError(
          `Could not resolve completed phone reviews: ${error.message}`,
          500
        );
      }
    }

    for (
      const state of
      contactStates.values()
    ) {
      if (
        !cleanText(
          state.company
        )
      ) {
        reviews.push(
          missingFieldReview(
            profile.id,
            profile.org_id,
            state.contact,
            "missing_brokerage"
          )
        );
      }

      if (
        !cleanText(
          state.phone
        )
      ) {
        reviews.push(
          missingFieldReview(
            profile.id,
            profile.org_id,
            state.contact,
            "missing_phone"
          )
        );
      }
    }

    let reviewsQueued = 0;

    for (const review of reviews) {
      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "contact_enrichment_reviews"
          )
          .insert(
            review
          );

      if (!error) {
        reviewsQueued += 1;
        continue;
      }

      if (
        error.code ===
        "23505"
      ) {
        continue;
      }

      throw new ContactImportError(
        `Could not queue a contact review: ${error.message}`,
        500
      );
    }

    const touchedIds =
      Array.from(
        contactStates.keys()
      );

    const contactsWithPendingReviews =
      new Set<string>();

    for (
      const contactIdChunk of
      chunkValues(
        touchedIds,
        QUERY_CHUNK
      )
    ) {
      if (
        contactIdChunk.length === 0
      ) {
        continue;
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "contact_enrichment_reviews"
          )
          .select(
            "contact_id"
          )
          .eq(
            "org_id",
            profile.org_id
          )
          .eq(
            "status",
            "pending"
          )
          .in(
            "contact_id",
            contactIdChunk
          );

      if (error) {
        throw new ContactImportError(
          `Could not refresh contact review statuses: ${error.message}`,
          500
        );
      }

      for (
        const row of
        data || []
      ) {
        if (row.contact_id) {
          contactsWithPendingReviews.add(
            String(
              row.contact_id
            )
          );
        }
      }
    }

    const statusUpdates =
      Array.from(
        contactStates.entries()
      ).map(
        ([
          contactId,
          state,
        ]) => ({
          id:
            contactId,
          status:
            cleanText(
              state.company
            ) &&
            cleanText(
              state.phone
            ) &&
            !contactsWithPendingReviews.has(
              contactId
            )
              ? "ready"
              : "needs_review",
        })
      );

    for (
      const statusChunk of
      chunkValues(
        statusUpdates,
        UPDATE_CHUNK
      )
    ) {
      await Promise.all(
        statusChunk.map(
          async (
            item
          ) => {
            const {
              error,
            } =
              await supabaseAdmin
                .from("contacts")
                .update({
                  contact_review_status:
                    item.status,
                })
                .eq(
                  "id",
                  item.id
                )
                .eq(
                  "org_id",
                  profile.org_id
                );

            if (error) {
              throw new ContactImportError(
                `Could not refresh a contact directory status: ${error.message}`,
                500
              );
            }
          }
        )
      );
    }

    return NextResponse.json({
      ok:
        true,
      new_contacts:
        insertedContacts.length,
      enriched_contacts:
        enrichedContacts,
      existing_unchanged:
        unchangedExisting,
      conflicts_found:
        conflictCount,
      reviews_queued:
        reviewsQueued,
      access_skipped:
        accessSkipped,
      invalid_rows:
        invalidRows,
    });
  }
  catch (error) {
    if (
      error instanceof
      RequestAuthError
    ) {
      return NextResponse.json(
        {
          ok:
            false,
          error:
            error.message,
        },
        {
          status:
            requestErrorStatus(
              error
            ),
        }
      );
    }

    const status =
      error instanceof
        ContactImportError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        ok:
          false,
        error:
          error instanceof Error
            ? error.message
            : "Contact import failed.",
      },
      {
        status,
      }
    );
  }
}
