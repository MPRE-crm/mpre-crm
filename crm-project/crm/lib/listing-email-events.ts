export const LISTING_EMAIL_EXTERNAL_EVENT_KEYS = [
  'coming_soon',
  'new_listing',
  'open_house',
  'price_improvement',
  'back_on_market',
  'contingent',
  'pending_under_contract',
  'just_sold',
  'broker_open',
  'new_photos',
  'new_video',
  'virtual_tour',
  'seller_incentive',
  'rate_buydown',
  'offer_deadline',
  'best_and_final',
] as const;

export const LISTING_EMAIL_INTERNAL_EVENT_KEYS = [
  'withdrawn',
  'temporarily_off_market',
  'expired',
  'cancelled',
] as const;

export const LISTING_EMAIL_EVENT_KEYS = [
  ...LISTING_EMAIL_EXTERNAL_EVENT_KEYS,
  ...LISTING_EMAIL_INTERNAL_EVENT_KEYS,
] as const;

export type ListingEmailExternalEventKey =
  typeof LISTING_EMAIL_EXTERNAL_EVENT_KEYS[number];

export type ListingEmailInternalEventKey =
  typeof LISTING_EMAIL_INTERNAL_EVENT_KEYS[number];

export type ListingEmailEventKey =
  | ListingEmailExternalEventKey
  | ListingEmailInternalEventKey;

export type ListingEmailPreferenceCampaignType =
  | 'listing_ad'
  | 'open_house'
  | 'price_change';

export type ListingEmailLuxuryEditionKey =
  | 'launch'
  | 'views_lifestyle'
  | 'design_interiors'
  | 'property_in_motion'
  | 'closer_look'
  | 'agent_spotlight'
  | 'fresh_opportunity';

export type ListingEmailEventDetailKey =
  | 'event_start_at'
  | 'original_price'
  | 'new_price'
  | 'photo_media_ids'
  | 'video_url'
  | 'incentive_summary'
  | 'deadline_at';

export type ListingEmailEventDefinition = {
  value: ListingEmailEventKey;
  label: string;
  subjectPrefix: string;
  campaignType:
    | ListingEmailPreferenceCampaignType
    | null;
  internalOnly: boolean;
  defaultLuxuryEdition:
    | ListingEmailLuxuryEditionKey
    | null;
  defaultCtaLabel:
    | string
    | null;
  requiredDetails:
    readonly ListingEmailEventDetailKey[];
  preferFreshPhotos: boolean;
  samanthaBrief: string;
  photoBrief: string;
};

const DEFINITIONS:
  Record<
    ListingEmailEventKey,
    ListingEmailEventDefinition
  > = {
  coming_soon: {
    value: 'coming_soon',
    label: 'Coming Soon',
    subjectPrefix: 'Coming Soon',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition: 'launch',
    defaultCtaLabel: 'Preview the Property',
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Build anticipation using verified property facts. Do not claim the home is available for showings unless that is explicitly verified.',
    photoBrief:
      'Lead with the strongest exterior or establishing image, followed by the most compelling verified interior and lifestyle images.',
  },

  new_listing: {
    value: 'new_listing',
    label: 'New Listing',
    subjectPrefix: 'New Listing',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition: 'launch',
    defaultCtaLabel: 'View Full Listing',
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Introduce the property as a new listing and communicate the strongest verified overall value proposition without inventing features or urgency.',
    photoBrief:
      'Use the strongest complete first-impression sequence: exterior, kitchen, living space, primary suite and the best verified outdoor or view image.',
  },

  open_house: {
    value: 'open_house',
    label: 'Open House',
    subjectPrefix: 'Open House',
    campaignType: 'open_house',
    internalOnly: false,
    defaultLuxuryEdition:
      'views_lifestyle',
    defaultCtaLabel: 'Plan Your Visit',
    requiredDetails: [
      'event_start_at',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Invite recipients to a verified open house. Include only supplied dates, times and access details. Never invent availability or showing instructions.',
    photoBrief:
      'Prioritize the exterior and arrival experience, then the main gathering spaces, kitchen and strongest outdoor or lifestyle feature.',
  },

  price_improvement: {
    value: 'price_improvement',
    label: 'Price Improvement',
    subjectPrefix: 'Price Improvement',
    campaignType: 'price_change',
    internalOnly: false,
    defaultLuxuryEdition:
      'fresh_opportunity',
    defaultCtaLabel: 'View Updated Price',
    requiredDetails: [
      'original_price',
      'new_price',
    ],
    preferFreshPhotos: true,
    samanthaBrief:
      'Present the verified price improvement as a renewed opportunity. State only the supplied original and current prices and avoid unsupported value claims.',
    photoBrief:
      'Use a refreshed selection that does not feel recycled. Lead with the strongest available image and emphasize the property features that best support renewed attention.',
  },

  back_on_market: {
    value: 'back_on_market',
    label: 'Back on Market',
    subjectPrefix: 'Back on Market',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'fresh_opportunity',
    defaultCtaLabel: 'Revisit the Property',
    requiredDetails: [],
    preferFreshPhotos: true,
    samanthaBrief:
      'Explain that the property is back on the market without speculating about the prior transaction, buyer, inspection or reason for the status change.',
    photoBrief:
      'Use a fresh, high-impact photo sequence and avoid simply repeating the previous campaign order when suitable alternatives exist.',
  },

  contingent: {
    value: 'contingent',
    label: 'Contingent',
    subjectPrefix: 'Now Contingent',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'closer_look',
    defaultCtaLabel: 'View Property Details',
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Announce the verified contingent status clearly. Do not imply that backup offers are accepted unless that has been explicitly verified.',
    photoBrief:
      'Use the strongest representative property photos and maintain a polished status-announcement presentation.',
  },

  pending_under_contract: {
    value: 'pending_under_contract',
    label: 'Pending / Under Contract',
    subjectPrefix: 'Under Contract',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition: 'launch',
    defaultCtaLabel: 'View Property Details',
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Announce the verified pending or under-contract status without disclosing confidential transaction terms or implying that closing is guaranteed.',
    photoBrief:
      'Use the strongest overall property presentation with a clear, professional status-announcement tone.',
  },

  just_sold: {
    value: 'just_sold',
    label: 'Just Sold / Closed',
    subjectPrefix: 'Just Sold',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition: 'launch',
    defaultCtaLabel: 'Discuss Your Real Estate Goals',
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Celebrate the verified closed sale without inventing sale terms, demand, multiple offers, speed, performance statistics or client testimonials.',
    photoBrief:
      'Lead with the best recognizable exterior or hero image and use a concise supporting selection suitable for a closed-sale announcement.',
  },

  broker_open: {
    value: 'broker_open',
    label: 'Broker Open',
    subjectPrefix: 'Broker Open',
    campaignType: 'open_house',
    internalOnly: false,
    defaultLuxuryEdition:
      'agent_spotlight',
    defaultCtaLabel: 'View Broker Open Details',
    requiredDetails: [
      'event_start_at',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Write specifically for real-estate professionals using verified event details and property facts. Do not mention compensation or unsupported showing activity.',
    photoBrief:
      'Use the exterior, principal living spaces, kitchen and the features most useful to an agent evaluating the property for buyers.',
  },

  new_photos: {
    value: 'new_photos',
    label: 'New Photos Added',
    subjectPrefix: 'New Photos',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'design_interiors',
    defaultCtaLabel: 'View New Photos',
    requiredDetails: [
      'photo_media_ids',
    ],
    preferFreshPhotos: true,
    samanthaBrief:
      'Call attention to newly added verified listing photography without claiming that the property itself is new or newly listed.',
    photoBrief:
      'Prioritize the supplied newly added photo IDs, remove duplicates and arrange them into the strongest coherent visual story.',
  },

  new_video: {
    value: 'new_video',
    label: 'New Property Video',
    subjectPrefix: 'New Property Video',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'property_in_motion',
    defaultCtaLabel: 'Watch Property Video',
    requiredDetails: [
      'video_url',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Introduce the verified property video and use it as the primary call to action. Do not claim footage or experiences that are not supplied.',
    photoBrief:
      'Choose images that support the flow of the property video, including the exterior, connected living spaces and strongest destination feature.',
  },

  virtual_tour: {
    value: 'virtual_tour',
    label: 'Virtual Tour',
    subjectPrefix: 'Virtual Tour',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'property_in_motion',
    defaultCtaLabel: 'Explore the Virtual Tour',
    requiredDetails: [
      'video_url',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Invite recipients to explore the verified virtual tour. Do not describe tour functionality or coverage beyond what is supplied.',
    photoBrief:
      'Use a logical visual progression that complements the virtual-tour experience and avoids duplicate room views.',
  },

  seller_incentive: {
    value: 'seller_incentive',
    label: 'Seller Incentive',
    subjectPrefix: 'Seller Incentive',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'fresh_opportunity',
    defaultCtaLabel: 'Review the Opportunity',
    requiredDetails: [
      'incentive_summary',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Explain only the verified seller incentive terms. Avoid financial guarantees, estimated savings or eligibility claims unless explicitly supplied and approved.',
    photoBrief:
      'Use the strongest complete property presentation while keeping the verified incentive as the message focus.',
  },

  rate_buydown: {
    value: 'rate_buydown',
    label: 'Rate Buydown Opportunity',
    subjectPrefix: 'Rate Buydown Opportunity',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition:
      'fresh_opportunity',
    defaultCtaLabel: 'Review the Opportunity',
    requiredDetails: [
      'incentive_summary',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Describe only the verified rate-buydown terms and required disclaimers. Do not calculate payments, promise qualification or guarantee financing outcomes.',
    photoBrief:
      'Use the strongest overall property images while keeping the verified financing opportunity clearly secondary to the property facts.',
  },

  offer_deadline: {
    value: 'offer_deadline',
    label: 'Offer Deadline',
    subjectPrefix: 'Offer Deadline',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition: 'launch',
    defaultCtaLabel: 'Review Deadline Details',
    requiredDetails: [
      'deadline_at',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'Communicate the exact verified offer deadline without manufacturing urgency, competition, offer counts or seller expectations.',
    photoBrief:
      'Use a concise, high-impact property selection that supports rapid review without sacrificing factual presentation.',
  },

  best_and_final: {
    value: 'best_and_final',
    label: 'Best and Final',
    subjectPrefix: 'Best and Final Deadline',
    campaignType: 'listing_ad',
    internalOnly: false,
    defaultLuxuryEdition: 'launch',
    defaultCtaLabel: 'Review Deadline Details',
    requiredDetails: [
      'deadline_at',
    ],
    preferFreshPhotos: false,
    samanthaBrief:
      'State the exact verified best-and-final deadline and instructions. Do not invent competition, offer totals, pricing guidance or acceptance criteria.',
    photoBrief:
      'Use a concise, high-impact property selection appropriate for a time-sensitive but factual notice.',
  },

  withdrawn: {
    value: 'withdrawn',
    label: 'Withdrawn',
    subjectPrefix: 'Withdrawn',
    campaignType: null,
    internalOnly: true,
    defaultLuxuryEdition: null,
    defaultCtaLabel: null,
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Internal status only. Never generate external marketing copy or recipient communications.',
    photoBrief:
      'No external email photo selection is permitted.',
  },

  temporarily_off_market: {
    value: 'temporarily_off_market',
    label: 'Temporarily Off Market',
    subjectPrefix: 'Temporarily Off Market',
    campaignType: null,
    internalOnly: true,
    defaultLuxuryEdition: null,
    defaultCtaLabel: null,
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Internal status only. Never generate external marketing copy or recipient communications.',
    photoBrief:
      'No external email photo selection is permitted.',
  },

  expired: {
    value: 'expired',
    label: 'Expired',
    subjectPrefix: 'Expired',
    campaignType: null,
    internalOnly: true,
    defaultLuxuryEdition: null,
    defaultCtaLabel: null,
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Internal status only. Never generate external marketing copy or recipient communications.',
    photoBrief:
      'No external email photo selection is permitted.',
  },

  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    subjectPrefix: 'Cancelled',
    campaignType: null,
    internalOnly: true,
    defaultLuxuryEdition: null,
    defaultCtaLabel: null,
    requiredDetails: [],
    preferFreshPhotos: false,
    samanthaBrief:
      'Internal status only. Never generate external marketing copy or recipient communications.',
    photoBrief:
      'No external email photo selection is permitted.',
  },
};

const EVENT_KEY_SET =
  new Set<string>(
    LISTING_EMAIL_EVENT_KEYS
  );

const LEGACY_EVENT_ALIASES:
  Readonly<
    Record<
      string,
      ListingEmailEventKey
    >
  > = {
  listing_ad:
    'new_listing',

  price_change:
    'price_improvement',

  showing_window:
    'open_house',

  seller_terms:
    'seller_incentive',
};

const DETAIL_LABELS:
  Record<
    ListingEmailEventDetailKey,
    string
  > = {
  event_start_at:
    'event date and start time',

  original_price:
    'original price',

  new_price:
    'new price',

  photo_media_ids:
    'newly added photos',

  video_url:
    'property video or virtual-tour URL',

  incentive_summary:
    'verified incentive terms',

  deadline_at:
    'deadline date and time',
};

export const LISTING_EMAIL_EXTERNAL_EVENTS =
  LISTING_EMAIL_EXTERNAL_EVENT_KEYS.map(
    (eventKey) =>
      DEFINITIONS[eventKey]
  );

export const LISTING_EMAIL_INTERNAL_EVENTS =
  LISTING_EMAIL_INTERNAL_EVENT_KEYS.map(
    (eventKey) =>
      DEFINITIONS[eventKey]
  );

export function isListingEmailEventKey(
  value: unknown
): value is ListingEmailEventKey {
  return typeof value ===
    'string' &&
    EVENT_KEY_SET.has(
      value
        .trim()
        .toLowerCase()
    );
}

export function normalizeListingEmailEventKey(
  value: unknown,
  fallback:
    ListingEmailEventKey =
      'new_listing'
): ListingEmailEventKey {
  const normalized =
    typeof value ===
    'string'
      ? value
          .trim()
          .toLowerCase()
      : '';

  if (
    EVENT_KEY_SET.has(
      normalized
    )
  ) {
    return normalized as
      ListingEmailEventKey;
  }

  return (
    LEGACY_EVENT_ALIASES[
      normalized
    ] ||
    fallback
  );
}

export function listingEmailEventDefinition(
  value: unknown,
  fallback:
    ListingEmailEventKey =
      'new_listing'
): ListingEmailEventDefinition {
  return DEFINITIONS[
    normalizeListingEmailEventKey(
      value,
      fallback
    )
  ];
}

export function listingEmailEventLabel(
  value: unknown
): string {
  return listingEmailEventDefinition(
    value
  ).label;
}

export function listingEmailEventCampaignType(
  value: unknown
):
  | ListingEmailPreferenceCampaignType
  | null {
  return listingEmailEventDefinition(
    value
  ).campaignType;
}

export function isInternalListingEmailEvent(
  value: unknown
): boolean {
  return listingEmailEventDefinition(
    value
  ).internalOnly;
}

export function defaultListingEmailSubject(
  eventValue: unknown,
  listingTitle: unknown
): string {
  const definition =
    listingEmailEventDefinition(
      eventValue
    );

  const title =
    typeof listingTitle ===
      'string'
      ? listingTitle.trim()
      : '';

  return title
    ? `${definition.subjectPrefix}: ${title}`
    : definition.subjectPrefix;
}

export function listingEmailEventDetailLabel(
  detailKey:
    ListingEmailEventDetailKey
): string {
  return DETAIL_LABELS[
    detailKey
  ];
}

function eventDetailIsPresent(
  value: unknown
): boolean {
  if (
    typeof value ===
    'string'
  ) {
    return value.trim().length >
      0;
  }

  if (
    typeof value ===
    'number'
  ) {
    return Number.isFinite(
      value
    );
  }

  if (
    Array.isArray(value)
  ) {
    return value.length > 0;
  }

  return value !==
    null &&
    value !==
      undefined;
}

export function validateListingEmailEventDetails(
  eventValue: unknown,
  details: unknown
): {
  ok: boolean;
  missing:
    ListingEmailEventDetailKey[];
} {
  const definition =
    listingEmailEventDefinition(
      eventValue
    );

  const detailRecord =
    details &&
    typeof details ===
      'object' &&
    !Array.isArray(details)
      ? details as
          Record<
            string,
            unknown
          >
      : {};

  const missing =
    definition
      .requiredDetails
      .filter(
        (detailKey) =>
          !eventDetailIsPresent(
            detailRecord[
              detailKey
            ]
          )
      );

  return {
    ok:
      missing.length ===
      0,

    missing:
      [...missing],
  };
}