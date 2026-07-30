'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Image as ImageIcon,
  Images,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { getSupabaseBrowser } from '../../../../lib/supabase-browser';
import {
  LISTING_PHOTO_CATEGORY_LABELS,
  isListingPhotoCategory,
} from '../../../../lib/listing-photo-categories';
import {
  FIRST_PHASE_SOCIAL_TEMPLATES,
  SOCIAL_CAMPAIGN_LABELS,
  SOCIAL_CREATIVE_TARGETS,
  SOCIAL_FORMAT_LABELS,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_SUITE_PHOTO_COUNT,
  buildSocialCreativeViewModel,
  socialTemplateForTarget,
  verifiedPhotoLabel,
  type SocialAgentBrand,
  type SocialBrokerageBrand,
  type SocialCreativeAsset,
  type SocialCreativePhoto,
  type SocialCreativeTargetKey,
  type SocialListingFacts,
  type SocialOrganizationBrand,
  type SocialReadinessIssue,
  type SocialVisualStyle,
} from '../../../../lib/listing-social-creative';
import ListingSocialCreativePreview, {
  downloadSocialCreativePng,
  socialCreativeRequiredImageUrls,
} from './ListingSocialCreativePreview';

const supabase = getSupabaseBrowser();

type StudioListing = SocialListingFacts & {
  id: string;
  owner_user_id: string | null;
};
type StudioSection = {
  status: string;
  template_key: string;
  content: Record<string, unknown>;
};
type StudioPhoto = {
  id: string;
  public_url: string;
  use_in_marketing: boolean;
};
type StudioAssignment = {
  section_key: string;
  slot_key: string;
  sort_order: number;
  media_id: string;
};
type PanelProps = {
  listing: StudioListing;
  section: StudioSection | null;
  photos: StudioPhoto[];
  assignments: StudioAssignment[];
  saving: boolean;
  onApprove: () => Promise<void>;
};
type PhotoAnalysis = {
  media_id: string;
  analysis_status: 'complete' | 'failed' | 'needs_review' | null;
  primary_category: string | null;
  room_label: string | null;
  label_source: 'samantha' | 'user' | null;
  label_locked: boolean;
};
type MarketingIdentity = {
  name: string | null;
  marketing_from_name: string | null;
  marketing_phone: string | null;
  marketing_title: string | null;
  marketing_brokerage: string | null;
  marketing_website_url: string | null;
  marketing_headshot_url: string | null;
  marketing_logo_url: string | null;
};
type MarketingBrand = {
  name: string | null;
  logo_url: string | null;
};
type MarketingIdentityPayload = {
  profile: MarketingIdentity;
  branding: {
    personal: MarketingBrand;
    organization: MarketingBrand;
    brokerage: MarketingBrand;
  };
};
type Loaded<T> = { requestKey: string; value: T };

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map(text).filter(Boolean)))
    : [];
}

function socialPhotoIds(
  assignments: StudioAssignment[],
  slideCount: number
) {
  const social = assignments.filter(
    ({ section_key }) => section_key === 'social'
  );
  const find = (slot: string, order: number) =>
    social.find(
      ({ slot_key, sort_order }) =>
        slot_key === slot && sort_order === order
    )?.media_id || '';

  return slideCount > 0
    ? [
        find('primary', 0),
        ...Array.from(
          { length: slideCount - 1 },
          (_, index) => find('carousel', index)
        ),
      ]
    : [];
}

function categoryLabel(analysis: PhotoAnalysis | undefined) {
  const category = analysis?.primary_category;
  return isListingPhotoCategory(category)
    ? LISTING_PHOTO_CATEGORY_LABELS[category]
    : '';
}

function filenamePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function ReadinessCard({
  label,
  value,
  detail,
  ready,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  ready: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        {icon}
        {label}
      </div>
      <div
        className={`mt-2 text-lg font-bold ${
          ready ? 'text-emerald-700' : 'text-amber-700'
        }`}
      >
        {value}
      </div>
      {detail && <div className="mt-1 text-xs text-slate-600">{detail}</div>}
    </div>
  );
}

function Readiness({ issues }: { issues: SocialReadinessIssue[] }) {
  const ready = !issues.some(
    ({ severity }) =>
      severity === 'blocking'
  );
  const hasWarnings = issues.some(
    ({ severity }) =>
      severity === 'warning'
  );

  return (
    <div
      id="social-readiness"
      role="status"
      aria-live="polite"
      className={`mt-5 rounded-2xl border p-4 ${
        ready && !hasWarnings
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}
    >
      <div className="flex items-center gap-2 font-bold">
        {ready ? (
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
        ) : (
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        )}
        {ready
          ? hasWarnings
            ? 'Ready with review notes.'
            : 'Ready for Social-section approval.'
          : 'Review before approval'}
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {issues.map((issue) => (
            <li key={issue.code} className="flex items-start gap-2">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                  issue.severity === 'blocking'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {issue.severity === 'blocking' ? 'Required' : 'Review'}
              </span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TargetSelector({
  selected,
  onSelect,
}: {
  selected: SocialCreativeTargetKey;
  onSelect: (
    target: SocialCreativeTargetKey
  ) => void;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <Images
          aria-hidden="true"
          className="h-5 w-5 text-fuchsia-700"
        />
        <h4 className="font-bold text-slate-950">
          Creative Target
        </h4>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Platform and format selection stay local to this preview and do not
        change the prepared Social section.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SOCIAL_CREATIVE_TARGETS.map(
          (target) => {
            const active =
              target.key === selected;

            return (
              <button
                key={target.key}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onSelect(target.key)
                }
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:ring-offset-2 ${
                  active
                    ? 'border-fuchsia-500 bg-white ring-2 ring-fuchsia-100'
                    : 'border-slate-200 bg-white/80 hover:border-fuchsia-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-slate-950">
                    {target.shortName}
                  </strong>
                  {active && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-fuchsia-700"
                    />
                  )}
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">
                  {target.description}
                </p>
                <div className="mt-3 text-xs font-bold text-fuchsia-700">
                  {target.assetCount}{' '}
                  {target.assetCount === 1
                    ? 'asset'
                    : 'assets'}{' '}
                  · {target.width} ×{' '}
                  {target.height}
                </div>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

function StyleSelector({
  selected,
  onSelect,
}: {
  selected: SocialVisualStyle;
  onSelect: (style: SocialVisualStyle) => void;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <Palette aria-hidden="true" className="h-5 w-5 text-fuchsia-700" />
        <h4 className="font-bold text-slate-950">Preview Style</h4>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Style selection is local to this preview and does not change the
        prepared Social section.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {FIRST_PHASE_SOCIAL_TEMPLATES.map((template) => {
          const templateStyle = template.selection.visualStyle;
          const active = templateStyle === selected;

          return (
            <button
              key={template.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(templateStyle)}
              className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:ring-offset-2 ${
                active
                  ? 'border-fuchsia-500 bg-white ring-2 ring-fuchsia-100'
                  : 'border-slate-200 bg-white/80 hover:border-fuchsia-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <strong className="text-slate-950">{template.name}</strong>
                {active && (
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-fuchsia-700"
                  />
                )}
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-600">
                {template.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ListingSocialStudioPanel({
  listing,
  section,
  photos,
  assignments,
  saving,
  onApprove,
}: PanelProps) {
  const [style, setStyle] = useState<SocialVisualStyle>('luxury');
  const [targetKey, setTargetKey] =
    useState<SocialCreativeTargetKey>(
      'instagram_carousel'
    );
  const [analyses, setAnalyses] =
    useState<Loaded<Record<string, PhotoAnalysis>> | null>(null);
  const [identity, setIdentity] =
    useState<Loaded<MarketingIdentityPayload> | null>(null);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [loadingIdentity, setLoadingIdentity] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [confirmedCampaign, setConfirmedCampaign] =
    useState<string | null>(null);
  const [exporting, setExporting] =
    useState<string | null>(null);
  const [exportError, setExportError] =
    useState<string | null>(null);
  const [exportNotice, setExportNotice] =
    useState<string | null>(null);
  const [copyNotice, setCopyNotice] =
    useState<string | null>(null);
  const previewRefs = useRef<
    Map<number, SVGSVGElement>
  >(new Map());

  const selectedTemplate =
    socialTemplateForTarget(
      targetKey,
      style
    );
  const photoIds = useMemo(
    () =>
      socialPhotoIds(
        assignments,
        SOCIAL_SUITE_PHOTO_COUNT
      ),
    [assignments]
  );
  const photoKey = [listing.id, ...photoIds].join('|');
  const identityKey = [
    listing.id,
    listing.owner_user_id || 'unassigned',
  ].join('|');
  const campaignKey = [
    identityKey,
    selectedTemplate?.selection.campaignPurpose || '',
    selectedTemplate?.selection.version || '',
  ].join('|');
  const campaignConfirmed = confirmedCampaign === campaignKey;

  useEffect(() => {
    let active = true;

    async function loadLabels() {
      setAnalyses(null);
      setLabelError(null);
      const ids = Array.from(new Set(photoIds.filter(Boolean)));

      if (ids.length === 0) {
        setLoadingLabels(false);
        return;
      }

      try {
        setLoadingLabels(true);
        const { data, error } = await supabase
          .from('listing_media_ai_analysis')
          .select(`
            media_id,
            analysis_status,
            primary_category,
            room_label,
            label_source,
            label_locked
          `)
          .eq('listing_id', listing.id)
          .in('media_id', ids);

        if (error) {
          throw error;
        }

        const rows: Record<string, PhotoAnalysis> = {};
        for (const row of data || []) {
          const item = row as PhotoAnalysis;
          rows[item.media_id] = item;
        }

        if (active) {
          setAnalyses({ requestKey: photoKey, value: rows });
        }
      } catch {
        if (active) {
          setAnalyses(null);
          setLabelError('Could not load the saved photo labels.');
        }
      } finally {
        if (active) {
          setLoadingLabels(false);
        }
      }
    }

    void loadLabels();
    return () => {
      active = false;
    };
  }, [listing.id, photoIds, photoKey]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setIdentity(null);
    setIdentityError(null);

    if (!listing.owner_user_id) {
      setLoadingIdentity(false);
      setIdentityError('This listing does not have an assigned owner.');
      return () => {
        active = false;
        controller.abort();
      };
    }

    async function loadIdentity() {
      try {
        setLoadingIdentity(true);
        const { data: sessionResult, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionResult.session) {
          throw new Error('Your CRM session expired.');
        }

        const response = await fetch(
          `/api/preferences/marketing-identity?listing_id=${encodeURIComponent(
            listing.id
          )}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${sessionResult.session.access_token}`,
            },
          }
        );
        const result = await response.json().catch(() => ({}));

        if (
          !response.ok ||
          !result?.ok ||
          !result?.profile ||
          !result?.branding?.personal ||
          !result?.branding?.organization ||
          !result?.branding?.brokerage
        ) {
          throw new Error(
            result?.error ||
              'Could not load the listing owner’s marketing identity.'
          );
        }

        if (active) {
          setIdentity({
            requestKey: identityKey,
            value: {
              profile:
                result.profile as MarketingIdentity,
              branding:
                result.branding as MarketingIdentityPayload['branding'],
            },
          });
        }
      } catch (error: unknown) {
        const aborted =
          error instanceof DOMException && error.name === 'AbortError';

        if (active && !aborted) {
          setIdentity(null);
          setIdentityError(
            error instanceof Error
              ? error.message
              : 'Could not load the listing owner’s marketing identity.'
          );
        }
      } finally {
        if (active) {
          setLoadingIdentity(false);
        }
      }
    }

    void loadIdentity();
    return () => {
      active = false;
      controller.abort();
    };
  }, [identityKey, listing.id, listing.owner_user_id]);

  const activeAnalyses: Record<string, PhotoAnalysis> =
    analyses?.requestKey === photoKey ? analyses.value : {};
  const loadedIdentity =
    identity?.requestKey === identityKey
      ? identity.value
      : null;
  const profile = loadedIdentity?.profile || null;
  const savedBranding =
    loadedIdentity?.branding || null;
  const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
  const creativePhotos = photoIds.map(
    (id): SocialCreativePhoto | null => {
      const photo = photoMap.get(id);
      if (!photo?.use_in_marketing || !text(photo.public_url)) {
        return null;
      }

      const analysis = activeAnalyses[id];
      return {
        id,
        url: photo.public_url,
        verifiedLabel: verifiedPhotoLabel({
          analysisStatus: analysis?.analysis_status || null,
          labelSource: analysis?.label_source || null,
          labelLocked: Boolean(analysis?.label_locked),
          roomLabel: text(analysis?.room_label),
          categoryLabel: categoryLabel(analysis),
        }),
      };
    }
  );
  const agent: SocialAgentBrand = {
    name: text(profile?.marketing_from_name) || text(profile?.name),
    title: text(profile?.marketing_title),
    phone: text(profile?.marketing_phone),
    websiteUrl: text(profile?.marketing_website_url),
    headshotUrl: text(profile?.marketing_headshot_url),
    logoUrl: text(savedBranding?.personal.logo_url),
  };
  const organization: SocialOrganizationBrand = {
    name: text(savedBranding?.organization.name),
    logoUrl: text(savedBranding?.organization.logo_url),
  };
  const brokerage: SocialBrokerageBrand = {
    name: text(savedBranding?.brokerage.name),
    logoUrl: text(savedBranding?.brokerage.logo_url),
  };
  const preparedHeadline = text(
    section?.content?.headline
  );
  const instagramCaption = text(
    section?.content?.instagram_caption
  );
  const facebookCaption = text(
    section?.content?.facebook_caption
  );
  const linkedinCaption = text(
    section?.content?.linkedin_caption
  );
  const hashtags = stringList(section?.content?.hashtags);
  const creative = buildSocialCreativeViewModel(selectedTemplate, {
    listing,
    photos: creativePhotos,
    agentBrand: agent,
    organizationBrand: organization,
    brokerageBrand: brokerage,
    preparedCopy: {
      headline: preparedHeadline,
      instagramCaption,
      facebookCaption,
      linkedinCaption,
      hashtags,
    },
    sectionStatus: section?.status || null,
    campaignConfirmed,
  });
  const template = creative.template;
  const target =
    SOCIAL_CREATIVE_TARGETS.find(
      (candidate) =>
        candidate.key === targetKey
    ) || null;
  const platform = template
    ? SOCIAL_PLATFORM_LABELS[template.selection.platform]
    : 'Social';
  const format = template
    ? SOCIAL_FORMAT_LABELS[template.selection.format]
    : 'Template unavailable';
  const campaign = template
    ? SOCIAL_CAMPAIGN_LABELS[template.selection.campaignPurpose]
    : 'Campaign unavailable';
  const loading = loadingLabels || loadingIdentity;
  const required = creative.metrics.requiredPhotoCount;
  const cards = [
    {
      label: 'Social Photos',
      value: `${creative.metrics.uniquePhotoCount}/${required} unique`,
      detail: `${creative.metrics.filledPhotoCount} slots filled`,
      ready: required > 0 && creative.metrics.uniquePhotoCount === required,
      icon: <ImageIcon aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: 'Verified Labels',
      value: `${creative.metrics.verifiedLabelCount}/${required} verified`,
      ready: required > 0 && creative.metrics.verifiedLabelCount === required,
      icon: <ShieldCheck aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: 'Owner Brand',
      value: creative.metrics.brandingReady ? 'Ready' : 'Needs attention',
      ready: creative.metrics.brandingReady,
      icon: <Sparkles aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: 'Campaign',
      value: campaignConfirmed ? 'Confirmed' : 'Confirmation needed',
      detail: campaign,
      ready: campaignConfirmed,
      icon: <Images aria-hidden="true" className="h-4 w-4" />,
    },
  ];

  function exportFilename(
    asset: SocialCreativeAsset
  ) {
    const listingSlug =
      filenamePart(
        listing.property_address ||
          listing.title
      ) || 'listing';
    const platformSlug =
      filenamePart(
        template?.selection.platform ||
          'social'
      );
    const formatSlug =
      filenamePart(
        template?.selection.format ||
          'creative'
      );
    const styleSlug =
      filenamePart(style);
    const sequence =
      String(asset.index + 1).padStart(
        2,
        '0'
      );

    return `${listingSlug}_${platformSlug}_${formatSlug}_${styleSlug}_just-listed_${sequence}_${template?.width || 0}x${template?.height || 0}.png`;
  }

  async function exportAsset(
    asset: SocialCreativeAsset
  ) {
    if (
      !template ||
      !creative.canExport
    ) {
      setExportError(
        'Approve the Social section and resolve every required readiness item before export.'
      );
      return false;
    }

    const svg = previewRefs.current.get(
      asset.index
    );

    if (!svg) {
      setExportError(
        'The selected creative preview is not ready for export.'
      );
      return false;
    }

    const exportKey = `${template.key}:${asset.index}`;
    setExporting(exportKey);
    setExportError(null);
    setExportNotice(null);

    try {
      await downloadSocialCreativePng({
        svg,
        template,
        filename:
          exportFilename(asset),
        requiredImageUrls:
          socialCreativeRequiredImageUrls(
            asset,
            agent,
            organization,
            brokerage
          ),
      });
      return true;
    } catch (error: unknown) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'The PNG export could not be prepared.'
      );
      return false;
    } finally {
      setExporting(null);
    }
  }

  async function exportAllAssets() {
    if (creative.assets.length < 2) {
      return;
    }

    let completed = 0;

    for (const asset of creative.assets) {
      const exported =
        await exportAsset(asset);

      if (!exported) {
        return;
      }

      completed += 1;
    }

    setExportNotice(
      `${completed} PNG assets were prepared for manual download.`
    );
  }

  async function copyPreparedText(
    value: string,
    label: string
  ) {
    setCopyNotice(null);

    if (!value.trim()) {
      setCopyNotice(
        `${label} is not available.`
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );
      setCopyNotice(
        `${label} copied.`
      );
    } catch {
      setCopyNotice(
        `${label} could not be copied in this browser.`
      );
    }
  }

  return (
    <section
      aria-labelledby="social-studio-title"
      aria-busy={loading}
      className="rounded-3xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-orange-50 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-fuchsia-700">
            <Images aria-hidden="true" className="h-5 w-5" />
            {platform} {format}
          </div>
          <h3
            id="social-studio-title"
            className="mt-2 text-xl font-bold text-slate-950"
          >
            {campaign} Social Studio
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Review factual, branded creative for manual cross-platform export.
            Platform, format and style choices remain local to this studio.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || !creative.canApprove}
          aria-describedby="social-readiness"
          onClick={() => void onApprove()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {section?.status === 'approved'
            ? 'Approved'
            : saving
            ? 'Approving...'
            : 'Approve Social Section'}
        </button>
      </div>

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-800"
        >
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading verified labels and listing-owner branding...
        </div>
      )}
      {[labelError, identityError].filter(Boolean).map((message) => (
        <div
          key={message}
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {message}
        </div>
      ))}
      {exportError && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {exportError}
        </div>
      )}
      {exportNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {exportNotice}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <ReadinessCard key={card.label} {...card} />
        ))}
      </div>

      <fieldset className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <legend className="px-1 text-sm font-bold text-violet-950">
          {campaign} eligibility
        </legend>
        <label className="mt-1 flex cursor-pointer items-start gap-3 text-sm text-violet-950">
          <input
            type="checkbox"
            checked={campaignConfirmed}
            disabled={!template}
            onChange={({ target }) =>
              setConfirmedCampaign(target.checked ? campaignKey : null)
            }
            className="mt-0.5 h-4 w-4 rounded border-violet-400 text-violet-700 focus:ring-violet-600"
          />
          <span>I confirm this listing is eligible for the {campaign} claim.</span>
        </label>
        <p className="mt-2 text-xs leading-5 text-violet-800">
          This confirmation is local to the current preview. Eligibility is
          not inferred from listing status.
        </p>
      </fieldset>

      <Readiness issues={creative.issues} />
      <TargetSelector
        selected={targetKey}
        onSelect={(nextTarget) => {
          setTargetKey(nextTarget);
          setExportError(null);
          setExportNotice(null);
          setCopyNotice(null);
          previewRefs.current.clear();
        }}
      />
      <StyleSelector
        selected={style}
        onSelect={(nextStyle) => {
          setStyle(nextStyle);
          setExportError(null);
          setExportNotice(null);
          previewRefs.current.clear();
        }}
      />

      {template && target ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-950">
                {template.name} {target.name}
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {target.assetCount}{' '}
                {target.assetCount === 1
                  ? 'manual PNG asset'
                  : 'coordinated manual PNG assets'}{' '}
                · {template.width} ×{' '}
                {template.height}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-xs font-bold text-fuchsia-700">
                Local preview
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  creative.canExport
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {creative.canExport
                  ? 'Approved for export'
                  : 'Export locked'}
              </span>
              {creative.assets.length > 1 && (
                <button
                  type="button"
                  disabled={
                    !creative.canExport ||
                    Boolean(exporting)
                  }
                  onClick={() =>
                    void exportAllAssets()
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-fuchsia-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {exporting ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <Download
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  )}
                  Download all PNGs
                </button>
              )}
            </div>
          </div>

          {!creative.canExport && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
              Preview remains available while incomplete. Manual PNG export
              requires an approved Social section, all five unique verified
              photos, complete required branding, and campaign confirmation.
            </div>
          )}

          {creative.assets.length > 0 ? (
            <div
              className={
                creative.assets.length > 1
                  ? 'mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3'
                  : template.composition ===
                    'story_reel'
                  ? 'mx-auto mt-4 max-w-sm'
                  : template.composition ===
                    'instagram_single'
                  ? 'mx-auto mt-4 max-w-xl'
                  : template.composition ===
                    'facebook_mosaic'
                  ? 'mx-auto mt-4 max-w-3xl'
                  : 'mx-auto mt-4 max-w-5xl'
              }
            >
              {creative.assets.map((asset) => {
                const exportKey = `${template.key}:${asset.index}`;

                return (
                  <div
                    key={asset.index}
                    className="min-w-0"
                  >
                    <ListingSocialCreativePreview
                      ref={(node) => {
                        if (node) {
                          previewRefs.current.set(
                            asset.index,
                            node
                          );
                        } else {
                          previewRefs.current.delete(
                            asset.index
                          );
                        }
                      }}
                      asset={asset}
                      template={template}
                      agent={agent}
                      organization={
                        organization
                      }
                      brokerage={brokerage}
                      showSafeArea
                    />
                    <button
                      type="button"
                      disabled={
                        !creative.canExport ||
                        Boolean(exporting)
                      }
                      onClick={() =>
                        void exportAsset(asset)
                      }
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-200 bg-white px-3 py-2.5 text-sm font-bold text-fuchsia-700 hover:bg-fuchsia-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {exporting === exportKey ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : (
                        <Download
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      )}
                      Download PNG
                      {asset.totalAssets > 1
                        ? ` ${asset.index + 1}`
                        : ''}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              The selected target could not produce its configured creative.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-600">
          Select an available creative target to display the preview.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Copy
                aria-hidden="true"
                className="h-5 w-5 text-fuchsia-700"
              />
              <h4 className="font-bold text-slate-950">
                {platform} Manual Copy
              </h4>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Copy is prepared for manual review and posting. Nothing is
              published or scheduled from this studio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
              {creative.postCopy.characterCount}{' '}
              characters
            </span>
            {creative.postCopy.source ===
              'deterministic' && (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
                Local draft
              </span>
            )}
          </div>
        </div>
        {creative.postCopy.caption ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
            {creative.postCopy.caption}
          </p>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Prepare the complete marketing package to create this platform’s
            Social caption.
          </div>
        )}
        {creative.postCopy.hashtags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {creative.postCopy.hashtags.map((hashtag) => (
              <span
                key={hashtag}
                className="max-w-full rounded-full bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 [overflow-wrap:anywhere]"
              >
                {hashtag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              !creative.postCopy.caption
            }
            onClick={() =>
              void copyPreparedText(
                creative.postCopy.caption,
                `${platform} caption`
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3.5 py-2 text-sm font-bold text-fuchsia-700 hover:bg-fuchsia-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy
              aria-hidden="true"
              className="h-4 w-4"
            />
            Copy caption
          </button>
          <button
            type="button"
            disabled={
              creative.postCopy.hashtags
                .length === 0
            }
            onClick={() =>
              void copyPreparedText(
                creative.postCopy.hashtags.join(
                  ' '
                ),
                'Hashtags'
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy
              aria-hidden="true"
              className="h-4 w-4"
            />
            Copy hashtags
          </button>
        </div>
        {copyNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 text-sm font-medium text-slate-700"
          >
            {copyNotice}
          </div>
        )}
      </div>
    </section>
  );
}
