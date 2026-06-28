'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { getSupabaseBrowser } from '../../../../lib/supabase-browser';

const supabase = getSupabaseBrowser();

type Role = 'agent' | 'admin' | 'org_admin' | 'platform_admin';

type Profile = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
};

type Organization = {
  id: string;
  name: string | null;
  slug: string | null;
  org_display?: string | null;
  market_name?: string | null;
  city?: string | null;
  state?: string | null;
};

type GuideType =
  | 'relocation'
  | 'fsbo'
  | 'buyer'
  | 'seller'
  | 'home_valuation'
  | 'open_house'
  | 'other';

type GuideAsset = {
  id: string;
  org_id: string;
  guide_type: GuideType;
  title: string;
  year: number | null;
  file_name: string | null;
  file_size_bytes: number | null;
  content_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  public_url: string | null;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  is_active: boolean;
  uploaded_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  notes: string | null;
};

const GUIDE_TYPES: { value: GuideType; label: string }[] = [
  { value: 'relocation', label: 'Relocation Guide' },
  { value: 'fsbo', label: 'FSBO Guide' },
  { value: 'buyer', label: 'Buyer Guide' },
  { value: 'seller', label: 'Seller Guide' },
  { value: 'home_valuation', label: 'Home Valuation Guide' },
  { value: 'open_house', label: 'Open House Guide' },
  { value: 'other', label: 'Other Lead Magnet' },
];

function formatBytes(bytes?: number | null) {
  if (!bytes) return '-';

  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;

  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;

  return `${bytes} B`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function orgDisplayName(org?: Organization | null) {
  if (!org) return 'Unknown org';
  return org.org_display || org.name || org.slug || org.id;
}

function guideTypeLabel(value: string) {
  return GUIDE_TYPES.find((type) => type.value === value)?.label || value;
}

function guideDisplayTitle(titleValue?: string | null, yearValue?: string | number | null) {
  const cleanTitle = String(titleValue || '').trim();
  const parsedYear = Number(String(yearValue || '').trim());

  if (!cleanTitle) return '';

  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    return cleanTitle;
  }

  if (new RegExp(`^\\s*${parsedYear}\\b`).test(cleanTitle)) {
    return cleanTitle;
  }

  return `${parsedYear} ${cleanTitle}`;
}
function safeSlug(value?: string | null) {
  return (
    String(value || 'org')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'org'
  );
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .replace(/-+/g, '-') || 'guide-file'
  );
}

function statusClasses(status: GuideAsset['status'], active: boolean) {
  if (active && status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'archived') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'deleted') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function AdminGuidesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [guides, setGuides] = useState<GuideAsset[]>([]);

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [guideType, setGuideType] = useState<GuideType>('relocation');
  const [title, setTitle] = useState('Boise Idaho Area Relocation Guide');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState('');
  const [makeActive, setMakeActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const canManage =
    profile?.role === 'platform_admin' ||
    profile?.role === 'admin' ||
    profile?.role === 'org_admin';

  const canSeeAllOrgs = profile?.role === 'platform_admin';

  const displayTitlePreview = useMemo(() => guideDisplayTitle(title, year), [title, year]);

  const orgById = useMemo(() => {
    const map = new Map<string, Organization>();
    orgs.forEach((org) => map.set(org.id, org));
    return map;
  }, [orgs]);

  const visibleGuides = useMemo(() => {
    return [...guides]
      .filter((guide) => guide.status !== 'deleted')
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
      });
  }, [guides]);

  async function loadData() {
    setLoading(true);
    setError(null);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userRes?.user) {
      setError(userErr?.message || 'Not authenticated.');
      setLoading(false);
      return;
    }

    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, role, org_id')
      .eq('id', userRes.user.id)
      .single();

    if (profileErr || !profileRow) {
      setError(profileErr?.message || 'Profile not found.');
      setLoading(false);
      return;
    }

    const typedProfile = profileRow as Profile;
    setProfile(typedProfile);

    if (typedProfile.role === 'agent') {
      setOrgs([]);
      setGuides([]);
      setLoading(false);
      return;
    }

    let orgQuery = supabase
      .from('organizations')
      .select('id, name, slug, org_display, market_name, city, state')
      .order('name', { ascending: true });

    if (typedProfile.role !== 'platform_admin') {
      orgQuery = orgQuery.eq('id', typedProfile.org_id);
    }

    const { data: orgData, error: orgErr } = await orgQuery;

    if (orgErr) {
      setError(orgErr.message);
      setLoading(false);
      return;
    }

    const orgRows = (orgData || []) as Organization[];
    setOrgs(orgRows);

    const defaultOrgId =
      typedProfile.org_id ||
      orgRows.find((org) => org.slug === 'mpre-boise')?.id ||
      orgRows[0]?.id ||
      '';

    setSelectedOrgId((current) => current || defaultOrgId);

    let guideQuery = supabase
      .from('guide_assets')
      .select(
        'id, org_id, guide_type, title, year, file_name, file_size_bytes, content_type, storage_bucket, storage_path, public_url, status, is_active, uploaded_at, updated_at, archived_at, deleted_at, notes'
      )
      .order('uploaded_at', { ascending: false });

    if (typedProfile.role !== 'platform_admin') {
      guideQuery = guideQuery.eq('org_id', typedProfile.org_id);
    }

    const { data: guideData, error: guideErr } = await guideQuery;

    if (guideErr) {
      setError(guideErr.message);
      setLoading(false);
      return;
    }

    setGuides((guideData || []) as GuideAsset[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || !profile) {
      setError('Only admins and platform admins can manage guide assets.');
      return;
    }

    if (!selectedOrgId) {
      setError('Choose an organization first.');
      return;
    }

    if (!file) {
      setError('Choose a guide file first.');
      return;
    }

    if (file.size > 250000000) {
      setError('File is too large. Max size is 250 MB.');
      return;
    }

    const selectedOrg = orgById.get(selectedOrgId);

    if (!selectedOrg) {
      setError('Selected organization was not found.');
      return;
    }

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError('Add a guide title.');
      return;
    }

    const yearNumber = year.trim() ? Number(year.trim()) : null;

    if (yearNumber !== null && (!Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100)) {
      setError('Guide year must be blank or a valid year.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const orgSlug = safeSlug(selectedOrg.slug || selectedOrg.name || selectedOrg.id);
      const cleanFile = safeFileName(file.name);
      const storagePath = `${orgSlug}/${guideType}/${yearNumber || 'undated'}/${Date.now()}-${cleanFile}`;

      const { error: uploadErr } = await supabase.storage
        .from('guide-assets')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/pdf',
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('guide-assets')
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData.publicUrl;
      const nowIso = new Date().toISOString();

      if (makeActive) {
        const { error: archiveErr } = await supabase
          .from('guide_assets')
          .update({
            is_active: false,
            status: 'archived',
            archived_by: profile.id,
            archived_at: nowIso,
            updated_by: profile.id,
            updated_at: nowIso,
          })
          .eq('org_id', selectedOrgId)
          .eq('guide_type', guideType)
          .eq('status', 'active')
          .eq('is_active', true);

        if (archiveErr) {
          await supabase.storage.from('guide-assets').remove([storagePath]);
          throw archiveErr;
        }
      }

      const { error: insertErr } = await supabase.from('guide_assets').insert({
        org_id: selectedOrgId,
        guide_type: guideType,
        title: cleanTitle,
        year: yearNumber,
        file_name: file.name,
        file_size_bytes: file.size,
        content_type: file.type || 'application/pdf',
        storage_bucket: 'guide-assets',
        storage_path: storagePath,
        public_url: publicUrl,
        status: makeActive ? 'active' : 'draft',
        is_active: makeActive,
        uploaded_by: profile.id,
        updated_by: profile.id,
        notes: notes.trim() || null,
        metadata: {
          uploaded_from: 'dashboard_admin_guides',
          org_slug: orgSlug,
          display_title: guideDisplayTitle(cleanTitle, yearNumber),
          guide_year: yearNumber,
          guide_type: guideType,
        },
      });

      if (insertErr) {
        await supabase.storage.from('guide-assets').remove([storagePath]);
        throw insertErr;
      }

      setFile(null);
      setFileInputKey((current) => current + 1);
      setNotes('');

      await loadData();

      setNotice(makeActive ? 'Guide uploaded and set active.' : 'Guide uploaded as draft.');
    } catch (err: any) {
      setError(err?.message || 'Guide upload failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(guide: GuideAsset) {
    if (!profile || !canManage) return;

    try {
      setActionId(guide.id);
      setError(null);
      setNotice(null);

      const nowIso = new Date().toISOString();

      const { error: archiveErr } = await supabase
        .from('guide_assets')
        .update({
          is_active: false,
          status: 'archived',
          archived_by: profile.id,
          archived_at: nowIso,
          updated_by: profile.id,
          updated_at: nowIso,
        })
        .eq('org_id', guide.org_id)
        .eq('guide_type', guide.guide_type)
        .eq('status', 'active')
        .eq('is_active', true)
        .neq('id', guide.id);

      if (archiveErr) throw archiveErr;

      const { error: activeErr } = await supabase
        .from('guide_assets')
        .update({
          is_active: true,
          status: 'active',
          updated_by: profile.id,
          updated_at: nowIso,
          archived_by: null,
          archived_at: null,
          deleted_by: null,
          deleted_at: null,
        })
        .eq('id', guide.id);

      if (activeErr) throw activeErr;

      await loadData();
      setNotice('Guide is now active.');
    } catch (err: any) {
      setError(err?.message || 'Failed to set guide active.');
    } finally {
      setActionId(null);
    }
  }

  async function handleArchive(guide: GuideAsset) {
    if (!profile || !canManage) return;

    if (guide.is_active && guide.status === 'active') {
      setError('Active guides cannot be archived. Set a replacement guide active first, then archive the old guide.');
      return;
    }

    const ok = window.confirm(`Archive "${guide.title}"? The file will stay in Supabase Storage.`);

    if (!ok) return;

    try {
      setActionId(guide.id);
      setError(null);
      setNotice(null);

      const { error: archiveErr } = await supabase
        .from('guide_assets')
        .update({
          is_active: false,
          status: 'archived',
          archived_by: profile.id,
          archived_at: new Date().toISOString(),
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guide.id);

      if (archiveErr) throw archiveErr;

      await loadData();
      setNotice('Guide archived.');
    } catch (err: any) {
      setError(err?.message || 'Failed to archive guide.');
    } finally {
      setActionId(null);
    }
  }

  async function handleSoftDelete(guide: GuideAsset) {
    if (!profile || !canManage) return;

    if (guide.is_active && guide.status === 'active') {
      setError('Active guides cannot be deleted. Set a replacement guide active first, then delete or archive the old guide.');
      return;
    }

    const ok = window.confirm(
      `Delete "${guide.title}"? The row will be marked deleted. The storage file will not be permanently removed yet.`
    );

    if (!ok) return;

    try {
      setActionId(guide.id);
      setError(null);
      setNotice(null);

      const { error: deleteErr } = await supabase
        .from('guide_assets')
        .update({
          is_active: false,
          status: 'deleted',
          deleted_by: profile.id,
          deleted_at: new Date().toISOString(),
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guide.id);

      if (deleteErr) throw deleteErr;

      await loadData();
      setNotice('Guide deleted from active library.');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete guide.');
    } finally {
      setActionId(null);
    }
  }

  async function copyLink(url?: string | null) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setNotice('Guide link copied.');
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading guide assets...</div>;
  }

  if (!canManage) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
          <ShieldAlert className="h-3.5 w-3.5" />
          Admin Only
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Guide Assets</h1>
        <p className="mt-2 text-sm text-slate-500">
          This page is only available to admins and platform admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <FileText className="h-3.5 w-3.5" />
              Org Guide Assets
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {canSeeAllOrgs ? 'Guides Across All Orgs' : 'Guides for Your Org'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Manage public lead-magnet guides used by landing pages, Samantha, email, and SMS.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible Guides</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{visibleGuides.length}</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Guides</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {visibleGuides.filter((g) => g.is_active && g.status === 'active').length}
          </div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drafts</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {visibleGuides.filter((g) => g.status === 'draft').length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orgs Visible</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{orgs.length}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Upload / Replace Guide</h2>
          <p className="mt-1 text-sm text-slate-500">
            Uploads go to the Supabase guide-assets bucket. Leave Set Active unchecked for a draft test.
            Check Set Active when you intentionally want to replace the live guide.
          </p>
        </div>

        <form onSubmit={handleUpload} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <label className="lg:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Organization</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
              disabled={!canSeeAllOrgs}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {orgDisplayName(org)}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Guide Type</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={guideType}
              onChange={(event) => setGuideType(event.target.value as GuideType)}
            >
              {GUIDE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Boise Idaho Area Relocation Guide"
            />
          </label>

          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Year</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              placeholder="2026"
            />
          </label>

          {displayTitlePreview && (
            <div className="lg:col-span-12 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Samantha/email/SMS will call this: <span className="font-semibold">{displayTitlePreview}</span>
            </div>
          )}

          <label className="lg:col-span-6">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">File</span>
            <input
              key={fileInputKey}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700"
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            {file && (
              <div className="mt-1 text-xs text-slate-500">
                Selected: {file.name} ({formatBytes(file.size)})
              </div>
            )}
          </label>

          <label className="lg:col-span-6">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional internal note"
            />
          </label>

          <label className="flex items-center gap-2 lg:col-span-8">
            <input
              type="checkbox"
              checked={makeActive}
              onChange={(event) => setMakeActive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span className="text-sm text-slate-700">
              Set Active now. This archives the previous active guide for this org and guide type.
            </span>
          </label>

          <div className="lg:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {saving ? 'Uploading...' : 'Upload Guide'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Guide Library</h2>
          <p className="mt-1 text-sm text-slate-500">
            Active guide rows are the source used by Samantha guide email/SMS delivery.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {visibleGuides.map((guide) => {
            const org = orgById.get(guide.org_id);
            const active = guide.is_active && guide.status === 'active';
            const displayName = guideDisplayTitle(guide.title, guide.year);

            return (
              <div key={guide.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(guide.status, active)}`}>
                        {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {active ? 'Active' : guide.status}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        <Building2 className="h-3.5 w-3.5" />
                        {orgDisplayName(org)}
                      </span>

                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {guideTypeLabel(guide.guide_type)}
                      </span>

                      {guide.year && (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                          {guide.year}
                        </span>
                      )}
                    </div>

                    <h3 className="truncate text-lg font-semibold text-slate-900">{displayName}</h3>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                      <div>File: {guide.file_name || '-'}</div>
                      <div>Size: {formatBytes(guide.file_size_bytes)}</div>
                      <div>Uploaded: {formatDate(guide.uploaded_at)}</div>
                      <div>Updated: {formatDate(guide.updated_at)}</div>
                    </div>

                    <div className="mt-2 break-all text-xs text-slate-400">
                      {guide.storage_bucket}/{guide.storage_path}
                    </div>

                    {guide.notes && (
                      <p className="mt-2 text-sm text-slate-600">{guide.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {guide.public_url && (
                      <a
                        href={guide.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    )}

                    {guide.public_url && (
                      <button
                        type="button"
                        onClick={() => copyLink(guide.public_url)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    )}

                    {!active && guide.status !== 'deleted' && (
                      <button
                        type="button"
                        disabled={actionId === guide.id}
                        onClick={() => handleSetActive(guide)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Set Active
                      </button>
                    )}

                    {!active && guide.status !== 'archived' && guide.status !== 'deleted' && (
                      <button
                        type="button"
                        disabled={actionId === guide.id}
                        onClick={() => handleArchive(guide)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    )}

                    {!active && guide.status !== 'deleted' && (
                      <button
                        type="button"
                        disabled={actionId === guide.id}
                        onClick={() => handleSoftDelete(guide)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleGuides.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No guide assets found yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

