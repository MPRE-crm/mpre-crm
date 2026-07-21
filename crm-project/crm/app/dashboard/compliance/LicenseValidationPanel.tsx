'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ExternalLink,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type LicenseSummary = {
  organizationLicenseRecords: number;
  profileLicenseRecords: number;
  verifiedOrganizationLicenses: number;
  verifiedProfileLicenses: number;
  totalVerified: number;
  needsAttention: number;
  expiringSoon: number;
};

type OrganizationLicense = {
  id: string;
  organizationId: string;
  organizationName: string;
  marketId: string | null;
  marketName: string | null;
  marketStatus: string | null;
  marketMarketingEnabled: boolean;
  jurisdictionId: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  jurisdictionLaunchStatus: string | null;
  jurisdictionMarketingEnabled: boolean;
  currentRuleVersion: string | null;
  licensedBusinessName: string | null;
  dbaName: string | null;
  brokerageLicenseNumber: string | null;
  licenseType: string | null;
  licenseStatus: string | null;
  responsibleBrokerName: string | null;
  responsibleBrokerLicenseNumber: string | null;
  officePhone: string | null;
  officeAddress: string | null;
  complianceMailingAddress: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  regulatorSourceUrl: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  notes: string | null;
  verified: boolean;
  expired: boolean;
  daysUntilExpiration: number | null;
  missingFields: string[];
};

type ProfileLicense = {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  profileRole: string | null;
  organizationId: string;
  organizationLicenseId: string | null;
  organizationName: string;
  jurisdictionId: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  licenseType: string | null;
  licenseNumber: string | null;
  licenseStatus: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  isPrimary: boolean;
  supervisingBrokerName: string | null;
  supervisingBrokerLicenseNumber: string | null;
  regulatorSourceUrl: string | null;
  verificationSource: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  notes: string | null;
  verified: boolean;
  expired: boolean;
  daysUntilExpiration: number | null;
  missingFields: string[];
};

type LicenseResponse = {
  ok: true;
  summary: LicenseSummary;
  organizationLicenses:
    OrganizationLicense[];
  profileLicenses:
    ProfileLicense[];
  message?: string;
};

type OrganizationDraft = {
  licensedBusinessName: string;
  dbaName: string;
  brokerageLicenseNumber: string;
  licenseType: string;
  responsibleBrokerName: string;
  responsibleBrokerLicenseNumber: string;
  officePhone: string;
  officeAddress: string;
  complianceMailingAddress: string;
  issueDate: string;
  expirationDate: string;
  regulatorSourceUrl: string;
  notes: string;
};

type ProfileDraft = {
  licenseType: string;
  licenseNumber: string;
  issueDate: string;
  expirationDate: string;
  supervisingBrokerName: string;
  supervisingBrokerLicenseNumber: string;
  isPrimary: boolean;
  regulatorSourceUrl: string;
  verificationSource: string;
  notes: string;
};

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

function text(
  value: string | null
) {
  return value || '';
}

function formatStatus(
  value: string | null
) {
  if (!value) {
    return 'Not entered';
  }

  return value
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return 'Not verified';
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

function VerificationBadge({
  verified,
  expired,
}: {
  verified: boolean;
  expired: boolean;
}) {
  if (expired) {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        Expired
      </span>
    );
  }

  if (verified) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Complete and Verified
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      Incomplete or Pending Review
    </span>
  );
}

function MissingFields({
  fields,
}: {
  fields: string[];
}) {
  if (
    fields.length ===
    0
  ) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
        Every required field is complete.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-xs font-semibold text-amber-900">
        Missing information
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {fields.map(
          (field) => (
            <span
              key={field}
              className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-800"
            >
              {field}
            </span>
          )
        )}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className={inputClass}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}

      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className={inputClass}
      />
    </label>
  );
}

function organizationDraft(
  license: OrganizationLicense
): OrganizationDraft {
  return {
    licensedBusinessName:
      text(
        license.licensedBusinessName
      ),
    dbaName:
      text(
        license.dbaName
      ),
    brokerageLicenseNumber:
      text(
        license.brokerageLicenseNumber
      ),
    licenseType:
      text(
        license.licenseType
      ),
    responsibleBrokerName:
      text(
        license.responsibleBrokerName
      ),
    responsibleBrokerLicenseNumber:
      text(
        license.responsibleBrokerLicenseNumber
      ),
    officePhone:
      text(
        license.officePhone
      ),
    officeAddress:
      text(
        license.officeAddress
      ),
    complianceMailingAddress:
      text(
        license.complianceMailingAddress
      ),
    issueDate:
      text(
        license.issueDate
      ),
    expirationDate:
      text(
        license.expirationDate
      ),
    regulatorSourceUrl:
      text(
        license.regulatorSourceUrl
      ),
    notes:
      text(
        license.notes
      ),
  };
}

function profileDraft(
  license: ProfileLicense
): ProfileDraft {
  return {
    licenseType:
      text(
        license.licenseType
      ),
    licenseNumber:
      text(
        license.licenseNumber
      ),
    issueDate:
      text(
        license.issueDate
      ),
    expirationDate:
      text(
        license.expirationDate
      ),
    supervisingBrokerName:
      text(
        license.supervisingBrokerName
      ),
    supervisingBrokerLicenseNumber:
      text(
        license.supervisingBrokerLicenseNumber
      ),
    isPrimary:
      license.isPrimary,
    regulatorSourceUrl:
      text(
        license.regulatorSourceUrl
      ),
    verificationSource:
      text(
        license.verificationSource
      ),
    notes:
      text(
        license.notes
      ),
  };
}

export default function LicenseValidationPanel() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(
      null
    );

  const [
    result,
    setResult,
  ] =
    useState<LicenseResponse | null>(
      null
    );

  const [
    organizationDrafts,
    setOrganizationDrafts,
  ] = useState<
    Record<
      string,
      OrganizationDraft
    >
  >({});

  const [
    profileDrafts,
    setProfileDrafts,
  ] = useState<
    Record<
      string,
      ProfileDraft
    >
  >({});

  const [
    workingKey,
    setWorkingKey,
  ] =
    useState<string | null>(
      null
    );

  function applyResult(
    nextResult: LicenseResponse
  ) {
    setResult(
      nextResult
    );

    setOrganizationDrafts(
      Object.fromEntries(
        nextResult.organizationLicenses.map(
          (license) => [
            license.id,
            organizationDraft(
              license
            ),
          ]
        )
      )
    );

    setProfileDrafts(
      Object.fromEntries(
        nextResult.profileLicenses.map(
          (license) => [
            license.id,
            profileDraft(
              license
            ),
          ]
        )
      )
    );
  }

  async function sessionToken() {
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

  async function loadLicenses() {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const token =
        await sessionToken();

      const response =
        await fetch(
          '/api/compliance/licenses',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: 'no-store',
          }
        );

      const responseBody =
        await response.json();

      if (
        !response.ok ||
        !responseBody?.ok
      ) {
        throw new Error(
          responseBody?.error ||
            'Could not load license records.'
        );
      }

      applyResult(
        responseBody as LicenseResponse
      );
    }
    catch (loadError: any) {
      console.error(
        'License load failed:',
        loadError
      );

      setResult(null);

      setError(
        loadError?.message ||
          'Could not load license data.'
      );
    }
    finally {
      setLoading(false);
    }
  }

  async function updateCompliance(
    workingId: string,
    payload: Record<
      string,
      unknown
    >
  ) {
    try {
      setWorkingKey(
        workingId
      );
      setError(null);
      setSuccess(null);

      const token =
        await sessionToken();

      const response =
        await fetch(
          '/api/compliance/licenses',
          {
            method: 'PATCH',
            headers: {
              Authorization:
                `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              payload
            ),
          }
        );

      const responseBody =
        await response.json();

      if (
        !response.ok ||
        !responseBody?.ok
      ) {
        const missing =
          Array.isArray(
            responseBody?.missing_fields
          )
            ? responseBody.missing_fields.join(
                ', '
              )
            : '';

        throw new Error(
          missing
            ? `${responseBody?.error || 'The compliance record could not be saved.'} Missing: ${missing}`
            : responseBody?.error ||
                'The compliance record could not be saved.'
        );
      }

      applyResult(
        responseBody as LicenseResponse
      );

      setSuccess(
        responseBody?.message ||
          'Compliance information saved.'
      );
    }
    catch (saveError: any) {
      console.error(
        'Compliance save failed:',
        saveError
      );

      setError(
        saveError?.message ||
          'The compliance information could not be saved.'
      );
    }
    finally {
      setWorkingKey(null);
    }
  }

  function updateOrganizationDraft<
    Key extends keyof OrganizationDraft
  >(
    licenseId: string,
    key: Key,
    value: OrganizationDraft[Key]
  ) {
    setOrganizationDrafts(
      (current) => ({
        ...current,
        [licenseId]: {
          ...current[licenseId],
          [key]: value,
        },
      })
    );
  }

  function updateProfileDraft<
    Key extends keyof ProfileDraft
  >(
    licenseId: string,
    key: Key,
    value: ProfileDraft[Key]
  ) {
    setProfileDrafts(
      (current) => ({
        ...current,
        [licenseId]: {
          ...current[licenseId],
          [key]: value,
        },
      })
    );
  }

  function saveOrganization(
    license: OrganizationLicense,
    verify: boolean
  ) {
    const draft =
      organizationDrafts[
        license.id
      ];

    if (!draft) {
      return;
    }

    void updateCompliance(
      `organization:${license.id}:${verify ? 'verify' : 'draft'}`,
      {
        action:
          'save_organization_license',
        license_id:
          license.id,
        verify,
        licensed_business_name:
          draft.licensedBusinessName,
        dba_name:
          draft.dbaName,
        brokerage_license_number:
          draft.brokerageLicenseNumber,
        license_type:
          draft.licenseType,
        responsible_broker_name:
          draft.responsibleBrokerName,
        responsible_broker_license_number:
          draft.responsibleBrokerLicenseNumber,
        office_phone:
          draft.officePhone,
        office_address:
          draft.officeAddress,
        compliance_mailing_address:
          draft.complianceMailingAddress,
        issue_date:
          draft.issueDate,
        expiration_date:
          draft.expirationDate,
        regulator_source_url:
          draft.regulatorSourceUrl,
        notes:
          draft.notes,
      }
    );
  }

  function saveProfile(
    license: ProfileLicense,
    verify: boolean
  ) {
    const draft =
      profileDrafts[
        license.id
      ];

    if (!draft) {
      return;
    }

    void updateCompliance(
      `profile:${license.id}:${verify ? 'verify' : 'draft'}`,
      {
        action:
          'save_profile_license',
        license_id:
          license.id,
        verify,
        license_type:
          draft.licenseType,
        license_number:
          draft.licenseNumber,
        issue_date:
          draft.issueDate,
        expiration_date:
          draft.expirationDate,
        supervising_broker_name:
          draft.supervisingBrokerName,
        supervising_broker_license_number:
          draft.supervisingBrokerLicenseNumber,
        is_primary:
          draft.isPrimary,
        regulator_source_url:
          draft.regulatorSourceUrl,
        verification_source:
          draft.verificationSource,
        notes:
          draft.notes,
      }
    );
  }

  useEffect(() => {
    void loadLicenses();
  }, []);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-blue-700" />

            <h2 className="text-lg font-semibold text-slate-950">
              License and Market Compliance Editor
            </h2>
          </div>

          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Complete brokerage and individual license information, save drafts,
            verify reviewed records, and activate organization marketing only
            after the jurisdiction rule package is approved.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadLicenses();
          }}
          disabled={
            loading ||
            Boolean(
              workingKey
            )
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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

      <div className="border-b border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-800">
        Saving a draft clears prior verification. Save and Verify succeeds only
        after every required field is complete and the license is not expired.
      </div>

      {error ? (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="m-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {loading &&
      !result ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Loading compliance records...
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Brokerage Records
              </p>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-950">
                  {result.summary.organizationLicenseRecords}
                </p>

                <Building2 className="h-6 w-6 text-blue-700" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Individual Licenses
              </p>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-950">
                  {result.summary.profileLicenseRecords}
                </p>

                <UserRoundCheck className="h-6 w-6 text-slate-600" />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Complete and Verified
              </p>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-950">
                  {result.summary.totalVerified}
                </p>

                <BadgeCheck className="h-6 w-6 text-emerald-700" />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Needs Attention
              </p>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-950">
                  {result.summary.needsAttention}
                </p>

                <AlertTriangle className="h-6 w-6 text-amber-700" />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 p-5">
            <div>
              <h3 className="font-semibold text-slate-950">
                Organization Brokerage Licenses
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                These records control brokerage identity, responsible-broker
                validation, office information, and organization-market access.
              </p>
            </div>

            {result.organizationLicenses.map(
              (license) => {
                const draft =
                  organizationDrafts[
                    license.id
                  ];

                if (!draft) {
                  return null;
                }

                const savingDraft =
                  workingKey ===
                  `organization:${license.id}:draft`;

                const verifying =
                  workingKey ===
                  `organization:${license.id}:verify`;

                const activating =
                  workingKey ===
                  `market:${license.marketId}`;

                const marketReady =
                  license.marketMarketingEnabled &&
                  license.marketStatus ===
                    'active';

                return (
                  <details
                    key={license.id}
                    open
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                  >
                    <summary className="cursor-pointer px-4 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-semibold text-slate-950">
                            {license.organizationName}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {license.jurisdictionCode}
                            {' • '}
                            {license.marketName ||
                              'Market not entered'}
                            {' • License status: '}
                            {formatStatus(
                              license.licenseStatus
                            )}
                          </div>
                        </div>

                        <VerificationBadge
                          verified={license.verified}
                          expired={license.expired}
                        />
                      </div>
                    </summary>

                    <div className="space-y-5 border-t border-slate-200 bg-white p-4">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className={`rounded-xl border p-3 ${license.jurisdictionMarketingEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Jurisdiction
                          </div>
                          <div className="mt-1 font-semibold text-slate-900">
                            {license.jurisdictionName}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {license.jurisdictionMarketingEnabled
                              ? `Active rule ${license.currentRuleVersion || ''}`
                              : 'Rule package is not active'}
                          </div>
                        </div>

                        <div className={`rounded-xl border p-3 ${marketReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Organization Market
                          </div>
                          <div className="mt-1 font-semibold text-slate-900">
                            {marketReady
                              ? 'Active for marketing'
                              : 'Not active for marketing'}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Status: {formatStatus(
                              license.marketStatus
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Last Verification
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {formatDateTime(
                              license.verifiedAt
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {license.verifiedByName ||
                              'No verifier recorded'}
                          </div>
                        </div>
                      </div>

                      <MissingFields
                        fields={license.missingFields}
                      />

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <TextField
                          label="Licensed business name *"
                          value={draft.licensedBusinessName}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'licensedBusinessName',
                              value
                            )
                          }
                        />

                        <TextField
                          label="DBA / public brokerage name"
                          value={draft.dbaName}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'dbaName',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Brokerage license number *"
                          value={draft.brokerageLicenseNumber}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'brokerageLicenseNumber',
                              value
                            )
                          }
                        />

                        <TextField
                          label="License type *"
                          value={draft.licenseType}
                          placeholder="Brokerage"
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'licenseType',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Responsible broker name *"
                          value={draft.responsibleBrokerName}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'responsibleBrokerName',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Responsible broker license *"
                          value={draft.responsibleBrokerLicenseNumber}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'responsibleBrokerLicenseNumber',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Office phone *"
                          value={draft.officePhone}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'officePhone',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Issue date *"
                          type="date"
                          value={draft.issueDate}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'issueDate',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Expiration date *"
                          type="date"
                          value={draft.expirationDate}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'expirationDate',
                              value
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextAreaField
                          label="Office address *"
                          value={draft.officeAddress}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'officeAddress',
                              value
                            )
                          }
                        />

                        <TextAreaField
                          label="Compliance mailing address *"
                          value={draft.complianceMailingAddress}
                          onChange={(value) =>
                            updateOrganizationDraft(
                              license.id,
                              'complianceMailingAddress',
                              value
                            )
                          }
                        />
                      </div>

                      <TextField
                        label="Official regulator source URL *"
                        type="url"
                        value={draft.regulatorSourceUrl}
                        placeholder="https://..."
                        onChange={(value) =>
                          updateOrganizationDraft(
                            license.id,
                            'regulatorSourceUrl',
                            value
                          )
                        }
                      />

                      {draft.regulatorSourceUrl ? (
                        <a
                          href={draft.regulatorSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Open official source
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}

                      <TextAreaField
                        label="Verification notes"
                        value={draft.notes}
                        onChange={(value) =>
                          updateOrganizationDraft(
                            license.id,
                            'notes',
                            value
                          )
                        }
                      />

                      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            saveOrganization(
                              license,
                              false
                            )
                          }
                          disabled={Boolean(
                            workingKey
                          )}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {savingDraft
                            ? 'Saving...'
                            : 'Save Draft'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveOrganization(
                              license,
                              true
                            )
                          }
                          disabled={Boolean(
                            workingKey
                          )}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {verifying
                            ? 'Verifying...'
                            : license.verified
                              ? 'Save and Reverify'
                              : 'Save and Verify'}
                        </button>

                        {!marketReady ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !license.marketId
                              ) {
                                setError(
                                  'No organization-market record exists for this license.'
                                );
                                return;
                              }

                              void updateCompliance(
                                `market:${license.marketId}`,
                                {
                                  action:
                                    'activate_organization_market',
                                  market_id:
                                    license.marketId,
                                }
                              );
                            }}
                            disabled={
                              Boolean(
                                workingKey
                              ) ||
                              !license.jurisdictionMarketingEnabled ||
                              !license.marketId
                            }
                            title={
                              license.jurisdictionMarketingEnabled
                                ? 'Activate this organization market'
                                : 'Activate the jurisdiction rule package first'
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Power className="h-4 w-4" />
                            {activating
                              ? 'Activating...'
                              : 'Activate Organization Market'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                            <BadgeCheck className="h-4 w-4" />
                            Organization Market Active
                          </span>
                        )}
                      </div>

                      {!license.jurisdictionMarketingEnabled ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          Finish, approve, and activate the {license.jurisdictionCode}
                          rule package above before organization marketing can be activated.
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              }
            )}

            {result.organizationLicenses.length ===
            0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No organization license records exist.
              </div>
            ) : null}
          </div>

          <div className="space-y-4 p-5">
            <div>
              <h3 className="font-semibold text-slate-950">
                Individual Real Estate Licenses
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Complete and verify the state license used by each agent,
                administrator, or broker in public marketing.
              </p>
            </div>

            {result.profileLicenses.map(
              (license) => {
                const draft =
                  profileDrafts[
                    license.id
                  ];

                if (!draft) {
                  return null;
                }

                const savingDraft =
                  workingKey ===
                  `profile:${license.id}:draft`;

                const verifying =
                  workingKey ===
                  `profile:${license.id}:verify`;

                return (
                  <details
                    key={license.id}
                    open
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                  >
                    <summary className="cursor-pointer px-4 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-semibold text-slate-950">
                            {license.profileName}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {formatStatus(
                              license.profileRole
                            )}
                            {' • '}
                            {license.organizationName}
                            {' • '}
                            {license.jurisdictionCode}
                          </div>
                        </div>

                        <VerificationBadge
                          verified={license.verified}
                          expired={license.expired}
                        />
                      </div>
                    </summary>

                    <div className="space-y-5 border-t border-slate-200 bg-white p-4">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <MissingFields
                          fields={license.missingFields}
                        />

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Last Verification
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {formatDateTime(
                              license.verifiedAt
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {license.verifiedByName ||
                              'No verifier recorded'}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <TextField
                          label="License type *"
                          value={draft.licenseType}
                          placeholder="Salesperson"
                          onChange={(value) =>
                            updateProfileDraft(
                              license.id,
                              'licenseType',
                              value
                            )
                          }
                        />

                        <TextField
                          label="License number *"
                          value={draft.licenseNumber}
                          onChange={(value) =>
                            updateProfileDraft(
                              license.id,
                              'licenseNumber',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Issue date *"
                          type="date"
                          value={draft.issueDate}
                          onChange={(value) =>
                            updateProfileDraft(
                              license.id,
                              'issueDate',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Expiration date *"
                          type="date"
                          value={draft.expirationDate}
                          onChange={(value) =>
                            updateProfileDraft(
                              license.id,
                              'expirationDate',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Supervising broker name *"
                          value={draft.supervisingBrokerName}
                          onChange={(value) =>
                            updateProfileDraft(
                              license.id,
                              'supervisingBrokerName',
                              value
                            )
                          }
                        />

                        <TextField
                          label="Supervising broker license *"
                          value={draft.supervisingBrokerLicenseNumber}
                          onChange={(value) =>
                            updateProfileDraft(
                              license.id,
                              'supervisingBrokerLicenseNumber',
                              value
                            )
                          }
                        />
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.isPrimary}
                          onChange={(event) =>
                            updateProfileDraft(
                              license.id,
                              'isPrimary',
                              event.target.checked
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />

                        <span>
                          <span className="font-semibold text-slate-900">
                            Primary advertising license
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            This is the license displayed and validated for this
                            person’s public marketing in this jurisdiction.
                          </span>
                        </span>
                      </label>

                      <TextField
                        label="Official regulator source URL *"
                        type="url"
                        value={draft.regulatorSourceUrl}
                        placeholder="https://..."
                        onChange={(value) =>
                          updateProfileDraft(
                            license.id,
                            'regulatorSourceUrl',
                            value
                          )
                        }
                      />

                      <TextField
                        label="Verification source / lookup details *"
                        value={draft.verificationSource}
                        placeholder="Official regulator search, record number, or lookup notes"
                        onChange={(value) =>
                          updateProfileDraft(
                            license.id,
                            'verificationSource',
                            value
                          )
                        }
                      />

                      {draft.regulatorSourceUrl ? (
                        <a
                          href={draft.regulatorSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Open official source
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}

                      <TextAreaField
                        label="Verification notes"
                        value={draft.notes}
                        onChange={(value) =>
                          updateProfileDraft(
                            license.id,
                            'notes',
                            value
                          )
                        }
                      />

                      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            saveProfile(
                              license,
                              false
                            )
                          }
                          disabled={Boolean(
                            workingKey
                          )}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {savingDraft
                            ? 'Saving...'
                            : 'Save Draft'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveProfile(
                              license,
                              true
                            )
                          }
                          disabled={Boolean(
                            workingKey
                          )}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {verifying
                            ? 'Verifying...'
                            : license.verified
                              ? 'Save and Reverify'
                              : 'Save and Verify'}
                        </button>
                      </div>
                    </div>
                  </details>
                );
              }
            )}

            {result.profileLicenses.length ===
            0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No individual license records exist.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
