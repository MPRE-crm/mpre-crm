'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import ComplianceAiFindingDetails from './ComplianceAiFindingDetails';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type AuditRun = {
  id: string;
  audit_type: string;
  scope: string;
  jurisdiction_id: string | null;
  trigger_source: string;
  status: string;
  source_count: number;
  checked_count: number;
  changed_count: number;
  unchanged_count: number;
  error_count: number;
  started_at: string | null;
  completed_at: string | null;
  summary:
    Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

type AuditFinding = {
  id: string;
  audit_run_id: string;
  source_id: string;
  jurisdiction_id: string;
  finding_type: string;
  severity: string;
  finding_status: string;
  title: string;
  summary: string | null;
  confidence: number | null;
  change_details:
    Record<string, unknown> | null;
  created_at: string;
};

type MonitoredSource = {
  id: string;
  rule_set_id: string;
  source_type: string;
  title: string;
  source_url: string | null;
  monitor_enabled: boolean;
  monitor_frequency: string;
  monitor_priority: number;
  last_checked_at: string | null;
  last_changed_at: string | null;
  next_check_at: string | null;
  last_check_status: string | null;
  last_content_hash: string | null;
  last_http_status: number | null;
  last_error: string | null;
};

type AuditDashboardResponse = {
  ok: true;
  runs: AuditRun[];
  findings: AuditFinding[];
  sources: MonitoredSource[];
};

type AuditRunResponse = {
  ok: true;
  run_id: string;
  audit_type: string;
  status: string;
  source_count: number;
  checked_count: number;
  first_snapshot_count: number;
  changed_count: number;
  unchanged_count: number;
  error_count: number;
  automatic_rule_changes: false;
};

type OpenAiHealthResponse = {
  ok: true;
  valid: true;
  checked_at: string;
};

type OpenAiImageHealthResponse = {
  ok: true;
  valid: true;
  model: string;
  checked_at: string;
};

function formatStatus(
  value:
    string | null
) {
  if (!value) {
    return 'Not Checked';
  }

  return value
    .replaceAll(
      '_',
      ' '
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDate(
  value:
    string | null
) {
  if (!value) {
    return 'Not yet';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function runStatusClasses(
  status:
    string | null
) {
  if (
    status ===
    'completed'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    status ===
      'completed_with_findings' ||
    status ===
      'running' ||
    status ===
      'queued'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    status ===
      'failed' ||
    status ===
      'cancelled'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function sourceStatusClasses(
  status:
    string | null
) {
  if (
    status ===
      'unchanged' ||
    status ===
      'first_snapshot'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    status ===
    'changed'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    status ===
      'unavailable' ||
    status ===
      'unsupported' ||
    status ===
      'error'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function ComplianceAuditPanel() {
  const [
    data,
    setData,
  ] =
    useState<AuditDashboardResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    running,
    setRunning,
  ] = useState(false);

  const [
    testingOpenAi,
    setTestingOpenAi,
  ] = useState(false);

  const [
    testingOpenAiImage,
    setTestingOpenAiImage,
  ] = useState(false);

  const [
    jurisdictionCode,
    setJurisdictionCode,
  ] =
    useState<
      'US-FED' |
      'US-ID'
    >('US-ID');

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null
    );

  const [
    workingFindingId,
    setWorkingFindingId,
  ] =
    useState<string | null>(
      null
    );

  async function getAccessToken() {
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

    return sessionResult
      .session
      .access_token;
  }

  async function auditFetch<T>(
    url: string,
    init?:
      RequestInit
  ): Promise<T> {
    const token =
      await getAccessToken();

    const response =
      await fetch(
        url,
        {
          ...init,

          headers: {
            Authorization:
              `Bearer ${token}`,

            ...(init?.body
              ? {
                  'Content-Type':
                    'application/json',
                }
              : {}),

            ...(init?.headers ||
              {}),
          },

          cache:
            'no-store',
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => null
        );

    if (
      !response.ok ||
      !result?.ok
    ) {
      throw new Error(
        result?.error ||
          'The Samantha audit request failed.'
      );
    }

    return result as T;
  }

  async function loadAuditData() {
    try {
      setLoading(true);
      setError(null);

      const result =
        await auditFetch<
          AuditDashboardResponse
        >(
          '/api/compliance/audits'
        );

      setData(result);
    } catch (
      loadError:
        unknown
    ) {
      console.error(
        'Compliance audit dashboard load failed:',
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load Samantha audit data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuditData();
  }, []);

  async function testOpenAiRuntime() {
    const confirmed =
      window.confirm(
        'Test the production OpenAI API key now?\n\nThis makes one tiny request from the protected Vercel runtime. It does not modify compliance rules, database records or environment variables.'
      );

    if (!confirmed) {
      return;
    }

    try {
      setTestingOpenAi(true);
      setError(null);
      setNotice(null);

      await auditFetch<
        OpenAiHealthResponse
      >(
        '/api/compliance/openai-health',
        {
          method:
            'POST',
        }
      );

      setNotice(
        'Production OpenAI API key is valid. OpenAI successfully completed the protected runtime request.'
      );
    }
    catch (
      testError:
        unknown
    ) {
      console.error(
        'OpenAI runtime test failed:',
        testError
      );

      setError(
        testError instanceof Error
          ? testError.message
          : 'The production OpenAI runtime test failed.'
      );
    }
    finally {
      setTestingOpenAi(false);
    }
  }

  async function testOpenAiImageRuntime() {
    const confirmed =
      window.confirm(
        'Test GPT Image 2 access now?\n\nThis makes one low-cost protected image-generation request from the Vercel runtime. It does not save the image, modify compliance rules, write to Supabase or expose the API key.'
      );

    if (!confirmed) {
      return;
    }

    try {
      setTestingOpenAiImage(true);
      setError(null);
      setNotice(null);

      await auditFetch<
        OpenAiImageHealthResponse
      >(
        '/api/compliance/openai-image-health',
        {
          method:
            'POST',
        }
      );

      setNotice(
        'GPT Image 2 access is confirmed. OpenAI successfully completed the protected image-generation runtime test.'
      );
    }
    catch (
      testError:
        unknown
    ) {
      console.error(
        'OpenAI GPT Image 2 test failed:',
        testError
      );

      setError(
        testError instanceof Error
          ? testError.message
          : 'The GPT Image 2 runtime test failed.'
      );
    }
    finally {
      setTestingOpenAiImage(false);
    }
  }

  async function runOneSourceTest(
    sourceId?: string | null,
    sourceTitle?: string | null,
    forcedJurisdictionCode?:
      | 'US-FED'
      | 'US-ID'
      | null
  ) {
    const testJurisdictionCode =
      forcedJurisdictionCode ||
      jurisdictionCode;

    const jurisdictionName =
      testJurisdictionCode ===
      'US-FED'
        ? 'Federal'
        : 'Idaho';

    const exactSource =
      Boolean(
        sourceId
      );

    const sourceDescription =
      exactSource
        ? sourceTitle ||
          'the last checked official source'
        : `one ${jurisdictionName} official source`;

    const confirmed =
      window.confirm(
        `Run a controlled Samantha test against ${sourceDescription}?\n\nThis creates or compares a source snapshot and audit record. If stored source text changed, Samantha drafts an AI analysis for human review. It will not verify, approve, activate or change any rule package.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setRunning(true);
      setError(null);
      setNotice(null);

      const result =
        await auditFetch<
          AuditRunResponse
        >(
          '/api/compliance/audits',
          {
            method:
              'POST',

            body:
              JSON.stringify(
                {
                  audit_type:
                    'change_scan',

                  jurisdiction_code:
                    testJurisdictionCode,

                  max_sources:
                    1,

                  ...(sourceId
                    ? {
                        source_id:
                          sourceId,
                      }
                    : {}),
                }
              ),
          }
        );

      setNotice(
        `${
          exactSource
            ? 'Exact-source comparison'
            : 'Controlled test'
        } completed. ${result.checked_count} source checked, ${result.first_snapshot_count} first snapshots, ${result.unchanged_count} unchanged, ${result.changed_count} changed, and ${result.error_count} errors.`
      );

      await loadAuditData();
    } catch (
      runError:
        unknown
    ) {
      console.error(
        'Controlled compliance audit failed:',
        runError
      );

      setError(
        runError instanceof Error
          ? runError.message
          : 'The controlled Samantha test failed.'
      );
    } finally {
      setRunning(false);
    }
  }
  async function runIdahoBatch() {
    const confirmed =
      window.confirm(
        `Run the controlled Idaho pilot batch against all 8 Idaho official sources?\n\nEach source will be compared with its latest stored snapshot. Samantha analyzes only genuine stored-text changes. Successful unchanged checks count toward source verification. Material changes still require review before any active rule changes.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setRunning(true);
      setError(null);
      setNotice(null);

      const result =
        await auditFetch<
          AuditRunResponse
        >(
          '/api/compliance/audits',
          {
            method:
              'POST',

            body:
              JSON.stringify(
                {
                  audit_type:
                    'change_scan',

                  jurisdiction_code:
                    'US-ID',

                  max_sources:
                    8,
                }
              ),
          }
        );

      setNotice(
        `Idaho pilot batch completed. ${result.checked_count} sources checked, ${result.first_snapshot_count} first snapshots, ${result.unchanged_count} unchanged, ${result.changed_count} changed, and ${result.error_count} errors.`
      );

      await loadAuditData();
    } catch (
      batchError:
        unknown
    ) {
      console.error(
        'Idaho compliance batch failed:',
        batchError
      );

      setError(
        batchError instanceof Error
          ? batchError.message
          : 'The controlled Idaho batch failed.'
      );
    } finally {
      setRunning(false);
    }
  }
  async function reviewFinding(
    findingId: string,
    decision:
      | 'approve'
      | 'reject'
      | 'needs_legal_review',
    resolutionNotes: string
  ) {
    const decisionLabel =
      decision ===
        'approve'
        ? 'approve this recommendation'
        : decision ===
          'reject'
        ? 'reject this recommendation'
        : 'send this finding for legal review';

    const confirmed =
      window.confirm(
        `Are you sure you want to ${decisionLabel}?

This records your decision and reviewer identity. It will not silently change an active compliance rule.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setWorkingFindingId(
        `${findingId}:${decision}`
      );

      setError(null);
      setNotice(null);

      const result =
        await auditFetch<{
          ok: true;
          message: string;
        }>(
          '/api/compliance/audits',
          {
            method:
              'PATCH',

            body:
              JSON.stringify({
                finding_id:
                  findingId,

                decision,

                resolution_notes:
                  resolutionNotes,
              }),
          }
        );

      setNotice(
        result.message
      );

      await loadAuditData();
    }
    catch (
      reviewError:
        unknown
    ) {
      console.error(
        'Compliance finding review failed:',
        reviewError
      );

      setError(
        reviewError instanceof Error
          ? reviewError.message
          : 'The compliance finding decision could not be saved.'
      );
    }
    finally {
      setWorkingFindingId(
        null
      );
    }
  }
  const latestRun =
    data?.runs?.[0] ||
    null;

  const latestSourceResult:
    | {
        sourceId: string;

        jurisdictionCode:
          | 'US-FED'
          | 'US-ID';
      }
    | null =
    (() => {
      const results =
        latestRun?.summary
          ?.results;

      if (
        !Array.isArray(
          results
        ) ||
        !results[0] ||
        typeof results[0] !==
          'object'
      ) {
        return null;
      }

      const result =
        results[0] as
          Record<
            string,
            unknown
          >;

      const sourceId =
        typeof result.source_id ===
        'string'
          ? result.source_id
          : null;

      let resultJurisdiction:
        | 'US-FED'
        | 'US-ID'
        | null =
        null;

      if (
        result.jurisdiction_code ===
          'US-FED' ||
        result.jurisdiction_code ===
          'US-ID'
      ) {
        resultJurisdiction =
          result.jurisdiction_code;
      }

      if (
        !sourceId ||
        !resultJurisdiction
      ) {
        return null;
      }

      return {
        sourceId,

        jurisdictionCode:
          resultJurisdiction,
      };
    })();

  const latestSource =
    latestSourceResult
      ? (
          data?.sources ||
          []
        ).find(
          (source) =>
            source.id ===
            latestSourceResult
              .sourceId
        ) ||
        null
      : null;

  const dueSourceCount =
    useMemo(
      () => {
        const now =
          Date.now();

        return (
          data?.sources ||
          []
        ).filter(
          (source) => {
            if (
              !source.next_check_at
            ) {
              return true;
            }

            const dueAt =
              new Date(
                source.next_check_at
              ).getTime();

            return (
              Number.isNaN(
                dueAt
              ) ||
              dueAt <= now
            );
          }
        ).length;
      },
      [data]
    );

  const healthySourceCount =
    (
      data?.sources ||
      []
    ).filter(
      (source) =>
        source.last_check_status ===
          'unchanged' ||
        source.last_check_status ===
          'first_snapshot'
    ).length;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-700" />

              <h2 className="text-xl font-bold text-slate-950">
                Samantha Compliance Monitor
              </h2>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Samantha watches official Federal and state sources for changes.
              Successful unchanged checks count as system verification. Material
              legal changes remain open until the review workflow is completed.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                void testOpenAiRuntime()
              }
              disabled={
                loading ||
                running ||
                testingOpenAi ||
                testingOpenAiImage
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
            >
              {testingOpenAi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}

              {testingOpenAi
                ? 'Testing OpenAI...'
                : 'Test OpenAI Key'}
            </button>

            <button
              type="button"
              onClick={() =>
                void testOpenAiImageRuntime()
              }
              disabled={
                loading ||
                running ||
                testingOpenAi ||
                testingOpenAiImage
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-800 hover:bg-fuchsia-100 disabled:opacity-50"
            >
              {testingOpenAiImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}

              {testingOpenAiImage
                ? 'Testing GPT Image 2...'
                : 'Test GPT Image 2'}
            </button>

            <button
              type="button"
              onClick={() =>
                void loadAuditData()
              }
              disabled={
                loading ||
                running ||
                testingOpenAi ||
                testingOpenAiImage
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? 'animate-spin'
                    : ''
                }`}
              />
              Refresh Monitor
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Controlled Test Jurisdiction
            </span>

            <select
              value={
                jurisdictionCode
              }
              onChange={(event) =>
                setJurisdictionCode(
                  event.target
                    .value as
                    'US-FED' |
                    'US-ID'
                )
              }
              disabled={
                loading ||
                running
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="US-ID">
                Idaho  -  US-ID
              </option>

              <option value="US-FED">
                Federal  -  US-FED
              </option>
            </select>
          </label>

          <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-end">
            <button
              type="button"
              onClick={() =>
                void runOneSourceTest()
              }
              disabled={
                loading ||
                running
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              {running
                ? 'Testing One Source...'
                : 'Run 1-Source Test'}
            </button>

            {latestSourceResult ? (
              <button
                type="button"
                onClick={() =>
                  void runOneSourceTest(
                    latestSourceResult
                      .sourceId,
                    latestSource?.title ||
                      null,
                    latestSourceResult
                      .jurisdictionCode
                  )
                }
                disabled={
                  loading ||
                  running
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                Repeat Last Source
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                void runIdahoBatch()
              }
              disabled={
                loading ||
                running
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              Run Idaho 8-Source Batch
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          Monitoring records hashes and snapshots. Successful unchanged checks count
          toward source verification. Samantha creates review findings only when
          a source changes or a technical problem needs attention.
        </div>
      </div>

      {notice ? (
        <div className="m-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {loading &&
      !data ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Samantha monitor...
        </div>
      ) : null}

      {data ? (
        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Monitored Sources
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {data.sources.length}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Healthy Snapshots
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {healthySourceCount}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Sources Due
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {dueSourceCount}
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Open Findings
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {data.findings.length}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-950">
                  Latest Audit
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Most recent source-monitoring activity.
                </p>
              </div>

              <span
                className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${runStatusClasses(
                  latestRun?.status ||
                    null
                )}`}
              >
                {formatStatus(
                  latestRun?.status ||
                    null
                )}
              </span>
            </div>

            {latestRun ? (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Type
                  </div>

                  <div className="mt-1 font-medium text-slate-900">
                    {formatStatus(
                      latestRun.audit_type
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Checked
                  </div>

                  <div className="mt-1 font-medium text-slate-900">
                    {latestRun.checked_count}
                    {' / '}
                    {latestRun.source_count}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Changed
                  </div>

                  <div className="mt-1 font-medium text-slate-900">
                    {latestRun.changed_count}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Errors
                  </div>

                  <div className="mt-1 font-medium text-slate-900">
                    {latestRun.error_count}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Completed
                  </div>

                  <div className="mt-1 font-medium text-slate-900">
                    {formatDate(
                      latestRun.completed_at
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                No audit has run yet.
              </div>
            )}
          </div>

          <details className="rounded-2xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-4 font-semibold text-slate-950">
              Recent Audit Runs
              {'  -  '}
              {data.runs.length}
            </summary>

            <div className="space-y-2 border-t border-slate-200 p-4">
              {data.runs.length ===
              0 ? (
                <div className="text-sm text-slate-500">
                  No audit runs have been recorded.
                </div>
              ) : (
                data.runs.map(
                  (run) => (
                    <div
                      key={run.id}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-semibold text-slate-950">
                            {formatStatus(
                              run.audit_type
                            )}
                            {'  -  '}
                            {formatStatus(
                              run.trigger_source
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(
                              run.created_at
                            )}
                          </div>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${runStatusClasses(
                            run.status
                          )}`}
                        >
                          {formatStatus(
                            run.status
                          )}
                        </span>
                      </div>

                      <div className="mt-3 text-xs text-slate-600">
                        Checked {run.checked_count}
                        {'  |  '}
                        Changed {run.changed_count}
                        {'  |  '}
                        Unchanged {run.unchanged_count}
                        {'  |  '}
                        Errors {run.error_count}
                      </div>

                      {run.error_message ? (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          {run.error_message}
                        </div>
                      ) : null}
                    </div>
                  )
                )
              )}
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-4 font-semibold text-slate-950">
              Open Samantha Findings
              {'  -  '}
              {data.findings.length}
            </summary>

            <div className="space-y-2 border-t border-slate-200 p-4">
              {data.findings.length ===
              0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  No open audit findings.
                </div>
              ) : (
                data.findings.map(
                  (finding) => (
                    <div
                      key={
                        finding.id
                      }
                      className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                        <div>
                          <div className="font-semibold text-amber-950">
                            {finding.title}
                          </div>

                          {finding.summary ? (
                            <p className="mt-1 text-sm leading-6 text-amber-800">
                              {finding.summary}
                            </p>
                          ) : null}

                          <ComplianceAiFindingDetails
                            finding={
                              finding
                            }
                            onDecision={
                              reviewFinding
                            }
                            workingDecision={
                              workingFindingId?.startsWith(
                                `${finding.id}:`
                              )
                                ? workingFindingId
                                : null
                            }
                          />

                          {[
                            'source_unavailable',
                            'source_moved',
                            'manual_review',
                          ].includes(
                            finding.finding_type
                          ) ? (
                            <button
                              type="button"
                              onClick={() => {
                                const source =
                                  data.sources.find(
                                    (
                                      item
                                    ) =>
                                      item.id ===
                                      finding.source_id
                                  );

                                void runOneSourceTest(
                                  finding.source_id,
                                  source?.title ||
                                    'the unavailable official source',
                                  finding.title.startsWith(
                                    'US-FED:'
                                  )
                                    ? 'US-FED'
                                    : 'US-ID'
                                );
                              }}
                              disabled={
                                running
                              }
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <RefreshCw className="h-4 w-4" />

                              {running
                                ? 'Retrying Source...'
                                : 'Retry This Source'}
                            </button>
                          ) : null}

                          <div className="mt-2 text-xs text-amber-700">
                            {formatStatus(
                              finding.finding_type
                            )}
                            {'  |  '}
                            {formatStatus(
                              finding.severity
                            )}
                            {'  |  '}
                            {formatDate(
                              finding.created_at
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-4 font-semibold text-slate-950">
              Official Source Health
              {'  -  '}
              {data.sources.length}
            </summary>

            <div className="max-h-[600px] space-y-2 overflow-auto border-t border-slate-200 p-4">
              {data.sources.map(
                (source) => (
                  <div
                    key={source.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {source.title}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {formatStatus(
                            source.source_type
                          )}
                          {'  |  '}
                          {formatStatus(
                            source.monitor_frequency
                          )}
                          {' monitoring'}
                        </div>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceStatusClasses(
                          source.last_check_status
                        )}`}
                      >
                        {formatStatus(
                          source.last_check_status
                        )}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div>
                        <strong>
                          Last checked:
                        </strong>
                        {' '}
                        {formatDate(
                          source.last_checked_at
                        )}
                      </div>

                      <div>
                        <strong>
                          Next check:
                        </strong>
                        {' '}
                        {formatDate(
                          source.next_check_at
                        )}
                      </div>

                      <div>
                        <strong>
                          HTTP:
                        </strong>
                        {' '}
                        {source.last_http_status ||
                          ' - '}
                      </div>
                    </div>

                    {source.last_error ? (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                        {source.last_error}
                      </div>
                    ) : null}

                    {source.source_url ? (
                      <a
                        href={
                          source.source_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Open Official Source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                )
              )}
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
