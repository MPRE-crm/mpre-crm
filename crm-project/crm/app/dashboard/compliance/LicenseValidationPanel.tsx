'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  RefreshCw,
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
  organizationName: string;
  marketName: string | null;
  marketStatus: string | null;
  jurisdictionCode: string;
  licensedBusinessName: string | null;
  dbaName: string | null;
  brokerageLicenseNumber: string | null;
  licenseStatus: string | null;
  responsibleBrokerName: string | null;
  responsibleBrokerLicenseNumber: string | null;
  expirationDate: string | null;
  verifiedAt: string | null;
  verified: boolean;
  expired: boolean;
  missingFields: string[];
};

type ProfileLicense = {
  id: string;
  profileName: string;
  profileEmail: string | null;
  profileRole: string | null;
  organizationName: string;
  jurisdictionCode: string;
  licenseNumber: string | null;
  licenseStatus: string | null;
  isPrimary: boolean;
  supervisingBrokerName: string | null;
  supervisingBrokerLicenseNumber: string | null;
  expirationDate: string | null;
  verifiedAt: string | null;
  verified: boolean;
  expired: boolean;
  missingFields: string[];
};

type LicenseResponse = {
  ok: true;
  summary: LicenseSummary;
  organizationLicenses:
    OrganizationLicense[];
  profileLicenses:
    ProfileLicense[];
};

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

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'Not entered';
  }

  const date =
    new Date(`${value}T00:00:00`);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );
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
        Verified
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      Pending Review
    </span>
  );
}

function MissingFields({
  fields,
}: {
  fields: string[];
}) {
  if (fields.length === 0) {
    return (
      <span className="text-xs font-medium text-emerald-700">
        No missing fields
      </span>
    );
  }

  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {fields.map((field) => (
        <span
          key={field}
          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800"
        >
          {field}
        </span>
      ))}
    </div>
  );
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
    result,
    setResult,
  ] =
    useState<LicenseResponse | null>(
      null
    );

  async function loadLicenses() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: sessionResult,
        error: sessionError,
      } =
        await supabase.auth.getSession();

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
          '/api/compliance/licenses',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,
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

      setResult(
        responseBody as LicenseResponse
      );
    } catch (loadError: any) {
      console.error(
        'License load failed:',
        loadError
      );

      setResult(null);

      setError(
        loadError?.message ||
          'Could not load license data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLicenses();
  }, []);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-blue-700" />

            <h2 className="text-lg font-semibold text-slate-950">
              Live License Validation
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Read-only brokerage, responsible-broker,
            and individual license readiness.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLicenses}
          disabled={loading}
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
        Direct MLS access is not required for license
        validation. Samantha’s MLS connection remains
        separate and unconfigured.
      </div>

      {error ? (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading &&
      !result ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Loading license data...
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
                  {
                    result.summary
                      .organizationLicenseRecords
                  }
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
                  {
                    result.summary
                      .profileLicenseRecords
                  }
                </p>

                <UserRoundCheck className="h-6 w-6 text-slate-600" />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Verified
              </p>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-950">
                  {
                    result.summary
                      .totalVerified
                  }
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
                  {
                    result.summary
                      .needsAttention
                  }
                </p>

                <AlertTriangle className="h-6 w-6 text-amber-700" />
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200">
            <div className="px-5 py-4">
              <h3 className="font-semibold text-slate-950">
                Organization Brokerage Licenses
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Licensed business name, brokerage number,
                responsible broker, expiration, and official
                verification source.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Organization
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Brokerage License
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Responsible Broker
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Expiration
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Verification
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Missing Information
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {result.organizationLicenses.map(
                    (license) => (
                      <tr
                        key={license.id}
                        className="border-t border-slate-100 align-top"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {
                              license.organizationName
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {
                              license.marketName ||
                              'Market not entered'
                            }
                            {' • '}
                            {
                              license.jurisdictionCode
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800">
                            {
                              license.licensedBusinessName ||
                              license.dbaName ||
                              'Not entered'
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {
                              license.brokerageLicenseNumber ||
                              'License number not entered'
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {formatStatus(
                              license.licenseStatus
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800">
                            {
                              license.responsibleBrokerName ||
                              'Not entered'
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {
                              license.responsibleBrokerLicenseNumber ||
                              'License number not entered'
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {formatDate(
                            license.expirationDate
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <VerificationBadge
                            verified={
                              license.verified
                            }
                            expired={
                              license.expired
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <MissingFields
                            fields={
                              license.missingFields
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}

                  {result.organizationLicenses.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        No organization license records exist.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="px-5 py-4">
              <h3 className="font-semibold text-slate-950">
                Individual Real Estate Licenses
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Agent and administrator license numbers,
                supervising brokers, expirations, and official
                verification.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Person
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      License
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Supervising Broker
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Expiration
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Verification
                    </th>

                    <th className="px-5 py-3 font-semibold">
                      Missing Information
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {result.profileLicenses.map(
                    (license) => (
                      <tr
                        key={license.id}
                        className="border-t border-slate-100 align-top"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {
                              license.profileName
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {
                              formatStatus(
                                license.profileRole
                              )
                            }
                            {' • '}
                            {
                              license.organizationName
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800">
                            {
                              license.licenseNumber ||
                              'Not entered'
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {formatStatus(
                              license.licenseStatus
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800">
                            {
                              license.supervisingBrokerName ||
                              'Not entered'
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {
                              license.supervisingBrokerLicenseNumber ||
                              'License number not entered'
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {formatDate(
                            license.expirationDate
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <VerificationBadge
                            verified={
                              license.verified
                            }
                            expired={
                              license.expired
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <MissingFields
                            fields={
                              license.missingFields
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}

                  {result.profileLicenses.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        No individual license records exist.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
