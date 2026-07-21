'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type TabName =
  | 'overview'
  | 'requirements'
  | 'sources'
  | 'checklist'
  | 'approval';

type JurisdictionRow = {
  id: string;
  code: string;
  country_code: string;
  state_code: string | null;
  name: string;
  jurisdiction_type: string;
  launch_status: string;
  marketing_enabled: boolean;
  current_rule_version: string | null;
  review_cycle_months: number;
  last_reviewed_at: string | null;
  next_review_due: string | null;
};

type RuleSetRow = {
  id: string;
  jurisdiction_id: string;
  channel: string;
  material_type: string;
  campaign_type: string;
  name: string;
  version: string;
  status: string;
  is_active: boolean;
  effective_date: string | null;
  expiration_date: string | null;
  next_review_due: string | null;
  approved_at: string | null;
  requires_broker_approval: boolean;
  requires_legal_review: boolean;
  legal_reviewed_at: string | null;
  legal_reviewed_by?: string | null;
  broker_reviewed_at: string | null;
  broker_reviewed_by?: string | null;
  notes?: string | null;
  configuration?: Record<string, unknown> | null;
};

type RequirementRow = {
  id: string;
  rule_set_id: string;
  requirement_key: string;
  label: string;
  description: string | null;
  requirement_type: string;
  severity: string;
  is_required: boolean;
  sort_order: number;
  disclosure_template: string | null;
};

type SourceRow = {
  id: string;
  rule_set_id: string;
  source_type: string;
  title: string;
  source_url: string | null;
  citation: string | null;
  issuing_authority: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
  last_checked_at?: string | null;
  last_check_status?: string | null;
  last_content_hash?: string | null;
  archived_copy_url: string | null;
  notes: string | null;
};

type LinkRow = {
  id: string;
  requirement_id: string;
  source_id: string;
  source_role: string;
  pinpoint_citation: string | null;
  notes: string | null;
};

type ChecklistRow = {
  id: string;
  jurisdiction_id: string;
  item_key: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  evidence_url: string | null;
  official_source_url: string | null;
  rule_reference: string | null;
  notes: string | null;
  automatic_completion?: boolean;
  automation_reason?: string | null;
  is_blocking?: boolean;
};

type Readiness = {
  requirement_count: number;
  source_count: number;
  linked_requirement_count: number;
  unlinked_required_count: number;
  unverified_source_count: number;
  incomplete_checklist_count: number;
  incomplete_preapproval_checklist_count: number;
  legal_review_complete: boolean;
  broker_review_complete: boolean;
  metadata_complete: boolean;
  research_complete: boolean;
  approval_ready: boolean;
  activation_ready: boolean;
};

type ManagerIndex = {
  ok: true;
  jurisdictions: JurisdictionRow[];
  rule_sets: RuleSetRow[];
};

type ManagerDetails = {
  ok: true;
  jurisdiction: JurisdictionRow;
  rule_set: RuleSetRow;
  requirements: RequirementRow[];
  sources: SourceRow[];
  links: LinkRow[];
  checklist: ChecklistRow[];
  readiness: Readiness;
};

type RuleSetForm = {
  name: string;
  version: string;
  channel: string;
  material_type: string;
  campaign_type: string;
  effective_date: string;
  expiration_date: string;
  next_review_due: string;
  requires_legal_review: boolean;
  requires_broker_approval: boolean;
  notes: string;
  configuration: string;
};

type ChecklistDraft = {
  is_completed: boolean;
  evidence_url: string;
  official_source_url: string;
  rule_reference: string;
  notes: string;
};

function sourceIsVerified(
  source: SourceRow
) {
  const manuallyVerified =
    Boolean(
      source
        .last_verified_at &&
      source.verified_by
    );

  const samanthaVerified =
    Boolean(
      source
        .last_checked_at &&
      source
        .last_content_hash &&
      [
        'first_snapshot',
        'unchanged',
        'unavailable',
        'unsupported',
        'error',
      ].includes(
        source
          .last_check_status ||
        ''
      )
    );

  return (
    manuallyVerified ||
    samanthaVerified
  );
}
function formatStatus(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function statusClasses(
  status: string,
  active = false
) {
  if (active) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'in_review') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (
    status === 'rejected' ||
    status === 'retired' ||
    status === 'expired'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function formFromRuleSet(
  ruleSet: RuleSetRow
): RuleSetForm {
  return {
    name: ruleSet.name || '',
    version: ruleSet.version || '',
    channel: ruleSet.channel || 'all',
    material_type:
      ruleSet.material_type || 'all',
    campaign_type:
      ruleSet.campaign_type || 'all',
    effective_date:
      ruleSet.effective_date || '',
    expiration_date:
      ruleSet.expiration_date || '',
    next_review_due:
      ruleSet.next_review_due || '',
    requires_legal_review:
      Boolean(
        ruleSet.requires_legal_review
      ),
    requires_broker_approval:
      Boolean(
        ruleSet.requires_broker_approval
      ),
    notes: ruleSet.notes || '',
    configuration: JSON.stringify(
      ruleSet.configuration || {},
      null,
      2
    ),
  };
}

export default function ComplianceManagerPanel() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    working,
    setWorking,
  ] = useState(false);

  const [
    index,
    setIndex,
  ] =
    useState<ManagerIndex | null>(
      null
    );

  const [
    details,
    setDetails,
  ] =
    useState<ManagerDetails | null>(
      null
    );

  const [
    selectedJurisdictionId,
    setSelectedJurisdictionId,
  ] = useState('');

  const [
    selectedRuleSetId,
    setSelectedRuleSetId,
  ] = useState('');

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabName>(
      'overview'
    );

  const [
    requirementSearch,
    setRequirementSearch,
  ] = useState('');

  const [
    sourceSearch,
    setSourceSearch,
  ] = useState('');

  const [
    ruleSetForm,
    setRuleSetForm,
  ] =
    useState<RuleSetForm | null>(
      null
    );

  const [
    checklistDrafts,
    setChecklistDrafts,
  ] = useState<
    Record<
      string,
      ChecklistDraft
    >
  >({});

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

  async function getAccessToken() {
    const {
      data,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !data.session
    ) {
      throw new Error(
        sessionError?.message ||
          'Your CRM session expired.'
      );
    }

    return data.session.access_token;
  }

  async function managerFetch<T>(
    url: string,
    init?: RequestInit
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
            ...(init?.headers || {}),
          },
          cache: 'no-store',
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result?.ok
    ) {
      throw new Error(
        result?.error ||
          'The compliance request failed.'
      );
    }

    return result as T;
  }

  function chooseRuleSet(
    managerIndex: ManagerIndex,
    jurisdictionId: string
  ) {
    const ruleSets =
      managerIndex.rule_sets.filter(
        (ruleSet) =>
          ruleSet.jurisdiction_id ===
          jurisdictionId
      );

    return (
      ruleSets.find(
        (ruleSet) =>
          ruleSet.is_active
      ) ||
      ruleSets.find(
        (ruleSet) =>
          ruleSet.status ===
          'approved'
      ) ||
      ruleSets[0] ||
      null
    );
  }

  function applyDetails(
    result: ManagerDetails
  ) {
    setDetails(result);

    setSelectedJurisdictionId(
      result.jurisdiction.id
    );

    setSelectedRuleSetId(
      result.rule_set.id
    );

    setRuleSetForm(
      formFromRuleSet(
        result.rule_set
      )
    );

    const drafts:
      Record<
        string,
        ChecklistDraft
      > = {};

    for (
      const item of
        result.checklist
    ) {
      drafts[item.id] = {
        is_completed:
          Boolean(
            item.is_completed
          ),
        evidence_url:
          item.evidence_url || '',
        official_source_url:
          item.official_source_url ||
          '',
        rule_reference:
          item.rule_reference || '',
        notes: item.notes || '',
      };
    }

    setChecklistDrafts(
      drafts
    );
  }

  async function loadDetails(
    ruleSetId: string
  ) {
    const result =
      await managerFetch<ManagerDetails>(
        `/api/compliance/manager?ruleSetId=${encodeURIComponent(
          ruleSetId
        )}`
      );

    applyDetails(result);
  }

  async function loadManager() {
    try {
      setLoading(true);
      setError(null);

      const result =
        await managerFetch<ManagerIndex>(
          '/api/compliance/manager'
        );

      setIndex(result);

      const defaultJurisdiction =
        result.jurisdictions.find(
          (jurisdiction) =>
            jurisdiction.code ===
            'US-ID'
        ) ||
        result.jurisdictions.find(
          (jurisdiction) =>
            jurisdiction.code ===
            'US-FED'
        ) ||
        result.jurisdictions[0];

      if (!defaultJurisdiction) {
        setDetails(null);
        return;
      }

      const ruleSet =
        chooseRuleSet(
          result,
          defaultJurisdiction.id
        );

      setSelectedJurisdictionId(
        defaultJurisdiction.id
      );

      if (!ruleSet) {
        setDetails(null);
        return;
      }

      setSelectedRuleSetId(
        ruleSet.id
      );

      await loadDetails(
        ruleSet.id
      );
    } catch (loadError: any) {
      console.error(
        'Compliance manager load failed:',
        loadError
      );

      setError(
        loadError?.message ||
          'Could not load the compliance manager.'
      );

      setIndex(null);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadManager();
  }, []);

  async function selectJurisdiction(
    jurisdictionId: string
  ) {
    if (!index) return;

    setSelectedJurisdictionId(
      jurisdictionId
    );

    setActiveTab(
      'overview'
    );

    setRequirementSearch('');
    setSourceSearch('');
    setNotice(null);
    setError(null);

    const ruleSet =
      chooseRuleSet(
        index,
        jurisdictionId
      );

    if (!ruleSet) {
      setSelectedRuleSetId('');
      setDetails(null);
      return;
    }

    try {
      setLoading(true);

      setSelectedRuleSetId(
        ruleSet.id
      );

      await loadDetails(
        ruleSet.id
      );
    } catch (loadError: any) {
      setError(
        loadError?.message ||
          'Could not load the selected jurisdiction.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectRuleSet(
    ruleSetId: string
  ) {
    try {
      setLoading(true);
      setError(null);

      setSelectedRuleSetId(
        ruleSetId
      );

      await loadDetails(
        ruleSetId
      );
    } catch (loadError: any) {
      setError(
        loadError?.message ||
          'Could not load the selected version.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    payload:
      Record<string, unknown>,
    successMessage: string
  ) {
    try {
      setWorking(true);
      setError(null);
      setNotice(null);

      const result =
        await managerFetch<ManagerDetails>(
          '/api/compliance/manager',
          {
            method: 'POST',
            body: JSON.stringify(
              payload
            ),
          }
        );

      applyDetails(result);

      const refreshedIndex =
        await managerFetch<ManagerIndex>(
          '/api/compliance/manager'
        );

      setIndex(
        refreshedIndex
      );

      setNotice(
        successMessage
      );
    } catch (actionError: any) {
      setError(
        actionError?.message ||
          'Could not complete the compliance action.'
      );
    } finally {
      setWorking(false);
    }
  }

  const selectedRuleSets =
    useMemo(
      () =>
        (
          index?.rule_sets || []
        ).filter(
          (ruleSet) =>
            ruleSet.jurisdiction_id ===
            selectedJurisdictionId
        ),
      [
        index,
        selectedJurisdictionId,
      ]
    );

  const sourceById =
    useMemo(() => {
      const map =
        new Map<
          string,
          SourceRow
        >();

      for (
        const source of
          details?.sources || []
      ) {
        map.set(
          source.id,
          source
        );
      }

      return map;
    }, [details]);

  const filteredRequirements =
    useMemo(() => {
      const search =
        requirementSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return (
          details?.requirements ||
          []
        );
      }

      return (
        details?.requirements ||
        []
      ).filter(
        (requirement) =>
          requirement.label
            .toLowerCase()
            .includes(search) ||
          requirement.requirement_key
            .toLowerCase()
            .includes(search) ||
          String(
            requirement.description ||
              ''
          )
            .toLowerCase()
            .includes(search)
      );
    }, [
      details,
      requirementSearch,
    ]);

  const filteredSources =
    useMemo(() => {
      const search =
        sourceSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return (
          details?.sources ||
          []
        );
      }

      return (
        details?.sources ||
        []
      ).filter(
        (source) =>
          source.title
            .toLowerCase()
            .includes(search) ||
          source.source_type
            .toLowerCase()
            .includes(search) ||
          String(
            source.issuing_authority ||
              ''
          )
            .toLowerCase()
            .includes(search)
      );
    }, [
      details,
      sourceSearch,
    ]);

  const stateTracker =
    useMemo(() => {
      if (!index) return [];

      return index.jurisdictions
        .filter(
          (jurisdiction) =>
            jurisdiction
              .jurisdiction_type ===
            'state'
        )
        .map(
          (jurisdiction) => ({
            jurisdiction,
            ruleSet:
              chooseRuleSet(
                index,
                jurisdiction.id
              ),
          })
        )
        .sort(
          (left, right) =>
            left.jurisdiction.name
              .localeCompare(
                right.jurisdiction
                  .name
              )
        );
    }, [index]);

  const activeStateCount =
    stateTracker.filter(
      ({ jurisdiction }) =>
        jurisdiction
          .marketing_enabled
    ).length;

  const approvedStateCount =
    stateTracker.filter(
      ({ ruleSet }) =>
        ruleSet?.status ===
        'approved'
    ).length;

  const editable =
    Boolean(
      details &&
      !details.rule_set
        .is_active &&
      ![
        'approved',
        'expired',
        'retired',
      ].includes(
        details.rule_set.status
      )
    );

  const completionSteps =
    details
      ? [
          {
            label:
              'Requirements documented',
            description:
              `${details.readiness.requirement_count} requirements entered`,
            complete:
              details.readiness
                .requirement_count >
              0,
            tab:
              'requirements' as TabName,
          },
          {
            label:
              'Required citations linked',
            description:
              details.readiness
                .unlinked_required_count ===
              0
                ? 'Every required rule has a source'
                : `${details.readiness.unlinked_required_count} required citations missing`,
            complete:
              details.readiness
                .requirement_count >
                0 &&
              details.readiness
                .unlinked_required_count ===
                0,
            tab:
              'requirements' as TabName,
          },
          {
            label:
              'Official sources verified',
            description:
              `${details.readiness.source_count - details.readiness.unverified_source_count} of ${details.readiness.source_count} verified`,
            complete:
              details.readiness
                .source_count >
                0 &&
              details.readiness
                .unverified_source_count ===
                0,
            tab:
              'sources' as TabName,
          },
          {
            label:
              'Effective and review dates set',
            description:
              details.readiness
                .metadata_complete
                ? 'Required dates are recorded'
                : 'Effective date and next review date are required',
            complete:
              details.readiness
                .metadata_complete,
            tab:
              'approval' as TabName,
          },
          {
            label:
              'Launch checklist completed',
            description:
              details.checklist
                .length === 0
                ? 'No separate checklist is configured'
                : details.readiness
                    .incomplete_checklist_count ===
                  0
                ? 'All required checklist items are complete'
                : `${details.readiness.incomplete_checklist_count} checklist items remain`,
            complete:
              details.readiness
                .incomplete_checklist_count ===
              0,
            tab:
              'checklist' as TabName,
          },
          {
            label:
              'Legal review completed',
            description:
              details.rule_set
                .requires_legal_review
                ? details.readiness
                    .legal_review_complete
                  ? 'Legal review is recorded'
                  : 'Legal review is required'
                : 'Legal review is not required',
            complete:
              details.readiness
                .legal_review_complete,
            tab:
              'approval' as TabName,
          },
          {
            label:
              'Broker review completed',
            description:
              details.rule_set
                .requires_broker_approval
                ? details.readiness
                    .broker_review_complete
                  ? 'Broker review is recorded'
                  : 'Responsible-broker review is required'
                : 'Broker review is not required',
            complete:
              details.readiness
                .broker_review_complete,
            tab:
              'approval' as TabName,
          },
          {
            label:
              'Platform approval completed',
            description:
              details.rule_set
                .status ===
                'approved' ||
              details.rule_set
                .is_active
                ? 'The package is approved'
                : 'Platform approval is still pending',
            complete:
              details.rule_set
                .status ===
                'approved' ||
              details.rule_set
                .is_active,
            tab:
              'approval' as TabName,
          },
          {
            label:
              'Package activated',
            description:
              details.rule_set
                .is_active
                ? 'Organizations may use this package'
                : 'Marketing remains locked',
            complete:
              details.rule_set
                .is_active,
            tab:
              'approval' as TabName,
          },
        ]
      : [];

  const completedSteps =
    completionSteps.filter(
      (step) =>
        step.complete
    ).length;

  const nextStep =
    completionSteps.find(
      (step) =>
        !step.complete
    ) || null;

  async function saveMetadata() {
    if (
      !details ||
      !ruleSetForm
    ) {
      return;
    }

    let configuration:
      Record<string, unknown>;

    try {
      configuration =
        JSON.parse(
          ruleSetForm.configuration ||
            '{}'
        );
    } catch {
      setError(
        'Engine configuration must contain valid JSON.'
      );
      return;
    }

    await runAction(
      {
        action:
          'save_rule_set',
        rule_set_id:
          details.rule_set.id,
        ...ruleSetForm,
        configuration,
      },
      'Rule-pack setup saved.'
    );
  }

  async function toggleSource(
    source: SourceRow
  ) {
    const verified =
      sourceIsVerified(
        source
      );

    await runAction(
      {
        action:
          'save_source',
        rule_set_id:
          source.rule_set_id,
        source_id:
          source.id,
        source_type:
          source.source_type,
        title:
          source.title,
        source_url:
          source.source_url,
        citation:
          source.citation,
        issuing_authority:
          source.issuing_authority,
        effective_date:
          source.effective_date,
        expiration_date:
          source.expiration_date,
        archived_copy_url:
          source.archived_copy_url,
        notes:
          source.notes,
        verified:
          !verified,
      },
      verified
        ? 'Source verification removed.'
        : 'Official source verified.'
    );
  }

  async function saveChecklistItem(
    item: ChecklistRow
  ) {
    if (!details) return;

    const draft =
      checklistDrafts[item.id];

    if (!draft) return;

    await runAction(
      {
        action:
          'save_checklist_item',
        rule_set_id:
          details.rule_set.id,
        checklist_item_id:
          item.id,
        ...draft,
      },
      'Checklist item saved.'
    );
  }

  function workflowAction(
    action: string,
    message: string,
    extra:
      Record<string, unknown> = {}
  ) {
    if (!details) return;

    void runAction(
      {
        action,
        rule_set_id:
          details.rule_set.id,
        ...extra,
      },
      message
    );
  }

  function finishFederalAndIdaho() {
    if (
      !details
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          'Finish and activate the routine Federal and Idaho compliance baselines?',
          '',
          'Samantha will:',
          '- record the effective and review dates',
          '- use the routine automation policy',
          '- approve and activate both packages',
          '- complete supported checklist items',
          '',
          'The process stops if a material or uncertain legal-change finding is open.',
        ].join(
          '\n'
        )
      );

    if (!confirmed) {
      return;
    }

    workflowAction(
      'finalize_pilot',
      'Federal and Idaho routine compliance baselines are approved and active.'
    );
  }
  function updateForm(
    field: keyof RuleSetForm,
    value:
      string | boolean
  ) {
    setRuleSetForm(
      (current) =>
        current
          ? {
              ...current,
              [field]: value,
            }
          : current
    );
  }

  const tabs: Array<{
    id: TabName;
    label: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
    },
    {
      id: 'requirements',
      label: 'Requirements',
    },
    {
      id: 'sources',
      label: 'Official Sources',
    },
    {
      id: 'checklist',
      label: 'Checklist',
    },
    {
      id: 'approval',
      label: 'Approval',
    },
  ];

  if (
    loading &&
    !index
  ) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading compliance manager...
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-700" />

              <h2 className="text-xl font-bold text-slate-950">
                State Compliance Manager
              </h2>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Select Federal or a state, see exactly what remains, and work
              through one manageable checklist.
            </p>
          </div>

          <button
            type="button"
            onClick={loadManager}
            disabled={
              loading ||
              working
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
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Federal or State
            </span>

            <select
              value={
                selectedJurisdictionId
              }
              onChange={(event) =>
                void selectJurisdiction(
                  event.target.value
                )
              }
              disabled={
                loading ||
                working
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {(index?.jurisdictions ||
                []
              ).map(
                (jurisdiction) => (
                  <option
                    key={
                      jurisdiction.id
                    }
                    value={
                      jurisdiction.id
                    }
                  >
                    {jurisdiction.name}
                    {'  -  '}
                    {jurisdiction.code}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rule Version
            </span>

            <select
              value={
                selectedRuleSetId
              }
              onChange={(event) =>
                void selectRuleSet(
                  event.target.value
                )
              }
              disabled={
                loading ||
                working ||
                selectedRuleSets.length ===
                  0
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {selectedRuleSets.map(
                (ruleSet) => (
                  <option
                    key={
                      ruleSet.id
                    }
                    value={
                      ruleSet.id
                    }
                  >
                    {ruleSet.version}
                    {'  -  '}
                    {formatStatus(
                      ruleSet.status
                    )}
                    {ruleSet.is_active
                      ? '  -  ACTIVE'
                      : ''}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
              <div className="text-xs font-semibold uppercase text-blue-700">
                States Active
              </div>
              <div className="mt-1 text-xl font-bold text-slate-950">
                {activeStateCount} / 50
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2">
              <div className="text-xs font-semibold uppercase text-emerald-700">
                Approved
              </div>
              <div className="mt-1 text-xl font-bold text-slate-950">
                {approvedStateCount}
              </div>
            </div>
          </div>
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

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-500">
          Loading selected package...
        </div>
      ) : null}

      {!loading &&
      !details ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No rule package exists for this jurisdiction.
        </div>
      ) : null}

      {!loading &&
      details ? (
        <>
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Selected Package
                </div>

                <h3 className="mt-1 text-2xl font-bold text-slate-950">
                  {details.jurisdiction.name}
                </h3>

                <div className="mt-1 text-sm text-slate-500">
                  {details.jurisdiction.code}
                  {'  |  '}
                  {details.rule_set.version}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                    details.rule_set.status,
                    details.rule_set.is_active
                  )}`}
                >
                  {details.rule_set.is_active
                    ? 'Active'
                    : formatStatus(
                        details.rule_set.status
                      )}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    completedSteps ===
                    completionSteps.length
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {completedSteps}
                  {' / '}
                  {completionSteps.length}
                  {' steps complete'}
                </span>
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border p-4 ${
                nextStep
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {nextStep
                  ? 'Next Action'
                  : 'Package Complete'}
              </div>

              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold text-slate-950">
                    {nextStep
                      ? nextStep.label
                      : `${details.jurisdiction.name} is approved and active`}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {nextStep
                      ? nextStep.description
                      : 'No additional launch steps remain.'}
                  </div>
                </div>

                {nextStep ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        nextStep.tab
                      )
                    }
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Go to Step
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-5 py-3">
            {tabs.map(
              (tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
                    activeTab ===
                    tab.id
                      ? 'bg-blue-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              )
            )}
          </div>

          <div className="p-5">
            {activeTab ===
            'overview' ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    What Needs to Be Done?
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Complete these steps from top to bottom. Green means done.
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {completionSteps.map(
                    (step) => (
                      <button
                        key={
                          step.label
                        }
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            step.tab
                          )
                        }
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"
                      >
                        {step.complete ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                        )}

                        <div>
                          <div className="font-semibold text-slate-950">
                            {step.label}
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            {step.description}
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>

                <details className="rounded-2xl border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-5 py-4 font-semibold text-slate-900">
                    View All 50 States
                    {'  -  '}
                    {activeStateCount} Active
                  </summary>

                  <div className="max-h-[500px] overflow-auto border-t border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-4 py-3">
                            State
                          </th>
                          <th className="px-4 py-3">
                            Status
                          </th>
                          <th className="px-4 py-3">
                            Version
                          </th>
                          <th className="px-4 py-3">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {stateTracker.map(
                          ({
                            jurisdiction,
                            ruleSet,
                          }) => (
                            <tr
                              key={
                                jurisdiction.id
                              }
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {jurisdiction.name}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                    ruleSet?.status ||
                                      'draft',
                                    Boolean(
                                      ruleSet?.is_active
                                    )
                                  )}`}
                                >
                                  {ruleSet?.is_active
                                    ? 'Active'
                                    : ruleSet
                                    ? formatStatus(
                                        ruleSet.status
                                      )
                                    : 'Not Started'}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-slate-500">
                                {ruleSet?.version ||
                                  'None'}
                              </td>

                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void selectJurisdiction(
                                      jurisdiction.id
                                    )
                                  }
                                  className="font-semibold text-blue-700 hover:underline"
                                >
                                  Open
                                </button>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            ) : null}

            {activeTab ===
            'requirements' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">
                      Requirements
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {details.requirements.length} documented requirements.
                      Open only the rule you need.
                    </p>
                  </div>

                  <label className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

                    <input
                      value={
                        requirementSearch
                      }
                      onChange={(event) =>
                        setRequirementSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search requirements"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm md:w-72"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {filteredRequirements.map(
                    (requirement) => {
                      const links =
                        details.links.filter(
                          (link) =>
                            link.requirement_id ===
                            requirement.id
                        );

                      return (
                        <details
                          key={
                            requirement.id
                          }
                          className="rounded-xl border border-slate-200 bg-white"
                        >
                          <summary className="cursor-pointer list-none px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="font-semibold text-slate-950">
                                  {requirement.label}
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {requirement.requirement_type}
                                  {'  |  '}
                                  {requirement.severity}
                                </div>
                              </div>

                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                  links.length >
                                  0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                                }`}
                              >
                                {links.length}
                                {' sources'}
                              </span>
                            </div>
                          </summary>

                          <div className="border-t border-slate-200 px-4 py-4">
                            <div className="text-xs font-mono text-slate-500">
                              {requirement.requirement_key}
                            </div>

                            {requirement.description ? (
                              <p className="mt-3 text-sm leading-6 text-slate-700">
                                {requirement.description}
                              </p>
                            ) : null}

                            <div className="mt-4 space-y-2">
                              {links.map(
                                (link) => {
                                  const source =
                                    sourceById.get(
                                      link.source_id
                                    );

                                  return (
                                    <div
                                      key={
                                        link.id
                                      }
                                      className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                                    >
                                      <strong>
                                        {link.source_role}
                                      </strong>
                                      {'  -  '}
                                      {source?.title ||
                                        'Unknown source'}
                                      {link.pinpoint_citation
                                        ? `  -  ${link.pinpoint_citation}`
                                        : ''}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        </details>
                      );
                    }
                  )}
                </div>
              </div>
            ) : null}

            {activeTab ===
            'sources' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">
                      Official Sources
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Verify sources only after opening and reviewing the official page.
                    </p>
                  </div>

                  <label className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

                    <input
                      value={
                        sourceSearch
                      }
                      onChange={(event) =>
                        setSourceSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search sources"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm md:w-72"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {filteredSources.map(
                    (source) => {
                      const verified =
                        sourceIsVerified(
                          source
                        );

                      return (
                        <details
                          key={
                            source.id
                          }
                          className="rounded-xl border border-slate-200 bg-white"
                        >
                          <summary className="cursor-pointer list-none px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="font-semibold text-slate-950">
                                  {source.title}
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {source.source_type}
                                  {source.issuing_authority
                                    ? `  |  ${source.issuing_authority}`
                                    : ''}
                                </div>
                              </div>

                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                  verified
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                }`}
                              >
                                {verified
                                  ? 'Verified'
                                  : 'Needs Review'}
                              </span>
                            </div>
                          </summary>

                          <div className="border-t border-slate-200 px-4 py-4">
                            {source.citation ? (
                              <p className="text-sm leading-6 text-slate-700">
                                {source.citation}
                              </p>
                            ) : null}

                            <div className="mt-4 flex flex-wrap gap-2">
                              {source.source_url ? (
                                <a
                                  href={
                                    source.source_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
                                >
                                  Open Official Source
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : null}

                              {editable ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleSource(
                                      source
                                    )
                                  }
                                  disabled={
                                    working
                                  }
                                  className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                                    verified
                                      ? 'border border-red-200 bg-red-50 text-red-700'
                                      : 'bg-emerald-700 text-white'
                                  }`}
                                >
                                  {verified
                                    ? 'Remove Verification'
                                    : 'Mark Verified'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </details>
                      );
                    }
                  )}
                </div>
              </div>
            ) : null}

            {activeTab ===
            'checklist' ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Launch Checklist
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Save evidence and notes with each completed review item.
                  </p>
                </div>

                {details.checklist.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No separate launch checklist is configured for this package.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {details.checklist.map(
                      (item) => {
                        const draft =
                          checklistDrafts[
                            item.id
                          ];

                        if (!draft) {
                          return null;
                        }

                        const automatic =
                          item
                            .automatic_completion ===
                            true ||
                          item.item_key ===
                            'platform_admin_approval_completed';

                        return (
                          <details
                            key={
                              item.id
                            }
                            className="rounded-xl border border-slate-200 bg-white"
                          >
                            <summary className="cursor-pointer list-none px-4 py-3">
                              <div className="flex items-center gap-3">
                                {draft.is_completed ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                ) : (
                                  <Circle className="h-5 w-5 text-amber-500" />
                                )}

                                <div>
                                  <div className="font-semibold text-slate-950">
                                    {item.label}
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    {draft.is_completed
                                      ? 'Complete'
                                      : item
                                          .is_blocking ===
                                          false
                                      ? 'Handled separately - not blocking'
                                      : automatic
                                      ? 'Waiting for Samantha'
                                      : 'Pending'}
                                  </div>
                                </div>
                              </div>
                            </summary>

                            <div className="border-t border-slate-200 p-4">
                              {item.description ? (
                                <p className="text-sm leading-6 text-slate-600">
                                  {item.description}
                                </p>
                              ) : null}

                              {automatic ? (
                                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                                  {item
                                    .automation_reason ||
                                    'This item is managed automatically by the compliance workflow.'}
                                </div>
                              ) : (
                                <>
                                  <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={
                                        draft.is_completed
                                      }
                                      onChange={(event) =>
                                        setChecklistDrafts(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            [item.id]: {
                                              ...current[
                                                item.id
                                              ],
                                              is_completed:
                                                event.target
                                                  .checked,
                                            },
                                          })
                                        )
                                      }
                                    />
                                    Mark this item complete
                                  </label>

                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    <input
                                      value={
                                        draft.official_source_url
                                      }
                                      onChange={(event) =>
                                        setChecklistDrafts(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            [item.id]: {
                                              ...current[
                                                item.id
                                              ],
                                              official_source_url:
                                                event.target
                                                  .value,
                                            },
                                          })
                                        )
                                      }
                                      placeholder="Official source URL"
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />

                                    <input
                                      value={
                                        draft.rule_reference
                                      }
                                      onChange={(event) =>
                                        setChecklistDrafts(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            [item.id]: {
                                              ...current[
                                                item.id
                                              ],
                                              rule_reference:
                                                event.target
                                                  .value,
                                            },
                                          })
                                        )
                                      }
                                      placeholder="Rule reference"
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />

                                    <input
                                      value={
                                        draft.evidence_url
                                      }
                                      onChange={(event) =>
                                        setChecklistDrafts(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            [item.id]: {
                                              ...current[
                                                item.id
                                              ],
                                              evidence_url:
                                                event.target
                                                  .value,
                                            },
                                          })
                                        )
                                      }
                                      placeholder="Evidence URL"
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />

                                    <input
                                      value={
                                        draft.notes
                                      }
                                      onChange={(event) =>
                                        setChecklistDrafts(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            [item.id]: {
                                              ...current[
                                                item.id
                                              ],
                                              notes:
                                                event.target
                                                  .value,
                                            },
                                          })
                                        )
                                      }
                                      placeholder="Review notes"
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void saveChecklistItem(
                                        item
                                      )
                                    }
                                    disabled={
                                      working
                                    }
                                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                  >
                                    <Save className="h-4 w-4" />
                                    Save Item
                                  </button>
                                </>
                              )}
                            </div>
                          </details>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab ===
              'approval' &&
            ruleSetForm ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Setup, Review and Approval
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Dates, required reviews, approval and activation are managed here.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <h4 className="font-bold text-slate-950">
                    Rule-Pack Setup
                  </h4>

                  {!editable ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      This version is locked because it is approved, active,
                      expired or retired.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Rule-Pack Name
                      </span>
                      <input
                        value={
                          ruleSetForm.name
                        }
                        disabled={
                          !editable
                        }
                        onChange={(event) =>
                          updateForm(
                            'name',
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Version
                      </span>
                      <input
                        value={
                          ruleSetForm.version
                        }
                        disabled={
                          !editable
                        }
                        onChange={(event) =>
                          updateForm(
                            'version',
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Effective Date
                      </span>
                      <input
                        type="date"
                        value={
                          ruleSetForm.effective_date
                        }
                        disabled={
                          !editable
                        }
                        onChange={(event) =>
                          updateForm(
                            'effective_date',
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Next Review Due
                      </span>
                      <input
                        type="date"
                        value={
                          ruleSetForm.next_review_due
                        }
                        disabled={
                          !editable
                        }
                        onChange={(event) =>
                          updateForm(
                            'next_review_due',
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Expiration Date
                      </span>
                      <input
                        type="date"
                        value={
                          ruleSetForm.expiration_date
                        }
                        disabled={
                          !editable
                        }
                        onChange={(event) =>
                          updateForm(
                            'expiration_date',
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </label>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={
                            ruleSetForm.requires_legal_review
                          }
                          disabled={
                            !editable
                          }
                          onChange={(event) =>
                            updateForm(
                              'requires_legal_review',
                              event.target.checked
                            )
                          }
                        />
                        Require legal review
                      </label>

                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={
                            ruleSetForm.requires_broker_approval
                          }
                          disabled={
                            !editable
                          }
                          onChange={(event) =>
                            updateForm(
                              'requires_broker_approval',
                              event.target.checked
                            )
                          }
                        />
                        Require responsible-broker review
                      </label>
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Notes
                    </span>
                    <textarea
                      value={
                        ruleSetForm.notes
                      }
                      disabled={
                        !editable
                      }
                      rows={3}
                      onChange={(event) =>
                        updateForm(
                          'notes',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>

                  {editable ? (
                    <button
                      type="button"
                      onClick={() =>
                        void saveMetadata()
                      }
                      disabled={
                        working
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save Setup
                    </button>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <h4 className="font-bold text-blue-950">
                    Review and Activation
                  </h4>

                  {details
                    .jurisdiction
                    .code ===
                    'US-ID' &&
                  !details
                    .rule_set
                    .is_active ? (
                    <div className="mt-4 rounded-2xl border border-emerald-300 bg-white p-4">
                      <div className="font-semibold text-emerald-950">
                        Samantha Routine Setup
                      </div>

                      <p className="mt-1 text-sm leading-6 text-emerald-800">
                        Finish the routine Federal and Idaho baselines in one
                        controlled action. Material or uncertain legal changes
                        remain blocked for review.
                      </p>

                      <button
                        type="button"
                        onClick={
                          finishFederalAndIdaho
                        }
                        disabled={
                          working
                        }
                        className="mt-3 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {working
                          ? 'Samantha Is Finishing Setup...'
                          : 'Finish Federal + Idaho Setup'}
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      'draft',
                      'rejected',
                    ].includes(
                      details.rule_set.status
                    ) ? (
                      <button
                        type="button"
                        onClick={() =>
                          workflowAction(
                            'submit_review',
                            'Rule pack submitted for review.'
                          )
                        }
                        disabled={
                          working ||
                          !details.readiness
                            .research_complete
                        }
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Submit for Review
                      </button>
                    ) : null}

                    {details.rule_set
                      .status ===
                    'in_review' ? (
                      <>
                        {details.rule_set
                          .requires_legal_review ? (
                          <button
                            type="button"
                            onClick={() =>
                              workflowAction(
                                'record_legal_review',
                                details.readiness
                                  .legal_review_complete
                                  ? 'Legal review removed.'
                                  : 'Legal review recorded.',
                                {
                                  completed:
                                    !details.readiness
                                      .legal_review_complete,
                                }
                              )
                            }
                            disabled={
                              working
                            }
                            className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700"
                          >
                            {details.readiness
                              .legal_review_complete
                              ? 'Remove Legal Review'
                              : 'Record Legal Review'}
                          </button>
                        ) : null}

                        {details.rule_set
                          .requires_broker_approval ? (
                          <button
                            type="button"
                            onClick={() =>
                              workflowAction(
                                'record_broker_review',
                                details.readiness
                                  .broker_review_complete
                                  ? 'Broker review removed.'
                                  : 'Broker review recorded.',
                                {
                                  completed:
                                    !details.readiness
                                      .broker_review_complete,
                                }
                              )
                            }
                            disabled={
                              working
                            }
                            className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700"
                          >
                            {details.readiness
                              .broker_review_complete
                              ? 'Remove Broker Review'
                              : 'Record Broker Review'}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() =>
                            workflowAction(
                              'approve',
                              'Rule pack approved. Activation remains separate.'
                            )
                          }
                          disabled={
                            working ||
                            !details.readiness
                              .approval_ready
                          }
                          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Approve Package
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            workflowAction(
                              'reject',
                              'Rule pack returned for corrections.'
                            )
                          }
                          disabled={
                            working
                          }
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700"
                        >
                          Return for Corrections
                        </button>
                      </>
                    ) : null}

                    {details.rule_set
                      .status ===
                      'approved' &&
                    !details.rule_set
                      .is_active ? (
                      <button
                        type="button"
                        onClick={() =>
                          workflowAction(
                            'activate',
                            'Rule pack activated.'
                          )
                        }
                        disabled={
                          working ||
                          !details.readiness
                            .activation_ready
                        }
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Activate Package
                      </button>
                    ) : null}

                    {details.rule_set
                      .is_active ? (
                      <button
                        type="button"
                        onClick={() =>
                          workflowAction(
                            'deactivate',
                            'Rule pack deactivated.'
                          )
                        }
                        disabled={
                          working
                        }
                        className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700"
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </div>

                <details className="rounded-2xl border border-red-200 bg-red-50">
                  <summary className="cursor-pointer px-5 py-4 font-semibold text-red-800">
                    Danger Zone
                  </summary>

                  <div className="border-t border-red-200 p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-red-700" />

                      <div>
                        <div className="font-semibold text-red-900">
                          Retire this version
                        </div>

                        <p className="mt-1 text-sm text-red-700">
                          Retirement removes the version from future use. It
                          should only be used when the package is permanently obsolete.
                        </p>

                        {![
                          'retired',
                          'expired',
                        ].includes(
                          details.rule_set.status
                        ) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const confirmed =
                                window.confirm(
                                  `Retire ${details.rule_set.version}? This should only be used when the version is permanently obsolete.`
                                );

                              if (
                                confirmed
                              ) {
                                workflowAction(
                                  'retire',
                                  'Rule pack retired.'
                                );
                              }
                            }}
                            disabled={
                              working
                            }
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                            Retire Version
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
