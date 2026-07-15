'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Building2,
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
};

type ComplianceForm = {
  marketing_licensed_business_name:
    string;

  marketing_broker_license_number:
    string;

  marketing_license_state:
    string;

  marketing_privacy_policy_url:
    string;

  marketing_mls_attribution:
    string;

  marketing_standard_disclaimer:
    string;

  marketing_advertisement_label:
    string;
};

const DEFAULT_DISCLAIMER =
  'Information is deemed reliable but not guaranteed. Property information, price, availability, features and measurements are subject to change. Buyers should independently verify all information.';

const EMPTY_FORM:
  ComplianceForm = {
    marketing_licensed_business_name:
      '',

    marketing_broker_license_number:
      '',

    marketing_license_state:
      'Idaho',

    marketing_privacy_policy_url:
      '',

    marketing_mls_attribution:
      '',

    marketing_standard_disclaimer:
      DEFAULT_DISCLAIMER,

    marketing_advertisement_label:
      'Advertisement',
  };

function formFromOrganization(
  organization:
    OrganizationCompliance
): ComplianceForm {
  return {
    marketing_licensed_business_name:
      organization
        .marketing_licensed_business_name ||
      '',

    marketing_broker_license_number:
      organization
        .marketing_broker_license_number ||
      '',

    marketing_license_state:
      organization
        .marketing_license_state ||
      'Idaho',

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
      DEFAULT_DISCLAIMER,

    marketing_advertisement_label:
      organization
        .marketing_advertisement_label ||
      'Advertisement',
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
    canEdit,
    setCanEdit,
  ] = useState(false);

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

      const response =
        await fetch(
          '/api/preferences/organization-compliance',
          {
            method: 'GET',

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache: 'no-store',
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
            'Could not load organization compliance settings.'
        );
      }

      setCanEdit(
        Boolean(
          result.can_edit
        )
      );

      setForm(
        formFromOrganization(
          result.organization
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
            'License state',
          ready:
            Boolean(
              form
                .marketing_license_state
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

      const token =
        await accessToken();

      const response =
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

            body:
              JSON.stringify(form),
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
            'Could not save organization compliance settings.'
        );
      }

      setForm(
        formFromOrganization(
          result.organization
        )
      );

      setNotice(
        'Brokerage and email compliance settings saved successfully.'
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
            Organization-wide legal identity and disclosure settings used
            automatically in every marketing email.
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
            License State
          </span>

          <input
            value={
              form
                .marketing_license_state
            }
            disabled={!canEdit}
            onChange={(event) =>
              updateField(
                'marketing_license_state',
                event.target.value
              )
            }
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
          />
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
