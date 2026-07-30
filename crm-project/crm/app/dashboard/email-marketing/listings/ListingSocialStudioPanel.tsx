'use client';

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
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
  FIRST_PHASE_SOCIAL_TARGET,
  FIRST_PHASE_SOCIAL_TEMPLATES,
  SOCIAL_CAMPAIGN_LABELS,
  SOCIAL_FORMAT_LABELS,
  SOCIAL_PLATFORM_LABELS,
  buildSocialCreativeViewModel,
  socialTemplateForSelection,
  verifiedPhotoLabel,
  type SocialAgentBrand,
  type SocialBrokerageBrand,
  type SocialCarouselSlide,
  type SocialCreativePhoto,
  type SocialListingFacts,
  type SocialOrganizationBrand,
  type SocialReadinessIssue,
  type SocialTemplateDefinition,
  type SocialVisualStyle,
} from '../../../../lib/listing-social-creative';

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

const TWO_LINES: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

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

function BrandMark({
  brand,
  fallbackLabel,
  compact = false,
  prominent = false,
  suppressLogo = false,
}: {
  brand: SocialOrganizationBrand | SocialBrokerageBrand;
  fallbackLabel: string;
  compact?: boolean;
  prominent?: boolean;
  suppressLogo?: boolean;
}) {
  if (brand.logoUrl && !suppressLogo) {
    return (
      <img
        src={brand.logoUrl}
        alt={`${brand.name || fallbackLabel} logo`}
        loading="lazy"
        className={`shrink-0 object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)] drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${
          prominent
            ? compact
              ? 'max-h-10 max-w-32'
              : 'max-h-12 max-w-36'
            : compact
            ? 'max-h-7 max-w-20'
            : 'max-h-10 max-w-28'
        }`}
      />
    );
  }

  return (
    <span
      className={`min-w-0 font-bold uppercase tracking-[0.1em] ${
        compact ? 'text-[8px]' : 'text-[9px]'
      }`}
      style={TWO_LINES}
    >
      {brand.name || fallbackLabel}
    </span>
  );
}

function BrandFooter({
  organization,
  brokerage,
  borderColor,
}: {
  organization: SocialOrganizationBrand;
  brokerage: SocialBrokerageBrand;
  borderColor: string;
}) {
  const duplicateLogo = Boolean(
    organization.logoUrl &&
      brokerage.logoUrl &&
      organization.logoUrl === brokerage.logoUrl
  );

  return (
    <div
      className="mt-3 flex min-h-10 min-w-0 items-center justify-between gap-3 border-t pt-2.5"
      style={{ borderColor }}
    >
      <div className="flex min-w-0 flex-1 items-center">
        <BrandMark
          brand={organization}
          fallbackLabel="Organization"
          compact
        />
      </div>
      <div className="flex min-w-0 flex-[1.35] items-center justify-end text-right">
        <BrandMark
          brand={brokerage}
          fallbackLabel="Licensed Brokerage"
          compact
          prominent
          suppressLogo={duplicateLogo}
        />
      </div>
    </div>
  );
}

function SlidePreview({
  slide,
  template,
  agent,
  organization,
  brokerage,
}: {
  slide: SocialCarouselSlide;
  template: SocialTemplateDefinition;
  agent: SocialAgentBrand;
  organization: SocialOrganizationBrand;
  brokerage: SocialBrokerageBrand;
}) {
  const tokens = template.tokens;
  const editorial = tokens.layout === 'editorial';
  const banded = tokens.layout === 'banded';
  const framed = tokens.layout === 'framed';
  const headlineLength = Array.from(
    slide.headline.trim()
  ).length;
  const headlineNeedsRoom = headlineLength > 42;
  const headlineIsDense = headlineLength > 88;
  const imageClass = framed
    ? 'absolute left-[6%] right-[6%] top-[6%] h-[52%] w-[88%] object-cover'
    : 'absolute inset-0 h-full w-full object-cover';
  const overlayClass = framed
    ? 'absolute left-[6%] right-[6%] top-[6%] h-[52%]'
    : 'absolute inset-0';
  const contentClass = editorial
    ? `absolute bottom-[4%] left-[4%] right-[8%] overflow-hidden border-l-4 p-4 backdrop-blur-[2px] ${
        slide.showContactCard
          ? 'max-h-[64%]'
          : headlineIsDense
          ? 'max-h-[66%]'
          : headlineNeedsRoom
          ? 'max-h-[59%]'
          : 'max-h-[51%]'
      }`
    : banded
    ? `absolute bottom-0 left-0 right-0 overflow-hidden px-4 pb-4 pt-3 ${
        slide.showContactCard
          ? 'max-h-[60%]'
          : headlineIsDense
          ? 'max-h-[62%]'
          : headlineNeedsRoom
          ? 'max-h-[55%]'
          : 'max-h-[47%]'
      }`
    : `absolute bottom-[4%] left-[6%] right-[6%] overflow-hidden border-t-2 pt-3 ${
        slide.showContactCard
          ? 'top-[46%]'
          : headlineIsDense
          ? 'top-[44%]'
          : headlineNeedsRoom
          ? 'top-[53%]'
          : 'top-[62%]'
      }`;
  const headingClass = editorial
    ? 'whitespace-normal break-words font-normal leading-[1.08] tracking-[-0.02em] [overflow-wrap:anywhere]'
    : banded
    ? 'whitespace-normal break-words font-black uppercase leading-[1.06] tracking-[0.01em] [overflow-wrap:anywhere]'
    : 'whitespace-normal break-words font-semibold leading-[1.08] tracking-[-0.035em] [overflow-wrap:anywhere]';
  const headingFontSize = editorial
    ? headlineIsDense
      ? 'clamp(0.8rem, 4.2cqi, 1rem)'
      : headlineNeedsRoom
      ? 'clamp(0.95rem, 5.4cqi, 1.25rem)'
      : 'clamp(1.1rem, 6.8cqi, 1.5rem)'
    : banded
    ? headlineIsDense
      ? 'clamp(0.75rem, 4cqi, 0.95rem)'
      : headlineNeedsRoom
      ? 'clamp(0.9rem, 5.2cqi, 1.15rem)'
      : 'clamp(1.05rem, 6.4cqi, 1.4rem)'
    : headlineIsDense
    ? 'clamp(0.78rem, 4.1cqi, 0.98rem)'
    : headlineNeedsRoom
    ? 'clamp(0.92rem, 5.2cqi, 1.18rem)'
    : 'clamp(1.05rem, 6.2cqi, 1.35rem)';
  const personalLogoDuplicates = Boolean(
    agent.logoUrl &&
      [organization.logoUrl, brokerage.logoUrl].includes(
        agent.logoUrl
      )
  );

  return (
    <article
      aria-label={`Slide ${slide.index + 1} of ${slide.totalSlides}: ${slide.headline}`}
      className="relative min-w-0 overflow-hidden border shadow-lg"
      style={{
        aspectRatio: `${template.width} / ${template.height}`,
        backgroundColor: tokens.canvas,
        borderColor: tokens.border,
        borderRadius: tokens.radius,
        color: tokens.foreground,
        containerType: 'inline-size',
        fontFamily: tokens.bodyFont,
      }}
    >
      {slide.photo ? (
        <img
          src={slide.photo.url}
          alt={
            slide.photo.verifiedLabel
              ? `${slide.photo.verifiedLabel} listing photo`
              : 'Listing property photo'
          }
          loading="lazy"
          className={imageClass}
          style={{
            filter: tokens.imageFilter,
            borderRadius: framed ? tokens.radius : undefined,
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800 px-8 text-center text-slate-200">
          <ImageIcon aria-hidden="true" className="h-9 w-9" />
          <span className="text-sm font-semibold">
            Assign this carousel photo above
          </span>
        </div>
      )}
      <div
        aria-hidden="true"
        className={overlayClass}
        style={{ background: tokens.overlay }}
      />

      <div
        className={`absolute flex items-start justify-between gap-3 ${
          framed
            ? 'left-[8%] right-[8%] top-[8%]'
            : 'left-4 right-4 top-4 sm:left-5 sm:right-5 sm:top-5'
        }`}
      >
        <span
          className={`max-w-[75%] px-3 py-1.5 text-[10px] font-black uppercase ${
            editorial
              ? 'rounded-sm tracking-[0.2em]'
              : banded
              ? 'rounded-md tracking-[0.14em]'
              : 'rounded-none tracking-[0.18em]'
          }`}
          style={{
            ...TWO_LINES,
            backgroundColor: tokens.chipBackground,
            color: tokens.chipForeground,
          }}
        >
          {slide.eyebrow}
        </span>
        <span
          className={`shrink-0 px-2.5 py-1 text-[10px] font-bold ${
            framed
              ? 'bg-white/85 text-slate-950'
              : 'bg-black/65 text-white'
          }`}
        >
          {slide.index + 1}/{slide.totalSlides}
        </span>
      </div>

      <div
        className={contentClass}
        style={{
          background: tokens.contentBackground,
          borderColor: tokens.border,
        }}
      >
        <h4
          className={headingClass}
          style={{
            fontFamily: tokens.headingFont,
            fontSize: headingFontSize,
          }}
        >
          {slide.headline}
        </h4>
        {slide.detail && (
          <p
            className={`mt-2 break-words ${
              editorial
                ? 'text-xs leading-[1.45]'
                : banded
                ? 'text-xs leading-4 sm:text-sm'
                : 'text-[11px] leading-4 sm:text-xs'
            }`}
            style={{ ...TWO_LINES, color: tokens.muted }}
          >
            {slide.detail}
          </p>
        )}
        {slide.facts.length > 0 && (
          <div
            className={`mt-3 flex flex-wrap ${
              framed ? 'gap-x-3 gap-y-1' : 'gap-1.5'
            }`}
          >
            {slide.facts.map((fact, index) => (
              <span
                key={`${index}:${fact}`}
                title={fact}
                className={`max-w-full text-[10px] font-bold [overflow-wrap:anywhere] ${
                  editorial
                    ? 'border-b px-0.5 py-1'
                    : banded
                    ? 'rounded-md px-2.5 py-1'
                    : 'border-b px-0 py-1 uppercase tracking-[0.08em]'
                }`}
                style={{
                  ...TWO_LINES,
                  borderColor: tokens.border,
                  backgroundColor: banded
                    ? tokens.accent
                    : 'transparent',
                  color: banded
                    ? tokens.accentForeground
                    : tokens.foreground,
                }}
              >
                {fact}
              </span>
            ))}
          </div>
        )}

        {slide.showContactCard ? (
          <>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              {agent.headshotUrl ? (
                <img
                  src={agent.headshotUrl}
                  alt={`${agent.name || 'Listing agent'} headshot`}
                  loading="lazy"
                  className={`h-12 w-12 shrink-0 object-cover ${
                    framed
                      ? 'rounded-sm'
                      : 'rounded-full'
                  }`}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center text-sm font-black ${
                    framed
                      ? 'rounded-sm'
                      : 'rounded-full'
                  }`}
                  style={{
                    backgroundColor: tokens.accent,
                    color: tokens.accentForeground,
                  }}
                >
                  {agent.name.slice(0, 1).toUpperCase() || 'A'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">
                  {agent.name || 'Listing Agent'}
                </div>
                {agent.title && (
                  <div
                    className="truncate text-[10px]"
                    style={{ color: tokens.muted }}
                  >
                    {agent.title}
                  </div>
                )}
                {(agent.phone || agent.websiteUrl) && (
                  <div
                    className="mt-1 text-[9px] font-semibold"
                    style={{
                      ...TWO_LINES,
                      color: tokens.muted,
                    }}
                  >
                    {[agent.phone, agent.websiteUrl]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                )}
              </div>
              {agent.logoUrl && !personalLogoDuplicates && (
                <img
                  src={agent.logoUrl}
                  alt={`${agent.name || 'Agent'} personal brand logo`}
                  loading="lazy"
                  className="max-h-9 max-w-20 shrink-0 object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)] drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]"
                />
              )}
            </div>
            <BrandFooter
              organization={organization}
              brokerage={brokerage}
              borderColor={tokens.border}
            />
          </>
        ) : (
          <BrandFooter
            organization={organization}
            brokerage={brokerage}
            borderColor={tokens.border}
          />
        )}
      </div>
    </article>
  );
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
  const ready = issues.length === 0;

  return (
    <div
      id="social-readiness"
      role="status"
      aria-live="polite"
      className={`mt-5 rounded-2xl border p-4 ${
        ready
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
          ? 'Ready for Social-section approval.'
          : 'Review before approval'}
      </div>
      {!ready && (
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

  const selectedTemplate = socialTemplateForSelection({
    ...FIRST_PHASE_SOCIAL_TARGET,
    visualStyle: style,
  });
  const photoIds = useMemo(
    () =>
      socialPhotoIds(assignments, selectedTemplate?.slideCount || 0),
    [assignments, selectedTemplate?.slideCount]
  );
  const photoKey = [listing.id, ...photoIds].join('|');
  const identityKey = [
    listing.id,
    listing.owner_user_id || 'unassigned',
  ].join('|');
  const campaignKey = [
    identityKey,
    selectedTemplate?.selection.platform || '',
    selectedTemplate?.selection.format || '',
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
  const instagramCaption = text(section?.content?.instagram_caption);
  const hashtags = stringList(section?.content?.hashtags);
  const creative = buildSocialCreativeViewModel(selectedTemplate, {
    listing,
    photos: creativePhotos,
    agentBrand: agent,
    organizationBrand: organization,
    brokerageBrand: brokerage,
    instagramCaption,
    sectionStatus: section?.status || null,
    studioTemplateKey: section?.template_key || null,
    campaignConfirmed,
  });
  const template = creative.template;
  const supportedLayout = Boolean(
    template && section?.template_key === template.studioTemplateKey
  );
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
      label: 'Carousel Photos',
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
            Review a coordinated, factual carousel using verified photos,
            labels and listing-owner branding.
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

      {!supportedLayout && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <div>
            <strong>Choose Photo Carousel above</strong>
            <p className="mt-1 leading-6">
              This phase supports only the selected template’s {format} layout.
            </p>
          </div>
        </div>
      )}

      <Readiness issues={creative.issues} />
      <StyleSelector selected={style} onSelect={setStyle} />

      {template && supportedLayout ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-950">
                {template.name} Carousel Preview
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {template.slideCount} coordinated slides · {template.width} ×{' '}
                {template.height}
              </p>
            </div>
            <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-xs font-bold text-fuchsia-700">
              Preview only
            </span>
          </div>

          {creative.slides.length > 0 ? (
            <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {creative.slides.map((slide) => (
                <SlidePreview
                  key={slide.index}
                  slide={slide}
                  template={template}
                  agent={agent}
                  organization={organization}
                  brokerage={brokerage}
                />
              ))}
            </div>
          ) : (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              The selected template could not produce its configured slides.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-600">
          Select the supported Photo Carousel layout to display the preview.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Images aria-hidden="true" className="h-5 w-5 text-fuchsia-700" />
          <h4 className="font-bold text-slate-950">
            Existing Instagram Caption
          </h4>
        </div>
        {instagramCaption ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
            {instagramCaption}
          </p>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Prepare the complete marketing package to create the Social caption.
          </div>
        )}
        {hashtags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hashtags.map((hashtag) => (
              <span
                key={hashtag}
                className="max-w-full rounded-full bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 [overflow-wrap:anywhere]"
              >
                {hashtag.startsWith('#') ? hashtag : `#${hashtag}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
