import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { supabaseAdmin } from "../supabaseAdmin";

import { analyzeAdvertisingComplianceChange } from "./analyzeAdvertisingComplianceChange";

export type AdvertisingAuditType =
  | "change_scan"
  | "full_audit";

export type AdvertisingAuditTrigger =
  | "cron"
  | "platform_admin"
  | "system";

export type AdvertisingAuditOptions = {
  auditType: AdvertisingAuditType;
  triggerSource: AdvertisingAuditTrigger;
  requestedBy?: string | null;
  jurisdictionCode?: "US-FED" | "US-ID" | null;
  sourceId?: string | null;
  dueOnly?: boolean;
  maxSources?: number;
};

export type AdvertisingAuditResult = {
  ok: true;
  run_id: string;
  audit_type: AdvertisingAuditType;
  status:
    | "completed"
    | "completed_with_findings";
  source_count: number;
  checked_count: number;
  first_snapshot_count: number;
  changed_count: number;
  unchanged_count: number;
  error_count: number;
  automatic_rule_changes: false;
  results: SourceResult[];
};

type SourceCheckStatus =
  | "first_snapshot"
  | "unchanged"
  | "changed"
  | "unavailable"
  | "unsupported"
  | "error";

type JurisdictionRow = {
  id: string;
  code: string;
  name: string;
};

type RuleSetRow = {
  id: string;
  jurisdiction_id: string;
  name: string;
  version: string;
  status: string;
  is_active: boolean;
};

type SourceRow = {
  id: string;
  rule_set_id: string;
  source_type: string;
  title: string;
  source_url: string | null;
  monitor_enabled: boolean;
  monitor_frequency:
    | "monthly"
    | "semiannual"
    | "annual"
    | "manual";
  monitor_priority: number;
  next_check_at: string | null;
  last_check_status: string | null;
  last_content_hash: string | null;
};

type SourceContext = {
  source: SourceRow;
  ruleSet: RuleSetRow;
  jurisdiction: JurisdictionRow;
};

type SourceVersionRow = {
  id: string;
  source_id: string;
  content_hash: string;
  normalized_text: string | null;
  content_excerpt: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

type FetchResult = {
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  contentHash: string;
  normalizedText: string | null;
  contentExcerpt: string | null;
  rawByteCount: number;
  etag: string | null;
  lastModified: string | null;
  responseHeaders: Record<string, string>;
  extractor: string;
};

export type SourceResult = {
  source_id: string;
  source_title: string;
  jurisdiction_code: string;
  status: SourceCheckStatus;
  changed: boolean;
  http_status: number | null;
  error: string | null;
  ai_analysis_status:
    | "not_required"
    | "completed"
    | "skipped"
    | "failed";
  ai_model:
    string |
    null;
};

const ENGINE_VERSION =
  "samantha-advertising-law-monitor-1.0";

const PILOT_JURISDICTIONS =
  new Set([
    "US-FED",
    "US-ID",
  ]);

const OFFICIAL_HOSTNAMES =
  new Set([
    "ecfr.gov",
    "www.ecfr.gov",
    "ftc.gov",
    "www.ftc.gov",
    "justice.gov",
    "www.justice.gov",
    "fcc.gov",
    "www.fcc.gov",
    "hud.gov",
    "www.hud.gov",
    "ag.idaho.gov",
    "www.ag.idaho.gov",
    "humanrights.idaho.gov",
    "www.humanrights.idaho.gov",
    "dopl.idaho.gov",
    "www.dopl.idaho.gov",
    "adminrules.idaho.gov",
    "www.adminrules.idaho.gov",
  ]);

const IDAHO_RULES_BLOB_HOSTNAME =
  "proddfmmainsa.blob.core.windows.net";

const IDAHO_RULES_BLOB_PATH_PREFIX =
  "/dfm-admin-website/rules/current/";

const DEFAULT_MAX_SOURCES =
  25;

const MAX_ALLOWED_SOURCES =
  50;

const FETCH_TIMEOUT_MS =
  20_000;

const MAX_RESPONSE_BYTES =
  3_000_000;

const MAX_STORED_TEXT =
  250_000;

const MAX_EXCERPT_TEXT =
  8_000;

const MAX_REDIRECTS =
  5;

class SourceAuditError extends Error {
  status: SourceCheckStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  contentType: string | null;

  constructor(
    message: string,
    status: SourceCheckStatus,
    options?: {
      httpStatus?: number | null;
      finalUrl?: string | null;
      contentType?: string | null;
    }
  ) {
    super(message);

    this.name =
      "SourceAuditError";

    this.status =
      status;

    this.httpStatus =
      options?.httpStatus ??
      null;

    this.finalUrl =
      options?.finalUrl ??
      null;

    this.contentType =
      options?.contentType ??
      null;
  }
}

function throwDatabaseError(
  error:
    | {
        message?: string;
      }
    | null
    | undefined,
  fallback: string
) {
  if (!error) {
    return;
  }

  throw new Error(
    error.message ||
      fallback
  );
}

function sha256(
  value:
    string |
    Buffer
) {
  return createHash(
    "sha256"
  )
    .update(value)
    .digest("hex");
}

function safeSourceLimit(
  value: unknown
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return DEFAULT_MAX_SOURCES;
  }

  return Math.min(
    MAX_ALLOWED_SOURCES,
    Math.max(
      1,
      Math.trunc(parsed)
    )
  );
}

function isPrivateIpv4(
  address: string
) {
  const parts =
    address
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return true;
  }

  const first =
    parts[0];

  const second =
    parts[1];

  if (
    first === 0 ||
    first === 10 ||
    first === 127
  ) {
    return true;
  }

  if (
    first === 100 &&
    second >= 64 &&
    second <= 127
  ) {
    return true;
  }

  if (
    first === 169 &&
    second === 254
  ) {
    return true;
  }

  if (
    first === 172 &&
    second >= 16 &&
    second <= 31
  ) {
    return true;
  }

  if (
    first === 192 &&
    second === 168
  ) {
    return true;
  }

  if (
    first === 198 &&
    (
      second === 18 ||
      second === 19
    )
  ) {
    return true;
  }

  if (first >= 224) {
    return true;
  }

  return false;
}

function isPrivateIp(
  address: string
) {
  const normalized =
    address
      .toLowerCase()
      .split("%")[0];

  const version =
    isIP(normalized);

  if (version === 4) {
    return isPrivateIpv4(
      normalized
    );
  }

  if (version !== 6) {
    return true;
  }

  if (
    normalized === "::" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  if (
    normalized.startsWith(
      "::ffff:"
    )
  ) {
    const mapped =
      normalized.slice(7);

    if (
      isIP(mapped) === 4
    ) {
      return isPrivateIpv4(
        mapped
      );
    }
  }

  return false;
}

async function assertSafeOfficialUrl(
  value: string,
  options?: {
    allowIdahoRulesBlob?: boolean;
  }
) {
  let url: URL;

  try {
    url =
      new URL(value);
  }
  catch {
    throw new SourceAuditError(
      "The official source URL is invalid.",
      "unsupported"
    );
  }

  if (
    url.protocol !==
    "https:"
  ) {
    throw new SourceAuditError(
      "Only HTTPS official sources are supported.",
      "unsupported",
      {
        finalUrl:
          url.toString(),
      }
    );
  }

  const hostname =
    url.hostname
      .toLowerCase();

  if (
    hostname ===
      "localhost" ||
    hostname.endsWith(
      ".localhost"
    ) ||
    hostname.endsWith(
      ".local"
    ) ||
    hostname.endsWith(
      ".internal"
    )
  ) {
    throw new SourceAuditError(
      "Private and internal source hosts are blocked.",
      "unsupported",
      {
        finalUrl:
          url.toString(),
      }
    );
  }

  const officialHost =
    OFFICIAL_HOSTNAMES.has(
      hostname
    );

  const approvedIdahoRulesBlob =
    options?.allowIdahoRulesBlob ===
      true &&
    hostname ===
      IDAHO_RULES_BLOB_HOSTNAME &&
    url.pathname.startsWith(
      IDAHO_RULES_BLOB_PATH_PREFIX
    );

  if (
    !officialHost &&
    !approvedIdahoRulesBlob
  ) {
    throw new SourceAuditError(
      "The Federal and Idaho pilot only monitors approved official government domains.",
      "unsupported",
      {
        finalUrl:
          url.toString(),
      }
    );
  }

  if (isIP(hostname)) {
    if (
      isPrivateIp(hostname)
    ) {
      throw new SourceAuditError(
        "Private and internal source addresses are blocked.",
        "unsupported",
        {
          finalUrl:
            url.toString(),
        }
      );
    }

    return url;
  }

  let addresses:
    Array<{
      address: string;
      family: number;
    }>;

  try {
    addresses =
      await lookup(
        hostname,
        {
          all: true,
          verbatim: true,
        }
      );
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "The official source host could not be resolved.";

    throw new SourceAuditError(
      message,
      "unavailable",
      {
        finalUrl:
          url.toString(),
      }
    );
  }

  if (
    addresses.length === 0 ||
    addresses.some(
      (entry) =>
        isPrivateIp(
          entry.address
        )
    )
  ) {
    throw new SourceAuditError(
      "The official source resolved to a blocked address.",
      "unsupported",
      {
        finalUrl:
          url.toString(),
      }
    );
  }

  return url;
}

async function readLimitedBody(
  response: Response
) {
  const declaredLength =
    Number(
      response.headers.get(
        "content-length"
      ) ||
      0
    );

  if (
    Number.isFinite(
      declaredLength
    ) &&
    declaredLength >
      MAX_RESPONSE_BYTES
  ) {
    throw new SourceAuditError(
      "The official source is larger than the audit download limit.",
      "unsupported",
      {
        httpStatus:
          response.status,

        finalUrl:
          response.url ||
          null,

        contentType:
          response.headers.get(
            "content-type"
          ),
      }
    );
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader =
    response.body.getReader();

  const chunks:
    Uint8Array[] = [];

  let total =
    0;

  while (true) {
    const {
      value,
      done,
    } =
      await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    total +=
      value.byteLength;

    if (
      total >
      MAX_RESPONSE_BYTES
    ) {
      await reader.cancel();

      throw new SourceAuditError(
        "The official source is larger than the audit download limit.",
        "unsupported",
        {
          httpStatus:
            response.status,

          finalUrl:
            response.url ||
            null,

          contentType:
            response.headers.get(
              "content-type"
            ),
        }
      );
    }

    chunks.push(value);
  }

  return Buffer.concat(
    chunks.map(
      (chunk) =>
        Buffer.from(chunk)
    ),
    total
  );
}

function decodeHtmlEntities(
  input: string
) {
  return input
    .replace(
      /&#x([0-9a-f]+);/gi,
      (
        _match,
        hexadecimal
      ) => {
        const value =
          Number.parseInt(
            hexadecimal,
            16
          );

        return Number.isFinite(
          value
        )
          ? String.fromCodePoint(
              value
            )
          : " ";
      }
    )
    .replace(
      /&#(\d+);/g,
      (
        _match,
        decimal
      ) => {
        const value =
          Number.parseInt(
            decimal,
            10
          );

        return Number.isFinite(
          value
        )
          ? String.fromCodePoint(
              value
            )
          : " ";
      }
    )
    .replaceAll(
      "&nbsp;",
      " "
    )
    .replaceAll(
      "&amp;",
      "&"
    )
    .replaceAll(
      "&quot;",
      '"'
    )
    .replaceAll(
      "&#39;",
      "'"
    )
    .replaceAll(
      "&lt;",
      "<"
    )
    .replaceAll(
      "&gt;",
      ">"
    );
}

function normalizeWhitespace(
  input: string
) {
  return input
    .replace(
      /\r\n?/g,
      "\n"
    )
    .split("\n")
    .map(
      (line) =>
        line
          .replace(
            /[ \t]+/g,
            " "
          )
          .trim()
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractPrimaryHtml(
  html: string
) {
  const mainMatch =
    html.match(
      /<main\b[^>]*>([\s\S]*?)<\/main>/i
    );

  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  const articleMatch =
    html.match(
      /<article\b[^>]*>([\s\S]*?)<\/article>/i
    );

  if (articleMatch?.[1]) {
    return articleMatch[1];
  }

  const bodyMatch =
    html.match(
      /<body\b[^>]*>([\s\S]*?)<\/body>/i
    );

  return bodyMatch?.[1] ||
    html;
}

function normalizeHtml(
  html: string
) {
  let value =
    extractPrimaryHtml(
      html
    );

  value =
    value
      .replace(
        /<!--[\s\S]*?-->/g,
        " "
      )
      .replace(
        /<(script|style|noscript|svg|canvas|template|form)\b[^>]*>[\s\S]*?<\/\1>/gi,
        " "
      )
      .replace(
        /<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,
        " "
      )
      .replace(
        /<(br|hr)\b[^>]*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/(p|div|li|tr|td|th|h1|h2|h3|h4|h5|h6|section|article|blockquote)>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      );

  return normalizeWhitespace(
    decodeHtmlEntities(
      value
    )
  );
}

function stableJson(
  value: unknown
): unknown {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      stableJson
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const result:
      Record<
        string,
        unknown
      > = {};

    for (
      const key of
        Object.keys(
          value
        ).sort()
    ) {
      result[key] =
        stableJson(
          (
            value as
              Record<
                string,
                unknown
              >
          )[key]
        );
    }

    return result;
  }

  return value;
}

function selectedResponseHeaders(
  headers: Headers
) {
  const result:
    Record<
      string,
      string
    > = {};

  for (
    const name of [
      "cache-control",
      "content-language",
      "content-length",
      "content-type",
      "date",
      "etag",
      "last-modified",
    ]
  ) {
    const value =
      headers.get(name);

    if (value) {
      result[name] =
        value;
    }
  }

  return result;
}

function normalizeContent(
  body: Buffer,
  contentType: string,
  finalUrl: string
) {
  const lowerType =
    contentType
      .toLowerCase();

  const lowerUrl =
    finalUrl
      .toLowerCase();

  if (
    lowerType.includes(
      "application/pdf"
    ) ||
    lowerUrl.endsWith(
      ".pdf"
    )
  ) {
    return {
      hashValue:
        body as
          string |
          Buffer,

      normalizedText:
        null as
          string |
          null,

      contentExcerpt:
        "PDF source monitored through binary SHA-256 comparison.",

      extractor:
        "pdf-binary-sha256",
    };
  }

  const decoded =
    body.toString(
      "utf8"
    );

  let normalized =
    "";

  let extractor =
    "";

  if (
    lowerType.includes(
      "json"
    )
  ) {
    try {
      normalized =
        JSON.stringify(
          stableJson(
            JSON.parse(
              decoded
            )
          )
        );

      extractor =
        "stable-json";
    }
    catch {
      normalized =
        normalizeWhitespace(
          decoded
        );

      extractor =
        "plain-text";
    }
  }
  else if (
    lowerType.includes(
      "html"
    ) ||
    lowerType.includes(
      "xml"
    ) ||
    /^\s*</.test(
      decoded
    )
  ) {
    normalized =
      normalizeHtml(
        decoded
      );

    extractor =
      "primary-html-text";
  }
  else if (
    lowerType.startsWith(
      "text/"
    )
  ) {
    normalized =
      normalizeWhitespace(
        decoded
      );

    extractor =
      "plain-text";
  }
  else {
    throw new SourceAuditError(
      `Unsupported source content type: ${
        contentType ||
        "unknown"
      }.`,
      "unsupported",
      {
        finalUrl,
        contentType,
      }
    );
  }

  if (!normalized) {
    throw new SourceAuditError(
      "The official source returned no usable legal text.",
      "unsupported",
      {
        finalUrl,
        contentType,
      }
    );
  }

  return {
    hashValue:
      normalized as
        string |
        Buffer,

    normalizedText:
      normalized.slice(
        0,
        MAX_STORED_TEXT
      ),

    contentExcerpt:
      normalized.slice(
        0,
        MAX_EXCERPT_TEXT
      ),

    extractor,
  };
}

async function fetchOfficialSource(
  sourceUrl: string
): Promise<FetchResult> {
  let currentUrl =
    await assertSafeOfficialUrl(
      sourceUrl
    );

  let response:
    Response |
    null =
    null;

  for (
    let redirectCount =
      0;
    redirectCount <=
      MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        FETCH_TIMEOUT_MS
      );

    try {
      response =
        await fetch(
          currentUrl,
          {
            method:
              "GET",

            redirect:
              "manual",

            signal:
              controller.signal,

            headers: {
              Accept:
                "text/html,application/xhtml+xml,application/xml,text/plain,application/json,application/pdf;q=0.9,*/*;q=0.5",

              "Accept-Language":
                "en-US,en;q=0.8",

              "User-Agent":
                "Mozilla/5.0 MPRE-Samantha-Compliance-Audit/1.0",
            },

            cache:
              "no-store",
          }
        );
    }
    catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "The official source could not be fetched.";

      throw new SourceAuditError(
        message,
        "error",
        {
          finalUrl:
            currentUrl.toString(),
        }
      );
    }
    finally {
      clearTimeout(
        timeout
      );
    }

    if (
      response.status >=
        300 &&
      response.status <
        400
    ) {
      const location =
        response.headers.get(
          "location"
        );

      if (!location) {
        throw new SourceAuditError(
          `The official source returned HTTP ${response.status} without a redirect location.`,
          "unavailable",
          {
            httpStatus:
              response.status,

            finalUrl:
              currentUrl.toString(),

            contentType:
              response.headers.get(
                "content-type"
              ),
          }
        );
      }

      const redirectUrl =
        new URL(
          location,
          currentUrl
        );

      const currentHostname =
        currentUrl.hostname
          .toLowerCase();

      const allowIdahoRulesBlob =
        currentHostname ===
          "adminrules.idaho.gov" ||
        currentHostname ===
          "www.adminrules.idaho.gov" ||
        currentHostname ===
          IDAHO_RULES_BLOB_HOSTNAME;

      currentUrl =
        await assertSafeOfficialUrl(
          redirectUrl.toString(),
          {
            allowIdahoRulesBlob,
          }
        );

      continue;
    }

    break;
  }

  if (!response) {
    throw new SourceAuditError(
      "The official source did not return a response.",
      "error",
      {
        finalUrl:
          currentUrl.toString(),
      }
    );
  }

  if (
    response.status >=
      300 &&
    response.status <
      400
  ) {
    throw new SourceAuditError(
      "The official source exceeded the redirect limit.",
      "unavailable",
      {
        httpStatus:
          response.status,

        finalUrl:
          currentUrl.toString(),

        contentType:
          response.headers.get(
            "content-type"
          ),
      }
    );
  }

  if (!response.ok) {
    throw new SourceAuditError(
      `The official source returned HTTP ${response.status}.`,
      "unavailable",
      {
        httpStatus:
          response.status,

        finalUrl:
          currentUrl.toString(),

        contentType:
          response.headers.get(
            "content-type"
          ),
      }
    );
  }

  const body =
    await readLimitedBody(
      response
    );

  const contentType =
    response.headers
      .get(
        "content-type"
      )
      ?.split(";")[0]
      ?.trim() ||
    "";

  const normalized =
    normalizeContent(
      body,
      contentType,
      currentUrl.toString()
    );

  return {
    finalUrl:
      currentUrl.toString(),

    httpStatus:
      response.status,

    contentType,

    contentHash:
      sha256(
        normalized.hashValue
      ),

    normalizedText:
      normalized.normalizedText,

    contentExcerpt:
      normalized.contentExcerpt,

    rawByteCount:
      body.byteLength,

    etag:
      response.headers.get(
        "etag"
      ),

    lastModified:
      response.headers.get(
        "last-modified"
      ),

    responseHeaders:
      selectedResponseHeaders(
        response.headers
      ),

    extractor:
      normalized.extractor,
  };
}

function calculateNextCheck(
  frequency:
    SourceRow["monitor_frequency"],
  status:
    SourceCheckStatus
) {
  if (
    frequency ===
    "manual"
  ) {
    return null;
  }

  const date =
    new Date();

  if (
    status ===
      "unavailable" ||
    status ===
      "error"
  ) {
    date.setUTCDate(
      date.getUTCDate() +
        1
    );

    return date.toISOString();
  }

  if (
    status ===
    "unsupported"
  ) {
    date.setUTCDate(
      date.getUTCDate() +
        7
    );

    return date.toISOString();
  }

  const days =
    frequency ===
      "annual"
      ? 365
      : frequency ===
        "semiannual"
      ? 182
      : 30;

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return date.toISOString();
}

async function loadSourceContexts(
  options:
    AdvertisingAuditOptions
) {
  const codes =
    options.jurisdictionCode
      ? [
          options.jurisdictionCode,
        ]
      : Array.from(
          PILOT_JURISDICTIONS
        );

  const {
    data:
      jurisdictionData,
    error:
      jurisdictionError,
  } =
    await supabaseAdmin
      .from(
        "marketing_jurisdictions"
      )
      .select(
        "id, code, name"
      )
      .in(
        "code",
        codes
      );

  throwDatabaseError(
    jurisdictionError,
    "Could not load audit jurisdictions."
  );

  const jurisdictions =
    (
      jurisdictionData ||
      []
    ) as
      JurisdictionRow[];

  if (
    jurisdictions.length ===
    0
  ) {
    throw new Error(
      "No supported audit jurisdiction was found."
    );
  }

  const jurisdictionById =
    new Map(
      jurisdictions.map(
        (
          jurisdiction
        ) => [
          jurisdiction.id,
          jurisdiction,
        ]
      )
    );

  const {
    data:
      ruleSetData,
    error:
      ruleSetError,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_rule_sets"
      )
      .select(`
        id,
        jurisdiction_id,
        name,
        version,
        status,
        is_active
      `)
      .in(
        "jurisdiction_id",
        jurisdictions.map(
          (
            jurisdiction
          ) =>
            jurisdiction.id
        )
      );

  throwDatabaseError(
    ruleSetError,
    "Could not load audit rule packs."
  );

  const ruleSets =
    (
      ruleSetData ||
      []
    ) as
      RuleSetRow[];

  if (
    ruleSets.length ===
    0
  ) {
    return {
      contexts:
        [] as
          SourceContext[],
      jurisdictions,
    };
  }

  const ruleSetById =
    new Map(
      ruleSets.map(
        (
          ruleSet
        ) => [
          ruleSet.id,
          ruleSet,
        ]
      )
    );

  const {
    data:
      sourceData,
    error:
      sourceError,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_rule_sources"
      )
      .select(`
        id,
        rule_set_id,
        source_type,
        title,
        source_url,
        monitor_enabled,
        monitor_frequency,
        monitor_priority,
        next_check_at,
        last_check_status,
        last_content_hash
      `)
      .eq(
        "monitor_enabled",
        true
      )
      .in(
        "rule_set_id",
        ruleSets.map(
          (
            ruleSet
          ) =>
            ruleSet.id
        )
      )
      .order(
        "monitor_priority",
        {
          ascending:
            true,
        }
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        }
      );

  throwDatabaseError(
    sourceError,
    "Could not load monitored official sources."
  );

  const now =
    Date.now();

  const contexts =
    (
      (
        sourceData ||
        []
      ) as
        SourceRow[]
    )
      .map(
        (
          source
        ) => {
          const ruleSet =
            ruleSetById.get(
              source.rule_set_id
            );

          const jurisdiction =
            ruleSet
              ? jurisdictionById.get(
                  ruleSet.jurisdiction_id
                )
              : null;

          if (
            !ruleSet ||
            !jurisdiction
          ) {
            return null;
          }

          return {
            source,
            ruleSet,
            jurisdiction,
          } as
            SourceContext;
        }
      )
      .filter(
        (
          context
        ):
          context is
            SourceContext =>
          Boolean(context)
      )
      .filter(
        (
          context
        ) =>
          !options.sourceId ||
          context.source.id ===
            options.sourceId
      )
      .filter(
        (
          context
        ) => {
          if (
            !options.dueOnly
          ) {
            return true;
          }

          if (
            !context.source
              .next_check_at
          ) {
            return true;
          }

          const dueAt =
            new Date(
              context.source
                .next_check_at
            ).getTime();

          return (
            Number.isNaN(
              dueAt
            ) ||
            dueAt <= now
          );
        }
      )
      .slice(
        0,
        safeSourceLimit(
          options.maxSources
        )
      );

  return {
    contexts,
    jurisdictions,
  };
}

async function loadLatestVersion(
  sourceId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_source_versions"
      )
      .select(`
        id,
        source_id,
        content_hash,
        normalized_text,
        content_excerpt,
        first_seen_at,
        last_seen_at
      `)
      .eq(
        "source_id",
        sourceId
      )
      .order(
        "first_seen_at",
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle();

  throwDatabaseError(
    error,
    "Could not load the previous source version."
  );

  return (
    data as
      SourceVersionRow |
      null
  );
}

async function saveSourceVersion(
  context:
    SourceContext,
  fetched:
    FetchResult
) {
  const {
    data:
      existingData,
    error:
      existingError,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_source_versions"
      )
      .select(`
        id,
        source_id,
        content_hash,
        normalized_text,
        content_excerpt,
        first_seen_at,
        last_seen_at
      `)
      .eq(
        "source_id",
        context.source.id
      )
      .eq(
        "content_hash",
        fetched.contentHash
      )
      .maybeSingle();

  throwDatabaseError(
    existingError,
    "Could not check the current source version."
  );

  const existing =
    existingData as
      SourceVersionRow |
      null;

  if (existing) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "marketing_compliance_source_versions"
        )
        .update({
          last_seen_at:
            new Date()
              .toISOString(),

          fetched_url:
            fetched.finalUrl,

          http_status:
            fetched.httpStatus,

          content_type:
            fetched.contentType,

          etag:
            fetched.etag,

          last_modified_header:
            fetched.lastModified,

          response_headers:
            fetched.responseHeaders,

          metadata: {
            byte_count:
              fetched.rawByteCount,

            extractor:
              fetched.extractor,
          },
        })
        .eq(
          "id",
          existing.id
        )
        .select(`
          id,
          source_id,
          content_hash,
          normalized_text,
          content_excerpt,
          first_seen_at,
          last_seen_at
        `)
        .single();

    throwDatabaseError(
      error,
      "Could not refresh the existing source version."
    );

    if (!data?.id) {
      throw new Error(
        "The refreshed source version was not returned."
      );
    }

    return data as
      SourceVersionRow;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_source_versions"
      )
      .insert({
        source_id:
          context.source.id,

        rule_set_id:
          context.ruleSet.id,

        jurisdiction_id:
          context.jurisdiction.id,

        content_hash:
          fetched.contentHash,

        fetched_url:
          fetched.finalUrl,

        http_status:
          fetched.httpStatus,

        content_type:
          fetched.contentType,

        etag:
          fetched.etag,

        last_modified_header:
          fetched.lastModified,

        normalized_text:
          fetched.normalizedText,

        content_excerpt:
          fetched.contentExcerpt,

        response_headers:
          fetched.responseHeaders,

        metadata: {
          byte_count:
            fetched.rawByteCount,

          extractor:
            fetched.extractor,
        },
      })
      .select(`
        id,
        source_id,
        content_hash,
        normalized_text,
        content_excerpt,
        first_seen_at,
        last_seen_at
      `)
      .single();

  throwDatabaseError(
    error,
    "Could not create the source version."
  );

  if (!data?.id) {
    throw new Error(
      "The new source version was not returned."
    );
  }

  return data as
    SourceVersionRow;
}

async function insertSourceCheck(
  values: {
    auditRunId: string;
    sourceId: string;
    previousVersionId:
      string |
      null;
    currentVersionId:
      string |
      null;
    status:
      SourceCheckStatus;
    httpStatus:
      number |
      null;
    finalUrl:
      string |
      null;
    contentType:
      string |
      null;
    changed: boolean;
    checkedAt: string;
    errorMessage:
      string |
      null;
    metadata:
      Record<
        string,
        unknown
      >;
  }
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_audit_source_checks"
      )
      .insert({
        audit_run_id:
          values.auditRunId,

        source_id:
          values.sourceId,

        previous_version_id:
          values.previousVersionId,

        current_version_id:
          values.currentVersionId,

        check_status:
          values.status,

        http_status:
          values.httpStatus,

        final_url:
          values.finalUrl,

        content_type:
          values.contentType,

        changed:
          values.changed,

        checked_at:
          values.checkedAt,

        error_message:
          values.errorMessage,

        metadata:
          values.metadata,
      })
      .select("id")
      .single();

  throwDatabaseError(
    error,
    "Could not save the source-check result."
  );

  if (!data?.id) {
    throw new Error(
      "The source-check record was not returned."
    );
  }

  return String(
    data.id
  );
}

async function updateSourceMonitoring(
  source:
    SourceRow,
  values: {
    status:
      SourceCheckStatus;
    checkedAt: string;
    contentHash?:
      string |
      null;
    httpStatus?:
      number |
      null;
    errorMessage?:
      string |
      null;
    changed?: boolean;
  }
) {
  const payload:
    Record<
      string,
      unknown
    > = {
    last_checked_at:
      values.checkedAt,

    next_check_at:
      calculateNextCheck(
        source.monitor_frequency,
        values.status
      ),

    last_check_status:
      values.status,

    last_http_status:
      values.httpStatus ??
      null,

    last_error:
      values.errorMessage ??
      null,
  };

  if (
    values.contentHash
  ) {
    payload.last_content_hash =
      values.contentHash;
  }

  if (values.changed) {
    payload.last_changed_at =
      values.checkedAt;
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_rule_sources"
      )
      .update(payload)
      .eq(
        "id",
        source.id
      );

  throwDatabaseError(
    error,
    "Could not update official-source monitoring status."
  );
}

async function insertAuditFinding(
  values: {
    auditRunId: string;
    sourceCheckId: string;
    context:
      SourceContext;
    findingType:
      | "content_change"
      | "source_unavailable"
      | "source_moved"
      | "effective_date_change"
      | "potential_requirement_change"
      | "manual_review";
    severity:
      | "informational"
      | "warning"
      | "blocking";
    title: string;
    summary: string;
    confidence?:
      number |
      null;
    suggestedUpdates?:
      Array<
        Record<
          string,
          unknown
        >
      >;
    changeDetails?:
      Record<
        string,
        unknown
      >;
  }
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_audit_findings"
      )
      .insert({
        audit_run_id:
          values.auditRunId,

        source_check_id:
          values.sourceCheckId,

        source_id:
          values.context.source.id,

        jurisdiction_id:
          values.context
            .jurisdiction.id,

        rule_set_id:
          values.context.ruleSet.id,

        finding_type:
          values.findingType,

        severity:
          values.severity,

        finding_status:
          "open",

        title:
          values.title,

        summary:
          values.summary,

        confidence:
          values.confidence ??
          null,

        change_details:
          values.changeDetails ||
          {},

        suggested_updates:
          values.suggestedUpdates ||
          [],
      });

  throwDatabaseError(
    error,
    "Could not create the audit finding."
  );
}

type OperationalFindingRow = {
  id: string;
  finding_type: string;
  change_details:
    Record<
      string,
      unknown
    > |
    null;
};

async function resolveRecoveredSourceFindings(
  sourceId: string,
  checkedAt: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_audit_findings"
      )
      .select(`
        id,
        finding_type,
        change_details
      `)
      .eq(
        "source_id",
        sourceId
      )
      .eq(
        "finding_status",
        "open"
      )
      .in(
        "finding_type",
        [
          "source_unavailable",
          "source_moved",
          "manual_review",
        ]
      );

  throwDatabaseError(
    error,
    "Could not load recoverable source findings."
  );

  const findingIds =
    (
      (
        data ||
        []
      ) as
        OperationalFindingRow[]
    )
      .filter(
        (
          finding
        ) => {
          if (
            finding.finding_type !==
            "manual_review"
          ) {
            return true;
          }

          const checkStatus =
            typeof finding
              .change_details
              ?.check_status ===
              "string"
              ? finding
                  .change_details
                  .check_status
              : null;

          return [
            "unavailable",
            "unsupported",
            "error",
          ].includes(
            checkStatus ||
            ""
          );
        }
      )
      .map(
        (
          finding
        ) =>
          finding.id
      );

  if (
    findingIds.length ===
    0
  ) {
    return 0;
  }

  const {
    error:
      resolutionError,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_audit_findings"
      )
      .update({
        finding_status:
          "resolved",

        resolution_notes:
          "Automatically resolved after the official source completed a successful follow-up check. No compliance rule package was changed or legally verified.",

        updated_at:
          checkedAt,
      })
      .in(
        "id",
        findingIds
      );

  throwDatabaseError(
    resolutionError,
    "Could not resolve recovered source findings."
  );

  return findingIds.length;
}
async function processSource(
  context:
    SourceContext,
  auditRunId:
    string
): Promise<SourceResult> {
  const checkedAt =
    new Date()
      .toISOString();

  const previous =
    await loadLatestVersion(
      context.source.id
    );

  try {
    if (
      !context.source
        .source_url
    ) {
      throw new SourceAuditError(
        "The official source does not have a URL.",
        "unsupported"
      );
    }

    const fetched =
      await fetchOfficialSource(
        context.source.source_url
      );

    const current =
      await saveSourceVersion(
        context,
        fetched
      );

    const status:
      SourceCheckStatus =
      !previous
        ? "first_snapshot"
        : previous.content_hash ===
          current.content_hash
        ? "unchanged"
        : "changed";

    const changed =
      status ===
      "changed";

    const sourceCheckId =
      await insertSourceCheck({
        auditRunId,

        sourceId:
          context.source.id,

        previousVersionId:
          previous?.id ||
          null,

        currentVersionId:
          current.id,

        status,

        httpStatus:
          fetched.httpStatus,

        finalUrl:
          fetched.finalUrl,

        contentType:
          fetched.contentType,

        changed,

        checkedAt,

        errorMessage:
          null,

        metadata: {
          extractor:
            fetched.extractor,

          byte_count:
            fetched.rawByteCount,
        },
      });

    await updateSourceMonitoring(
      context.source,
      {
        status,
        checkedAt,

        contentHash:
          fetched.contentHash,

        httpStatus:
          fetched.httpStatus,

        errorMessage:
          null,

        changed,
      }
    );

    await resolveRecoveredSourceFindings(
      context.source.id,
      checkedAt
    );

    let aiAnalysisStatus:
      SourceResult["ai_analysis_status"] =
      "not_required";

    let aiModel:
      string |
      null =
      null;

    if (changed) {
      const analysis =
        await analyzeAdvertisingComplianceChange(
          {
            jurisdictionCode:
              context.jurisdiction.code,

            jurisdictionName:
              context.jurisdiction.name,

            sourceTitle:
              context.source.title,

            sourceUrl:
              context.source
                .source_url,

            ruleSetName:
              context.ruleSet.name,

            ruleSetVersion:
              context.ruleSet.version,

            previousText:
              previous
                ?.normalized_text ||
              null,

            currentText:
              current
                .normalized_text ||
              null,

            previousExcerpt:
              previous
                ?.content_excerpt ||
              null,

            currentExcerpt:
              current
                .content_excerpt ||
              null,
          }
        );

      aiAnalysisStatus =
        analysis.status;

      aiModel =
        analysis.model;

      await insertAuditFinding({
        auditRunId,
        sourceCheckId,
        context,

        findingType:
          "content_change",

        severity:
          analysis
            .legalSignificance ===
            "likely"
            ? "blocking"
            : "warning",

        title:
          `${context.jurisdiction.code}: official advertising-law source changed`,

        summary:
          analysis.summary,

        confidence:
          analysis.confidence,

        suggestedUpdates:
          analysis
            .proposedUpdates
            .map(
              (
                update
              ) => ({
                action:
                  update.action,

                requirement_key:
                  update.requirement_key,

                title:
                  update.title,

                rationale:
                  update.rationale,

                proposed_text:
                  update.proposed_text,
              })
            ),

        changeDetails: {
          previous_version_id:
            previous?.id ||
            null,

          current_version_id:
            current.id,

          previous_hash:
            previous
              ?.content_hash ||
            null,

          current_hash:
            current.content_hash,

          previous_excerpt:
            previous
              ?.content_excerpt ||
            null,

          current_excerpt:
            current
              .content_excerpt,

          official_source_url:
            context.source
              .source_url,

          final_url:
            fetched.finalUrl,

          requires_ai_analysis:
            analysis.status !==
            "completed",

          ai_analysis_status:
            analysis.status,

          ai_model:
            analysis.model,

          ai_legal_significance:
            analysis
              .legalSignificance,

          ai_impact_areas:
            analysis
              .impactAreas,

          ai_effective_date:
            analysis
              .effectiveDate,

          ai_evidence_notes:
            analysis
              .evidenceNotes,

          ai_error:
            analysis.error,

          requires_human_review:
            true,

          automatic_rule_changes:
            false,

          active_rule_unchanged:
            true,

          disclaimer:
            "Samantha provides compliance research assistance, not legal advice. A platform administrator must review and approve every proposed change.",
        },
      });
    }
    return {
      source_id:
        context.source.id,

      source_title:
        context.source.title,

      jurisdiction_code:
        context.jurisdiction.code,

      status,
      changed,

      http_status:
        fetched.httpStatus,

      error:
        null,

      ai_analysis_status:
        aiAnalysisStatus,

      ai_model:
        aiModel,
    };
  }
  catch (error: unknown) {
    if (
      !(
        error instanceof
        SourceAuditError
      )
    ) {
      throw error;
    }

    const sourceCheckId =
      await insertSourceCheck({
        auditRunId,

        sourceId:
          context.source.id,

        previousVersionId:
          previous?.id ||
          null,

        currentVersionId:
          null,

        status:
          error.status,

        httpStatus:
          error.httpStatus,

        finalUrl:
          error.finalUrl,

        contentType:
          error.contentType,

        changed:
          false,

        checkedAt,

        errorMessage:
          error.message,

        metadata:
          {},
      });

    await updateSourceMonitoring(
      context.source,
      {
        status:
          error.status,

        checkedAt,

        httpStatus:
          error.httpStatus,

        errorMessage:
          error.message,

        changed:
          false,
      }
    );

    await insertAuditFinding({
      auditRunId,
      sourceCheckId,
      context,

      findingType:
        error.status ===
        "unsupported"
          ? "manual_review"
          : "source_unavailable",

      severity:
        "warning",

      title:
        `${context.jurisdiction.code}: official source needs attention`,

      summary:
        `${context.source.title}: ${error.message}`,

      changeDetails: {
        official_source_url:
          context.source
            .source_url,

        final_url:
          error.finalUrl,

        http_status:
          error.httpStatus,

        check_status:
          error.status,

        active_rule_unchanged:
          true,
      },
    });

    return {
      source_id:
        context.source.id,

      source_title:
        context.source.title,

      jurisdiction_code:
        context.jurisdiction.code,

      status:
        error.status,

      changed:
        false,

      http_status:
        error.httpStatus,

      error:
        error.message,

      ai_analysis_status:
        "not_required",

      ai_model:
        null,
    };
  }
}

async function mapWithConcurrency<
  Item,
  Result
>(
  items:
    Item[],
  concurrency:
    number,
  worker:
    (
      item: Item
    ) =>
      Promise<Result>
) {
  const results:
    Result[] =
    new Array(
      items.length
    );

  let cursor =
    0;

  const workerCount =
    Math.min(
      Math.max(
        concurrency,
        1
      ),
      items.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      async () => {
        while (true) {
          const index =
            cursor;

          cursor +=
            1;

          if (
            index >=
            items.length
          ) {
            return;
          }

          results[index] =
            await worker(
              items[index] as
                Item
            );
        }
      }
    )
  );

  return results;
}

export async function runAdvertisingComplianceAudit(
  options:
    AdvertisingAuditOptions
): Promise<AdvertisingAuditResult> {
  if (
    options.jurisdictionCode &&
    !PILOT_JURISDICTIONS.has(
      options.jurisdictionCode
    )
  ) {
    throw new Error(
      "The audit pilot currently supports only US-FED and US-ID."
    );
  }

  const {
    contexts,
    jurisdictions,
  } =
    await loadSourceContexts(
      options
    );

  if (
    options.sourceId &&
    contexts.length ===
      0
  ) {
    throw new Error(
      "The requested monitored source was not found in the selected jurisdiction."
    );
  }
  const singleJurisdiction =
    options.jurisdictionCode
      ? jurisdictions.find(
          (
            jurisdiction
          ) =>
            jurisdiction.code ===
            options.jurisdictionCode
        ) ||
        null
      : null;

  const scope =
    options.jurisdictionCode ===
      "US-FED"
      ? "federal"
      : options.jurisdictionCode
      ? "jurisdiction"
      : "all";

  const startedAt =
    new Date()
      .toISOString();

  const {
    data:
      auditRunData,
    error:
      auditRunError,
  } =
    await supabaseAdmin
      .from(
        "marketing_compliance_audit_runs"
      )
      .insert({
        audit_type:
          options.auditType,

        scope,

        jurisdiction_id:
          singleJurisdiction?.id ||
          null,

        requested_by:
          options.requestedBy ||
          null,

        trigger_source:
          options.triggerSource,

        status:
          "running",

        engine_version:
          ENGINE_VERSION,

        model_name:
          null,

        source_count:
          contexts.length,

        checked_count:
          0,

        changed_count:
          0,

        unchanged_count:
          0,

        error_count:
          0,

        started_at:
          startedAt,

        summary: {
          pilot_jurisdictions:
            options.jurisdictionCode
              ? [
                  options.jurisdictionCode,
                ]
              : Array.from(
                  PILOT_JURISDICTIONS
                ),

          due_only:
            Boolean(
              options.dueOnly
            ),

          automatic_rule_changes:
            false,

          ai_analysis:
            "not_run",
        },
      })
      .select("id")
      .single();

  throwDatabaseError(
    auditRunError,
    "Could not create the compliance audit run."
  );

  if (!auditRunData?.id) {
    throw new Error(
      "The compliance audit run was not returned."
    );
  }

  const auditRunId =
    String(
      auditRunData.id
    );

  try {
    const results =
      contexts.length ===
      0
        ? []
        : await mapWithConcurrency(
            contexts,
            3,
            (
              context
            ) =>
              processSource(
                context,
                auditRunId
              )
          );

    const checkedCount =
      results.length;

    const firstSnapshotCount =
      results.filter(
        (
          result
        ) =>
          result.status ===
          "first_snapshot"
      ).length;

    const changedCount =
      results.filter(
        (
          result
        ) =>
          result.status ===
          "changed"
      ).length;

    const unchangedCount =
      results.filter(
        (
          result
        ) =>
          result.status ===
          "unchanged"
      ).length;

    const errorCount =
      results.filter(
        (
          result
        ) =>
          [
            "unavailable",
            "unsupported",
            "error",
          ].includes(
            result.status
          )
      ).length;

    const aiCompletedCount =
      results.filter(
        (
          result
        ) =>
          result
            .ai_analysis_status ===
          "completed"
      ).length;

    const aiSkippedCount =
      results.filter(
        (
          result
        ) =>
          result
            .ai_analysis_status ===
          "skipped"
      ).length;

    const aiFailedCount =
      results.filter(
        (
          result
        ) =>
          result
            .ai_analysis_status ===
          "failed"
      ).length;

    const aiModel =
      results.find(
        (
          result
        ) =>
          Boolean(
            result.ai_model
          )
      )?.ai_model ||
      null;

    const aiAnalysisStatus =
      changedCount ===
      0
        ? "not_required"
        : aiFailedCount >
          0
        ? "failed"
        : aiSkippedCount >
          0
        ? "partial"
        : "completed";

    const finalStatus:
      | "completed"
      | "completed_with_findings" =
      changedCount >
        0 ||
      errorCount >
        0
        ? "completed_with_findings"
        : "completed";

    const completedAt =
      new Date()
        .toISOString();

    const {
      error:
        completionError,
    } =
      await supabaseAdmin
        .from(
          "marketing_compliance_audit_runs"
        )
        .update({
          status:
            finalStatus,

          model_name:
            aiModel,

          checked_count:
            checkedCount,

          changed_count:
            changedCount,

          unchanged_count:
            unchangedCount,

          error_count:
            errorCount,

          completed_at:
            completedAt,

          updated_at:
            completedAt,

          summary: {
            pilot_jurisdictions:
              options.jurisdictionCode
                ? [
                    options.jurisdictionCode,
                  ]
                : Array.from(
                    PILOT_JURISDICTIONS
                  ),

            due_only:
              Boolean(
                options.dueOnly
              ),

            first_snapshot_count:
              firstSnapshotCount,

            changed_count:
              changedCount,

            unchanged_count:
              unchangedCount,

            error_count:
              errorCount,

            automatic_rule_changes:
              false,

            ai_analysis:
              aiAnalysisStatus,

            ai_analysis_completed_count:
              aiCompletedCount,

            ai_analysis_skipped_count:
              aiSkippedCount,

            ai_analysis_failed_count:
              aiFailedCount,

            ai_model:
              aiModel,

            results:
              results.map(
                (
                  result
                ) => ({
                  source_id:
                    result.source_id,

                  jurisdiction_code:
                    result.jurisdiction_code,

                  status:
                    result.status,

                  changed:
                    result.changed,

                  http_status:
                    result.http_status,

                  error:
                    result.error,

                  ai_analysis_status:
                    result
                      .ai_analysis_status,

                  ai_model:
                    result.ai_model,
                })
              ),
          },
        })
        .eq(
          "id",
          auditRunId
        );

    throwDatabaseError(
      completionError,
      "Could not complete the compliance audit run."
    );

    return {
      ok: true,
      run_id:
        auditRunId,
      audit_type:
        options.auditType,
      status:
        finalStatus,
      source_count:
        contexts.length,
      checked_count:
        checkedCount,
      first_snapshot_count:
        firstSnapshotCount,
      changed_count:
        changedCount,
      unchanged_count:
        unchangedCount,
      error_count:
        errorCount,
      automatic_rule_changes:
        false,
      results,
    };
  }
  catch (error: unknown) {
    const failedAt =
      new Date()
        .toISOString();

    const message =
      error instanceof Error
        ? error.message
        : "Unknown compliance audit error.";

    await supabaseAdmin
      .from(
        "marketing_compliance_audit_runs"
      )
      .update({
        status:
          "failed",

        completed_at:
          failedAt,

        updated_at:
          failedAt,

        error_message:
          message,
      })
      .eq(
        "id",
        auditRunId
      );

    throw error;
  }
}