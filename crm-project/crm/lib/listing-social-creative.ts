export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
] as const;
export type SocialPlatform =
  (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_FORMATS = [
  'feed_square',
  'feed_portrait_4_5',
  'carousel_4_5',
  'story_9_16',
  'reel_cover_9_16',
  'feed_landscape',
  'multi_image',
] as const;
export type SocialFormat =
  (typeof SOCIAL_FORMATS)[number];

export const SOCIAL_CAMPAIGN_PURPOSES = [
  'new_to_market',
  'just_listed',
  'coming_soon',
  'open_house',
  'price_reduction',
  'under_contract',
  'sold',
  'listing_showcase',
  'other',
] as const;
export type SocialCampaignPurpose =
  (typeof SOCIAL_CAMPAIGN_PURPOSES)[number];

export const SOCIAL_VISUAL_STYLES = [
  'luxury',
  'classic',
  'minimal',
] as const;
export type SocialVisualStyle =
  (typeof SOCIAL_VISUAL_STYLES)[number];

export const SOCIAL_PLATFORM_LABELS: Record<
  SocialPlatform,
  string
> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
};

export const SOCIAL_FORMAT_LABELS: Record<
  SocialFormat,
  string
> = {
  feed_square: 'Square Feed Post',
  feed_portrait_4_5: '4:5 Feed Post',
  carousel_4_5: '4:5 Carousel',
  story_9_16: 'Story',
  reel_cover_9_16: 'Reel Cover',
  feed_landscape: 'Landscape Feed Post',
  multi_image: 'Multi-image Post',
};

export const SOCIAL_CAMPAIGN_LABELS: Record<
  SocialCampaignPurpose,
  string
> = {
  new_to_market: 'New to Market',
  just_listed: 'Just Listed',
  coming_soon: 'Coming Soon',
  open_house: 'Open House',
  price_reduction: 'Price Reduction',
  under_contract: 'Under Contract',
  sold: 'Sold',
  listing_showcase: 'Listing Showcase',
  other: 'Other',
};

export const VERIFIED_PHOTO_FALLBACK =
  'Property Detail';

export type SocialTemplateSelection = {
  platform: SocialPlatform;
  format: SocialFormat;
  campaignPurpose: SocialCampaignPurpose;
  visualStyle: SocialVisualStyle;
  version: number;
};

export type SocialStyleTokens = {
  layout: 'editorial' | 'banded' | 'framed';
  canvas: string;
  foreground: string;
  muted: string;
  accent: string;
  accentForeground: string;
  border: string;
  overlay: string;
  contentBackground: string;
  imageFilter: string;
  chipBackground: string;
  chipForeground: string;
  headingFont: string;
  bodyFont: string;
  radius: string;
};

export type SocialTemplateDefinition = {
  key: string;
  name: string;
  description: string;
  selection: SocialTemplateSelection;
  studioTemplateKey: string;
  composition: 'just_listed_photo_carousel';
  width: number;
  height: number;
  slideCount: number;
  tokens: SocialStyleTokens;
};

export type SocialListingFacts = {
  title: string;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  list_price: number | null;
  campaign_headline: string | null;
  short_marketing_description: string | null;
  public_remarks: string | null;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  acres: number | null;
  lot_size_text: string | null;
};

export type SocialPhotoLabelEvidence = {
  analysisStatus:
    | 'complete'
    | 'failed'
    | 'needs_review'
    | null;
  labelSource:
    | 'samantha'
    | 'user'
    | null;
  labelLocked: boolean;
  roomLabel: string;
  categoryLabel: string;
};

export type SocialCreativePhoto = {
  id: string;
  url: string;
  verifiedLabel: string | null;
};

export type SocialAgentBrand = {
  name: string;
  title: string;
  phone: string;
  websiteUrl: string;
  headshotUrl: string;
  logoUrl: string;
};

export type SocialOrganizationBrand = {
  name: string;
  logoUrl: string;
};

export type SocialBrokerageBrand = {
  name: string;
  logoUrl: string;
};

export type SocialCreativeInput = {
  listing: SocialListingFacts;
  photos: Array<SocialCreativePhoto | null>;
  agentBrand: SocialAgentBrand;
  organizationBrand: SocialOrganizationBrand;
  brokerageBrand: SocialBrokerageBrand;
  instagramCaption: string;
  sectionStatus: string | null;
  studioTemplateKey: string | null;
  campaignConfirmed: boolean;
};

export type SocialCarouselSlide = {
  index: number;
  totalSlides: number;
  photo: SocialCreativePhoto | null;
  eyebrow: string;
  headline: string;
  detail: string;
  facts: string[];
  showContactCard: boolean;
};

export type SocialReadinessIssue = {
  code: string;
  severity: 'blocking' | 'warning';
  message: string;
};

export type SocialCreativeViewModel = {
  template: SocialTemplateDefinition | null;
  slides: SocialCarouselSlide[];
  issues: SocialReadinessIssue[];
  metrics: {
    requiredPhotoCount: number;
    filledPhotoCount: number;
    uniquePhotoCount: number;
    verifiedLabelCount: number;
    brandingReady: boolean;
  };
  canApprove: boolean;
};

export const FIRST_PHASE_SOCIAL_TARGET = {
  platform: 'instagram',
  format: 'carousel_4_5',
  campaignPurpose: 'just_listed',
  version: 1,
} as const;

const JUST_LISTED_SLIDE_COUNT = 5;

function createFirstPhaseTemplate(
  visualStyle: SocialVisualStyle,
  name: string,
  description: string,
  tokens: SocialStyleTokens
): SocialTemplateDefinition {
  const selection = {
    ...FIRST_PHASE_SOCIAL_TARGET,
    visualStyle,
  };

  return {
    key: `${selection.platform}.${selection.format}.${selection.campaignPurpose}.${selection.visualStyle}.v${selection.version}`,
    name,
    description,
    selection,
    studioTemplateKey: 'carousel',
    composition: 'just_listed_photo_carousel',
    width: 1080,
    height: 1350,
    slideCount: JUST_LISTED_SLIDE_COUNT,
    tokens,
  };
}

export const FIRST_PHASE_SOCIAL_TEMPLATES:
  readonly SocialTemplateDefinition[] = [
  createFirstPhaseTemplate(
    'luxury',
    'Luxury',
    'Editorial charcoal, cream and restrained gold presentation.',
    {
      layout: 'editorial',
      canvas: '#0b0b0c',
      foreground: '#fffaf0',
      muted: '#e7dfd1',
      accent: '#c9a55d',
      accentForeground: '#0b0b0c',
      border: 'rgba(201, 165, 93, 0.64)',
      overlay:
        'linear-gradient(180deg, rgba(8, 8, 9, 0) 42%, rgba(8, 8, 9, 0.58) 100%)',
      contentBackground:
        'linear-gradient(135deg, rgba(9, 9, 10, 0.91), rgba(30, 30, 32, 0.74))',
      imageFilter: 'saturate(0.98) contrast(1.03) brightness(1.03)',
      chipBackground: 'rgba(201, 165, 93, 0.96)',
      chipForeground: '#0b0b0c',
      headingFont: 'Georgia, Times New Roman, serif',
      bodyFont: 'Arial, Helvetica, sans-serif',
      radius: '1.5rem',
    }
  ),
  createFirstPhaseTemplate(
    'classic',
    'Standard / Classic',
    'Balanced brokerage-forward design with familiar real-estate hierarchy.',
    {
      layout: 'banded',
      canvas: '#0f3b63',
      foreground: '#ffffff',
      muted: '#dbeafe',
      accent: '#f28c28',
      accentForeground: '#ffffff',
      border: 'rgba(255, 255, 255, 0.65)',
      overlay:
        'linear-gradient(180deg, rgba(15, 59, 99, 0.02) 45%, rgba(15, 59, 99, 0.28) 100%)',
      contentBackground: 'rgba(15, 59, 99, 0.94)',
      imageFilter: 'saturate(1.02) contrast(1.01)',
      chipBackground: 'rgba(242, 140, 40, 0.96)',
      chipForeground: '#ffffff',
      headingFont: 'Arial, Helvetica, sans-serif',
      bodyFont: 'Arial, Helvetica, sans-serif',
      radius: '1rem',
    }
  ),
  createFirstPhaseTemplate(
    'minimal',
    'Modern / Minimal',
    'Clean monochrome composition with restrained typography and whitespace.',
    {
      layout: 'framed',
      canvas: '#f7f7f4',
      foreground: '#111111',
      muted: '#4b5563',
      accent: '#111111',
      accentForeground: '#ffffff',
      border: 'rgba(17, 17, 17, 0.28)',
      overlay: 'linear-gradient(180deg, transparent, transparent)',
      contentBackground: '#f7f7f4',
      imageFilter: 'saturate(0.96) contrast(1.02)',
      chipBackground: '#111111',
      chipForeground: '#ffffff',
      headingFont: 'Arial, Helvetica, sans-serif',
      bodyFont: 'Arial, Helvetica, sans-serif',
      radius: '0.25rem',
    }
  ),
];

export function socialTemplateForSelection(
  selection: SocialTemplateSelection
) {
  const matches =
    FIRST_PHASE_SOCIAL_TEMPLATES.filter(
      ({ selection: candidate }) =>
        candidate.platform === selection.platform &&
        candidate.format === selection.format &&
        candidate.campaignPurpose ===
          selection.campaignPurpose &&
        candidate.visualStyle ===
          selection.visualStyle &&
        candidate.version === selection.version
    );

  return matches.length === 1
    ? matches[0]
    : null;
}

export function verifiedPhotoLabel(
  evidence: SocialPhotoLabelEvidence
) {
  if (
    evidence.analysisStatus !== 'complete' ||
    evidence.labelSource !== 'user' ||
    !evidence.labelLocked
  ) {
    return null;
  }

  return (
    evidence.roomLabel.trim() ||
    evidence.categoryLabel.trim() ||
    null
  );
}

function cleanText(value: string | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function positiveFinite(value: number | null) {
  return value !== null &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : null;
}

function compactText(
  value: string | null,
  maximumLength: number
) {
  const cleaned = cleanText(value);

  if (cleaned.length <= maximumLength) {
    return cleaned;
  }

  const candidate = cleaned
    .slice(0, Math.max(0, maximumLength - 1))
    .replace(/\s+\S*$/, '')
    .replace(
      /[\s,;:–—-]+(?:and|or|with|including|featuring)?$/i,
      ''
    )
    .trim();

  return candidate ? `${candidate}…` : '';
}

function compactDescription(
  value: string | null,
  maximumLength: number
) {
  const cleaned = cleanText(value);
  const sentence =
    cleaned.match(/^.*?[.!?](?=\s|$)/)?.[0] ||
    cleaned;

  return compactText(
    sentence,
    maximumLength
  );
}

export function socialListingAddress(
  listing: SocialListingFacts
) {
  const street = cleanText(
    listing.property_address
  );
  const city = cleanText(listing.city);
  const stateZip = [
    cleanText(listing.state),
    cleanText(listing.zip),
  ]
    .filter(Boolean)
    .join(' ');
  const locality = [city, stateZip]
    .filter(Boolean)
    .join(', ');

  return [street, locality]
    .filter(Boolean)
    .join(', ');
}

function hasCompleteAddress(
  listing: SocialListingFacts
) {
  return Boolean(
    cleanText(listing.property_address) &&
      cleanText(listing.city) &&
      cleanText(listing.state) &&
      cleanText(listing.zip)
  );
}

export function socialListingPrice(
  value: number | null
) {
  const price = positiveFinite(value);

  return price === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(price);
}

function formattedCount(
  value: number | null,
  singular: string,
  plural: string
) {
  const count = positiveFinite(value);

  if (count === null) {
    return '';
  }

  const formatted =
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
    }).format(count);

  return `${formatted} ${
    count === 1 ? singular : plural
  }`;
}

export function socialListingFacts(
  listing: SocialListingFacts
) {
  const squareFeet = positiveFinite(
    listing.square_feet
  );
  const acres = positiveFinite(
    listing.acres
  );

  return [
    formattedCount(
      listing.bedrooms,
      'Bed',
      'Beds'
    ),
    formattedCount(
      listing.bathrooms,
      'Bath',
      'Baths'
    ),
    squareFeet === null
      ? ''
      : `${new Intl.NumberFormat(
          'en-US',
          { maximumFractionDigits: 0 }
        ).format(squareFeet)} Sq Ft`,
    acres === null
      ? cleanText(
          listing.lot_size_text
        )
      : `${new Intl.NumberFormat(
          'en-US',
          { maximumFractionDigits: 2 }
        ).format(acres)} Acres`,
  ].filter(Boolean);
}

function photoHeadline(
  photo: SocialCreativePhoto | null,
  fallback = VERIFIED_PHOTO_FALLBACK
) {
  return (
    photo?.verifiedLabel?.trim() ||
    fallback
  );
}

function buildSlides(
  template: SocialTemplateDefinition,
  input: SocialCreativeInput
) {
  if (
    template.composition !==
      'just_listed_photo_carousel' ||
    template.slideCount !==
      JUST_LISTED_SLIDE_COUNT
  ) {
    return [];
  }

  const photos = Array.from(
    { length: template.slideCount },
    (_, index) => input.photos[index] || null
  );
  const address =
    socialListingAddress(input.listing);
  const price = socialListingPrice(
    input.listing.list_price
  );
  const facts =
    socialListingFacts(input.listing);
  const headline = cleanText(
    input.listing.campaign_headline ||
      input.listing.title
  );
  const description = compactDescription(
    input.listing
      .short_marketing_description ||
      input.listing.public_remarks ||
      input.listing.description,
    96
  );
  const shared = {
    totalSlides: template.slideCount,
    showContactCard: false,
  };

  return [
    {
      ...shared,
      index: 0,
      photo: photos[0],
      eyebrow:
        SOCIAL_CAMPAIGN_LABELS[
          template.selection.campaignPurpose
        ],
      headline:
        headline ||
        cleanText(input.listing.title) ||
        'Listing Presentation',
      detail: address || 'Address pending',
      facts: price ? [price] : [],
    },
    {
      ...shared,
      index: 1,
      photo: photos[1],
      eyebrow: 'Property Details',
      headline: photoHeadline(
        photos[1],
        'Property Detail'
      ),
      detail: address || 'Address pending',
      facts: facts.slice(0, 4),
    },
    {
      ...shared,
      index: 2,
      photo: photos[2],
      eyebrow: 'Inside the Listing',
      headline: photoHeadline(
        photos[2],
        'Interior Detail'
      ),
      detail:
        description ||
        address ||
        'Property details pending',
      facts: [],
    },
    {
      ...shared,
      index: 3,
      photo: photos[3],
      eyebrow: 'Explore More',
      headline: photoHeadline(
        photos[3],
        'Property Feature'
      ),
      detail: address || 'Address pending',
      facts: facts.slice(0, 3),
    },
    {
      ...shared,
      index: 4,
      photo: photos[4],
      eyebrow: photoHeadline(
        photos[4],
        'Property Detail'
      ),
      headline: 'Schedule a Private Tour',
      detail:
        address ||
        'Listing information available',
      facts: [],
      showContactCard: true,
    },
  ] satisfies SocialCarouselSlide[];
}

export function buildSocialCreativeViewModel(
  template: SocialTemplateDefinition | null,
  input: SocialCreativeInput
): SocialCreativeViewModel {
  const requiredPhotoCount =
    template?.slideCount || 0;
  const assignedPhotos = input.photos
    .slice(0, requiredPhotoCount)
    .filter(
      (
        photo
      ): photo is SocialCreativePhoto =>
        Boolean(photo)
    );
  const uniquePhotoCount = new Set(
    assignedPhotos.map((photo) => photo.id)
  ).size;
  const verifiedLabelCount =
    assignedPhotos.filter((photo) =>
      Boolean(photo.verifiedLabel?.trim())
    ).length;
  const brandingReady = Boolean(
    input.agentBrand.name.trim() &&
      (input.organizationBrand.name.trim() ||
        input.organizationBrand.logoUrl.trim()) &&
      (input.brokerageBrand.name.trim() ||
        input.brokerageBrand.logoUrl.trim())
  );
  const issues: SocialReadinessIssue[] = [];
  const block = (
    code: string,
    message: string
  ) =>
    issues.push({
      code,
      severity: 'blocking',
      message,
    });

  if (!template) {
    block(
      'template_not_found',
      'The selected Social template configuration is unavailable.'
    );
  } else {
    if (
      template.slideCount !==
      JUST_LISTED_SLIDE_COUNT
    ) {
      block(
        'template_slide_count_invalid',
        'The selected template has an invalid slide-count configuration.'
      );
    }

    if (
      input.studioTemplateKey !==
      template.studioTemplateKey
    ) {
      block(
        'studio_template_mismatch',
        'Choose Photo Carousel above to review this Social format.'
      );
    }
  }

  if (
    !['needs_review', 'approved'].includes(
      input.sectionStatus || ''
    )
  ) {
    block(
      'section_not_completed',
      'The Social section must finish preparation before it can be reviewed.'
    );
  }

  if (
    requiredPhotoCount > 0 &&
    assignedPhotos.length <
      requiredPhotoCount
  ) {
    block(
      'photos_incomplete',
      `Assign all ${requiredPhotoCount} required Social photos.`
    );
  }

  if (
    uniquePhotoCount <
    assignedPhotos.length
  ) {
    block(
      'duplicate_photos',
      'Each carousel slide must use a different listing photo.'
    );
  }

  if (
    requiredPhotoCount > 0 &&
    verifiedLabelCount <
      requiredPhotoCount
  ) {
    block(
      'verified_labels_incomplete',
      'Verify and lock the label for every selected photo before approval.'
    );
  }

  if (!hasCompleteAddress(input.listing)) {
    block(
      'listing_address_incomplete',
      'Complete the street, city, state and ZIP before approval.'
    );
  }

  if (!input.agentBrand.name.trim()) {
    block(
      'agent_name_required',
      'Complete the listing owner’s marketing name.'
    );
  }

  if (
    !input.organizationBrand.name.trim() &&
    !input.organizationBrand.logoUrl.trim()
  ) {
    block(
      'organization_brand_required',
      'Add the active MPRE master brand in Preferences.'
    );
  }

  if (
    !input.brokerageBrand.name.trim() &&
    !input.brokerageBrand.logoUrl.trim()
  ) {
    block(
      'brokerage_brand_required',
      'Add licensed brokerage branding in Organization Compliance.'
    );
  }

  if (!input.instagramCaption.trim()) {
    block(
      'instagram_caption_required',
      'Prepare the Social section before approving its Instagram caption.'
    );
  }

  if (
    template?.selection.campaignPurpose ===
      'just_listed' &&
    !input.campaignConfirmed
  ) {
    block(
      'campaign_confirmation_required',
      'Confirm that this listing is eligible for the Just Listed claim.'
    );
  }

  if (
    input.agentBrand.name.trim() &&
    !input.agentBrand.phone.trim() &&
    !input.agentBrand.websiteUrl.trim()
  ) {
    issues.push({
      code: 'agent_contact_missing',
      severity: 'warning',
      message:
        'Add an agent phone number or website for the contact slide.',
    });
  }

  const slides = template
    ? buildSlides(template, input)
    : [];
  const hasBlockingIssue = issues.some(
    ({ severity }) =>
      severity === 'blocking'
  );

  return {
    template,
    slides,
    issues,
    metrics: {
      requiredPhotoCount,
      filledPhotoCount:
        assignedPhotos.length,
      uniquePhotoCount,
      verifiedLabelCount,
      brandingReady,
    },
    canApprove:
      input.sectionStatus ===
        'needs_review' &&
      !hasBlockingIssue,
  };
}
