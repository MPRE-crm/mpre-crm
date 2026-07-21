'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  Building2,
  Camera,
  CheckCircle2,
  LockKeyhole,
  Loader2,
  Save,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../lib/supabase-browser';

const supabase = getSupabaseBrowser();

type BrandSettings = {
  brand_key: string;
  brand_name: string;
  master_logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_active: boolean;
};

const EMPTY_BRAND: BrandSettings = {
  brand_key: 'mpre',
  brand_name: 'MPRE',
  master_logo_url:
    'https://easyrealtor.homes/MPREcrm.png',
  primary_color: '#0f172a',
  secondary_color: '#ffffff',
  accent_color: '#d97706',
  is_active: true,
};

export default function PlatformBrandCard() {
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [uploading, setUploading] =
    useState(false);
  const [canEdit, setCanEdit] =
    useState(false);
  const [brand, setBrand] =
    useState<BrandSettings>(
      EMPTY_BRAND
    );
  const [error, setError] =
    useState<string | null>(null);
  const [notice, setNotice] =
    useState<string | null>(null);

  async function accessToken() {
    const {
      data,
      error: sessionError,
    } = await supabase.auth.getSession();

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

  async function loadBrand() {
    try {
      setLoading(true);
      setError(null);

      const token = await accessToken();
      const response = await fetch(
        '/api/preferences/platform-brand',
        {
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
            'Could not load MPRE branding.'
        );
      }

      setCanEdit(
        Boolean(result.can_edit)
      );
      setBrand(
        result.brand as BrandSettings
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load MPRE branding.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBrand();
  }, []);

  function updateBrand<K extends keyof BrandSettings>(
    field: K,
    value: BrandSettings[K]
  ) {
    setBrand((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function saveBrand() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const token = await accessToken();
      const response = await fetch(
        '/api/preferences/platform-brand',
        {
          method: 'PATCH',
          headers: {
            Authorization:
              `Bearer ${token}`,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(brand),
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
            'Could not save MPRE branding.'
        );
      }

      setBrand(
        result.brand as BrandSettings
      );
      setNotice(
        'MPRE master branding saved successfully.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not save MPRE branding.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(
    file: File
  ) {
    try {
      setUploading(true);
      setError(null);
      setNotice(null);

      const token = await accessToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        '/api/preferences/platform-brand/logo',
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
            'Could not upload the MPRE logo.'
        );
      }

      updateBrand(
        'master_logo_url',
        result.url
      );
      setNotice(
        'MPRE master logo uploaded successfully.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not upload the MPRE logo.'
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading MPRE brand settings...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-5 text-white shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-bold">
              MPRE Master Brand
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            MPRE is the company-wide master brand. Each organization adds its
            own market name, such as MPRE Boise or MPRE Twin Falls.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
            <LockKeyhole className="h-4 w-4" />
            Brand Control
          </div>
          <div className="mt-1 font-bold text-amber-300">
            {canEdit
              ? 'Platform admin editable'
              : 'Inherited and locked'}
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/15 p-3 text-sm font-medium text-emerald-100">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-3 text-sm font-medium text-red-100">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/15 bg-white p-5">
          <div className="flex min-h-36 items-center justify-center">
            <img
              src={brand.master_logo_url}
              alt="MPRE"
              className="max-h-32 max-w-full object-contain"
            />
          </div>

          {canEdit && (
            <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {uploading
                ? 'Uploading...'
                : 'Replace MPRE Logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];
                  if (file) uploadLogo(file);
                  event.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Master Brand Name
            </span>
            <input
              value={brand.brand_name}
              disabled={!canEdit}
              onChange={(event) =>
                updateBrand(
                  'brand_name',
                  event.target.value
                )
              }
              className="w-full rounded-2xl border border-white/20 bg-white px-3 py-2.5 text-sm text-slate-950 disabled:bg-slate-200"
            />
          </label>


          {[
            ['primary_color', 'Primary Color'],
            ['secondary_color', 'Secondary Color'],
            ['accent_color', 'Accent Color'],
          ].map(([field, label]) => (
            <label key={field}>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                {label}
              </span>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={
                    brand[
                      field as keyof BrandSettings
                    ] as string
                  }
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateBrand(
                      field as keyof BrandSettings,
                      event.target.value as never
                    )
                  }
                  className="h-11 w-14 rounded-xl border border-white/20 bg-white p-1 disabled:opacity-60"
                />
                <input
                  value={
                    brand[
                      field as keyof BrandSettings
                    ] as string
                  }
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateBrand(
                      field as keyof BrandSettings,
                      event.target.value as never
                    )
                  }
                  className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white px-3 py-2.5 text-sm text-slate-950 disabled:bg-slate-200"
                />
              </div>
            </label>
          ))}

          {canEdit && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={saveBrand}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving
                  ? 'Saving...'
                  : 'Save MPRE Brand'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
