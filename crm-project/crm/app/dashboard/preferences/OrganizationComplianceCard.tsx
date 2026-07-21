'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Building2,
  Camera,
  CheckCircle2,
  Loader2,
  Save,
  Scale,
  ShieldCheck,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type OrganizationCompliance = {
  id: string;
  name: string | null;
  org_display: string | null;
  market_name: string | null;
  brokerage_name: string | null;

  marketing_licensed_business_name:
    | string
    | null;

  marketing_broker_license_number:
    | string
    | null;

  marketing_license_state:
    | string
    | null;

  marketing_privacy_policy_url:
    | string
    | null;

  marketing_mls_attribution:
    | string
    | null;

  marketing_standard_disclaimer:
    | string
    | null;

  marketing_advertisement_label:
    | string
    | null;

  brokerage_logo_url:
    | string
    | null;
};

type JurisdictionOption = {
  id: string;
  code: string;
  state_code: string | null;
  name: string;
  launch_status: string;
  marketing_enabled: boolean;
  current_rule_version: string | null;
};

type CompliancePackageItem = {
  jurisdiction_id: string;
  code: string;
  state_code: string | null;
  name: string;
  launch_status: string;
  marketing_enabled: boolean;
  current_rule_version: string | null;

  rule_set: {
    id: string;
    name: string;
    version: string;
    status: string;
    is_active: boolean;
    approved_at: string | null;
  } | null;
};

type CompliancePackage = {
  federal:
    | CompliancePackageItem
    | null;

  state:
    | CompliancePackageItem
    | null;
};

const US_TIME_ZONE_OPTIONS = [
  {
    value: 'America/New_York',
    label: 'Eastern Time',
  },
  {
    value: 'America/Detroit',
    label: 'Eastern Time — Michigan',
  },
  {
    value: 'America/Indiana/Indianapolis',
    label: 'Eastern Time — Indiana',
  },
  {
    value: 'America/Kentucky/Louisville',
    label: 'Eastern Time — Kentucky',
  },
  {
    value: 'America/Chicago',
    label: 'Central Time',
  },
  {
    value: 'America/Menominee',
    label: 'Central Time — Michigan',
  },
  {
    value: 'America/Denver',
    label: 'Mountain Time',
  },
  {
    value: 'America/Boise',
    label: 'Mountain Time — Idaho',
  },
  {
    value: 'America/Phoenix',
    label: 'Arizona Time — No DST',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Pacific Time',
  },
  {
    value: 'America/Anchorage',
    label: 'Alaska Time',
  },
  {
    value: 'America/Adak',
    label: 'Aleutian Time',
  },
  {
    value: 'America/Juneau',
    label: 'Alaska Time — Juneau',
  },
  {
    value: 'America/Nome',
    label: 'Alaska Time — Nome',
  },
  {
    value: 'Pacific/Honolulu',
    label: 'Hawaii Time',
  },
];
type ComplianceForm = {
  market_name: string;
  brokerage_name: string;

  marketing_licensed_business_name:
    string;

  marketing_broker_license_number:
    string;

  marketing_license_state:
    string;

  state_jurisdiction_id:
    string;

  timezone:
    string;

  marketing_privacy_policy_url:
    string;

  marketing_mls_attribution:
    string;

  marketing_standard_disclaimer:
    string;

  marketing_advertisement_label:
    string;

  brokerage_logo_url: string;
};

const EMPTY_FORM:
  ComplianceForm = {
    market_name: '',
    brokerage_name: '',

    marketing_licensed_business_name:
      '',

    marketing_broker_license_number:
      '',

    marketing_license_state:
      '',

    state_jurisdiction_id:
      '',

    timezone:
      '',

    marketing_privacy_policy_url:
      '',

    marketing_mls_attribution:
      '',

    marketing_standard_disclaimer:
      '',

    marketing_advertisement_label:
      '',

    brokerage_logo_url:
      '',
  };

function formFromOrganization(
  organization:
    OrganizationCompliance,
  setup?: {
    organization?: {
      state_jurisdiction_id?:
        string | null;

      timezone?:
        string | null;
    };

    compliance_package?:
      CompliancePackage | null;
  }
): ComplianceForm {
  return {
    market_name:
      organization.market_name ||
      '',

    brokerage_name:
      organization.brokerage_name ||
      '',

    marketing_licensed_business_name:
      organization
        .marketing_licensed_business_name ||
      '',

    marketing_broker_license_number:
      organization
        .marketing_broker_license_number ||
      '',

    marketing_license_state:
      setup
        ?.compliance_package
        ?.state
        ?.name ||
      organization
        .marketing_license_state ||
      '',

    state_jurisdiction_id:
      setup
        ?.organization
        ?.state_jurisdiction_id ||
      '',

    timezone:
      setup
        ?.organization
        ?.timezone ||
      '',

    marketing_privacy_policy_url:
      organization
        .marketing_privacy_policy_url ||
      '',

    marketing_mls_attribution:
      organization
        .marketing_mls_attribution ||
      '',

    marketing_standard_disclaimer:
      organization
        .marketing_standard_disclaimer ||
      '',

    marketing_advertisement_label:
      organization
        .marketing_advertisement_label ||
      '',

    brokerage_logo_url:
      organization
        .brokerage_logo_url ||
      '',
  };
}

export default function OrganizationComplianceCard() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    uploadingLogo,
    setUploadingLogo,
  ] = useState(false);

  const [
    canEdit,
    setCanEdit,
  ] = useState(false);

  const [
    masterBrandName,
    setMasterBrandName,
  ] = useState('MPRE');

  const [
    jurisdictions,
    setJurisdictions,
  ] = useState<
    JurisdictionOption[]
  >([]);

  const [
    compliancePackage,
    setCompliancePackage,
  ] = useState<
    CompliancePackage | null
  >(null);

  const [
    form,
    setForm,
  ] = useState<ComplianceForm>(
    EMPTY_FORM
  );

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

  async function accessToken() {
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

    return data.session
      .access_token;
  }

  async function loadCompliance() {
    try {
      setLoading(true);
      setError(null);

      const token =
        await accessToken();

      const [
        complianceResponse,
        setupResponse,
      ] = await Promise.all([
        fetch(
          '/api/preferences/organization-compliance',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: 'no-store',
          }
        ),

        fetch(
          '/api/preferences/organization-compliance/setup',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: 'no-store',
          }
        ),
      ]);

      const [
        complianceResult,
        setupResult,
      ] = await Promise.all([
        complianceResponse.json(),
        setupResponse.json(),
      ]);

      if (
        !complianceResponse.ok ||
        !complianceResult.ok
      ) {
        throw new Error(
          complianceResult.error ||
            'Could not load organization compliance settings.'
        );
      }

      if (
        !setupResponse.ok ||
        !setupResult.ok
      ) {
        throw new Error(
          setupResult.error ||
            'Could not load organization state and timezone settings.'
        );
      }

      setCanEdit(
        Boolean(
          complianceResult.can_edit &&
          setupResult.can_edit
        )
      );

      setMasterBrandName(
        String(
          complianceResult
            .master_brand_name ||
          'MPRE'
        )
      );

      setJurisdictions(
        Array.isArray(
          setupResult.jurisdictions
        )
          ? setupResult
              .jurisdictions
          : []
      );

      setCompliancePackage(
        setupResult
          .compliance_package ||
        null
      );

      setForm(
        formFromOrganization(
          complianceResult.organization,
          setupResult
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load organization compliance settings.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompliance();
  }, []);

  function updateField<
    K extends keyof ComplianceForm
  >(
    field: K,
    value: ComplianceForm[K]
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  const organizationDisplay =
    useMemo(() => {
      const marketName =
        form.market_name.trim();

      if (!marketName) {
        return masterBrandName;
      }

      const prefix =
        `${masterBrandName} `;

      const normalizedMarketName =
        marketName
          .toLowerCase()
          .startsWith(
            prefix.toLowerCase()
          )
          ? marketName
              .slice(prefix.length)
              .trim()
          : marketName;

      return normalizedMarketName
        ? `${masterBrandName} ${normalizedMarketName}`
        : masterBrandName;
    }, [
      form.market_name,
      masterBrandName,
    ]);

  const readiness =
    useMemo(() => {
      const requirements = [
        {
          label:
            'Broker licensed business name',
          ready:
            Boolean(
              form
                .marketing_licensed_business_name
                .trim()
            ),
        },

        {
          label:
            'Organization state',
          ready:
            Boolean(
              form
                .state_jurisdiction_id
                .trim()
            ),
        },

        {
          label:
            'Organization timezone',
          ready:
            Boolean(
              form
                .timezone
                .trim()
            ),
        },
        {
          label:
            'Privacy policy URL',
          ready:
            Boolean(
              form
                .marketing_privacy_policy_url
                .trim()
            ),
        },

        {
          label:
            'Advertising disclaimer',
          ready:
            Boolean(
              form
                .marketing_standard_disclaimer
                .trim()
            ),
        },
      ];

      return {
        requirements,

        complete:
          requirements.every(
            (item) =>
              item.ready
          ),
      };
    }, [form]);

  async function saveCompliance() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      if (
        !form
          .state_jurisdiction_id
          .trim()
      ) {
        throw new Error(
          'Select the organization state before saving.'
        );
      }

      if (
        !form.timezone.trim()
      ) {
        throw new Error(
          'Select the organization timezone before saving.'
        );
      }

      const token =
        await accessToken();

      const setupResponse =
        await fetch(
          '/api/preferences/organization-compliance/setup',
          {
            method: 'PATCH',
            headers: {
              Authorization:
                `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              state_jurisdiction_id:
                form
                  .state_jurisdiction_id,
              timezone:
                form.timezone,
            }),
          }
        );

      const setupResult =
        await setupResponse.json();

      if (
        !setupResponse.ok ||
        !setupResult.ok
      ) {
        throw new Error(
          setupResult.error ||
            'Could not save organization state and timezone.'
        );
      }

      const selectedStateName =
        setupResult
          .compliance_package
          ?.state
          ?.name ||
        form
          .marketing_license_state;

      const complianceResponse =
        await fetch(
          '/api/preferences/organization-compliance',
          {
            method: 'PATCH',
            headers: {
              Authorization:
                `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              ...form,
              marketing_license_state:
                selectedStateName,
            }),
          }
        );

      const complianceResult =
        await complianceResponse.json();

      if (
        !complianceResponse.ok ||
        !complianceResult.ok
      ) {
        throw new Error(
          complianceResult.error ||
            'Could not save organization compliance settings.'
        );
      }

      setJurisdictions(
        Array.isArray(
          setupResult.jurisdictions
        )
          ? setupResult
              .jurisdictions
          : []
      );

      setCompliancePackage(
        setupResult
          .compliance_package ||
        null
      );

      setForm(
        formFromOrganization(
          complianceResult.organization,
          setupResult
        )
      );

      setNotice(
        'Organization settings saved. Federal and state compliance packages were attached automatically.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not save organization compliance settings.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadBrokerageLogo(
    file: File
  ) {
    try {
      setUploadingLogo(true);
      setError(null);
      setNotice(null);

      const token =
        await accessToken();

      const formData =
        new FormData();

      formData.append(
        'file',
        file
      );

      const response = await fetch(
        '/api/preferences/organization-compliance/logo',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.error ||
            'Could not upload the brokerage logo.'
        );
      }

      updateField(
        'brokerage_logo_url',
        result.url
      );

      setNotice(
        'Brokerage logo uploaded successfully.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not upload the brokerage logo.'
      );
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading brokerage compliance...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-700" />

            <h2 className="text-xl font-bold text-slate-900">
              Brokerage and Email Compliance
            </h2>
          </div>

          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Organization identity and setup. The administrator selects only
            the state and timezone; Federal and state rule packages are
            controlled by platform administration and attached automatically.
          </p>
        </div>

        <div
          className={
            readiness.complete
              ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3'
              : 'rounded-2xl border border-amber-300 bg-white px-4 py-3'
          }
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Compliance Status
          </div>

          <div
            className={
              readiness.complete
                ? 'mt-1 font-bold text-emerald-700'
                : 'mt-1 font-bold text-amber-700'
            }
          >
            {readiness.complete
              ? 'Core fields complete'
              : 'Core fields missing'}
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {!canEdit && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          These organization-wide fields are read-only for agents.
          An administrator controls the brokerage’s licensed identity.
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Organization Market Identity
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Enter only the market name, such as Boise or Twin Falls. The MPRE
            master brand remains controlled by the platform admin.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Organization Market Name
            </span>
            <input
              value={form.market_name}
              disabled={!canEdit}
              onChange={(event) =>
                updateField(
                  'market_name',
                  event.target.value
                )
              }
              placeholder="Boise"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Organization Display
            </span>
            <input
              value={organizationDisplay}
              readOnly
              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-700"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Brokerage Display Name
            </span>
            <input
              value={form.brokerage_name}
              disabled={!canEdit}
              onChange={(event) =>
                updateField(
                  'brokerage_name',
                  event.target.value
                )
              }
              placeholder="Homes of Idaho"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
            />
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-700" />

          <h3 className="font-semibold text-blue-950">
            Read-Only Compliance Package
          </h3>
        </div>

        <p className="mt-2 text-sm text-blue-900">
          The organization administrator selects the state only. Federal and
          state rules are researched, edited, approved, activated and retired
          exclusively by platform administration.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            compliancePackage?.federal,
            compliancePackage?.state,
          ].map((item, index) => (
            <div
              key={
                item?.jurisdiction_id ||
                `missing-${index}`
              }
              className="rounded-xl border border-blue-200 bg-white p-3"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {index === 0
                  ? 'Federal Rules'
                  : 'State Rules'}
              </div>

              <div className="mt-1 font-semibold text-slate-900">
                {item?.name ||
                  (index === 0
                    ? 'United States Federal'
                    : 'Select a state')}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                {item?.rule_set?.is_active &&
                item?.rule_set?.status === 'approved'
                  ? 'Approved and active'
                  : item?.rule_set
                  ? `Platform review pending — ${item.rule_set.status}`
                  : 'Rule package not yet populated'}
              </div>

              {item?.rule_set ? (
                <div className="mt-1 text-xs text-slate-500">
                  {item.rule_set.name}
                  {' • '}
                  {item.rule_set.version}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
        <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Licensed Brokerage Logo
            </div>
            <div className="mt-2 flex min-h-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              {form.brokerage_logo_url ? (
                <img
                  src={form.brokerage_logo_url}
                  alt="Licensed brokerage logo"
                  className="max-h-28 max-w-full object-contain"
                />
              ) : (
                <span className="text-center text-xs text-slate-500">
                  No brokerage logo uploaded
                </span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Organization Brokerage Branding
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This may differ between MPRE Boise, MPRE Twin Falls, MPRE Atlanta
              and other markets. The shared MPRE logo remains controlled by the
              platform admin.
            </p>

            {canEdit && (
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white">
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploadingLogo
                  ? 'Uploading...'
                  : 'Replace Brokerage Logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingLogo}
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0];
                    if (file) {
                      uploadBrokerageLogo(file);
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Broker’s Full Licensed Business Name
          </span>

          <input
            value={
              form
                .marketing_licensed_business_name
            }
            disabled={!canEdit}
            onChange={(event) =>
              updateField(
                'marketing_licensed_business_name',
                event.target.value
              )
            }
            placeholder="Enter the exact name registered with the Idaho Real Estate Commission"
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Brokerage License Number
          </span>

          <input
            value={
              form
                .marketing_broker_license_number
            }
            disabled={!canEdit}
            onChange={(event) =>
              updateField(
                'marketing_broker_license_number',
                event.target.value
              )
            }
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Organization State
          </span>

          <select
            value={
              form
                .state_jurisdiction_id
            }
            disabled={!canEdit}
            onChange={(event) => {
              const jurisdictionId =
                event.target.value;

              const selected =
                jurisdictions.find(
                  (item) =>
                    item.id ===
                    jurisdictionId
                );

              setForm(
                (previous) => ({
                  ...previous,
                  state_jurisdiction_id:
                    jurisdictionId,
                  marketing_license_state:
                    selected?.name ||
                    '',
                })
              );

              setCompliancePackage(
                (previous) => ({
                  federal:
                    previous?.federal ||
                    null,
                  state:
                    selected
                      ? {
                          jurisdiction_id:
                            selected.id,
                          code:
                            selected.code,
                          state_code:
                            selected
                              .state_code,
                          name:
                            selected.name,
                          launch_status:
                            selected
                              .launch_status,
                          marketing_enabled:
                            selected
                              .marketing_enabled,
                          current_rule_version:
                            selected
                              .current_rule_version,
                          rule_set:
                            null,
                        }
                      : null,
                })
              );
            }}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
          >
            <option value="">
              Select state
            </option>

            {jurisdictions.map(
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
                  {jurisdiction.state_code
                    ? ` (${jurisdiction.state_code})`
                    : ''}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Organization Timezone
          </span>

          <select
            value={form.timezone}
            disabled={!canEdit}
            onChange={(event) =>
              updateField(
                'timezone',
                event.target.value
              )
            }
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
          >
            <option value="">
              Select timezone
            </option>

            {US_TIME_ZONE_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                  {' — '}
                  {option.value}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Advertisement Label
          </span>

          <input
            value={
              form
                .marketing_advertisement_label
            }
            disabled={!canEdit}
            onChange={(event) =>
              updateField(
                'marketing_advertisement_label',
                event.target.value
              )
            }
            placeholder="Advertisement"
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Privacy Policy URL
        </span>

        <input
          value={
            form
              .marketing_privacy_policy_url
          }
          disabled={!canEdit}
          onChange={(event) =>
            updateField(
              'marketing_privacy_policy_url',
              event.target.value
            )
          }
          placeholder="https://..."
          className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          MLS Attribution
        </span>

        <textarea
          value={
            form
              .marketing_mls_attribution
          }
          disabled={!canEdit}
          onChange={(event) =>
            updateField(
              'marketing_mls_attribution',
              event.target.value
            )
          }
          rows={3}
          placeholder="Optional MLS or listing-data attribution approved for your market"
          className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Standard Property Advertisement Disclaimer
        </span>

        <textarea
          value={
            form
              .marketing_standard_disclaimer
          }
          disabled={!canEdit}
          onChange={(event) =>
            updateField(
              'marketing_standard_disclaimer',
              event.target.value
            )
          }
          rows={4}
          className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
        />
      </label>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-blue-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-blue-700" />

            <div className="text-sm font-semibold text-slate-900">
              Equal Housing Opportunity
            </div>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-600">
            The official Equal Housing Opportunity graphic and wording
            are included automatically in marketing-email legal footers.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-700" />

            <div className="text-sm font-semibold text-slate-900">
              Platform and Opt-Out Branding
            </div>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-600">
            Unsubscribe, email preferences, privacy policy and
            “Powered by easyrealtor.homes” are inserted automatically.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {readiness.requirements.map(
          (item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white bg-white px-3 py-2 text-sm"
            >
              <span
                className={
                  item.ready
                    ? 'font-semibold text-emerald-700'
                    : 'font-semibold text-amber-700'
                }
              >
                {item.ready
                  ? 'Ready'
                  : 'Missing'}
              </span>

              <span className="ml-2 text-slate-700">
                {item.label}
              </span>
            </div>
          )
        )}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={saveCompliance}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {saving
            ? 'Saving...'
            : 'Save Brokerage Compliance'}
        </button>
      )}
    </section>
  );
}
