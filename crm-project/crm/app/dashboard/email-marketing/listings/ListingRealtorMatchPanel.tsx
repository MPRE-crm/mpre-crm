'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  Users,
  X,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type RealtorMatchRow = {
  id: string;
  contact_id:
    | string
    | null;

  agent_email: string;

  agent_display_name:
    | string
    | null;

  agent_company:
    | string
    | null;

  match_source: string;
  buyer_match_count: number;

  match_reasons:
    | string[]
    | null;

  criteria_summary:
    | string
    | null;

  match_score:
    | number
    | null;

  is_active: boolean;

  last_matched_at:
    | string
    | null;
};

type ImportBatchRow = {
  id: string;
  source_type: string;
  status: string;
  imported_rows: number;
  matched_rows: number;
  skipped_rows: number;

  source_file_name:
    | string
    | null;

  created_at: string;

  completed_at:
    | string
    | null;

  last_error:
    | string
    | null;
};

type ParsedImport = {
  headers: string[];
  rows: string[][];
};

type NormalizedImport = {
  rows: Array<
    Record<
      string,
      unknown
    >
  >;

  invalidRows: number;
  emailColumnFound: boolean;
};

type ListingRealtorMatchPanelProps = {
  listingId: string;
  listingTitle: string;
};

const HEADER_ALIASES = {
  agent_email: [
    'agent email',
    'realtor email',
    'email address',
    'email',
  ],

  agent_first_name: [
    'agent first name',
    'realtor first name',
    'first name',
    'firstname',
  ],

  agent_last_name: [
    'agent last name',
    'realtor last name',
    'last name',
    'lastname',
  ],

  agent_display_name: [
    'agent display name',
    'realtor name',
    'agent name',
    'display name',
    'name',
  ],

  agent_company: [
    'agent company',
    'brokerage',
    'office name',
    'company',
    'office',
  ],

  buyer_match_count: [
    'buyer match count',
    'buyer matches',
    'match count',
    'matches',
  ],

  match_reasons: [
    'match reasons',
    'match reason',
    'reasons',
    'reason',
  ],

  criteria_summary: [
    'criteria summary',
    'buyer criteria',
    'criteria',
    'match criteria',
  ],

  match_score: [
    'match score',
    'score',
  ],

  external_agent_id: [
    'external agent id',
    'agent mls id',
    'member mls id',
    'agent id',
  ],

  external_office_id: [
    'external office id',
    'office mls id',
    'office id',
  ],

  external_match_id: [
    'external match id',
    'match id',
  ],
} as const;

function normalizeHeader(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    );
}

function parseDelimitedLine(
  line: string,
  delimiter: string
) {
  const values:
    string[] = [];

  let current = '';
  let inQuotes = false;

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character =
      line[index];

    const nextCharacter =
      line[index + 1];

    if (
      character === '"'
    ) {
      if (
        inQuotes &&
        nextCharacter === '"'
      ) {
        current += '"';
        index += 1;
      } else {
        inQuotes =
          !inQuotes;
      }

      continue;
    }

    if (
      character ===
        delimiter &&
      !inQuotes
    ) {
      values.push(
        current.trim()
      );

      current = '';
      continue;
    }

    current +=
      character;
  }

  values.push(
    current.trim()
  );

  return values;
}

function parseDelimitedText(
  value: string
): ParsedImport {
  const clean =
    value
      .replace(
        /\r\n/g,
        '\n'
      )
      .replace(
        /\r/g,
        '\n'
      )
      .trim();

  if (!clean) {
    return {
      headers: [],
      rows: [],
    };
  }

  const lines =
    clean
      .split('\n')
      .filter(
        (line) =>
          line
            .trim()
            .length >
          0
      );

  const delimiter =
    lines[0]
      ?.includes('\t')
      ? '\t'
      : ',';

  const parsed =
    lines.map(
      (line) =>
        parseDelimitedLine(
          line,
          delimiter
        )
    );

  return {
    headers:
      parsed[0] ||
      [],

    rows:
      parsed.slice(1),
  };
}

function headerIndex(
  headers: string[],
  aliases:
    readonly string[]
) {
  const normalizedHeaders =
    headers.map(
      normalizeHeader
    );

  for (
    const alias of aliases
  ) {
    const index =
      normalizedHeaders.indexOf(
        normalizeHeader(
          alias
        )
      );

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function rowValue(
  row: string[],
  index: number
) {
  if (index < 0) {
    return '';
  }

  return String(
    row[index] ||
      ''
  ).trim();
}

function looksLikeEmail(
  value: string
) {
  return (
    value.includes('@') &&
    value.includes('.') &&
    !value.includes(' ')
  );
}

function optionalNumber(
  value: string
) {
  if (!value.trim()) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function normalizeImport(
  parsed: ParsedImport
): NormalizedImport {
  const indices = {
    agent_email:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .agent_email
      ),

    agent_first_name:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .agent_first_name
      ),

    agent_last_name:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .agent_last_name
      ),

    agent_display_name:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .agent_display_name
      ),

    agent_company:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .agent_company
      ),

    buyer_match_count:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .buyer_match_count
      ),

    match_reasons:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .match_reasons
      ),

    criteria_summary:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .criteria_summary
      ),

    match_score:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .match_score
      ),

    external_agent_id:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .external_agent_id
      ),

    external_office_id:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .external_office_id
      ),

    external_match_id:
      headerIndex(
        parsed.headers,
        HEADER_ALIASES
          .external_match_id
      ),
  };

  if (
    indices.agent_email <
    0
  ) {
    return {
      rows: [],
      invalidRows:
        parsed.rows.length,

      emailColumnFound:
        false,
    };
  }

  const rows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  let invalidRows = 0;

  for (
    const row of
      parsed.rows
  ) {
    const email =
      rowValue(
        row,
        indices.agent_email
      )
        .toLowerCase();

    if (
      !looksLikeEmail(
        email
      )
    ) {
      invalidRows += 1;
      continue;
    }

    const reasons =
      rowValue(
        row,
        indices.match_reasons
      );

    rows.push({
      agent_email:
        email,

      agent_first_name:
        rowValue(
          row,
          indices
            .agent_first_name
        ),

      agent_last_name:
        rowValue(
          row,
          indices
            .agent_last_name
        ),

      agent_display_name:
        rowValue(
          row,
          indices
            .agent_display_name
        ),

      agent_company:
        rowValue(
          row,
          indices
            .agent_company
        ),

      buyer_match_count:
        optionalNumber(
          rowValue(
            row,
            indices
              .buyer_match_count
          )
        ) ||
        1,

      match_reasons:
        reasons
          ? reasons.split(
              /[|;,]+/
            )
          : [],

      criteria_summary:
        rowValue(
          row,
          indices
            .criteria_summary
        ),

      match_score:
        optionalNumber(
          rowValue(
            row,
            indices
              .match_score
          )
        ),

      external_agent_id:
        rowValue(
          row,
          indices
            .external_agent_id
        ),

      external_office_id:
        rowValue(
          row,
          indices
            .external_office_id
        ),

      external_match_id:
        rowValue(
          row,
          indices
            .external_match_id
        ),

      provider_metadata: {
        provider:
          'manual_csv_upload',

        status:
          'imported',
      },
    });
  }

  return {
    rows,
    invalidRows,

    emailColumnFound:
      true,
  };
}

function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
    return '—';
  }

  return new Date(
    value
  ).toLocaleString();
}

function statusClasses(
  status: string
) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';

    case 'partially_completed':
      return 'bg-amber-100 text-amber-700';

    case 'failed':
      return 'bg-red-100 text-red-700';

    case 'processing':
      return 'bg-blue-100 text-blue-700';

    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function ListingRealtorMatchPanel({
  listingId,
  listingTitle,
}: ListingRealtorMatchPanelProps) {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    importing,
    setImporting,
  ] = useState(false);

  const [
    fileName,
    setFileName,
  ] = useState('');

  const [
    rawText,
    setRawText,
  ] = useState('');

  const [
    matches,
    setMatches,
  ] = useState<
    RealtorMatchRow[]
  >([]);

  const [
    batches,
    setBatches,
  ] = useState<
    ImportBatchRow[]
  >([]);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    notice,
    setNotice,
  ] = useState<
    string | null
  >(null);

  const parsed =
    useMemo(
      () =>
        parseDelimitedText(
          rawText
        ),
      [rawText]
    );

  const normalizedImport =
    useMemo(
      () =>
        normalizeImport(
          parsed
        ),
      [parsed]
    );

  const activeMatches =
    useMemo(
      () =>
        matches.filter(
          (match) =>
            match.is_active
        ),
      [matches]
    );

  const linkedContacts =
    useMemo(
      () =>
        activeMatches.filter(
          (match) =>
            Boolean(
              match.contact_id
            )
        ).length,
      [activeMatches]
    );

  const loadMatches =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const [
            matchResult,
            batchResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'listing_realtor_matches'
                )
                .select(`
                  id,
                  contact_id,
                  agent_email,
                  agent_display_name,
                  agent_company,
                  match_source,
                  buyer_match_count,
                  match_reasons,
                  criteria_summary,
                  match_score,
                  is_active,
                  last_matched_at
                `)
                .eq(
                  'listing_id',
                  listingId
                )
                .order(
                  'last_matched_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(250),

              supabase
                .from(
                  'mls_reverse_prospecting_batches'
                )
                .select(`
                  id,
                  source_type,
                  status,
                  imported_rows,
                  matched_rows,
                  skipped_rows,
                  source_file_name,
                  created_at,
                  completed_at,
                  last_error
                `)
                .eq(
                  'listing_id',
                  listingId
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(10),
            ]);

          if (
            matchResult.error
          ) {
            throw matchResult
              .error;
          }

          if (
            batchResult.error
          ) {
            throw batchResult
              .error;
          }

          setMatches(
            (
              matchResult.data ||
              []
            ) as RealtorMatchRow[]
          );

          setBatches(
            (
              batchResult.data ||
              []
            ) as ImportBatchRow[]
          );
        } catch (
          loadError: any
        ) {
          setError(
            loadError?.message ||
              'Could not load Realtor matches.'
          );
        } finally {
          setLoading(false);
        }
      },
      [listingId]
    );

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  async function handleFile(
    event:
      ChangeEvent<
        HTMLInputElement
      >
  ) {
    const file =
      event.target
        .files?.[0];

    event.target.value =
      '';

    if (!file) {
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        'The import file cannot exceed 5 MB.'
      );

      return;
    }

    try {
      const text =
        await file.text();

      setFileName(
        file.name
      );

      setRawText(
        text
      );

      setError(null);
      setNotice(null);
    } catch (
      fileError: any
    ) {
      setError(
        fileError?.message ||
          'Could not read the import file.'
      );
    }
  }

  function clearFile() {
    setFileName('');
    setRawText('');
    setError(null);
    setNotice(null);
  }

  async function importMatches() {
    if (!fileName) {
      setError(
        'Choose a CSV or TSV file first.'
      );

      return;
    }

    if (
      !normalizedImport
        .emailColumnFound
    ) {
      setError(
        'The file needs an agent email, Realtor email or email column.'
      );

      return;
    }

    if (
      normalizedImport
        .rows.length ===
      0
    ) {
      setError(
        'No valid Realtor email rows were found.'
      );

      return;
    }

    if (
      normalizedImport
        .rows.length >
      5000
    ) {
      setError(
        'A single import cannot exceed 5,000 valid rows.'
      );

      return;
    }

    try {
      setImporting(true);
      setError(null);
      setNotice(null);

      const {
        data:
          sessionResult,

        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

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
          '/api/marketing/reverse-prospecting/import',
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                listing_id:
                  listingId,

                source_type:
                  'manual_upload',

                source_file_name:
                  fileName,

                rows:
                  normalizedImport
                    .rows,
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
            'The Realtor-match import failed.'
        );
      }

      const imported =
        Number(
          result
            ?.import
            ?.matched_rows ||
          0
        );

      const skipped =
        Number(
          result
            ?.import
            ?.skipped_rows ||
          0
        );

      const directorySync =
        result
          ?.import
          ?.directory_sync ||
        {};

      const contactsUpdated =
        Number(
          directorySync
            .contacts_updated ||
          0
        );

      const reviewsCreated =
        Number(
          directorySync
            .reviews_created ||
          0
        );

      const reviewsResolved =
        Number(
          directorySync
            .reviews_resolved ||
          0
        );

      const directoryDetails = [
        contactsUpdated > 0
          ? `${contactsUpdated} contact${
              contactsUpdated === 1
                ? ''
                : 's'
            } enriched`
          : null,

        reviewsResolved > 0
          ? `${reviewsResolved} review${
              reviewsResolved === 1
                ? ''
                : 's'
            } resolved`
          : null,

        reviewsCreated > 0
          ? `${reviewsCreated} review${
              reviewsCreated === 1
                ? ''
                : 's'
            } created`
          : null,
      ]
        .filter(Boolean)
        .join(', ');

      setNotice(
        `${imported} Realtor match${
          imported === 1
            ? ''
            : 'es'
        } saved${
          skipped > 0
            ? `; ${skipped} row${
                skipped === 1
                  ? ''
                  : 's'
              } skipped or merged.`
            : '.'
        }${
          directoryDetails
            ? ` Directory: ${directoryDetails}.`
            : ''
        }`
      );

      setFileName('');
      setRawText('');

      await loadMatches();
    } catch (
      importError: any
    ) {
      setError(
        importError?.message ||
          'The Realtor-match import failed.'
      );
    } finally {
      setImporting(false);
    }
  }

  const latestBatch =
    batches[0] ||
    null;

  return (
    <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <Users className="h-4 w-4" />

            Buyer-Match Realtors
          </div>

          <h3 className="mt-2 text-xl font-bold text-slate-950">
            Realtor Match Import
          </h3>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Import Realtor email matches for {listingTitle}. Manual CSV uploads use the same normalized connection point reserved for future MLS, RESO, RETS and vendor feeds.
          </p>

          <p className="mt-2 text-xs font-semibold text-slate-500">
            Import Realtor and brokerage details only. Do not include buyer names, buyer contact information or other buyer-identifying data.
          </p>
        </div>

        <button
          type="button"
          disabled={
            loading ||
            importing
          }
          onClick={() =>
            void loadMatches()
          }
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading
                ? 'animate-spin'
                : ''
            }`}
          />

          Refresh Matches
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />

          {notice}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white bg-white/90 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Active Matches
          </div>

          <div className="mt-2 text-2xl font-bold text-slate-950">
            {loading
              ? '—'
              : activeMatches
                  .length}
          </div>
        </div>

        <div className="rounded-2xl border border-white bg-white/90 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Existing CRM Contacts
          </div>

          <div className="mt-2 text-2xl font-bold text-blue-700">
            {loading
              ? '—'
              : linkedContacts}
          </div>
        </div>

        <div className="rounded-2xl border border-white bg-white/90 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Latest Import
          </div>

          <div className="mt-2">
            {latestBatch ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(
                  latestBatch.status
                )}`}
              >
                {latestBatch.status
                  .replace(
                    /_/g,
                    ' '
                  )}
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-500">
                No imports yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-violet-700" />

          <h4 className="font-bold text-slate-950">
            Upload Match File
          </h4>
        </div>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          CSV and tab-separated files are supported. The only required column is an agent or Realtor email address.
        </p>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 hover:bg-violet-100">
            <Upload className="h-4 w-4" />

            Choose CSV or TSV

            <input
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={
                handleFile
              }
              className="hidden"
            />
          </label>

          {fileName ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {fileName}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {parsed.rows.length} total row{parsed.rows.length === 1 ? '' : 's'} · {normalizedImport.rows.length} valid email row{normalizedImport.rows.length === 1 ? '' : 's'}
                  {normalizedImport.invalidRows > 0
                    ? ` · ${normalizedImport.invalidRows} invalid`
                    : ''}
                </div>
              </div>

              <button
                type="button"
                disabled={
                  importing
                }
                onClick={
                  clearFile
                }
                className="rounded-full p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
                aria-label="Remove import file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              No file selected
            </div>
          )}

          <button
            type="button"
            disabled={
              importing ||
              !fileName ||
              !normalizedImport
                .emailColumnFound ||
              normalizedImport
                .rows.length ===
                0
            }
            onClick={() =>
              void importMatches()
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}

            {importing
              ? 'Importing Matches...'
              : 'Import Realtor Matches'}
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Recognized columns include agent email, first name, last name, display name, brokerage/company, buyer match count, match reason, criteria summary, match score and MLS agent or office IDs.
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h4 className="font-bold text-slate-950">
              Current Realtor Matches
            </h4>

            <p className="mt-1 text-xs text-slate-500">
              These records can later become the audience for buyer-match Realtor campaigns.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {activeMatches.length}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />

            Loading Realtor matches...
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No Realtor matches have been imported for this listing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Realtor
                  </th>

                  <th className="px-4 py-3">
                    Brokerage
                  </th>

                  <th className="px-4 py-3">
                    Matches
                  </th>

                  <th className="px-4 py-3">
                    Source
                  </th>

                  <th className="px-4 py-3">
                    CRM Contact
                  </th>

                  <th className="px-4 py-3">
                    Last Matched
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {activeMatches
                  .slice(
                    0,
                    50
                  )
                  .map(
                    (match) => (
                      <tr
                        key={
                          match.id
                        }
                        className="align-top"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {match.agent_display_name ||
                              match.agent_email}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {match.agent_email}
                          </div>

                          {match.criteria_summary && (
                            <div className="mt-2 max-w-sm text-xs leading-5 text-slate-600">
                              {match.criteria_summary}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {match.agent_company ||
                            '—'}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {match.buyer_match_count}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {match.match_source
                              .replace(
                                /_/g,
                                ' '
                              )}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {match.contact_id ? (
                            <span className="font-semibold text-emerald-700">
                              Linked
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Not linked
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                          {formatDate(
                            match.last_matched_at
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {latestBatch?.last_error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Latest import error: {latestBatch.last_error}
        </div>
      )}

      {latestBatch && (
        <div className="mt-4 text-xs text-slate-500">
          Latest batch: {latestBatch.source_file_name || latestBatch.source_type} · {latestBatch.matched_rows} matched · {latestBatch.skipped_rows} skipped · {formatDate(latestBatch.completed_at || latestBatch.created_at)}
        </div>
      )}
    </section>
  );
}