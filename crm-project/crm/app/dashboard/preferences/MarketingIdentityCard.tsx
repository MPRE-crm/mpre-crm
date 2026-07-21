'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Camera,
  CheckCircle2,
  Loader2,
  Save,
  UserRound,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type MarketingIdentity = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  org_id: string;

  marketing_from_name:
    | string
    | null;

  marketing_from_email:
    | string
    | null;

  marketing_reply_to_email:
    | string
    | null;

  marketing_physical_address:
    | string
    | null;

  marketing_email_enabled:
    boolean;

  marketing_phone:
    | string
    | null;

  marketing_title:
    | string
    | null;

  marketing_brokerage:
    | string
    | null;

  marketing_website_url:
    | string
    | null;

  marketing_license_number:
    | string
    | null;

  marketing_headshot_url:
    | string
    | null;

  marketing_signature_text:
    | string
    | null;

  marketing_signature_image_url:
    | string
    | null;

  marketing_logo_url:
    | string
    | null;

  marketing_office_phone:
    | string
    | null;

  marketing_office_address:
    | string
    | null;

  marketing_appointment_url:
    | string
    | null;

  marketing_designations:
    | string[]
    | null;

  marketing_certifications:
    | string[]
    | null;

  marketing_service_areas:
    | string[]
    | null;

  marketing_languages:
    | string[]
    | null;

  marketing_disclaimer:
    | string
    | null;

  marketing_facebook_url:
    | string
    | null;

  marketing_instagram_url:
    | string
    | null;

  marketing_linkedin_url:
    | string
    | null;

  marketing_youtube_url:
    | string
    | null;

  marketing_tiktok_url:
    | string
    | null;

  marketing_x_url:
    | string
    | null;
};

type IdentityForm = {
  marketing_from_name: string;
  marketing_from_email: string;
  marketing_reply_to_email: string;
  marketing_physical_address: string;
  marketing_email_enabled: boolean;

  marketing_phone: string;
  marketing_title: string;
  marketing_brokerage: string;
  marketing_website_url: string;
  marketing_license_number: string;
  marketing_headshot_url: string;
  marketing_signature_text: string;
  marketing_signature_image_url: string;

  marketing_logo_url: string;
  marketing_office_phone: string;
  marketing_office_address: string;
  marketing_appointment_url: string;
  marketing_designations: string;
  marketing_certifications: string;
  marketing_service_areas: string;
  marketing_languages: string;
  marketing_disclaimer: string;

  marketing_facebook_url: string;
  marketing_instagram_url: string;
  marketing_linkedin_url: string;
  marketing_youtube_url: string;
  marketing_tiktok_url: string;
  marketing_x_url: string;
};

const EMPTY_FORM:
  IdentityForm = {
    marketing_from_name: '',
    marketing_from_email: '',
    marketing_reply_to_email: '',
    marketing_physical_address: '',
    marketing_email_enabled:
      false,

    marketing_phone: '',
    marketing_title: '',
    marketing_brokerage: '',
    marketing_website_url: '',
    marketing_license_number:
      '',
    marketing_headshot_url: '',
    marketing_signature_text:
      '',

    marketing_signature_image_url:
      '',

    marketing_logo_url: '',
    marketing_office_phone: '',
    marketing_office_address: '',
    marketing_appointment_url: '',
    marketing_designations: '',
    marketing_certifications: '',
    marketing_service_areas: '',
    marketing_languages: '',
    marketing_disclaimer: '',

    marketing_facebook_url: '',
    marketing_instagram_url: '',
    marketing_linkedin_url: '',
    marketing_youtube_url: '',
    marketing_tiktok_url: '',
    marketing_x_url: '',
  };

function formFromProfile(
  profile: MarketingIdentity
): IdentityForm {
  return {
    marketing_from_name:
      profile
        .marketing_from_name ||
      profile.name ||
      '',

    marketing_from_email:
      profile
        .marketing_from_email ||
      profile.email ||
      '',

    marketing_reply_to_email:
      profile
        .marketing_reply_to_email ||
      profile.email ||
      '',

    marketing_physical_address:
      profile
        .marketing_physical_address ||
      '',

    marketing_email_enabled:
      Boolean(
        profile
          .marketing_email_enabled
      ),

    marketing_phone:
      profile.marketing_phone ||
      '',

    marketing_title:
      profile.marketing_title ||
      '',

    marketing_brokerage:
      profile
        .marketing_brokerage ||
      '',

    marketing_website_url:
      profile
        .marketing_website_url ||
      '',

    marketing_license_number:
      profile
        .marketing_license_number ||
      '',

    marketing_headshot_url:
      profile
        .marketing_headshot_url ||
      '',

    marketing_signature_text:
      profile
        .marketing_signature_text ||
      '',

    marketing_signature_image_url:
      profile
        .marketing_signature_image_url ||
      '',

    marketing_logo_url:
      profile
        .marketing_logo_url ||
      '',

    marketing_office_phone:
      profile
        .marketing_office_phone ||
      '',

    marketing_office_address:
      profile
        .marketing_office_address ||
      '',

    marketing_appointment_url:
      profile
        .marketing_appointment_url ||
      '',

    marketing_designations:
      (
        profile
          .marketing_designations ||
        []
      ).join(', '),

    marketing_certifications:
      (
        profile
          .marketing_certifications ||
        []
      ).join(', '),

    marketing_service_areas:
      (
        profile
          .marketing_service_areas ||
        []
      ).join(', '),

    marketing_languages:
      (
        profile
          .marketing_languages ||
        []
      ).join(', '),

    marketing_disclaimer:
      profile
        .marketing_disclaimer ||
      '',

    marketing_facebook_url:
      profile
        .marketing_facebook_url ||
      '',

    marketing_instagram_url:
      profile
        .marketing_instagram_url ||
      '',

    marketing_linkedin_url:
      profile
        .marketing_linkedin_url ||
      '',

    marketing_youtube_url:
      profile
        .marketing_youtube_url ||
      '',

    marketing_tiktok_url:
      profile
        .marketing_tiktok_url ||
      '',

    marketing_x_url:
      profile
        .marketing_x_url ||
      '',
  };
}

export default function MarketingIdentityCard() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadingSignature,
    setUploadingSignature,
  ] = useState(false);

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

  const [
    profile,
    setProfile,
  ] = useState<
    MarketingIdentity | null
  >(null);

  const [
    form,
    setForm,
  ] = useState<IdentityForm>(
    EMPTY_FORM
  );

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

  async function loadIdentity() {
    try {
      setLoading(true);
      setError(null);

      const token =
        await accessToken();

      const response =
        await fetch(
          '/api/preferences/marketing-identity',
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
            'Could not load marketing identity.'
        );
      }

      const nextProfile =
        result.profile as MarketingIdentity;

      setProfile(
        nextProfile
      );

      setForm(
        formFromProfile(
          nextProfile
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load marketing identity.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIdentity();
  }, []);

  function updateField<
    K extends keyof IdentityForm
  >(
    field: K,
    value: IdentityForm[K]
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  const completeness =
    useMemo(() => {
      const checks = [
        form
          .marketing_from_name,
        form
          .marketing_from_email,
        form
          .marketing_reply_to_email,
        form.marketing_phone,
        form.marketing_title,
        form.marketing_brokerage,
        form
          .marketing_physical_address,
        form
          .marketing_signature_image_url ||
          form.marketing_signature_text,
        form
          .marketing_headshot_url,
      ];

      const complete =
        checks.filter(
          (value) =>
            Boolean(
              String(
                value || ''
              ).trim()
            )
        ).length;

      return {
        complete,
        total: checks.length,
      };
    }, [form]);

  async function saveIdentity() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const token =
        await accessToken();

      const response =
        await fetch(
          '/api/preferences/marketing-identity',
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
            'Could not save marketing identity.'
        );
      }

      const nextProfile =
        result.profile as MarketingIdentity;

      setProfile(
        nextProfile
      );

      setForm(
        formFromProfile(
          nextProfile
        )
      );

      setNotice(
        'Marketing identity saved successfully.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not save marketing identity.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadHeadshot(
    file: File
  ) {
    try {
      setUploading(true);
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

      const response =
        await fetch(
          '/api/preferences/marketing-identity/headshot',
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
            'Could not upload headshot.'
        );
      }

      updateField(
        'marketing_headshot_url',
        result.url
      );

      setNotice(
        'Headshot uploaded. Save the marketing identity to confirm the rest of your information.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not upload headshot.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function uploadSignatureImage(
    file: File
  ) {
    try {
      setUploadingSignature(true);
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

      const response =
        await fetch(
          '/api/preferences/marketing-identity/signature',
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
            'Could not upload signature image.'
        );
      }

      updateField(
        'marketing_signature_image_url',
        result.url
      );

      setNotice(
        'Signature image uploaded successfully.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not upload signature image.'
      );
    } finally {
      setUploadingSignature(false);
    }
  }
  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading marketing identity...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-orange-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-blue-700" />

            <h2 className="text-xl font-bold text-slate-900">
              Marketing Identity and Email Signature
            </h2>
          </div>

          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            This information becomes your professional email footer,
            sender identity and public contact card.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Profile Completeness
          </div>

          <div className="mt-1 text-xl font-bold text-slate-900">
            {completeness.complete}
            {' / '}
            {completeness.total}
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

      <div className="mt-5 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
            {form
              .marketing_headshot_url ? (
              <img
                src={
                  form
                    .marketing_headshot_url
                }
                alt={
                  form
                    .marketing_from_name ||
                  'Headshot'
                }
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-slate-400">
                <UserRound className="h-20 w-20" />
              </div>
            )}
          </div>

          <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}

            {uploading
              ? 'Uploading...'
              : 'Upload Headshot'}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file =
                  event.target
                    .files?.[0];

                if (file) {
                  uploadHeadshot(
                    file
                  );
                }

                event.target.value =
                  '';
              }}
            />
          </label>

          <p className="mt-2 text-xs text-slate-500">
            JPG, PNG or WebP. Maximum 8 MB.
          </p>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Public Name
              </span>

              <input
                value={
                  form
                    .marketing_from_name
                }
                onChange={(event) =>
                  updateField(
                    'marketing_from_name',
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Professional Title
              </span>

              <input
                value={
                  form
                    .marketing_title
                }
                onChange={(event) =>
                  updateField(
                    'marketing_title',
                    event.target.value
                  )
                }
                placeholder="REALTOR®, Broker, Team Lead..."
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Brokerage or Team
              </span>

              <input
                value={
                  form
                    .marketing_brokerage
                }
                onChange={(event) =>
                  updateField(
                    'marketing_brokerage',
                    event.target.value
                  )
                }
                placeholder="MPRE Boise | Homes of Idaho"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone
              </span>

              <input
                value={
                  form
                    .marketing_phone
                }
                onChange={(event) =>
                  updateField(
                    'marketing_phone',
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sender Email
              </span>

              <input
                type="email"
                value={
                  form
                    .marketing_from_email
                }
                onChange={(event) =>
                  updateField(
                    'marketing_from_email',
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reply-To Email
              </span>

              <input
                type="email"
                value={
                  form
                    .marketing_reply_to_email
                }
                onChange={(event) =>
                  updateField(
                    'marketing_reply_to_email',
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Website
              </span>

              <input
                value={
                  form
                    .marketing_website_url
                }
                onChange={(event) =>
                  updateField(
                    'marketing_website_url',
                    event.target.value
                  )
                }
                placeholder="https://www.mpre.homes"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                License Number
              </span>

              <input
                value={
                  form
                    .marketing_license_number
                }
                onChange={(event) =>
                  updateField(
                    'marketing_license_number',
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Signature or Tagline
            </span>

            <textarea
              value={
                form
                  .marketing_signature_text
              }
              onChange={(event) =>
                updateField(
                  'marketing_signature_text',
                  event.target.value
                )
              }
              rows={4}
              placeholder="Make it a super blessed day! I am always here when you need me."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">
              Office and Appointment Information
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Office Phone
                </span>

                <input
                  value={
                    form
                      .marketing_office_phone
                  }
                  onChange={(event) =>
                    updateField(
                      'marketing_office_phone',
                      event.target.value
                    )
                  }
                  placeholder="Separate from your mobile phone"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Appointment Booking Link
                </span>

                <input
                  value={
                    form
                      .marketing_appointment_url
                  }
                  onChange={(event) =>
                    updateField(
                      'marketing_appointment_url',
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Public Office Address
              </span>

              <textarea
                value={
                  form
                    .marketing_office_address
                }
                onChange={(event) =>
                  updateField(
                    'marketing_office_address',
                    event.target.value
                  )
                }
                rows={2}
                placeholder="Public-facing office location"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <p className="mt-2 text-xs text-slate-500">
              The public office address may appear in your contact card.
              The compliance mailing address remains a separate required field.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">
              Professional Background
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Separate multiple entries with commas.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Professional Designations
                </span>

                <input
                  value={
                    form
                      .marketing_designations
                  }
                  onChange={(event) =>
                    updateField(
                      'marketing_designations',
                      event.target.value
                    )
                  }
                  placeholder="REALTOR®, CRS, ABR..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Certifications
                </span>

                <input
                  value={
                    form
                      .marketing_certifications
                  }
                  onChange={(event) =>
                    updateField(
                      'marketing_certifications',
                      event.target.value
                    )
                  }
                  placeholder="Certified Master Inspector..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service Areas
                </span>

                <input
                  value={
                    form
                      .marketing_service_areas
                  }
                  onChange={(event) =>
                    updateField(
                      'marketing_service_areas',
                      event.target.value
                    )
                  }
                  placeholder="Boise, Meridian, Eagle..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Languages Spoken
                </span>

                <input
                  value={
                    form
                      .marketing_languages
                  }
                  onChange={(event) =>
                    updateField(
                      'marketing_languages',
                      event.target.value
                    )
                  }
                  placeholder="English, Spanish..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Real Estate / Legal Disclaimer
            </span>

            <textarea
              value={
                form
                  .marketing_disclaimer
              }
              onChange={(event) =>
                updateField(
                  'marketing_disclaimer',
                  event.target.value
                )
              }
              rows={4}
              placeholder="Optional public-facing real-estate, brokerage or legal disclaimer"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Compliance Mailing Address
            </span>

            <textarea
              value={
                form
                  .marketing_physical_address
              }
              onChange={(event) =>
                updateField(
                  'marketing_physical_address',
                  event.target.value
                )
              }
              rows={2}
              placeholder="Required for commercial email compliance"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Social Profiles
            </h3>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[
                [
                  'marketing_facebook_url',
                  'Facebook URL',
                ],
                [
                  'marketing_instagram_url',
                  'Instagram URL',
                ],
                [
                  'marketing_linkedin_url',
                  'LinkedIn URL',
                ],
                [
                  'marketing_youtube_url',
                  'YouTube URL',
                ],
                [
                  'marketing_tiktok_url',
                  'TikTok URL',
                ],
                [
                  'marketing_x_url',
                  'X.com URL',
                ],
              ].map(
                (
                  [
                    field,
                    label,
                  ]
                ) => (
                  <label
                    key={field}
                  >
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </span>

                    <input
                      value={
                        form[
                          field as keyof IdentityForm
                        ] as string
                      }
                      onChange={(event) =>
                        updateField(
                          field as keyof IdentityForm,
                          event.target
                            .value as never
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </label>
                )
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={
                form
                  .marketing_email_enabled
              }
              onChange={(event) =>
                updateField(
                  'marketing_email_enabled',
                  event.target.checked
                )
              }
            />

            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Enable marketing email
              </span>

              <span className="block text-xs text-slate-500">
                Campaign test and sending tools may use this identity.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={saveIdentity}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {saving
              ? 'Saving...'
              : 'Save Marketing Identity'}
          </button>
        </div>
      </div>
    </section>
  );
}


