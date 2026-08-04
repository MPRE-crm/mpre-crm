import {
  createHash,
} from 'node:crypto';

import {
  NextResponse,
} from 'next/server';

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from '../../../../../lib/server/authenticatedProfile';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

import {
  loadSavedListingPhotoIntelligence,
  type ListingPhotoAnalysis,
} from '../../../../../lib/server/listingPhotoIntelligence';

import {
  CANVA_FLYER_TEMPLATES,
  canvaPackageForPreservation,
} from '../../../../../lib/listing-canva-marketing-package';

import {
  isListingEmailEventKey,
  listingEmailEventDefinition,
  listingEmailEventDetailLabel,
  normalizeListingEmailEventKey,
  validateListingEmailEventDetails,
} from '../../../../../lib/listing-email-events';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

export const maxDuration =
  60;

type Role =
  | 'agent'
  | 'admin'
  | 'org_admin'
  | 'platform_admin';

type SectionKey =
  | 'property_website'
  | 'email'
  | 'social'
  | 'flyer'
  | 'video'
  | 'seller_report';

type Requester = {
  id: string;
  org_id: string | null;
  role: Role;
};

type ListingRow = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  title: string;
  property_type: string | null;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  list_price: number | null;
  listing_status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  garage_spaces: number | null;
  square_feet: number | null;
  year_built: number | null;
  lot_size_text: string | null;
  acres: number | null;
  county: string | null;
  subdivision: string | null;
  school_district: string | null;
  elementary_school: string | null;
  middle_school: string | null;
  high_school: string | null;
  hoa_fee: number | null;
  hoa_frequency: string | null;
  features: unknown;
  inclusions: string | null;
  public_remarks: string | null;
  description: string | null;
  campaign_headline: string | null;
  short_marketing_description: string | null;
  website_template_key: string | null;
  review_status: string;
};

type PhotoRow = {
  id: string;
  public_url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  title: string | null;
  caption: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
};

type ExistingSection = {
  section_key: SectionKey;
  status: string;
  template_key: string;
  template_locked: boolean;
  content:
    Record<string, unknown>;
  manual_override: boolean;
  generation_version: number;
  approved_at:
    | string
    | null;
  approved_by:
    | string
    | null;
};

type GeneratedSection = {
  template_key: unknown;
  photo_media_ids: unknown;
  [key: string]: unknown;
};

class MarketingPackageError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 500,
    code = 'marketing_package_error'
  ) {
    super(message);

    this.name =
      'MarketingPackageError';

    this.status =
      status;

    this.code =
      code;
  }
}

const SECTION_KEYS:
  SectionKey[] = [
  'property_website',
  'email',
  'social',
  'flyer',
  'video',
  'seller_report',
];

const TEMPLATE_OPTIONS:
  Record<
    SectionKey,
    string[]
  > = {
  property_website: [
    'luxury_editorial',
    'modern_showcase',
    'clean_standard',
  ],

  email: [
    'luxury',
    'standard',
    'modern',
    'realtor_blast',
  ],

  social: [
    'single_photo',
    'carousel',
    'story_reel',
  ],

  flyer: [
    'luxury_brochure',
    'modern_grid',
    'clean_one_page',
  ],

  video: [
    'reel_30',
    'tour_60',
    'youtube_90',
  ],

  seller_report: [
    'visual_snapshot',
    'detailed_weekly',
    'executive_summary',
  ],
};

function cleanText(
  value: unknown,
  maximumLength = 4000
) {
  return typeof value ===
    'string'
    ? value
        .replace(/\s+/g, ' ')
        .trim()
        .slice(
          0,
          maximumLength
        )
    : '';
}

function cleanStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength = 500
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      cleanText(
        item,
        maximumLength
      )
    )
    .filter(Boolean)
    .slice(
      0,
      maximumItems
    );
}

function getOutputText(
  payload: any
) {
  for (
    const output of
      payload?.output || []
  ) {
    if (
      output?.type !==
      'message'
    ) {
      continue;
    }

    for (
      const content of
        output?.content || []
    ) {
      if (
        content?.type ===
          'output_text' &&
        typeof content?.text ===
          'string'
      ) {
        return content.text;
      }
    }
  }

  return null;
}

const CORRECTABLE_EMAIL_EDITION_ERROR_CODES =
  new Set([
    'email_edition_samantha_photo_set_invalid',
    'email_edition_story_fit_invalid',
  ]);

function isCorrectableEmailEditionError(
  error:
    unknown
): error is
  MarketingPackageError {
  return (
    error instanceof
      MarketingPackageError &&
    CORRECTABLE_EMAIL_EDITION_ERROR_CODES
      .has(
        error.code
      )
  );
}

async function requestCorrectedEmailEditionSource({
  openAiApiKey,
  model,
  emailSchema,
  originalEditionSource,
  validationError,
  correctionContext,
}: {
  openAiApiKey:
    string;

  model:
    string;

  emailSchema:
    Record<
      string,
      unknown
    >;

  originalEditionSource:
    Record<
      string,
      unknown
    >;

  validationError:
    MarketingPackageError;

  correctionContext:
    Record<
      string,
      unknown
    >;
}) {
  const correctionResponse =
    await fetch(
      'https://api.openai.com/v1/responses',
      {
        method:
          'POST',

        headers: {
          Authorization:
            `Bearer ${openAiApiKey}`,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            model,

            store:
              false,

            input: [
              {
                role:
                  'user',

                content: [
                  {
                    type:
                      'input_text',

                    text: [
                      'You are Samantha, the listing marketing assistant for a real estate CRM.',
                      '',
                      'Correct the prior seven-edition Email response because it failed server validation.',
                      'This is one controlled correction attempt. Return all seven complete editions under the editions object.',
                      'Preserve every exact manually locked photo in its original edition and named slot.',
                      'Do not silently omit an edition, slot or copy field.',
                      'Do not repeat a photo ID within an edition.',
                      'Preserve valid prior choices and copy whenever possible, but correct every issue described by the validation failure.',
                      'Choose every corrected unlocked photo yourself from that named slot schema enum.',
                      '',
                      'VALIDATION FAILURE:',
                      validationError.message,
                      '',
                      'CORRECTION CONTEXT:',
                      JSON.stringify(
                        correctionContext,
                        null,
                        2
                      ),
                      '',
                      'PRIOR SEVEN-EDITION RESPONSE:',
                      JSON.stringify(
                        {
                          editions:
                            originalEditionSource,
                        },
                        null,
                        2
                      ),
                      '',
                      ...EMAIL_EDITION_STORY_FIT_PROMPT,
                      '',
                      'Return only JSON matching the supplied strict schema.',
                    ].join(
                      '\n'
                    ),
                  },
                ],
              },
            ],

            text: {
              format: {
                type:
                  'json_schema',

                name:
                  'corrected_listing_email_editions',

                strict:
                  true,

                schema:
                  emailSchema,
              },
            },

            max_output_tokens:
              9000,
          }),
      }
    );

  const correctionPayload =
    await correctionResponse
      .json()
      .catch(
        () => ({})
      );

  if (
    !correctionResponse.ok
  ) {
    throw new MarketingPackageError(
      correctionPayload
        ?.error
        ?.message ||
        'Samantha could not correct the Email edition response.',
      502,
      'openai_email_edition_correction_failed'
    );
  }

  const correctionText =
    getOutputText(
      correctionPayload
    );

  if (!correctionText) {
    throw new MarketingPackageError(
      'Samantha returned no corrected Email-edition content.',
      502,
      'openai_email_edition_correction_missing'
    );
  }

  let correctedEmail:
    Record<
      string,
      unknown
    >;

  try {
    correctedEmail =
      JSON.parse(
        correctionText
      );
  }
  catch {
    throw new MarketingPackageError(
      'Samantha returned invalid corrected Email-edition content.',
      502,
      'openai_email_edition_correction_invalid'
    );
  }

  if (
    !isRecord(
      correctedEmail
        .editions
    )
  ) {
    throw new MarketingPackageError(
      'Samantha did not return the corrected seven-edition Email object.',
      502,
      'openai_email_edition_correction_editions_missing'
    );
  }

  return correctedEmail
    .editions;
}

function canManageListing(
  requester: Requester,
  listing: ListingRow
) {
  if (
    requester.role ===
    'platform_admin'
  ) {
    return true;
  }

  if (
    requester.role ===
      'admin' ||
    requester.role ===
      'org_admin'
  ) {
    return (
      Boolean(
        requester.org_id
      ) &&
      requester.org_id ===
        listing.org_id
    );
  }

  return (
    requester.role ===
      'agent' &&
    requester.id ===
      listing.owner_user_id &&
    requester.org_id ===
      listing.org_id
  );
}

function normalizeTemplate(
  sectionKey: SectionKey,
  requested: unknown,
  existing:
    | ExistingSection
    | null
) {
  if (
    existing
      ?.template_locked &&
    TEMPLATE_OPTIONS[
      sectionKey
    ].includes(
      existing.template_key
    )
  ) {
    return existing
      .template_key;
  }

  const cleaned =
    cleanText(
      requested,
      100
    );

  return TEMPLATE_OPTIONS[
    sectionKey
  ].includes(cleaned)
    ? cleaned
    : TEMPLATE_OPTIONS[
        sectionKey
      ][0];
}

function normalizePhotoIds(
  value: unknown,
  validPhotoIds:
    Set<string>
) {
  const output:
    string[] = [];

  for (
    const photoId of
      cleanStringArray(
        value,
        8,
        100
      )
  ) {
    if (
      validPhotoIds.has(
        photoId
      ) &&
      !output.includes(
        photoId
      )
    ) {
      output.push(
        photoId
      );
    }
  }

  return output;
}

const EMAIL_EDITION_KEYS = [
  'launch',
  'views_lifestyle',
  'design_interiors',
  'property_in_motion',
  'closer_look',
  'agent_spotlight',
  'fresh_opportunity',
] as const;

type EmailEditionKey =
  typeof EMAIL_EDITION_KEYS[number];

const EMAIL_EDITION_LABELS:
  Record<
    EmailEditionKey,
    string
  > = {
  launch:
    'Luxury Launch',

  views_lifestyle:
    'Views & Lifestyle',

  design_interiors:
    'Design & Interiors',

  property_in_motion:
    'Property in Motion',

  closer_look:
    'A Closer Look',

  agent_spotlight:
    'Agent Spotlight',

  fresh_opportunity:
    'Fresh Opportunity',
};

const EMAIL_EDITION_DEFAULT_CTA:
  Record<
    EmailEditionKey,
    string
  > = {
  launch:
    'View Full Listing',

  views_lifestyle:
    'Experience the Property',

  design_interiors:
    'Explore the Interiors',

  property_in_motion:
    'Watch the Property Film',

  closer_look:
    'Take a Closer Look',

  agent_spotlight:
    'Share With Your Buyers',

  fresh_opportunity:
    'Revisit the Property',
};

const EMAIL_EDITION_SLOT_PRIORITIES:
  Record<
    EmailEditionKey,
    string[][]
  > = {
  launch: [
    [
      'front_exterior',
      'exterior',
    ],
    [
      'kitchen',
    ],
    [
      'living_room',
    ],
    [
      'primary_bedroom',
      'bedroom',
    ],
    [
      'primary_bathroom',
      'bathroom',
    ],
    [
      'view',
      'patio',
      'backyard',
      'pool',
      'shop',
      'garage',
      'office',
      'bonus_room',
    ],
  ],

  views_lifestyle: [
    [
      'view',
      'patio',
      'backyard',
      'pool',
      'exterior',
    ],
    [
      'patio',
      'backyard',
      'pool',
      'view',
    ],
    [
      'view',
      'exterior',
      'front_exterior',
    ],
    [
      'backyard',
      'patio',
      'pool',
      'community',
    ],
    [
      'front_exterior',
      'exterior',
    ],
    [
      'living_room',
      'dining_room',
      'kitchen',
    ],
  ],

  design_interiors: [
    [
      'kitchen',
      'living_room',
      'dining_room',
    ],
    [
      'living_room',
      'kitchen',
    ],
    [
      'kitchen',
      'dining_room',
    ],
    [
      'primary_bathroom',
      'bathroom',
    ],
    [
      'primary_bedroom',
      'bedroom',
    ],
    [
      'detail',
      'office',
      'bonus_room',
    ],
  ],

  property_in_motion: [
    [
      'front_exterior',
      'exterior',
    ],
    [
      'living_room',
    ],
    [
      'kitchen',
    ],
    [
      'dining_room',
      'living_room',
    ],
    [
      'primary_bedroom',
      'bedroom',
    ],
    [
      'patio',
      'backyard',
      'view',
      'pool',
    ],
  ],

  closer_look: [
    [
      'detail',
      'office',
      'bonus_room',
      'shop',
      'garage',
    ],
    [
      'detail',
      'primary_bathroom',
      'bathroom',
    ],
    [
      'office',
      'bonus_room',
      'laundry',
    ],
    [
      'shop',
      'garage',
    ],
    [
      'primary_bathroom',
      'primary_bedroom',
    ],
    [
      'patio',
      'backyard',
      'view',
    ],
  ],

  agent_spotlight: [
    [
      'front_exterior',
      'exterior',
    ],
    [
      'kitchen',
    ],
    [
      'living_room',
    ],
    [
      'primary_bedroom',
      'bedroom',
    ],
    [
      'primary_bathroom',
      'bathroom',
    ],
    [
      'view',
      'patio',
      'backyard',
      'shop',
      'garage',
    ],
  ],

  fresh_opportunity: [
    [
      'view',
      'patio',
      'backyard',
      'exterior',
      'front_exterior',
    ],
    [
      'primary_bathroom',
      'primary_bedroom',
      'office',
    ],
    [
      'dining_room',
      'living_room',
      'kitchen',
    ],
    [
      'shop',
      'garage',
      'bonus_room',
    ],
    [
      'detail',
      'patio',
      'pool',
    ],
    [
      'front_exterior',
      'exterior',
      'view',
    ],
  ],
};

type EditionPhotoAnalysis = {
  media_id: string;
  analysis_status: string;
  primary_category: string;

  room_label:
    | string
    | null;

  feature_tags:
    string[];

  visual_summary:
    | string
    | null;

  quality_score: number;
  marketing_score: number;
  confidence: number;
  is_usable: boolean;

  duplicate_group:
    | string
    | null;
};

const EMAIL_EDITION_WRITING_BRIEFS:
  Record<
    EmailEditionKey,
    string
  > = {
  launch:
    'Create the definitive first impression and a complete overview of the residence.',

  views_lifestyle:
    'When the analyzed photos strongly support views or outdoor living, center the story on that verified setting. Otherwise identify the property\'s strongest verified lifestyle hotspot and build a truthful coordinated story around it without implying views.',

  design_interiors:
    'Center the story on verified interior architecture, room relationships, finishes, craftsmanship and visible design details.',

  property_in_motion:
    'Tell the story as a natural progression through arrival, principal living spaces, private rooms and outdoor areas. Mention a property film only when a verified video URL is supplied.',

  closer_look:
    'Reveal verified specialty rooms, functional details, storage, offices, garages, shops and distinctive features that deserve focused attention.',

  agent_spotlight:
    'Create a balanced, professional and share-ready property story for real-estate professionals and their buyers.',

  fresh_opportunity:
    'Present a genuinely refreshed marketing perspective using the strongest verified features without claiming the property is new, just listed or recently relisted.',
};

function emailPhotoAnalysisText(
  analysis:
    EditionPhotoAnalysis
) {
  return [
    analysis
      .primary_category,

    analysis.room_label ||
      '',

    ...(
      analysis.feature_tags ||
      []
    ),

    analysis.visual_summary ||
      '',
  ]
    .join(' ')
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .trim();
}

function emailPhotoMatchesPriority(
  analysis:
    EditionPhotoAnalysis,
  priority: string
) {
  const normalizedPriority =
    priority
      .toLowerCase()
      .replace(
        /_/g,
        ' '
      )
      .replace(
        /[^a-z0-9]+/g,
        ' '
      )
      .trim();

  if (
    analysis
      .primary_category ===
    priority
  ) {
    return true;
  }

  const analysisText =
    emailPhotoAnalysisText(
      analysis
    );

  if (
    normalizedPriority.includes(
      ' '
    )
  ) {
    return analysisText.includes(
      normalizedPriority
    );
  }

  return analysisText
    .split(' ')
    .includes(
      normalizedPriority
    );
}

function isRecord(
  value: unknown
): value is
  Record<string, unknown> {
  return Boolean(
    value
  ) &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value
    );
}

function normalizeEmailEditionKey(
  value: unknown
): EmailEditionKey {
  const cleaned =
    cleanText(
      value,
      100
    );

  return EMAIL_EDITION_KEYS.includes(
    cleaned as
      EmailEditionKey
  )
    ? (
        cleaned as
          EmailEditionKey
      )
    : 'launch';
}

function selectEmailEditionPhotoIds({
  editionKey,
  photos,
  analyses,
  launchSlotPhotoIds,
  launchReferencePhotoIds,
  lockedSlotIndexes,
}: {
  editionKey:
    EmailEditionKey;
  photos:
    PhotoRow[];
  analyses:
    EditionPhotoAnalysis[];
  launchSlotPhotoIds:
    Array<string | null>;
  launchReferencePhotoIds:
    Array<string | null>;
  lockedSlotIndexes:
    Set<number>;
}) {
  const currentPhotoIds =
    new Set(
      photos.map(
        (photo) =>
          photo.id
      )
    );

  const photoOrder =
    new Map(
      photos.map(
        (
          photo,
          index
        ) => [
          photo.id,
          photo.sort_order ??
            index,
        ]
      )
    );

  const launchPhotoIdSet =
    new Set(
      launchReferencePhotoIds.filter(
        (
          photoId
        ): photoId is string =>
          Boolean(photoId)
      )
    );

  const output:
    Array<string | null> = [
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const usedIds =
    new Set<string>();

  const usedDuplicateGroups =
    new Set<string>();

  const usedCategories =
    new Set<string>();

  const analysisById =
    new Map(
      analyses.map(
        (analysis) => [
          analysis.media_id,
          analysis,
        ]
      )
    );

  function markUsed(
    mediaId: string
  ) {
    usedIds.add(
      mediaId
    );

    const analysis =
      analysisById.get(
        mediaId
      );

    if (
      analysis
        ?.duplicate_group
    ) {
      usedDuplicateGroups.add(
        analysis
          .duplicate_group
      );
    }

    if (analysis) {
      usedCategories.add(
        analysis
          .primary_category
      );
    }
  }

  for (
    const lockedIndex of
    lockedSlotIndexes
  ) {
    const mediaId =
      launchSlotPhotoIds[
        lockedIndex
      ];

    if (
      mediaId &&
      currentPhotoIds.has(
        mediaId
      ) &&
      lockedIndex >=
        0 &&
      lockedIndex <
        output.length
    ) {
      output[
        lockedIndex
      ] = mediaId;

      markUsed(
        mediaId
      );
    }
  }

  const ranked =
    analyses
      .filter(
        (analysis) =>
          currentPhotoIds.has(
            analysis.media_id
          ) &&
          analysis
            .analysis_status !==
            'failed' &&
          analysis.is_usable &&
          analysis.confidence >=
            0.35 &&
          analysis
            .primary_category !==
            'floor_plan' &&
          analysis
            .primary_category !==
            'hallway' &&
          analysis
            .primary_category !==
            'foyer'
      )
      .slice()
      .sort(
        (
          left,
          right
        ) => {
          const freshLeftPenalty =
            editionKey ===
              'fresh_opportunity' &&
            launchPhotoIdSet.has(
              left.media_id
            )
              ? 1000
              : 0;

          const freshRightPenalty =
            editionKey ===
              'fresh_opportunity' &&
            launchPhotoIdSet.has(
              right.media_id
            )
              ? 1000
              : 0;

          const leftScore =
            left.marketing_score *
              3 +
            left.quality_score *
              2 +
            left.confidence *
              50 -
            freshLeftPenalty;

          const rightScore =
            right.marketing_score *
              3 +
            right.quality_score *
              2 +
            right.confidence *
              50 -
            freshRightPenalty;

          if (
            rightScore !==
            leftScore
          ) {
            return (
              rightScore -
              leftScore
            );
          }

          return (
            (
              photoOrder.get(
                left.media_id
              ) ||
              0
            ) -
            (
              photoOrder.get(
                right.media_id
              ) ||
              0
            )
          );
        }
      );

  function isAvailable(
    analysis:
      EditionPhotoAnalysis,
    allowDuplicateCategory =
      false,
    allowDuplicateGroup =
      false
  ) {
    if (
      usedIds.has(
        analysis.media_id
      )
    ) {
      return false;
    }

    if (
      !allowDuplicateGroup &&
      analysis
        .duplicate_group &&
      usedDuplicateGroups.has(
        analysis
          .duplicate_group
      )
    ) {
      return false;
    }

    if (
      !allowDuplicateCategory &&
      usedCategories.has(
        analysis
          .primary_category
      )
    ) {
      return false;
    }

    return true;
  }

  for (
    let slotIndex = 0;
    slotIndex <
      output.length;
    slotIndex += 1
  ) {
    if (
      output[
        slotIndex
      ]
    ) {
      continue;
    }

    const categoryPriorities =
      EMAIL_EDITION_SLOT_PRIORITIES[
        editionKey
      ][
        slotIndex
      ] || [];

    let candidate:
      EditionPhotoAnalysis |
      undefined;

    for (
      const category of
      categoryPriorities
    ) {
      candidate =
        ranked.find(
          (analysis) =>
            emailPhotoMatchesPriority(
              analysis,
              category
            ) &&
            isAvailable(
              analysis
            )
        );

      if (candidate) {
        break;
      }
    }

    if (!candidate) {
      for (
        const category of
        categoryPriorities
      ) {
        candidate =
          ranked.find(
            (analysis) =>
              emailPhotoMatchesPriority(
                analysis,
                category
              ) &&
              isAvailable(
                analysis,
                true
              )
          );

        if (candidate) {
          break;
        }
      }
    }

    if (!candidate) {
      candidate =
        ranked.find(
          (analysis) =>
            isAvailable(
              analysis
            )
        );
    }

    if (!candidate) {
      candidate =
        ranked.find(
          (analysis) =>
            isAvailable(
              analysis,
              true
            )
        );
    }

    if (!candidate) {
      candidate =
        ranked.find(
          (analysis) =>
            isAvailable(
              analysis,
              true,
              true
            )
        );
    }

    if (candidate) {
      output[
        slotIndex
      ] =
        candidate.media_id;

      markUsed(
        candidate.media_id
      );
    }
  }

  const fallbackPhotos =
    photos
      .filter(
        (photo) =>
          currentPhotoIds.has(
            photo.id
          )
      )
      .slice()
      .sort(
        (
          left,
          right
        ) => {
          if (
            left.is_primary !==
            right.is_primary
          ) {
            return left.is_primary
              ? -1
              : 1;
          }

          return (
            (
              left.sort_order ||
              0
            ) -
            (
              right.sort_order ||
              0
            )
          );
        }
      );

  for (
    let slotIndex = 0;
    slotIndex <
      output.length;
    slotIndex += 1
  ) {
    if (
      output[
        slotIndex
      ]
    ) {
      continue;
    }

    const fallback =
      fallbackPhotos.find(
        (photo) =>
          !usedIds.has(
            photo.id
          )
      );

    if (!fallback) {
      break;
    }

    output[
      slotIndex
    ] =
      fallback.id;

    markUsed(
      fallback.id
    );
  }

  return output
    .filter(
      (
        photoId
      ): photoId is string =>
        Boolean(photoId)
    )
    .slice(
      0,
      6
    );
}

function completeEmailEditionPhotoIds({
  candidatePhotoIds,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  analyses,
  photos,
  validPhotoIds,
}: {
  candidatePhotoIds:
    string[];
  savedSlotPhotoIds:
    Array<string | null>;
  lockedSlotIndexes:
    Set<number>;
  analyses:
    EditionPhotoAnalysis[];
  photos:
    PhotoRow[];
  validPhotoIds:
    Set<string>;
}) {
  const completed:
    Array<string | null> = [
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const usedPhotoIds =
    new Set<string>();

  for (
    const lockedIndex of
      lockedSlotIndexes
  ) {
    const lockedPhotoId =
      savedSlotPhotoIds[
        lockedIndex
      ];

    if (
      lockedIndex < 0 ||
      lockedIndex >= 6 ||
      !lockedPhotoId ||
      !validPhotoIds.has(
        lockedPhotoId
      ) ||
      usedPhotoIds.has(
        lockedPhotoId
      )
    ) {
      throw new MarketingPackageError(
        'A locked Email photo is invalid or duplicated. Review the locked photo for this edition before preparing the package.',
        409,
        'email_locked_photo_invalid'
      );
    }

    completed[
      lockedIndex
    ] =
      lockedPhotoId;

    usedPhotoIds.add(
      lockedPhotoId
    );
  }

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    if (
      completed[index]
    ) {
      continue;
    }

    const positionCandidate =
      candidatePhotoIds[
        index
      ];

    if (
      positionCandidate &&
      validPhotoIds.has(
        positionCandidate
      ) &&
      !usedPhotoIds.has(
        positionCandidate
      )
    ) {
      completed[index] =
        positionCandidate;

      usedPhotoIds.add(
        positionCandidate
      );
    }
  }

  const rankedFallbackPhotoIds =
    analyses
      .filter(
        (analysis) =>
          analysis
            .analysis_status !==
            'failed' &&
          analysis.is_usable &&
          analysis.confidence >=
            0.35 &&
          validPhotoIds.has(
            analysis.media_id
          ) &&
          analysis
            .primary_category !==
            'floor_plan' &&
          analysis
            .primary_category !==
            'hallway' &&
          analysis
            .primary_category !==
            'foyer'
      )
      .slice()
      .sort(
        (
          left,
          right
        ) => {
          const leftScore =
            left.marketing_score *
              3 +
            left.quality_score *
              2 +
            left.confidence *
              50;

          const rightScore =
            right.marketing_score *
              3 +
            right.quality_score *
              2 +
            right.confidence *
              50;

          return (
            rightScore -
            leftScore
          );
        }
      )
      .map(
        (analysis) =>
          analysis.media_id
      );

  const fallbackPhotoIds =
    [
      ...candidatePhotoIds,
      ...savedSlotPhotoIds
        .filter(
          (
            photoId
          ): photoId is string =>
            Boolean(photoId)
        ),
      ...rankedFallbackPhotoIds,
      ...photos.map(
        (photo) =>
          photo.id
      ),
    ];

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    if (
      completed[index]
    ) {
      continue;
    }

    const fallbackPhotoId =
      fallbackPhotoIds.find(
        (photoId) =>
          validPhotoIds.has(
            photoId
          ) &&
          !usedPhotoIds.has(
            photoId
          )
      ) ||
      null;

    if (!fallbackPhotoId) {
      throw new MarketingPackageError(
        'Samantha could not prepare six unique valid photos for an Email edition. Review the listing photo library and photo analysis before trying again.',
        409,
        'email_six_photos_required'
      );
    }

    completed[index] =
      fallbackPhotoId;

    usedPhotoIds.add(
      fallbackPhotoId
    );
  }

  const normalized =
    completed.filter(
      (
        photoId
      ): photoId is string =>
        Boolean(photoId)
    );

  if (
    normalized.length !== 6 ||
    new Set(
      normalized
    ).size !== 6
  ) {
    throw new MarketingPackageError(
      'Samantha could not verify a complete six-photo Email edition.',
      409,
      'email_photo_set_incomplete'
    );
  }

  return normalized;
}

function buildEmailEditionPhotoIdsByEdition({
  photos,
  analyses,
  savedSlotPhotoIdsByEdition,
  lockedSlotIndexesByEdition,
  validPhotoIds,
  eventDefaultEditionKey:
    requestedEventDefaultEditionKey =
      null,
  eventPhotoMediaIds = [],
}: {
  photos:
    PhotoRow[];

  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIdsByEdition:
    Record<
      EmailEditionKey,
      Array<
        string |
        null
      >
    >;

  lockedSlotIndexesByEdition:
    Record<
      EmailEditionKey,
      number[]
    >;

  validPhotoIds:
    Set<string>;

  eventDefaultEditionKey?:
    | EmailEditionKey
    | null;

  eventPhotoMediaIds?:
    string[];
}) {
  const output =
    {} as
      Record<
        EmailEditionKey,
        string[]
      >;

  for (
    const editionKey of
      EMAIL_EDITION_KEYS
  ) {
    const savedSlotPhotoIds =
      savedSlotPhotoIdsByEdition[
        editionKey
      ];

    const lockedSlotIndexes =
      new Set(
        lockedSlotIndexesByEdition[
          editionKey
        ]
      );

    const launchReferencePhotoIds =
      output.launch ||
      savedSlotPhotoIdsByEdition
        .launch;

    const selectedPhotoIds =
      selectEmailEditionPhotoIds({
        editionKey,

        photos,

        analyses,

        launchSlotPhotoIds:
          savedSlotPhotoIds,

        launchReferencePhotoIds,

        lockedSlotIndexes,
      });

    const eventAwarePhotoIds =
      [
        ...selectedPhotoIds,
      ];

    if (
      editionKey ===
        requestedEventDefaultEditionKey &&
      eventPhotoMediaIds.length >
        0
    ) {
      const protectedPhotoIds =
        new Set(
          savedSlotPhotoIds
            .map(
              (
                photoId,
                index
              ) =>
                lockedSlotIndexes
                  .has(index)
                  ? photoId
                  : null
            )
            .filter(
              (
                photoId
              ): photoId is string =>
                Boolean(photoId)
            )
        );

      for (
        const preferredPhotoId of
          eventPhotoMediaIds
      ) {
        if (
          !validPhotoIds.has(
            preferredPhotoId
          )
        ) {
          continue;
        }

        if (
          eventAwarePhotoIds.includes(
            preferredPhotoId
          )
        ) {
          protectedPhotoIds.add(
            preferredPhotoId
          );

          continue;
        }

        let replaceIndex =
          -1;

        for (
          let index =
            eventAwarePhotoIds
              .length -
            1;
          index >= 0;
          index -= 1
        ) {
          if (
            !lockedSlotIndexes.has(
              index
            ) &&
            !protectedPhotoIds.has(
              eventAwarePhotoIds[
                index
              ]
            )
          ) {
            replaceIndex =
              index;

            break;
          }
        }

        if (
          replaceIndex >=
          0
        ) {
          eventAwarePhotoIds[
            replaceIndex
          ] =
            preferredPhotoId;

          protectedPhotoIds.add(
            preferredPhotoId
          );
        }
        else if (
          eventAwarePhotoIds
            .length <
          6
        ) {
          eventAwarePhotoIds.push(
            preferredPhotoId
          );

          protectedPhotoIds.add(
            preferredPhotoId
          );
        }
      }
    }

    output[
      editionKey
    ] =
      completeEmailEditionPhotoIds({
        candidatePhotoIds:
          eventAwarePhotoIds,

        savedSlotPhotoIds,

        lockedSlotIndexes,

        analyses,

        photos,

        validPhotoIds,
      });
  }

  return output;
}

function assertCompleteEmailEditionPhotoIds({
  photoIdsByEdition,
  validPhotoIds,
  actionLabel,
}: {
  photoIdsByEdition:
    Record<
      EmailEditionKey,
      string[]
    >;

  validPhotoIds:
    Set<string>;

  actionLabel:
    string;
}) {
  for (
    const editionKey of
      EMAIL_EDITION_KEYS
  ) {
    const photoIds =
      photoIdsByEdition[
        editionKey
      ];

    if (
      photoIds.length !==
        6 ||
      new Set(
        photoIds
      ).size !==
        6 ||
      photoIds.some(
        (photoId) =>
          !validPhotoIds.has(
            photoId
          )
      )
    ) {
      throw new MarketingPackageError(
        `Samantha could not prepare six unique valid photos for ${EMAIL_EDITION_LABELS[editionKey]} before ${actionLabel}.`,
        409,
        'email_edition_photo_plan_incomplete'
      );
    }
  }
}

function buildLockedEmailPhotoSlotsForPrompt({
  savedSlotPhotoIdsByEdition,
  lockedSlotIndexesByEdition,
}: {
  savedSlotPhotoIdsByEdition:
    Record<
      EmailEditionKey,
      Array<
        string |
        null
      >
    >;

  lockedSlotIndexesByEdition:
    Record<
      EmailEditionKey,
      number[]
    >;
}) {
  return Object.fromEntries(
    EMAIL_EDITION_KEYS.map(
      (editionKey) => [
        editionKey,
        lockedSlotIndexesByEdition[
          editionKey
        ].map(
          (index) => ({
            slot_index:
              index,

            slot_label:
              index ===
                0
                ? 'hero'
                : `supporting_${index}`,

            photo_media_id:
              savedSlotPhotoIdsByEdition[
                editionKey
              ][
                index
              ] ||
              null,
          })
        ),
      ]
    )
  );
}

function validateSamanthaEmailEditionPhotoIds({
  editionKey,
  candidatePhotoIds,
  validPhotoIds,
  savedSlotPhotoIds,
  lockedSlotIndexes,
}: {
  editionKey:
    EmailEditionKey;

  candidatePhotoIds:
    unknown;

  validPhotoIds:
    Set<string>;

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];
}) {
  const photoIds =
    Array.isArray(
      candidatePhotoIds
    )
      ? candidatePhotoIds
          .map(
            (value) =>
              cleanText(
                value,
                100
              )
          )
          .filter(Boolean)
      : [];

  const uniquePhotoIds =
    new Set(
      photoIds
    );

  const invalidPhotoIds =
    photoIds.filter(
      (photoId) =>
        !validPhotoIds.has(
          photoId
        )
    );

  const duplicatePhotoIds =
    Array.from(
      new Set(
        photoIds.filter(
          (
            photoId,
            index
          ) =>
            photoIds.indexOf(
              photoId
            ) !==
              index
        )
      )
    );

  if (
    photoIds.length !==
      6 ||
    uniquePhotoIds.size !==
      6 ||
    invalidPhotoIds.length >
      0
  ) {
    const failureReasons:
      string[] =
      [];

    if (
      photoIds.length !==
        6
    ) {
      failureReasons.push(
        `returned ${photoIds.length} cleaned IDs instead of 6`
      );
    }

    if (
      duplicatePhotoIds.length >
        0
    ) {
      failureReasons.push(
        `repeated ${duplicatePhotoIds.length} photo ID(s)`
      );
    }

    if (
      invalidPhotoIds.length >
        0
    ) {
      failureReasons.push(
        `returned ${invalidPhotoIds.length} ID(s) outside the listing catalog`
      );
    }

    console.error(
      'Samantha Email edition photo validation failed.',
      {
        edition_key:
          editionKey,

        edition_label:
          EMAIL_EDITION_LABELS[
            editionKey
          ],

        candidate_is_array:
          Array.isArray(
            candidatePhotoIds
          ),

        candidate_count:
          Array.isArray(
            candidatePhotoIds
          )
            ? candidatePhotoIds.length
            : 0,

        cleaned_count:
          photoIds.length,

        unique_count:
          uniquePhotoIds.size,

        returned_photo_ids:
          photoIds,

        duplicate_photo_ids:
          duplicatePhotoIds,

        invalid_photo_ids:
          invalidPhotoIds,
      }
    );

    throw new MarketingPackageError(
      `Samantha returned an invalid photo set for ${EMAIL_EDITION_LABELS[editionKey]}: ${failureReasons.join('; ')}. No edition changes were saved.`,
      502,
      'email_edition_samantha_photo_set_invalid'
    );
  }

  for (
    const index of
      lockedSlotIndexes
  ) {
    const lockedPhotoId =
      savedSlotPhotoIds[
        index
      ];

    if (
      !lockedPhotoId ||
      photoIds[
        index
      ] !==
        lockedPhotoId
    ) {
      throw new MarketingPackageError(
        `Samantha did not preserve the locked ${EMAIL_EDITION_LABELS[editionKey]} photo in slot ${index + 1}.`,
        502,
        'email_edition_locked_photo_changed'
      );
    }
  }

  return photoIds;
}

const EMAIL_EDITION_STORY_FIT_PROMPT = [
  '- Story-fit quality gates are mandatory for every edition.',
  '- Luxury Launch: use one strong arrival image, the principal living room, kitchen, a primary-suite image and a real outdoor or view image. Dining or kitchen alone does not replace a qualifying principal living-room photo.',
  '- Views & Lifestyle is adaptive: when at least four usable analyzed photos strongly support views or outdoor living, use a verified view-connected hero and at least four photos supporting that story.',
  '- When the listing does not contain that outdoor/view depth, identify its strongest verified lifestyle hotspot from the full analyzed catalog and coordinate the hero, supporting photos and copy around that real strength. Never claim views that are not supported.',
  '- A manually locked aerial may count as one supporting context image when an outdoor/view story exists, but an aerial is not a qualifying unlocked hero.',
  '- Design & Interiors: include a qualifying principal living-room photo whenever one exists, then use at least three distinct interior room families. Do not use more than two unlocked photos from one room family or more than two from one duplicate group.',
  '- Property in Motion: begin with a strong arrival image, move through the principal living room and another public space, include a private or specialty space and finish outdoors. Dining or kitchen alone does not replace a qualifying living-room photo.',
  '- A Closer Look: use at least four distinct feature families. Do not cluster utility spaces. Use no more than one unlocked laundry, garage or closet/storage photo and no more than two bathroom-family photos.',
  '- Agent Spotlight: create balanced coverage across arrival, public living, a private or specialty feature and outdoor living. Use no more than one unlocked ordinary exterior.',
  '- Fresh Opportunity: use at least four distinct families, no more than one unlocked ordinary exterior, at least one outdoor or view image and at least one primary-suite or distinctive-feature image.',
  '- Manually locked slots must remain exact. A locked photo may support a required story element but must not be moved or rejected.',
] as const;

function emailEditionStoryText(
  analysis:
    EditionPhotoAnalysis
) {
  return [
    analysis
      .primary_category,

    analysis.room_label ||
      '',

    ...(
      analysis.feature_tags ||
      []
    ),

    analysis.visual_summary ||
      '',
  ]
    .join(' ')
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .trim();
}

function emailEditionStoryFamily(
  analysis:
    EditionPhotoAnalysis
) {
  const category =
    analysis
      .primary_category;

  const storyText =
    emailEditionStoryText(
      analysis
    );

  if (
    category ===
      'front_exterior' ||
    category ===
      'exterior'
  ) {
    return 'exterior';
  }

  if (
    category ===
      'living_room'
  ) {
    return 'living';
  }

  if (
    category ===
      'dining_room'
  ) {
    return 'dining';
  }

  if (
    category ===
      'primary_bedroom' ||
    category ===
      'bedroom'
  ) {
    return 'bedroom';
  }

  if (
    category ===
      'primary_bathroom' ||
    category ===
      'bathroom'
  ) {
    return 'bathroom';
  }

  if (
    category ===
      'patio' ||
    category ===
      'backyard' ||
    category ===
      'view' ||
    category ===
      'pool'
  ) {
    return 'outdoor';
  }

  if (
    category ===
      'other' &&
    (
      storyText.includes(
        'closet'
      ) ||
      storyText.includes(
        'pantry'
      ) ||
      storyText.includes(
        'storage'
      ) ||
      storyText.includes(
        'shelving'
      )
    )
  ) {
    return 'storage';
  }

  return category;
}

function emailEditionHasStoryTerm(
  analysis:
    EditionPhotoAnalysis,
  terms:
    string[]
) {
  const storyText =
    emailEditionStoryText(
      analysis
    );

  return terms.some(
    (term) =>
      storyText.includes(
        term
      )
  );
}

function emailEditionIsStrongOutdoorView(
  analysis:
    EditionPhotoAnalysis
) {
  const category =
    analysis
      .primary_category;

  if (
    category ===
      'view' ||
    category ===
      'patio' ||
    category ===
      'backyard' ||
    category ===
      'pool'
  ) {
    return true;
  }

  return emailEditionHasStoryTerm(
    analysis,
    [
      'mountain view',
      'distant view',
      'patio view',
      'outdoor view',
      'covered patio',
      'backyard',
      'scenic',
      'acreage',
      'pool',
      'landscape',
    ]
  );
}

function emailEditionHasOutdoorLifestyleStory(
  analyses:
    EditionPhotoAnalysis[],
  validPhotoIds:
    Set<string>
) {
  return (
    analyses.filter(
      (analysis) =>
        validPhotoIds.has(
          analysis.media_id
        ) &&
        analysis.analysis_status ===
          'complete' &&
        analysis.is_usable &&
        emailEditionIsStrongOutdoorView(
          analysis
        )
    ).length >=
    4
  );
}

function emailEditionIsAerialContext(
  analysis:
    EditionPhotoAnalysis
) {
  return emailEditionHasStoryTerm(
    analysis,
    [
      'aerial',
      'neighborhood landscape',
    ]
  );
}

function buildViewsLifestyleSchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  const allowedPhotoIds =
    new Set(
      analyses
        .filter(
          (analysis) =>
            validPhotoIds.has(
              analysis.media_id
            ) &&
            analysis.analysis_status ===
              'complete' &&
            analysis.is_usable
        )
        .map(
          (analysis) =>
            analysis.media_id
        )
    );

  for (
    const index of
      lockedSlotIndexes
  ) {
    const lockedPhotoId =
      savedSlotPhotoIds[
        index
      ];

    if (
      lockedPhotoId &&
      validPhotoIds.has(
        lockedPhotoId
      )
    ) {
      allowedPhotoIds.add(
        lockedPhotoId
      );
    }
  }

  const output =
    Array.from(
      allowedPhotoIds
    );

  if (
    output.length <
      6
  ) {
    throw new MarketingPackageError(
      `Views & Lifestyle needs at least six eligible analyzed or exact locked listing photos, but only ${output.length} are available.`,
      409,
      'views_lifestyle_schema_photo_pool_incomplete'
    );
  }

  return output;
}
function buildDesignInteriorsSchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  const familyCounts =
    new Map<
      string,
      number
    >();

  const duplicateGroupCounts =
    new Map<
      string,
      number
    >();

  const output:
    string[] =
    [];

  const candidates =
    analyses
      .filter(
        (analysis) =>
          validPhotoIds.has(
            analysis.media_id
          ) &&
          analysis.analysis_status ===
            'complete' &&
          analysis.is_usable &&
          emailEditionIsInterior(
            analysis
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          second.marketing_score -
            first.marketing_score ||
          second.quality_score -
            first.quality_score ||
          first.media_id.localeCompare(
            second.media_id
          )
      );

  for (
    const analysis of
      candidates
  ) {
    const family =
      emailEditionStoryFamily(
        analysis
      );

    const familyCount =
      familyCounts.get(
        family
      ) ||
      0;

    if (
      familyCount >=
      2
    ) {
      continue;
    }

    const duplicateGroup =
      (
        analysis.duplicate_group ||
        ''
      )
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          ''
        )
        .replace(
          /^group/,
          'grp'
        );

    const duplicateGroupCount =
      duplicateGroup
        ? (
            duplicateGroupCounts.get(
              duplicateGroup
            ) ||
            0
          )
        : 0;

    if (
      duplicateGroup &&
      duplicateGroupCount >=
        2
    ) {
      continue;
    }

    output.push(
      analysis.media_id
    );

    familyCounts.set(
      family,
      familyCount +
        1
    );

    if (duplicateGroup) {
      duplicateGroupCounts.set(
        duplicateGroup,
        duplicateGroupCount +
          1
      );
    }
  }

  for (
    const index of
      lockedSlotIndexes
  ) {
    const lockedPhotoId =
      savedSlotPhotoIds[
        index
      ];

    if (
      lockedPhotoId &&
      validPhotoIds.has(
        lockedPhotoId
      ) &&
      !output.includes(
        lockedPhotoId
      )
    ) {
      output.push(
        lockedPhotoId
      );
    }
  }

  if (
    output.length <
      6
  ) {
    throw new MarketingPackageError(
      `Design & Interiors needs at least six qualifying varied interior or exact locked listing photos, but only ${output.length} are available.`,
      409,
      'design_interiors_schema_photo_pool_incomplete'
    );
  }

  return output;
}

const EMAIL_EDITION_PHOTO_SLOT_KEYS = [
  'hero',
  'supporting_1',
  'supporting_2',
  'supporting_3',
  'supporting_4',
  'supporting_5',
] as const;

type EmailEditionPhotoSlotKey =
  typeof EMAIL_EDITION_PHOTO_SLOT_KEYS[
    number
  ];

function emailEditionPhotoIdsFromSlots({
  editionKey,
  candidatePhotoSlots,
}: {
  editionKey:
    EmailEditionKey;

  candidatePhotoSlots:
    unknown;
}) {
  if (
    !isRecord(
      candidatePhotoSlots
    )
  ) {
    throw new MarketingPackageError(
      `Samantha did not return named photo slots for ${EMAIL_EDITION_LABELS[editionKey]}.`,
      502,
      'email_edition_photo_slots_missing'
    );
  }

  return EMAIL_EDITION_PHOTO_SLOT_KEYS.map(
    (slotKey) =>
      candidatePhotoSlots[
        slotKey
      ]
  );
}

function emailEditionIsUtilityFamily(
  analysis:
    EditionPhotoAnalysis
) {
  return [
    'laundry',
    'garage',
    'storage',
  ].includes(
    emailEditionStoryFamily(
      analysis
    )
  );
}

function emailEditionIsDistinctiveFeature(
  analysis:
    EditionPhotoAnalysis
) {
  if (
    emailEditionIsPrimarySuite(
      analysis
    )
  ) {
    return true;
  }

  return [
    'office',
    'bonus_room',
    'garage',
    'shop',
    'detail',
  ].includes(
    emailEditionStoryFamily(
      analysis
    )
  );
}

function buildEmailEditionPhotoSlotsSchema({
  editionKey,
  analyses,
  candidatePhotoIds,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  editionKey:
    EmailEditionKey;

  analyses:
    EditionPhotoAnalysis[];

  candidatePhotoIds:
    string[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  const analysisByPhotoId =
    new Map(
      analyses.map(
        (analysis) => [
          analysis.media_id,
          analysis,
        ]
      )
    );

  const candidateIds =
    Array.from(
      new Set(
        candidatePhotoIds.filter(
          (photoId) =>
            validPhotoIds.has(
              photoId
            ) &&
            analysisByPhotoId.has(
              photoId
            )
        )
      )
    );

  const lockedIndexes =
    new Set(
      lockedSlotIndexes
    );

  const lockedPhotoIds =
    new Set(
      lockedSlotIndexes
        .map(
          (index) =>
            savedSlotPhotoIds[
              index
            ]
        )
        .filter(
          (
            photoId
          ): photoId is string =>
            Boolean(
              photoId
            )
        )
    );

  const matchingIds =
    (
      predicate:
        (
          analysis:
            EditionPhotoAnalysis
        ) => boolean
    ) =>
      candidateIds.filter(
        (photoId) => {
          const analysis =
            analysisByPhotoId.get(
              photoId
            );

          return Boolean(
            analysis &&
            predicate(
              analysis
            )
          );
        }
      );

  const all =
    [
      ...candidateIds,
    ];

  const arrival =
    matchingIds(
      emailEditionIsArrival
    );

  const exteriorArrival =
    matchingIds(
      (analysis) =>
        emailEditionIsArrival(
          analysis
        ) &&
        emailEditionStoryFamily(
          analysis
        ) ===
          'exterior'
    );

  const publicInterior =
    matchingIds(
      emailEditionIsPublicInterior
    );

  const living =
    matchingIds(
      (analysis) =>
        emailEditionStoryFamily(
          analysis
        ) ===
          'living'
    );

  const kitchen =
    matchingIds(
      (analysis) =>
        emailEditionStoryFamily(
          analysis
        ) ===
        'kitchen'
    );

  const kitchenOrDining =
    matchingIds(
      (analysis) =>
        [
          'kitchen',
          'dining',
        ].includes(
          emailEditionStoryFamily(
            analysis
          )
        )
    );

  const primarySuite =
    matchingIds(
      emailEditionIsPrimarySuite
    );

  const bedroomOrBathroom =
    matchingIds(
      (analysis) =>
        [
          'bedroom',
          'bathroom',
        ].includes(
          emailEditionStoryFamily(
            analysis
          )
        )
    );

  const privateOrFeature =
    matchingIds(
      emailEditionIsPrivateOrFeature
    );

  const distinctiveFeature =
    matchingIds(
      emailEditionIsDistinctiveFeature
    );

  const outdoor =
    matchingIds(
      emailEditionIsStrongOutdoorView
    );

  const hasOutdoorLifestyleStory =
    emailEditionHasOutdoorLifestyleStory(
      analyses,
      validPhotoIds
    );

  const outdoorLifestyleSupporting =
    matchingIds(
      (analysis) =>
        emailEditionIsStrongOutdoorView(
          analysis
        ) ||
        ![
          'bedroom',
          'bathroom',
          'office',
          'laundry',
          'garage',
          'storage',
        ].includes(
          emailEditionStoryFamily(
            analysis
          )
        )
    );

  const interior =
    matchingIds(
      emailEditionIsInterior
    );

  const specialtyInterior =
    matchingIds(
      (analysis) =>
        [
          'office',
          'bonus_room',
          'detail',
        ].includes(
          emailEditionStoryFamily(
            analysis
          )
        )
    );

  const nonPublicInterior =
    matchingIds(
      (analysis) =>
        emailEditionIsInterior(
          analysis
        ) &&
        !emailEditionIsPublicInterior(
          analysis
        )
    );

  const strongNonUtilityFeature =
    matchingIds(
      (analysis) =>
        !emailEditionIsUtilityFamily(
          analysis
        ) &&
        analysis.marketing_score >=
          75
    );

  const kitchenOrDetail =
    matchingIds(
      (analysis) =>
        [
          'kitchen',
          'detail',
        ].includes(
          emailEditionStoryFamily(
            analysis
          )
        )
    );

  const officeBedroomFeature =
    matchingIds(
      (analysis) =>
        [
          'office',
          'bedroom',
          'bonus_room',
          'detail',
        ].includes(
          emailEditionStoryFamily(
            analysis
          )
        )
    );

  const utility =
    matchingIds(
      emailEditionIsUtilityFamily
    );

  const outdoorOrDetail =
    matchingIds(
      (analysis) =>
        emailEditionIsStrongOutdoorView(
          analysis
        ) ||
        emailEditionStoryFamily(
          analysis
        ) ===
          'detail'
    );

  const prefer =
    (
      preferred:
        string[],
      fallback:
        string[]
    ) =>
      preferred.length >
        0
        ? preferred
        : fallback;

  const requirePool =
    (
      label:
        string,
      pool:
        string[]
    ) => {
      if (
        pool.length ===
        0
      ) {
        throw new MarketingPackageError(
          `${EMAIL_EDITION_LABELS[editionKey]} has no qualifying analyzed photo candidates for ${label}.`,
          409,
          'email_edition_named_slot_pool_incomplete'
        );
      }

      return pool;
    };

  const slotPools:
    Record<
      EmailEditionPhotoSlotKey,
      string[]
    > = {
      hero:
        all,

      supporting_1:
        all,

      supporting_2:
        all,

      supporting_3:
        all,

      supporting_4:
        all,

      supporting_5:
        all,
    };

  switch (
    editionKey
  ) {
    case 'launch':
      slotPools.hero =
        requirePool(
          'the arrival hero slot',
          prefer(
            exteriorArrival,
            arrival
          )
        );

      slotPools.supporting_1 =
        requirePool(
          'the principal living-room slot',
          prefer(
            living,
            publicInterior
          )
        );

      slotPools.supporting_2 =
        requirePool(
          'the kitchen slot',
          kitchen
        );

      slotPools.supporting_3 =
        requirePool(
          'the primary-suite slot',
          primarySuite
        );

      slotPools.supporting_4 =
        requirePool(
          'the real outdoor or view slot',
          outdoor
        );
      break;

    case 'views_lifestyle':
      if (
        hasOutdoorLifestyleStory
      ) {
        slotPools.hero =
          requirePool(
            'the outdoor or view hero slot',
            outdoor
          );

        slotPools.supporting_1 =
          requirePool(
            'Supporting 1',
            outdoor
          );

        slotPools.supporting_2 =
          requirePool(
            'Supporting 2',
            outdoor
          );

        slotPools.supporting_3 =
          requirePool(
            'Supporting 3',
            outdoor
          );
      } else {
        slotPools.hero =
          requirePool(
            'the strongest verified lifestyle hero slot',
            prefer(
              strongNonUtilityFeature,
              all
            )
          );

        slotPools.supporting_1 =
          requirePool(
            'Supporting 1',
            all
          );

        slotPools.supporting_2 =
          requirePool(
            'Supporting 2',
            all
          );

        slotPools.supporting_3 =
          requirePool(
            'Supporting 3',
            all
          );
      }

      slotPools.supporting_4 =
        requirePool(
          'Supporting 4',
          hasOutdoorLifestyleStory
            ? outdoorLifestyleSupporting
            : all
        );

      slotPools.supporting_5 =
        requirePool(
          'Supporting 5',
          hasOutdoorLifestyleStory
            ? outdoorLifestyleSupporting
            : all
        );
      break;

    case 'design_interiors':
      slotPools.hero =
        requirePool(
          'the interior hero slot',
          interior
        );

      slotPools.supporting_1 =
        requirePool(
          'the principal living-room slot',
          prefer(
            living,
            publicInterior
          )
        );

      slotPools.supporting_2 =
        requirePool(
          'the kitchen or dining slot',
          prefer(
            kitchenOrDining,
            publicInterior
          )
        );

      slotPools.supporting_3 =
        requirePool(
          'the private-suite slot',
          prefer(
            primarySuite,
            bedroomOrBathroom
          )
        );

      slotPools.supporting_4 =
        requirePool(
          'the specialty-interior slot',
          prefer(
            specialtyInterior,
            nonPublicInterior
          )
        );

      slotPools.supporting_5 =
        requirePool(
          'the final varied-interior slot',
          prefer(
            nonPublicInterior,
            interior
          )
        );
      break;

    case 'property_in_motion':
      slotPools.hero =
        requirePool(
          'the arrival hero slot',
          prefer(
            exteriorArrival,
            arrival
          )
        );

      slotPools.supporting_1 =
        requirePool(
          'the principal living-room slot',
          prefer(
            living,
            publicInterior
          )
        );

      slotPools.supporting_2 =
        requirePool(
          'the second public-space slot',
          publicInterior
        );

      slotPools.supporting_3 =
        requirePool(
          'the private or specialty slot',
          privateOrFeature
        );

      slotPools.supporting_4 =
        requirePool(
          'the primary-suite or feature slot',
          prefer(
            primarySuite,
            privateOrFeature
          )
        );

      slotPools.supporting_5 =
        requirePool(
          'the outdoor finish slot',
          outdoor
        );
      break;

    case 'closer_look':
      slotPools.hero =
        requirePool(
          'the strong feature hero slot',
          strongNonUtilityFeature
        );

      slotPools.supporting_1 =
        requirePool(
          'the kitchen or detail slot',
          prefer(
            kitchenOrDetail,
            strongNonUtilityFeature
          )
        );

      slotPools.supporting_2 =
        requirePool(
          'the suite or bathroom slot',
          prefer(
            primarySuite,
            bedroomOrBathroom
          )
        );

      slotPools.supporting_3 =
        requirePool(
          'the office, bedroom or specialty slot',
          prefer(
            officeBedroomFeature,
            privateOrFeature
          )
        );

      slotPools.supporting_4 =
        requirePool(
          'the limited utility or feature slot',
          Array.from(
            new Set([
              ...utility,
              ...strongNonUtilityFeature,
            ])
          )
        );

      slotPools.supporting_5 =
        requirePool(
          'the outdoor or final detail slot',
          prefer(
            outdoorOrDetail,
            strongNonUtilityFeature
          )
        );
      break;

    case 'agent_spotlight':
      slotPools.hero =
        requirePool(
          'the arrival hero slot',
          prefer(
            exteriorArrival,
            arrival
          )
        );

      slotPools.supporting_1 =
        requirePool(
          'the public-living slot',
          publicInterior
        );

      slotPools.supporting_2 =
        requirePool(
          'the kitchen or dining slot',
          prefer(
            kitchenOrDining,
            publicInterior
          )
        );

      slotPools.supporting_3 =
        requirePool(
          'the private or specialty slot',
          privateOrFeature
        );

      slotPools.supporting_4 =
        requirePool(
          'the outdoor or view slot',
          outdoor
        );

      slotPools.supporting_5 =
        requirePool(
          'the final balanced slot',
          prefer(
            primarySuite,
            all
          )
        );
      break;

    case 'fresh_opportunity':
      slotPools.hero =
        requirePool(
          'the arrival hero slot',
          prefer(
            exteriorArrival,
            arrival
          )
        );

      slotPools.supporting_1 =
        requirePool(
          'the public-living slot',
          publicInterior
        );

      slotPools.supporting_2 =
        requirePool(
          'the kitchen or dining slot',
          prefer(
            kitchenOrDining,
            publicInterior
          )
        );

      slotPools.supporting_3 =
        requirePool(
          'the primary-suite or distinctive-feature slot',
          prefer(
            primarySuite,
            distinctiveFeature
          )
        );

      slotPools.supporting_4 =
        requirePool(
          'the outdoor or view slot',
          outdoor
        );

      slotPools.supporting_5 =
        requirePool(
          'the final refreshed-feature slot',
          prefer(
            distinctiveFeature,
            all
          )
        );
      break;
  }

  const properties =
    Object.fromEntries(
      EMAIL_EDITION_PHOTO_SLOT_KEYS.map(
        (
          slotKey,
          index
        ) => {
          const locked =
            lockedIndexes.has(
              index
            );

          const lockedPhotoId =
            locked
              ? savedSlotPhotoIds[
                  index
                ]
              : null;

          if (
            locked &&
            (
              !lockedPhotoId ||
              !validPhotoIds.has(
                lockedPhotoId
              )
            )
          ) {
            throw new MarketingPackageError(
              `The locked ${EMAIL_EDITION_LABELS[editionKey]} ${slotKey} photo is no longer valid.`,
              409,
              'email_edition_locked_photo_invalid'
            );
          }

          const allowedPhotoIds =
            lockedPhotoId
              ? [
                  lockedPhotoId,
                ]
              : Array.from(
                  new Set(
                    slotPools[
                      slotKey
                    ].filter(
                      (photoId) =>
                        !lockedPhotoIds.has(
                          photoId
                        )
                    )
                  )
                );

          if (
            allowedPhotoIds.length ===
            0
          ) {
            throw new MarketingPackageError(
              `${EMAIL_EDITION_LABELS[editionKey]} has no remaining candidates for ${slotKey}.`,
              409,
              'email_edition_named_slot_pool_incomplete'
            );
          }

          return [
            slotKey,
            {
              type:
                'string',

              description:
                lockedPhotoId
                  ? `Preserve the exact manually locked ${slotKey} photo.`
                  : `Choose the best unique ${slotKey} photo for ${EMAIL_EDITION_LABELS[editionKey]}.`,

              enum:
                allowedPhotoIds,
            },
          ];
        }
      )
    );

  return {
    type:
      'object',

    properties,

    required:
      EMAIL_EDITION_PHOTO_SLOT_KEYS,

    additionalProperties:
      false,
  };
}

function buildEmailEditionOutputSchema({
  photoSlotsSchema,
}: {
  photoSlotsSchema:
    Record<
      string,
      unknown
    >;
}) {
  return {
    type:
      'object',

    properties: {
      subject: {
        type:
          'string',
      },

      preview_text: {
        type:
          'string',
      },

      headline: {
        type:
          'string',
      },

      body: {
        type:
          'string',

        maxLength:
          520,
      },

      full_description: {
        type:
          'string',

        maxLength:
          1600,
      },

      cta_label: {
        type:
          'string',
      },

      photo_slots:
        photoSlotsSchema,
    },

    required: [
      'subject',
      'preview_text',
      'headline',
      'body',
      'full_description',
      'cta_label',
      'photo_slots',
    ],

    additionalProperties:
      false,
  };
}

function buildEmailEditionSchemaRecord(
  buildSchema:
    (
      editionKey:
        EmailEditionKey
    ) =>
      Record<
        string,
        unknown
      >
):
  Record<
    EmailEditionKey,
    Record<
      string,
      unknown
    >
  > {
  return {
    launch:
      buildSchema(
        'launch'
      ),

    views_lifestyle:
      buildSchema(
        'views_lifestyle'
      ),

    design_interiors:
      buildSchema(
        'design_interiors'
      ),

    property_in_motion:
      buildSchema(
        'property_in_motion'
      ),

    closer_look:
      buildSchema(
        'closer_look'
      ),

    agent_spotlight:
      buildSchema(
        'agent_spotlight'
      ),

    fresh_opportunity:
      buildSchema(
        'fresh_opportunity'
      ),
  };
}

function normalizeEmailEditionDuplicateGroup(
  analysis:
    EditionPhotoAnalysis
) {
  return (
    analysis.duplicate_group ||
    ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ''
    )
    .replace(
      /^group/,
      'grp'
    );
}

function buildConstrainedEmailEditionSchemaPhotoIds({
  editionLabel,
  errorCode,
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
  includeAnalysis,
  defaultFamilyLimit,
  familyLimits,
  duplicateGroupLimit,
}: {
  editionLabel:
    string;

  errorCode:
    string;

  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;

  includeAnalysis:
    (
      analysis:
        EditionPhotoAnalysis
    ) => boolean;

  defaultFamilyLimit:
    number;

  familyLimits:
    Record<
      string,
      number
    >;

  duplicateGroupLimit:
    number;
}) {
  const familyCounts =
    new Map<
      string,
      number
    >();

  const duplicateGroupCounts =
    new Map<
      string,
      number
    >();

  const output:
    string[] =
    [];

  const candidates =
    analyses
      .filter(
        (analysis) =>
          validPhotoIds.has(
            analysis.media_id
          ) &&
          analysis.analysis_status ===
            'complete' &&
          analysis.is_usable &&
          includeAnalysis(
            analysis
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          second.marketing_score -
            first.marketing_score ||
          second.quality_score -
            first.quality_score ||
          second.confidence -
            first.confidence ||
          first.media_id.localeCompare(
            second.media_id
          )
      );

  for (
    const analysis of
      candidates
  ) {
    const family =
      emailEditionStoryFamily(
        analysis
      );

    const familyLimit =
      familyLimits[
        family
      ] ??
      defaultFamilyLimit;

    const familyCount =
      familyCounts.get(
        family
      ) ||
      0;

    if (
      familyCount >=
      familyLimit
    ) {
      continue;
    }

    const duplicateGroup =
      normalizeEmailEditionDuplicateGroup(
        analysis
      );

    const duplicateGroupCount =
      duplicateGroup
        ? (
            duplicateGroupCounts.get(
              duplicateGroup
            ) ||
            0
          )
        : 0;

    if (
      duplicateGroup &&
      duplicateGroupCount >=
        duplicateGroupLimit
    ) {
      continue;
    }

    output.push(
      analysis.media_id
    );

    familyCounts.set(
      family,
      familyCount +
        1
    );

    if (duplicateGroup) {
      duplicateGroupCounts.set(
        duplicateGroup,
        duplicateGroupCount +
          1
      );
    }
  }

  for (
    const index of
      lockedSlotIndexes
  ) {
    const lockedPhotoId =
      savedSlotPhotoIds[
        index
      ];

    if (
      lockedPhotoId &&
      validPhotoIds.has(
        lockedPhotoId
      ) &&
      !output.includes(
        lockedPhotoId
      )
    ) {
      output.push(
        lockedPhotoId
      );
    }
  }

  if (
    output.length <
      6
  ) {
    throw new MarketingPackageError(
      `${editionLabel} needs at least six qualifying or exact locked listing photos, but only ${output.length} are available.`,
      409,
      errorCode
    );
  }

  return output;
}

function buildLuxuryLaunchSchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  return buildConstrainedEmailEditionSchemaPhotoIds({
    editionLabel:
      'Luxury Launch',

    errorCode:
      'launch_schema_photo_pool_incomplete',

    analyses,
    savedSlotPhotoIds,
    lockedSlotIndexes,
    validPhotoIds,

    includeAnalysis:
      (analysis) =>
        emailEditionIsArrival(
          analysis
        ) ||
        emailEditionIsPublicInterior(
          analysis
        ) ||
        emailEditionIsPrimarySuite(
          analysis
        ) ||
        emailEditionIsStrongOutdoorView(
          analysis
        ),

    defaultFamilyLimit:
      2,

    familyLimits: {
      exterior:
        1,

      living:
        2,

      dining:
        1,

      kitchen:
        2,

      bedroom:
        2,

      bathroom:
        2,

      outdoor:
        3,
    },

    duplicateGroupLimit:
      2,
  });
}

function buildPropertyInMotionSchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  return buildConstrainedEmailEditionSchemaPhotoIds({
    editionLabel:
      'Property in Motion',

    errorCode:
      'property_in_motion_schema_photo_pool_incomplete',

    analyses,
    savedSlotPhotoIds,
    lockedSlotIndexes,
    validPhotoIds,

    includeAnalysis:
      (analysis) =>
        (
          emailEditionIsArrival(
            analysis
          ) &&
          analysis.marketing_score >=
            88
        ) ||
        emailEditionIsPublicInterior(
          analysis
        ) ||
        emailEditionIsPrivateOrFeature(
          analysis
        ) ||
        emailEditionIsStrongOutdoorView(
          analysis
        ),

    defaultFamilyLimit:
      2,

    familyLimits: {
      exterior:
        2,

      living:
        2,

      dining:
        1,

      kitchen:
        2,

      bedroom:
        2,

      bathroom:
        2,

      office:
        1,

      detail:
        1,

      garage:
        1,

      outdoor:
        3,
    },

    duplicateGroupLimit:
      2,
  });
}

function buildCloserLookSchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  return buildConstrainedEmailEditionSchemaPhotoIds({
    editionLabel:
      'A Closer Look',

    errorCode:
      'closer_look_schema_photo_pool_incomplete',

    analyses,
    savedSlotPhotoIds,
    lockedSlotIndexes,
    validPhotoIds,

    includeAnalysis:
      (analysis) => {
        const family =
          emailEditionStoryFamily(
            analysis
          );

        return [
          'kitchen',
          'bedroom',
          'bathroom',
          'office',
          'bonus_room',
          'detail',
          'laundry',
          'garage',
          'storage',
          'shop',
          'outdoor',
        ].includes(
          family
        );
      },

    defaultFamilyLimit:
      2,

    familyLimits: {
      kitchen:
        2,

      bedroom:
        2,

      bathroom:
        2,

      office:
        2,

      bonus_room:
        2,

      detail:
        2,

      laundry:
        1,

      garage:
        1,

      storage:
        1,

      shop:
        1,

      outdoor:
        1,
    },

    duplicateGroupLimit:
      2,
  });
}

function buildAgentSpotlightSchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  return buildConstrainedEmailEditionSchemaPhotoIds({
    editionLabel:
      'Agent Spotlight',

    errorCode:
      'agent_spotlight_schema_photo_pool_incomplete',

    analyses,
    savedSlotPhotoIds,
    lockedSlotIndexes,
    validPhotoIds,

    includeAnalysis:
      (analysis) =>
        emailEditionIsArrival(
          analysis
        ) ||
        emailEditionIsPublicInterior(
          analysis
        ) ||
        emailEditionIsPrivateOrFeature(
          analysis
        ) ||
        emailEditionIsStrongOutdoorView(
          analysis
        ),

    defaultFamilyLimit:
      2,

    familyLimits: {
      exterior:
        1,

      living:
        2,

      dining:
        1,

      kitchen:
        2,

      bedroom:
        2,

      bathroom:
        1,

      office:
        1,

      detail:
        1,

      garage:
        1,

      outdoor:
        2,
    },

    duplicateGroupLimit:
      2,
  });
}

function buildFreshOpportunitySchemaPhotoIds({
  analyses,
  savedSlotPhotoIds,
  lockedSlotIndexes,
  validPhotoIds,
}: {
  analyses:
    EditionPhotoAnalysis[];

  savedSlotPhotoIds:
    Array<
      string |
      null
    >;

  lockedSlotIndexes:
    number[];

  validPhotoIds:
    Set<string>;
}) {
  return buildConstrainedEmailEditionSchemaPhotoIds({
    editionLabel:
      'Fresh Opportunity',

    errorCode:
      'fresh_opportunity_schema_photo_pool_incomplete',

    analyses,
    savedSlotPhotoIds,
    lockedSlotIndexes,
    validPhotoIds,

    includeAnalysis:
      (analysis) =>
        emailEditionIsArrival(
          analysis
        ) ||
        emailEditionIsPublicInterior(
          analysis
        ) ||
        emailEditionIsPrimarySuite(
          analysis
        ) ||
        emailEditionIsPrivateOrFeature(
          analysis
        ) ||
        emailEditionIsStrongOutdoorView(
          analysis
        ),

    defaultFamilyLimit:
      2,

    familyLimits: {
      exterior:
        1,

      living:
        2,

      dining:
        1,

      kitchen:
        2,

      bedroom:
        2,

      bathroom:
        2,

      office:
        1,

      detail:
        1,

      garage:
        1,

      outdoor:
        2,
    },

    duplicateGroupLimit:
      2,
  });
}

function emailEditionIsArrival(
  analysis:
    EditionPhotoAnalysis
) {
  if (
    emailEditionIsAerialContext(
      analysis
    )
  ) {
    return false;
  }

  const category =
    analysis
      .primary_category;

  return (
    category ===
      'front_exterior' ||
    category ===
      'exterior' ||
    category ===
      'foyer' ||
    emailEditionHasStoryTerm(
      analysis,
      [
        'front entrance',
        'front entry',
        'front door',
        'walkway',
        'arrival',
      ]
    )
  );
}

function emailEditionIsPublicInterior(
  analysis:
    EditionPhotoAnalysis
) {
  const family =
    emailEditionStoryFamily(
      analysis
    );

  return (
    family ===
      'living' ||
    family ===
      'dining' ||
    family ===
      'kitchen'
  );
}

function emailEditionIsPrimarySuite(
  analysis:
    EditionPhotoAnalysis
) {
  return (
    analysis
      .primary_category ===
      'primary_bedroom' ||
    analysis
      .primary_category ===
      'primary_bathroom' ||
    emailEditionHasStoryTerm(
      analysis,
      [
        'primary bedroom',
        'primary bathroom',
        'primary suite',
      ]
    )
  );
}

function emailEditionIsPrivateOrFeature(
  analysis:
    EditionPhotoAnalysis
) {
  const family =
    emailEditionStoryFamily(
      analysis
    );

  return (
    family ===
      'bedroom' ||
    family ===
      'bathroom' ||
    family ===
      'office' ||
    family ===
      'bonus_room' ||
    family ===
      'garage' ||
    family ===
      'shop' ||
    family ===
      'detail'
  );
}

function emailEditionIsInterior(
  analysis:
    EditionPhotoAnalysis
) {
  const family =
    emailEditionStoryFamily(
      analysis
    );

  return [
    'living',
    'dining',
    'kitchen',
    'bedroom',
    'bathroom',
    'office',
    'bonus_room',
    'detail',
  ].includes(
    family
  );
}

function validateSamanthaEmailEditionStoryFit({
  editionKey,
  photoIds,
  analyses,
  validPhotoIds,
  lockedSlotIndexes,
}: {
  editionKey:
    EmailEditionKey;

  photoIds:
    string[];

  analyses:
    EditionPhotoAnalysis[];

  validPhotoIds:
    Set<string>;

  lockedSlotIndexes:
    number[];
}) {
  const analysisById =
    new Map(
      analyses.map(
        (analysis) => [
          analysis.media_id,
          analysis,
        ]
      )
    );

  const lockedIndexes =
    new Set(
      lockedSlotIndexes
    );

  const selections =
    photoIds.map(
      (
        photoId,
        index
      ) => {
        const analysis =
          analysisById.get(
            photoId
          ) ||
          null;

        return {
          photoId,
          index,
          locked:
            lockedIndexes.has(
              index
            ),
          analysis,
          family:
            analysis
              ? emailEditionStoryFamily(
                  analysis
                )
              : 'unknown',
        };
      }
    );

  const issues:
    string[] =
    [];

  const unlocked =
    selections.filter(
      (selection) =>
        !selection.locked
    );

  const analyzed =
    selections.filter(
      (
        selection
      ): selection is
        typeof selection & {
          analysis:
            EditionPhotoAnalysis;
        } =>
          Boolean(
            selection.analysis
          )
    );

  for (
    const selection of
      selections
  ) {
    if (
      !selection.analysis &&
      !selection.locked
    ) {
      issues.push(
        `slot ${selection.index + 1} has no usable saved analysis`
      );
    }
  }

  function countFamily(
    family: string,
    onlyUnlocked =
      false
  ) {
    return (
      onlyUnlocked
        ? unlocked
        : selections
    ).filter(
      (selection) =>
        selection.family ===
        family
    ).length;
  }

  function hasFamily(
    family: string
  ) {
    return selections.some(
      (selection) =>
        selection.family ===
        family
    );
  }

  function hasAnalyzedMatch(
    predicate:
      (
        analysis:
          EditionPhotoAnalysis
      ) => boolean
  ) {
    return analyzed.some(
      (selection) =>
        predicate(
          selection.analysis
        )
    );
  }

  function hasQualifyingAvailableFamily(
    family:
      string
  ) {
    return analyses.some(
      (analysis) =>
        validPhotoIds.has(
          analysis.media_id
        ) &&
        analysis.analysis_status ===
          'complete' &&
        analysis.is_usable &&
        emailEditionStoryFamily(
          analysis
        ) ===
          family
    );
  }

  const distinctFamilies =
    new Set(
      analyzed.map(
        (selection) =>
          selection.family
      )
    );

  const duplicateGroupCounts =
    new Map<
      string,
      number
    >();

  for (
    const selection of
      unlocked
  ) {
    const duplicateGroup =
      selection.analysis
        ?.duplicate_group
        ?.trim()
        .toLowerCase() ||
      '';

    if (!duplicateGroup) {
      continue;
    }

    duplicateGroupCounts.set(
      duplicateGroup,
      (
        duplicateGroupCounts.get(
          duplicateGroup
        ) ||
        0
      ) +
      1
    );
  }

  for (
    const [
      duplicateGroup,
      count,
    ] of
      duplicateGroupCounts
  ) {
    if (count > 2) {
      issues.push(
        `uses ${count} unlocked photos from duplicate group ${duplicateGroup}`
      );
    }
  }

  const hero =
    selections[0];

  if (
    editionKey ===
      'launch'
  ) {
    if (
      hero &&
      !hero.locked &&
      (
        !hero.analysis ||
        !emailEditionIsArrival(
          hero.analysis
        )
      )
    ) {
      issues.push(
        'hero must be a strong arrival or front-exterior image'
      );
    }

    if (
      countFamily(
        'exterior',
        true
      ) >
      1
    ) {
      issues.push(
        'uses more than one unlocked ordinary exterior'
      );
    }

    if (
      !hasFamily(
        'exterior'
      )
    ) {
      issues.push(
        'is missing an arrival or exterior image'
      );
    }

    if (
      hasQualifyingAvailableFamily(
        'living'
      ) &&
      !hasFamily(
        'living'
      )
    ) {
      issues.push(
        'is missing the qualifying principal living-room image'
      );
    }

    if (
      !hasFamily(
        'kitchen'
      )
    ) {
      issues.push(
        'is missing a kitchen image'
      );
    }

    if (
      !hasAnalyzedMatch(
        emailEditionIsPrimarySuite
      )
    ) {
      issues.push(
        'is missing a primary-suite image'
      );
    }

    if (
      !hasAnalyzedMatch(
        emailEditionIsStrongOutdoorView
      )
    ) {
      issues.push(
        'is missing a real outdoor or view image'
      );
    }
  }

  if (
    editionKey ===
      'views_lifestyle'
  ) {
    const hasOutdoorLifestyleStory =
      emailEditionHasOutdoorLifestyleStory(
        analyses,
        validPhotoIds
      );

    if (
      hasOutdoorLifestyleStory
    ) {
      if (
        hero &&
        !hero.locked &&
        (
          !hero.analysis ||
          !emailEditionIsStrongOutdoorView(
            hero.analysis
          )
        )
      ) {
        issues.push(
          'hero must show the verified view, patio, backyard, pool, scenery or a room visibly connected to that setting'
        );
      }

      const outdoorViewCount =
        analyzed.filter(
          (selection) =>
            emailEditionIsStrongOutdoorView(
              selection.analysis
            ) ||
            (
              selection.locked &&
              emailEditionIsAerialContext(
                selection.analysis
              )
            )
        ).length;

      if (
        outdoorViewCount <
        4
      ) {
        issues.push(
          `needs at least four outdoor or view-connected photos but returned ${outdoorViewCount}`
        );
      }

      const unrelatedUnlocked =
        unlocked.filter(
          (selection) => {
            if (!selection.analysis) {
              return false;
            }

            return (
              [
                'bedroom',
                'bathroom',
                'office',
                'laundry',
                'garage',
                'storage',
              ].includes(
                selection.family
              ) &&
              !emailEditionIsStrongOutdoorView(
                selection.analysis
              )
            );
          }
        );

      if (
        unrelatedUnlocked.length >
        0
      ) {
        issues.push(
          `contains ${unrelatedUnlocked.length} unrelated unlocked interior or utility photo(s)`
        );
      }
    } else {
      if (
        hero &&
        !hero.locked &&
        (
          !hero.analysis ||
          [
            'laundry',
            'garage',
            'storage',
          ].includes(
            hero.family
          )
        )
      ) {
        issues.push(
          'adaptive lifestyle hero must show a strong verified non-utility property feature'
        );
      }

      if (
        distinctFamilies.size <
        2
      ) {
        issues.push(
          `adaptive lifestyle story needs at least two distinct feature families but returned ${distinctFamilies.size}`
        );
      }

      const utilityCount =
        unlocked.filter(
          (selection) =>
            [
              'laundry',
              'garage',
              'storage',
            ].includes(
              selection.family
            )
        ).length;

      if (
        utilityCount >
        1
      ) {
        issues.push(
          `adaptive lifestyle story contains ${utilityCount} unlocked utility photos`
        );
      }

      const unlockedFamilyCounts =
        new Map<
          string,
          number
        >();

      for (
        const selection of
          unlocked
      ) {
        unlockedFamilyCounts.set(
          selection.family,
          (
            unlockedFamilyCounts.get(
              selection.family
            ) ||
            0
          ) +
          1
        );
      }

      for (
        const [
          family,
          count,
        ] of
          unlockedFamilyCounts
      ) {
        if (
          count >
          3
        ) {
          issues.push(
            `adaptive lifestyle story uses ${count} unlocked photos from the ${family} family`
          );
        }
      }

      for (
        const [
          duplicateGroup,
          count,
        ] of
          duplicateGroupCounts
      ) {
        if (
          count >
          2
        ) {
          issues.push(
            `adaptive lifestyle story uses ${count} unlocked photos from duplicate group ${duplicateGroup}`
          );
        }
      }
    }
  }

  if (
    editionKey ===
      'design_interiors'
  ) {
    if (
      hero &&
      !hero.locked &&
      (
        !hero.analysis ||
        !emailEditionIsInterior(
          hero.analysis
        )
      )
    ) {
      issues.push(
        'hero must be a strong interior image'
      );
    }

    if (
      hasQualifyingAvailableFamily(
        'living'
      ) &&
      !hasFamily(
        'living'
      )
    ) {
      issues.push(
        'is missing the qualifying principal living-room image'
      );
    }

    const interiorFamilies =
      new Set(
        analyzed
          .filter(
            (selection) =>
              emailEditionIsInterior(
                selection.analysis
              )
          )
          .map(
            (selection) =>
              selection.family
          )
      );

    if (
      interiorFamilies.size <
      3
    ) {
      issues.push(
        `needs at least three distinct interior families but returned ${interiorFamilies.size}`
      );
    }

    const unlockedFamilyCounts =
      new Map<
        string,
        number
      >();

    for (
      const selection of
        unlocked
    ) {
      if (
        !selection.analysis ||
        !emailEditionIsInterior(
          selection.analysis
        )
      ) {
        continue;
      }

      unlockedFamilyCounts.set(
        selection.family,
        (
          unlockedFamilyCounts.get(
            selection.family
          ) ||
          0
        ) +
        1
      );
    }

    for (
      const [
        family,
        count,
      ] of
        unlockedFamilyCounts
    ) {
      if (count > 2) {
        issues.push(
          `uses ${count} unlocked ${family} photos`
        );
      }
    }
  }

  if (
    editionKey ===
      'property_in_motion'
  ) {
    if (
      hero &&
      !hero.locked
    ) {
      if (
        !hero.analysis ||
        !emailEditionIsArrival(
          hero.analysis
        )
      ) {
        issues.push(
          'hero must begin with a clear arrival image'
        );
      }
      else if (
        hero.analysis
          .marketing_score <
        88
      ) {
        issues.push(
          `hero marketing score is ${hero.analysis.marketing_score}; choose a stronger arrival image`
        );
      }
    }

    if (
      hasQualifyingAvailableFamily(
        'living'
      ) &&
      !hasFamily(
        'living'
      )
    ) {
      issues.push(
        'is missing the qualifying principal living-room image'
      );
    }

    for (
      const index of
        [
          1,
          2,
        ]
    ) {
      const selection =
        selections[index];

      if (
        selection &&
        !selection.locked &&
        (
          !selection.analysis ||
          !emailEditionIsPublicInterior(
            selection.analysis
          )
        )
      ) {
        issues.push(
          `slot ${index + 1} must continue through a principal living, dining or kitchen space`
        );
      }
    }

    const privateFeatureCount =
      selections
        .slice(
          3,
          5
        )
        .filter(
          (selection) =>
            selection.analysis &&
            emailEditionIsPrivateOrFeature(
              selection.analysis
            )
        ).length;

    if (
      privateFeatureCount <
      1
    ) {
      issues.push(
        'slots 4 and 5 need at least one private-room or specialty-feature image'
      );
    }

    const finalSelection =
      selections[5];

    if (
      finalSelection &&
      !finalSelection.locked &&
      (
        !finalSelection.analysis ||
        !emailEditionIsStrongOutdoorView(
          finalSelection.analysis
        )
      )
    ) {
      issues.push(
        'final slot must finish with a patio, backyard, pool or view image'
      );
    }
  }

  if (
    editionKey ===
      'closer_look'
  ) {
    if (
      distinctFamilies.size <
      4
    ) {
      issues.push(
        `needs at least four distinct feature families but returned ${distinctFamilies.size}`
      );
    }

    for (
      const family of
        [
          'laundry',
          'garage',
          'storage',
        ]
    ) {
      const count =
        countFamily(
          family,
          true
        );

      if (count > 1) {
        issues.push(
          `uses ${count} unlocked ${family} photos`
        );
      }
    }

    if (
      countFamily(
        'bathroom',
        true
      ) >
      2
    ) {
      issues.push(
        'uses more than two unlocked bathroom-family photos'
      );
    }

    const showcaseCount =
      analyzed.filter(
        (selection) =>
          selection.analysis
            .marketing_score >=
            80 &&
          ![
            'laundry',
            'storage',
            'garage',
          ].includes(
            selection.family
          )
      ).length;

    if (
      showcaseCount <
      3
    ) {
      issues.push(
        `needs at least three strong non-utility feature images but returned ${showcaseCount}`
      );
    }
  }

  if (
    editionKey ===
      'agent_spotlight'
  ) {
    if (
      distinctFamilies.size <
      4
    ) {
      issues.push(
        `needs at least four distinct families but returned ${distinctFamilies.size}`
      );
    }

    if (
      countFamily(
        'exterior',
        true
      ) >
      1
    ) {
      issues.push(
        'uses more than one unlocked ordinary exterior'
      );
    }

    if (
      !hasAnalyzedMatch(
        emailEditionIsPublicInterior
      )
    ) {
      issues.push(
        'is missing a principal public living space'
      );
    }

    if (
      !hasAnalyzedMatch(
        emailEditionIsPrivateOrFeature
      )
    ) {
      issues.push(
        'is missing a private-room or specialty-feature image'
      );
    }

    if (
      !hasAnalyzedMatch(
        emailEditionIsStrongOutdoorView
      )
    ) {
      issues.push(
        'is missing an outdoor or view image'
      );
    }
  }

  if (
    editionKey ===
      'fresh_opportunity'
  ) {
    if (
      distinctFamilies.size <
      4
    ) {
      issues.push(
        `needs at least four distinct families but returned ${distinctFamilies.size}`
      );
    }

    if (
      countFamily(
        'exterior',
        true
      ) >
      1
    ) {
      issues.push(
        'uses more than one unlocked ordinary exterior'
      );
    }

    if (
      !hasAnalyzedMatch(
        emailEditionIsStrongOutdoorView
      )
    ) {
      issues.push(
        'is missing an outdoor or view image'
      );
    }

    const hasPrimaryOrDistinctive =
      analyzed.some(
        (selection) =>
          emailEditionIsPrimarySuite(
            selection.analysis
          ) ||
          [
            'office',
            'bonus_room',
            'garage',
            'shop',
            'detail',
          ].includes(
            selection.family
          )
      );

    if (
      !hasPrimaryOrDistinctive
    ) {
      issues.push(
        'is missing a primary-suite or distinctive-feature image'
      );
    }
  }

  if (
    issues.length >
    0
  ) {
    console.error(
      'Samantha Email edition story-fit validation failed.',
      {
        edition_key:
          editionKey,

        edition_label:
          EMAIL_EDITION_LABELS[
            editionKey
          ],

        photo_media_ids:
          photoIds,

        locked_slot_indexes:
          lockedSlotIndexes,

        issues,
      }
    );

    throw new MarketingPackageError(
      `Samantha selected a weak photo story for ${EMAIL_EDITION_LABELS[editionKey]}: ${issues.join('; ')}. No Email edition changes were saved.`,
      502,
      'email_edition_story_fit_invalid'
    );
  }
}

function buildEmailEditionPhotoPlanForPrompt({
  photoIdsByEdition,
  analyses,
  photos,
}: {
  photoIdsByEdition:
    Record<
      EmailEditionKey,
      string[]
    >;

  analyses:
    EditionPhotoAnalysis[];

  photos:
    PhotoRow[];
}) {
  const analysisByPhotoId =
    new Map(
      analyses.map(
        (analysis) => [
          analysis.media_id,
          analysis,
        ]
      )
    );

  const photoById =
    new Map(
      photos.map(
        (photo) => [
          photo.id,
          photo,
        ]
      )
    );

  return Object.fromEntries(
    EMAIL_EDITION_KEYS.map(
      (editionKey) => [
        editionKey,
        {
          edition_key:
            editionKey,

          edition_label:
            EMAIL_EDITION_LABELS[
              editionKey
            ],

          creative_brief:
            EMAIL_EDITION_WRITING_BRIEFS[
              editionKey
            ],

          slots:
            photoIdsByEdition[
              editionKey
            ].map(
              (
                photoId,
                index
              ) => {
                const analysis =
                  analysisByPhotoId.get(
                    photoId
                  ) ||
                  null;

                const photo =
                  photoById.get(
                    photoId
                  ) ||
                  null;

                return {
                  slot:
                    index ===
                      0
                      ? 'hero'
                      : `supporting_${index}`,

                  photo_media_id:
                    photoId,

                  file_name:
                    photo
                      ?.file_name ||
                    null,

                  title:
                    photo
                      ?.title ||
                    null,

                  caption:
                    photo
                      ?.caption ||
                    null,

                  primary_category:
                    analysis
                      ?.primary_category ||
                    null,

                  room_label:
                    analysis
                      ?.room_label ||
                    null,

                  feature_tags:
                    analysis
                      ?.feature_tags ||
                    [],

                  visual_summary:
                    analysis
                      ?.visual_summary ||
                    null,

                  quality_score:
                    analysis
                      ?.quality_score ??
                    null,

                  marketing_score:
                    analysis
                      ?.marketing_score ??
                    null,

                  confidence:
                    analysis
                      ?.confidence ??
                    null,
                };
              }
            ),
        },
      ]
    )
  );
}

function assignmentSlot(
  sectionKey: SectionKey,
  index: number
) {
  if (
    sectionKey ===
    'property_website'
  ) {
    return index === 0
      ? {
          slot_key:
            'hero',
          sort_order:
            0,
        }
      : {
          slot_key:
            'gallery',
          sort_order:
            index - 1,
        };
  }

  if (
    sectionKey ===
    'email'
  ) {
    return index === 0
      ? {
          slot_key:
            'hero',
          sort_order:
            0,
        }
      : {
          slot_key:
            'supporting',
          sort_order:
            index - 1,
        };
  }

  if (
    sectionKey ===
    'social'
  ) {
    return index === 0
      ? {
          slot_key:
            'primary',
          sort_order:
            0,
        }
      : {
          slot_key:
            'carousel',
          sort_order:
            index - 1,
        };
  }

  if (
    sectionKey ===
    'flyer'
  ) {
    return index === 0
      ? {
          slot_key:
            'cover',
          sort_order:
            0,
        }
      : {
          slot_key:
            'interior',
          sort_order:
            index - 1,
        };
  }

  if (
    sectionKey ===
    'video'
  ) {
    return index === 0
      ? {
          slot_key:
            'cover',
          sort_order:
            0,
        }
      : {
          slot_key:
            'scene',
          sort_order:
            index - 1,
        };
  }

  return index === 0
    ? {
        slot_key:
          'cover',
        sort_order:
          0,
      }
    : {
        slot_key:
          'supporting',
        sort_order:
          index - 1,
      };
}

const EXCLUDED_FLYER_CATEGORIES =
  new Set<
    ListingPhotoAnalysis[
      'primary_category'
    ]
  >([
    'hallway',
    'foyer',
    'laundry',
    'community',
    'detail',
    'floor_plan',
    'other',
  ]);

function scoreFlyerPhoto(
  analysis:
    ListingPhotoAnalysis
) {
  return (
    analysis.marketing_score *
      3 +
    analysis.quality_score *
      2 +
    analysis.confidence *
      50
  );
}

function flyerCategoryPriorities(
  index: number
): Array<
  ListingPhotoAnalysis[
    'primary_category'
  ]
> {
  if (index === 0) {
    return [
      'front_exterior',
      'exterior',
    ];
  }

  if (index === 1) {
    return [
      'kitchen',
    ];
  }

  if (index === 2) {
    return [
      'living_room',
      'dining_room',
    ];
  }

  if (index === 3) {
    return [
      'primary_bedroom',
      'bedroom',
    ];
  }

  if (index === 4) {
    return [
      'primary_bathroom',
      'bathroom',
    ];
  }

  return [
    'backyard',
    'patio',
    'view',
    'pool',
    'garage',
    'shop',
    'exterior',
  ];
}

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
    MarketingPackageError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function responseCode(
  error: unknown
) {
  if (
    error instanceof
    MarketingPackageError
  ) {
    return error.code;
  }

  if (
    error instanceof
    RequestAuthError
  ) {
    return 'authorization_error';
  }

  return 'unexpected_error';
}

export async function POST(
  request: Request
) {
  try {
    const authenticatedProfile =
      await requireAuthenticatedProfile(
        request
      );

    const requester:
      Requester = {
      id:
        authenticatedProfile.id,

      org_id:
        authenticatedProfile.org_id ||
        null,

      role:
        authenticatedProfile.role as Role,
    };

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const listingId =
      cleanText(
        body?.listing_id,
        100
      );
    const requestMode =
      cleanText(
        body?.mode,
        80
      );
    const requestedFlyerTemplateKey =
      cleanText(
        body?.template_key,
        160
      );

    if (!listingId) {
      throw new MarketingPackageError(
        'Choose a listing first.',
        400,
        'listing_required'
      );
    }

    const rawEventType =
      cleanText(
        body?.event_type,
        100
      )
        .toLowerCase();

    const legacyEventTypes =
      new Set([
        'listing_ad',
        'price_change',
        'showing_window',
        'seller_terms',
      ]);

    if (
      rawEventType &&
      !isListingEmailEventKey(
        rawEventType
      ) &&
      !legacyEventTypes.has(
        rawEventType
      )
    ) {
      throw new MarketingPackageError(
        'Choose a valid listing email event.',
        400,
        'listing_email_event_invalid'
      );
    }

    const eventType =
      normalizeListingEmailEventKey(
        rawEventType ||
          'new_listing',
        'new_listing'
      );

    const eventDetails =
      isRecord(
        body?.event_details
      )
        ? body.event_details
        : {};

    const eventDefinition =
      listingEmailEventDefinition(
        eventType
      );

    if (
      eventDefinition
        .internalOnly
    ) {
      throw new MarketingPackageError(
        `${eventDefinition.label} is an internal-only listing event and cannot generate external email marketing.`,
        400,
        'internal_listing_event_external_email_forbidden'
      );
    }

    const eventDefaultEditionKey =
      normalizeEmailEditionKey(
        eventDefinition
          .defaultLuxuryEdition
      );

    const eventDetailValidation =
      validateListingEmailEventDetails(
        eventType,
        eventDetails
      );

    if (
      !eventDetailValidation.ok
    ) {
      const missingLabels =
        eventDetailValidation
          .missing
          .map(
            (detailKey) =>
              listingEmailEventDetailLabel(
                detailKey
              )
          )
          .join(', ');

      throw new MarketingPackageError(
        `Complete the verified ${eventDefinition.label} details before Samantha prepares the email: ${missingLabels}.`,
        400,
        'listing_email_event_details_required'
      );
    }

    const {
      data: listingData,
      error: listingError,
    } = await supabaseAdmin
      .from('listings')
      .select(`
        id,
        org_id,
        owner_user_id,
        title,
        property_type,
        property_address,
        city,
        state,
        zip,
        mls_number,
        list_price,
        listing_status,
        bedrooms,
        bathrooms,
        garage_spaces,
        square_feet,
        year_built,
        lot_size_text,
        acres,
        county,
        subdivision,
        school_district,
        elementary_school,
        middle_school,
        high_school,
        hoa_fee,
        hoa_frequency,
        features,
        inclusions,
        public_remarks,
        description,
        campaign_headline,
        short_marketing_description,
        website_template_key,
        review_status
      `)
      .eq(
        'id',
        listingId
      )
      .single();

    if (
      listingError ||
      !listingData
    ) {
      throw new MarketingPackageError(
        listingError?.message ||
          'Listing not found.',
        404,
        'listing_not_found'
      );
    }

    const listing =
      listingData as ListingRow;

    if (
      !canManageListing(
        requester,
        listing
      )
    ) {
      throw new MarketingPackageError(
        'You do not have access to prepare marketing for this listing.',
        403,
        'listing_access_denied'
      );
    }

    if (
      !listing.owner_user_id
    ) {
      throw new MarketingPackageError(
        'Assign a listing owner before Samantha prepares the marketing package.',
        400,
        'listing_owner_required'
      );
    }

    if (
      listing.review_status !==
      'confirmed'
    ) {
      throw new MarketingPackageError(
        'Review and confirm the listing facts before Samantha prepares marketing.',
        400,
        'listing_confirmation_required'
      );
    }

    const [
      photoResult,
      documentResult,
      sectionResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          'listing_media'
        )
        .select(`
          id,
          public_url,
          thumbnail_url,
          file_name,
          title,
          caption,
          sort_order,
          is_primary
        `)
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'media_type',
          'photo'
        )
        .eq(
          'use_in_marketing',
          true
        )
        .order(
          'sort_order',
          {
            ascending:
              true,
          }
        )
        .limit(100),

      supabaseAdmin
        .from(
          'listing_documents'
        )
        .select(`
          id,
          file_name,
          extracted_data,
          extracted_at
        `)
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'extraction_status',
          'completed'
        )
        .order(
          'extracted_at',
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle(),

      supabaseAdmin
        .from(
          'listing_marketing_sections'
        )
        .select(`
          section_key,
          status,
          template_key,
          template_locked,
          content,
          manual_override,
          generation_version,
          approved_at,
          approved_by
        `)
        .eq(
          'listing_id',
          listing.id
        ),
    ]);

    if (photoResult.error) {
      throw new MarketingPackageError(
        photoResult.error.message,
        500,
        'photo_load_failed'
      );
    }

    if (documentResult.error) {
      throw new MarketingPackageError(
        documentResult.error.message,
        500,
        'document_load_failed'
      );
    }

    if (sectionResult.error) {
      throw new MarketingPackageError(
        sectionResult.error.message,
        500,
        'section_load_failed'
      );
    }

    const photos =
      (
        photoResult.data ||
        []
      ) as PhotoRow[];

    if (
      photos.length ===
      0
    ) {
      throw new MarketingPackageError(
        'Select at least one listing photo for marketing.',
        400,
        'marketing_photos_required'
      );
    }

    const existingSections =
      new Map<
        SectionKey,
        ExistingSection
      >(
        (
          sectionResult.data ||
          []
        ).map(
          (row: any) => [
            row.section_key,
            row as ExistingSection,
          ]
        )
      );

    const document =
      documentResult.data ||
      null;

    const validPhotoIds =
      new Set(
        photos.map(
          (photo) =>
            photo.id
        )
      );

    const verifiedEventDetails:
      Record<string, unknown> =
      {};

    function normalizeEventDateTime(
      detailKey:
        | 'event_start_at'
        | 'deadline_at',
      value: unknown
    ) {
      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return;
      }

      const cleaned =
        cleanText(
          value,
          120
        );

      const parsed =
        new Date(cleaned);

      if (
        !cleaned ||
        Number.isNaN(
          parsed.getTime()
        ) ||
        parsed.getTime() <=
          Date.now()
      ) {
        throw new MarketingPackageError(
          `${listingEmailEventDetailLabel(detailKey)} must be a valid future date and time.`,
          400,
          'listing_email_event_datetime_invalid'
        );
      }

      verifiedEventDetails[
        detailKey
      ] =
        parsed.toISOString();
    }

    function normalizeEventPrice(
      detailKey:
        | 'original_price'
        | 'new_price',
      value: unknown
    ): number | null {
      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return null;
      }

      const cleaned =
        typeof value ===
          'number'
          ? String(value)
          : cleanText(
              value,
              50
            );

      const amount =
        Number(
          cleaned.replace(
            /[$,\s]/g,
            ''
          )
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        throw new MarketingPackageError(
          `${listingEmailEventDetailLabel(detailKey)} must be a positive currency value.`,
          400,
          'listing_email_event_price_invalid'
        );
      }

      const normalizedAmount =
        Math.round(
          amount * 100
        ) / 100;

      verifiedEventDetails[
        detailKey
      ] =
        normalizedAmount;

      return normalizedAmount;
    }

    normalizeEventDateTime(
      'event_start_at',
      eventDetails
        .event_start_at
    );

    normalizeEventDateTime(
      'deadline_at',
      eventDetails
        .deadline_at
    );

    const originalPrice =
      normalizeEventPrice(
        'original_price',
        eventDetails
          .original_price
      );

    const newPrice =
      normalizeEventPrice(
        'new_price',
        eventDetails
          .new_price
      );

    if (
      eventType ===
        'price_improvement'
    ) {
      if (
        originalPrice === null ||
        newPrice === null ||
        newPrice >=
          originalPrice
      ) {
        throw new MarketingPackageError(
          'The new price must be lower than the original price.',
          400,
          'listing_email_event_price_relationship_invalid'
        );
      }

      const currentListPrice =
        typeof listing
          .list_price ===
          'number'
          ? listing
              .list_price
          : Number(
              cleanText(
                listing
                  .list_price,
                50
              ).replace(
                /[$,\s]/g,
                ''
              )
            );

      if (
        !Number.isFinite(
          currentListPrice
        ) ||
        currentListPrice <= 0
      ) {
        throw new MarketingPackageError(
          'Confirm the current listing price before preparing a Price Improvement email.',
          400,
          'listing_current_price_required'
        );
      }

      if (
        Math.abs(
          newPrice -
            currentListPrice
        ) > 0.009
      ) {
        throw new MarketingPackageError(
          'The verified new price must match the listing current price.',
          400,
          'listing_email_event_new_price_mismatch'
        );
      }
    }

    if (
      eventDetails
        .video_url !==
        undefined
    ) {
      const videoUrl =
        cleanText(
          eventDetails
            .video_url,
          2048
        );

      let parsedVideoUrl:
        URL;

      try {
        parsedVideoUrl =
          new URL(
            videoUrl
          );
      }
      catch {
        throw new MarketingPackageError(
          'Enter a valid property video or virtual-tour URL.',
          400,
          'listing_email_event_video_url_invalid'
        );
      }

      if (
        parsedVideoUrl
          .protocol !==
          'https:' &&
        parsedVideoUrl
          .protocol !==
          'http:'
      ) {
        throw new MarketingPackageError(
          'The property video or virtual-tour URL must use HTTP or HTTPS.',
          400,
          'listing_email_event_video_url_invalid'
        );
      }

      verifiedEventDetails
        .video_url =
        parsedVideoUrl
          .toString();
    }

    if (
      eventDetails
        .incentive_summary !==
        undefined
    ) {
      if (
        typeof eventDetails
          .incentive_summary !==
          'string'
      ) {
        throw new MarketingPackageError(
          'Verified incentive terms must be entered as text.',
          400,
          'listing_email_event_incentive_invalid'
        );
      }

      const incentiveSummary =
        eventDetails
          .incentive_summary
          .trim();

      if (
        !incentiveSummary ||
        incentiveSummary.length >
          1000
      ) {
        throw new MarketingPackageError(
          'Verified incentive terms must contain between 1 and 1000 characters.',
          400,
          'listing_email_event_incentive_invalid'
        );
      }

      verifiedEventDetails
        .incentive_summary =
        incentiveSummary;
    }

    if (
      eventDetails
        .photo_media_ids !==
        undefined
    ) {
      if (
        !Array.isArray(
          eventDetails
            .photo_media_ids
        )
      ) {
        throw new MarketingPackageError(
          'Choose one or more valid listing photos.',
          400,
          'listing_email_event_photos_invalid'
        );
      }

      const requestedPhotoIds =
        eventDetails
          .photo_media_ids;

      const normalizedPhotoIds =
        requestedPhotoIds
          .map(
            (photoId) =>
              typeof photoId ===
                'string'
                ? photoId
                    .trim()
                : ''
          );

      if (
        normalizedPhotoIds
          .some(
            (photoId) =>
              !photoId ||
              !validPhotoIds.has(
                photoId
              )
          )
      ) {
        throw new MarketingPackageError(
          'Every selected event photo must belong to this listing.',
          400,
          'listing_email_event_photos_invalid'
        );
      }

      const uniquePhotoIds =
        [
          ...new Set(
            normalizedPhotoIds
          ),
        ];

      if (
        uniquePhotoIds.length ===
        0
      ) {
        throw new MarketingPackageError(
          'Choose at least one valid listing photo.',
          400,
          'listing_email_event_photos_required'
        );
      }

      verifiedEventDetails
        .photo_media_ids =
        uniquePhotoIds;
    }

    const eventPhotoMediaIds =
      Array.isArray(
        verifiedEventDetails
          .photo_media_ids
      )
        ? verifiedEventDetails
            .photo_media_ids as
              string[]
        : [];

    const verifiedDetailValidation =
      validateListingEmailEventDetails(
        eventType,
        verifiedEventDetails
      );

    if (
      !verifiedDetailValidation.ok
    ) {
      const invalidLabels =
        verifiedDetailValidation
          .missing
          .map(
            (detailKey) =>
              listingEmailEventDetailLabel(
                detailKey
              )
          )
          .join(', ');

      throw new MarketingPackageError(
        `Complete valid ${eventDefinition.label} details before Samantha prepares the email: ${invalidLabels}.`,
        400,
        'listing_email_event_details_invalid'
      );
    }

    const listingFacts = {
      ...listing,

      extracted_public_data:
        document
          ?.extracted_data ||
        null,
    };

    const photoCatalog =
      photos.map(
        (photo) => ({
          photo_media_id:
            photo.id,

          file_name:
            photo.file_name,

          title:
            photo.title,

          caption:
            photo.caption,

          sort_order:
            photo.sort_order,

          is_primary:
            photo.is_primary,
        })
      );

    if (
      requestMode ===
        'recommend_flyer_photos'
    ) {
      const template =
        CANVA_FLYER_TEMPLATES.find(
          (item) =>
            item.key ===
              requestedFlyerTemplateKey &&
            item.flyerType ===
              'flyer'
        ) ||
        null;

      if (!template) {
        throw new MarketingPackageError(
          'Choose a valid approved Canva Flyer template.',
          400,
          'flyer_template_invalid'
        );
      }

      const [
        intelligence,
        lockedFlyerResult,
      ] = await Promise.all([
        loadSavedListingPhotoIntelligence({
          listingId:
            listing.id,

          photos,
        }),

        supabaseAdmin
          .from(
            'listing_marketing_photo_assignments'
          )
          .select(`
            slot_key,
            sort_order,
            media_id,
            is_locked
          `)
          .eq(
            'listing_id',
            listing.id
          )
          .eq(
            'section_key',
            'flyer'
          )
          .eq(
            'is_locked',
            true
          ),
      ]);

      if (
        lockedFlyerResult.error
      ) {
        throw new MarketingPackageError(
          lockedFlyerResult
            .error
            .message,
          500,
          'flyer_locked_photo_load_failed'
        );
      }

      if (
        intelligence.analyses
          .length === 0
      ) {
        throw new MarketingPackageError(
          'Samantha must analyze the listing photos before recommending Flyer photos.',
          409,
          'flyer_photo_analysis_required'
        );
      }

      const currentPhotoIds =
        new Set(
          photos.map(
            (photo) =>
              photo.id
          )
        );
      const templateSlotIds =
        new Set(
          template.photoSlots.map(
            (slot) =>
              `${slot.slotKey}:${slot.sortOrder}`
          )
        );
      const analysisById =
        new Map(
          intelligence.analyses.map(
            (analysis) => [
              analysis.media_id,
              analysis,
            ]
          )
        );
      const lockedBySlot =
        new Map<
          string,
          string
        >();
      const usedPhotoIds =
        new Set<string>();
      const usedDuplicateGroups =
        new Set<string>();

      function markFlyerPhotoUsed(
        mediaId: string
      ) {
        usedPhotoIds.add(
          mediaId
        );

        const analysis =
          analysisById.get(
            mediaId
          );

        if (
          analysis
            ?.duplicate_group
        ) {
          usedDuplicateGroups.add(
            analysis
              .duplicate_group
          );
        }
      }

      for (
        const row of
          lockedFlyerResult
            .data || []
      ) {
        const slotId =
          `${row.slot_key}:${row.sort_order}`;
        const mediaId =
          String(
            row.media_id ||
            ''
          );

        if (
          !templateSlotIds.has(
            slotId
          ) ||
          !mediaId ||
          !currentPhotoIds.has(
            mediaId
          )
        ) {
          continue;
        }

        lockedBySlot.set(
          slotId,
          mediaId
        );

        markFlyerPhotoUsed(
          mediaId
        );
      }

      const rankedAnalyses =
        intelligence.analyses
          .filter(
            (analysis) =>
              currentPhotoIds.has(
                analysis.media_id
              ) &&
              analysis
                .analysis_status !==
                'failed' &&
              analysis.is_usable &&
              analysis.confidence >=
                0.35 &&
              !EXCLUDED_FLYER_CATEGORIES.has(
                analysis
                  .primary_category
              )
          )
          .slice()
          .sort(
            (left, right) =>
              scoreFlyerPhoto(
                right
              ) -
              scoreFlyerPhoto(
                left
              )
          );

      function isFlyerPhotoAvailable(
        analysis:
          ListingPhotoAnalysis
      ) {
        if (
          usedPhotoIds.has(
            analysis.media_id
          )
        ) {
          return false;
        }

        if (
          analysis
            .duplicate_group &&
          usedDuplicateGroups.has(
            analysis
              .duplicate_group
          )
        ) {
          return false;
        }

        return true;
      }

      const recommendations:
        Array<{
          slot_key: string;
          sort_order: number;
          media_id: string;
          locked: boolean;
        }> = [];

      for (
        let index = 0;
        index <
          template.photoSlots
            .length;
        index += 1
      ) {
        const slot =
          template.photoSlots[
            index
          ];
        const slotId =
          `${slot.slotKey}:${slot.sortOrder}`;
        const lockedMediaId =
          lockedBySlot.get(
            slotId
          );

        if (lockedMediaId) {
          recommendations.push({
            slot_key:
              slot.slotKey,

            sort_order:
              slot.sortOrder,

            media_id:
              lockedMediaId,

            locked: true,
          });

          continue;
        }

        const priorities =
          flyerCategoryPriorities(
            index
          );
        let candidate:
          ListingPhotoAnalysis |
          null =
            null;

        for (
          const category of
            priorities
        ) {
          candidate =
            rankedAnalyses.find(
              (analysis) =>
                analysis
                  .primary_category ===
                  category &&
                isFlyerPhotoAvailable(
                  analysis
                )
            ) ||
            null;

          if (candidate) {
            break;
          }
        }

        if (!candidate) {
          candidate =
            rankedAnalyses.find(
              (analysis) =>
                isFlyerPhotoAvailable(
                  analysis
                )
            ) ||
            null;
        }

        if (!candidate) {
          continue;
        }

        markFlyerPhotoUsed(
          candidate.media_id
        );

        recommendations.push({
          slot_key:
            slot.slotKey,

          sort_order:
            slot.sortOrder,

          media_id:
            candidate.media_id,

          locked: false,
        });
      }

      const {
        error:
          oldRecommendationDeleteError,
      } = await supabaseAdmin
        .from(
          'listing_marketing_photo_assignments'
        )
        .delete()
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'section_key',
          'flyer'
        )
        .eq(
          'is_locked',
          false
        );

      if (
        oldRecommendationDeleteError
      ) {
        throw new MarketingPackageError(
          oldRecommendationDeleteError
            .message,
          500,
          'old_flyer_recommendation_delete_failed'
        );
      }

      const unlockedRecommendations =
        recommendations.filter(
          (recommendation) =>
            !recommendation.locked
        );

      if (
        unlockedRecommendations
          .length > 0
      ) {
        const {
          error:
            recommendationInsertError,
        } = await supabaseAdmin
          .from(
            'listing_marketing_photo_assignments'
          )
          .insert(
            unlockedRecommendations.map(
              (recommendation) => ({
                listing_id:
                  listing.id,

                org_id:
                  listing.org_id,

                owner_user_id:
                  listing
                    .owner_user_id,

                section_key:
                  'flyer',

                slot_key:
                  recommendation
                    .slot_key,

                sort_order:
                  recommendation
                    .sort_order,

                media_id:
                  recommendation
                    .media_id,

                selected_by:
                  'samantha',

                is_locked:
                  false,

                created_by:
                  requester.id,

                updated_by:
                  requester.id,
              })
            )
          );

        if (
          recommendationInsertError
        ) {
          throw new MarketingPackageError(
            recommendationInsertError
              .message,
            500,
            'flyer_recommendation_save_failed'
          );
        }
      }

      const {
        error:
          flyerSectionUpdateError,
      } = await supabaseAdmin
        .from(
          'listing_marketing_sections'
        )
        .update({
          status:
            'needs_review',

          approved_at:
            null,

          approved_by:
            null,

          updated_by:
            requester.id,
        })
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'section_key',
          'flyer'
        );

      if (
        flyerSectionUpdateError
      ) {
        throw new MarketingPackageError(
          flyerSectionUpdateError
            .message,
          500,
          'flyer_section_update_failed'
        );
      }

      return NextResponse.json(
        {
          ok: true,

          message:
            `Samantha selected ${recommendations.length} photos for ${template.name}.`,

          template_key:
            template.key,

          recommended_count:
            unlockedRecommendations
              .length,

          locked_count:
            recommendations.filter(
              (recommendation) =>
                recommendation.locked
            ).length,
        },
        {
          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      );
    }

    if (
      requestMode ===
        'refresh_email_edition_stories' ||
      requestMode ===
        'repair_email_edition_photos'
    ) {
      const emailSection =
        existingSections.get(
          'email'
        ) ||
        null;

      if (!emailSection) {
        throw new MarketingPackageError(
          'Prepare the Email section before refreshing its edition stories and photos.',
          409,
          'email_section_required'
        );
      }

      const existingEmailContent =
        isRecord(
          emailSection.content
        )
          ? emailSection.content
          : {};

      const existingEditionSource =
        isRecord(
          existingEmailContent
            .editions
        )
          ? existingEmailContent
              .editions
          : {};

      const photoIntelligence =
        await loadSavedListingPhotoIntelligence({
          listingId:
            listing.id,

          photos,
        });

      if (
        photoIntelligence
          .analyses
          .length === 0
      ) {
        throw new MarketingPackageError(
          'Samantha must analyze the listing photos before refreshing the Email editions.',
          409,
          'email_photo_analysis_required'
        );
      }

      const storedEventType =
        cleanText(
          existingEmailContent
            .event_type,
          100
        );

      const refreshEventType =
        normalizeListingEmailEventKey(
          storedEventType ||
            eventType,
          'new_listing'
        );

      const refreshEventDefinition =
        listingEmailEventDefinition(
          refreshEventType
        );

      if (
        refreshEventDefinition
          .internalOnly
      ) {
        throw new MarketingPackageError(
          `${refreshEventDefinition.label} is an internal-only listing event and cannot generate external email marketing.`,
          400,
          'internal_listing_event_external_email_forbidden'
        );
      }

      const refreshDefaultEditionKey =
        normalizeEmailEditionKey(
          refreshEventDefinition
            .defaultLuxuryEdition
        );

      const refreshEventDetails =
        isRecord(
          existingEmailContent
            .event_details
        )
          ? existingEmailContent
              .event_details
          : verifiedEventDetails;

      const refreshEventPhotoIds =
        Array.isArray(
          refreshEventDetails
            .photo_media_ids
        )
          ? normalizePhotoIds(
              refreshEventDetails
                .photo_media_ids,
              validPhotoIds
            )
          : [];

      const refreshAnalysisByPhotoId =
        new Map(
          photoIntelligence
            .analyses
            .map(
              (analysis) => [
                analysis.media_id,
                analysis,
              ]
            )
        );

      const refreshAnalyzedPhotoCatalog =
        photoCatalog.map(
          (photo) => ({
            ...photo,

            ai_analysis:
              refreshAnalysisByPhotoId.get(
                photo.photo_media_id
              ) ||
              null,
          })
        );

      const refreshLockedPhotoSlots =
        buildLockedEmailPhotoSlotsForPrompt({
          savedSlotPhotoIdsByEdition:
            photoIntelligence
              .emailSlotPhotoIdsByEdition,

          lockedSlotIndexesByEdition:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition,
        });

      const refreshViewsLifestyleSchemaPhotoIds =
        buildViewsLifestyleSchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .views_lifestyle,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .views_lifestyle,

          validPhotoIds,
        });

      const refreshDesignInteriorsSchemaPhotoIds =
        buildDesignInteriorsSchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .design_interiors,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .design_interiors,

          validPhotoIds,
        });

      const refreshLuxuryLaunchSchemaPhotoIds =
        buildLuxuryLaunchSchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .launch,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .launch,

          validPhotoIds,
        });

      const refreshPropertyInMotionSchemaPhotoIds =
        buildPropertyInMotionSchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .property_in_motion,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .property_in_motion,

          validPhotoIds,
        });

      const refreshCloserLookSchemaPhotoIds =
        buildCloserLookSchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .closer_look,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .closer_look,

          validPhotoIds,
        });

      const refreshAgentSpotlightSchemaPhotoIds =
        buildAgentSpotlightSchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .agent_spotlight,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .agent_spotlight,

          validPhotoIds,
        });

      const refreshFreshOpportunitySchemaPhotoIds =
        buildFreshOpportunitySchemaPhotoIds({
          analyses:
            photoIntelligence
              .analyses,

          savedSlotPhotoIds:
            photoIntelligence
              .emailSlotPhotoIdsByEdition
              .fresh_opportunity,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition
              .fresh_opportunity,

          validPhotoIds,
        });

      const openAiApiKey =
        process.env
          .OPENAI_API_KEY;

      if (!openAiApiKey) {
        throw new MarketingPackageError(
          'OPENAI_API_KEY is not configured.',
          500,
          'openai_key_missing'
        );
      }

      const model =
        process.env
          .OPENAI_LISTING_MARKETING_MODEL ||
        process.env
          .OPENAI_LISTING_WEBSITE_MODEL ||
        'gpt-4.1-mini';

      const refreshCandidatePhotoIdsByEdition:
        Record<
          EmailEditionKey,
          string[]
        > = {
        launch:
          refreshLuxuryLaunchSchemaPhotoIds,

        views_lifestyle:
          refreshViewsLifestyleSchemaPhotoIds,

        design_interiors:
          refreshDesignInteriorsSchemaPhotoIds,

        property_in_motion:
          refreshPropertyInMotionSchemaPhotoIds,

        closer_look:
          refreshCloserLookSchemaPhotoIds,

        agent_spotlight:
          refreshAgentSpotlightSchemaPhotoIds,

        fresh_opportunity:
          refreshFreshOpportunitySchemaPhotoIds,
      };

      const refreshNamedEmailEditionSchemas =
        buildEmailEditionSchemaRecord(
          (editionKey) =>
            buildEmailEditionOutputSchema({
              photoSlotsSchema:
                buildEmailEditionPhotoSlotsSchema({
                  editionKey,

                  analyses:
                    photoIntelligence
                      .analyses,

                  candidatePhotoIds:
                    refreshCandidatePhotoIdsByEdition[
                      editionKey
                    ],

                  savedSlotPhotoIds:
                    photoIntelligence
                      .emailSlotPhotoIdsByEdition[
                        editionKey
                      ],

                  lockedSlotIndexes:
                    photoIntelligence
                      .lockedEmailSlotIndexesByEdition[
                        editionKey
                      ],

                  validPhotoIds,
                }),
            })
        );
      const emailOnlySchema = {
        type:
          'object',

        properties: {
          editions: {
            type:
              'object',

            properties:
              refreshNamedEmailEditionSchemas,

            required:
              EMAIL_EDITION_KEYS,

            additionalProperties:
              false,
          },
        },

        required: [
          'editions',
        ],

        additionalProperties:
          false,
      };

      const openAiResponse =
        await fetch(
          'https://api.openai.com/v1/responses',
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${openAiApiKey}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                model,

                store:
                  false,

                input: [
                  {
                    role:
                      'user',

                    content: [
                      {
                        type:
                          'input_text',

                        text: [
                          'You are Samantha, the listing marketing assistant for a real estate CRM.',
                          '',
                          'Compose all seven complete Email editions for this specific listing.',
                          'Every edition must be original, property-specific and coordinated with its exact six-photo sequence.',
                          'Do not use canned paragraphs, reusable boilerplate, generic filler or the same opening argument across editions.',
                          '',
                          'VERIFIED LISTING FACTS:',
                          JSON.stringify(
                            listingFacts,
                            null,
                            2
                          ),
                          '',
                          'LISTING EMAIL EVENT:',
                          JSON.stringify(
                            {
                              event_type:
                                refreshEventType,

                              label:
                                refreshEventDefinition
                                  .label,

                              campaign_type:
                                refreshEventDefinition
                                  .campaignType,

                              verified_event_details:
                                refreshEventDetails,

                              samantha_brief:
                                refreshEventDefinition
                                  .samanthaBrief,
                            },
                            null,
                            2
                          ),
                          '',
                          'MLS OR PUBLIC REMARKS:',
                          cleanText(
                            listing
                              .public_remarks ||
                            listing.description,
                            1600
                          ),
                          '',
                          'FULL ANALYZED ELIGIBLE PHOTO CATALOG:',
                          JSON.stringify(
                            refreshAnalyzedPhotoCatalog,
                            null,
                            2
                          ),
                          '',
                          'LOCKED EMAIL PHOTO SLOTS:',
                          JSON.stringify(
                            refreshLockedPhotoSlots,
                            null,
                            2
                          ),
                          '',
                          'PHOTO SELECTION AND WRITING REQUIREMENTS:',
                          '- Return all seven editions.',
                          '- For every edition, return a photo_slots object containing hero and supporting_1 through supporting_5.',
                          '- Choose exactly one valid photo ID for each named slot from that slot\'s schema enum.',
                          '- Before returning JSON, compare all six named slot IDs within every edition and correct any duplicate yourself.',
                          '- The server converts the named slots into the existing ordered six-photo CRM format after validation.',
                          '- Preserve every locked photo_media_id in its exact edition and exact slot_index. Choose all remaining slots yourself.',
                          '- A locked photo counts as one of the six and must not appear in any other slot of that same edition.',
                          '- Review the MLS/public remarks and verified facts to identify this property\'s dominant selling features before choosing any edition photos.',
                          '- Choose each edition\'s ordered photo sequence as part of that edition\'s marketing story. Do not accept a generic universal six-photo set.',
                          ...EMAIL_EDITION_STORY_FIT_PROMPT,
                          '- Luxury Launch must be the strongest complete overview and must include photos supporting the property\'s dominant selling features.',
                          '- Views & Lifestyle must prioritize actual verified views, setting and outdoor-living imagery over unrelated interior rooms.',
                          '- The Views & Lifestyle schema permits only qualifying outdoor, view-connected or exact manually locked photo IDs.',
                          '- Design & Interiors must prioritize the strongest relevant interior spaces and visible design details.',
                          '- The Design & Interiors schema permits only complete usable interior or exact manually locked photo IDs and limits the candidate pool to two photos per room family and normalized duplicate group.',
                          '- Property in Motion must create a coherent visual progression through the property.',
                          '- A Closer Look must prioritize details, finishes and specialty spaces; do not use a generic full front elevation merely as fallback.',
                          '- Agent Spotlight must be a balanced professional share-ready sequence.',
                          '- Fresh Opportunity must present a refreshed strongest mix without saying new listing, just listed or newly relisted.',
                          '- Compose the subject, preview text, headline, body, description and CTA around the six photos you selected for that edition.',
                          '- Treat each edition creative direction as guidance, not reusable copy.',
                          '- The server will preserve the MLS/public remarks as Luxury Launch full_description.',
                          '- Every other full_description must be an original two-to-four-paragraph property-specific narrative of at least 260 characters and no more than 1600 characters.',
                          '- Each body must be concise, useful, factual and no more than 520 characters.',
                          '- Do not invent materials, finishes, upgrades, views, amenities, room uses, measurements, neighborhood claims, schools, travel times, offers, activity, financing terms or event details.',
                          '- Mention only facts and visible details supported by the listing facts, event details and supplied photo analyses.',
                          '- Property in Motion must not claim a property film exists unless a verified video URL is supplied.',
                        ].join(
                          '\n'
                        ),
                      },
                    ],
                  },
                ],

                text: {
                  format: {
                    type:
                      'json_schema',

                    name:
                      'listing_email_editions',

                    strict:
                      true,

                    schema:
                      emailOnlySchema,
                  },
                },

                max_output_tokens:
                  9000,
              }),
          }
        );

      const openAiPayload =
        await openAiResponse
          .json()
          .catch(
            () => ({})
          );

      if (
        !openAiResponse.ok
      ) {
        throw new MarketingPackageError(
          openAiPayload
            ?.error
            ?.message ||
          'Samantha could not compose the Email editions.',
          502,
          'openai_email_editions_failed'
        );
      }

      const outputText =
        getOutputText(
          openAiPayload
        );

      if (!outputText) {
        throw new MarketingPackageError(
          'Samantha returned no Email-edition content.',
          502,
          'openai_email_editions_missing'
        );
      }

      let generatedEmail:
        Record<
          string,
          unknown
        >;

      try {
        generatedEmail =
          JSON.parse(
            outputText
          );
      }
      catch {
        throw new MarketingPackageError(
          'Samantha returned invalid Email-edition content.',
          502,
          'openai_email_editions_invalid'
        );
      }

      let generatedEditionSource =
        isRecord(
          generatedEmail
            .editions
        )
          ? generatedEmail
              .editions
          : {};

      const validateGeneratedEmailEditionPhotos =
        (
          editionSource:
            Record<
              string,
              unknown
            >
        ) => {
          const failedEditionKeys:
            EmailEditionKey[] = [];

          const validationIssuesByEdition:
            Partial<
              Record<
                EmailEditionKey,
                string
              >
            > = {};

          let firstValidationError:
            MarketingPackageError |
            null =
            null;

          for (
            const editionKey of
              EMAIL_EDITION_KEYS
          ) {
            try {
              const generatedCandidate =
                editionSource[
                  editionKey
                ];

              if (
                !isRecord(
                  generatedCandidate
                )
              ) {
                throw new MarketingPackageError(
                  `Samantha did not return ${EMAIL_EDITION_LABELS[editionKey]}.`,
                  502,
                  'email_edition_output_missing'
                );
              }

              const selectedPhotoIds =
                validateSamanthaEmailEditionPhotoIds({
                  editionKey,

                  candidatePhotoIds:
                    emailEditionPhotoIdsFromSlots({
                      editionKey,

                      candidatePhotoSlots:
                        generatedCandidate
                          .photo_slots,
                    }),

                  validPhotoIds,

                  savedSlotPhotoIds:
                    photoIntelligence
                      .emailSlotPhotoIdsByEdition[
                        editionKey
                      ],

                  lockedSlotIndexes:
                    photoIntelligence
                      .lockedEmailSlotIndexesByEdition[
                        editionKey
                      ],
                });

              validateSamanthaEmailEditionStoryFit({
                editionKey,

                photoIds:
                  selectedPhotoIds,

                analyses:
                  photoIntelligence
                    .analyses,

                validPhotoIds,

                lockedSlotIndexes:
                  photoIntelligence
                    .lockedEmailSlotIndexesByEdition[
                      editionKey
                    ],
              });
            }
            catch (
              validationError:
                unknown
            ) {
              if (
                !isCorrectableEmailEditionError(
                  validationError
                )
              ) {
                throw validationError;
              }

              failedEditionKeys.push(
                editionKey
              );

              validationIssuesByEdition[
                editionKey
              ] =
                validationError.message;

              if (!firstValidationError) {
                firstValidationError =
                  validationError;
              }
            }
          }

          return {
            failedEditionKeys,

            validationIssuesByEdition,

            validationError:
              firstValidationError,
          };
        };

      const initialEmailPhotoValidation =
        validateGeneratedEmailEditionPhotos(
          generatedEditionSource
        );

      if (
        initialEmailPhotoValidation
          .validationError
      ) {
        const failedEditionKeySet =
          new Set(
            initialEmailPhotoValidation
              .failedEditionKeys
          );

        const correctedEditionSource =
          await requestCorrectedEmailEditionSource({
            openAiApiKey,
            model,

            emailSchema:
              emailOnlySchema,

            originalEditionSource:
              generatedEditionSource,

            validationError:
              initialEmailPhotoValidation
                .validationError,

            correctionContext: {
              failed_edition_keys:
                initialEmailPhotoValidation
                  .failedEditionKeys,

              validation_issues_by_edition:
                initialEmailPhotoValidation
                  .validationIssuesByEdition,

              listing_facts:
                listingFacts,

              listing_email_event: {
                event_type:
                  refreshEventType,

                label:
                  refreshEventDefinition
                    .label,

                campaign_type:
                  refreshEventDefinition
                    .campaignType,

                verified_event_details:
                  refreshEventDetails,
              },

              analyzed_photo_catalog:
                refreshAnalyzedPhotoCatalog,

              locked_photo_slots:
                refreshLockedPhotoSlots,

              candidate_photo_ids_by_edition:
                refreshCandidatePhotoIdsByEdition,
            },
          });

        const originalEditionSource =
          generatedEditionSource;

        generatedEditionSource =
          buildEmailEditionSchemaRecord(
            (editionKey) => {
              const originalCandidate =
                isRecord(
                  originalEditionSource[
                    editionKey
                  ]
                )
                  ? originalEditionSource[
                      editionKey
                    ]
                  : {};

              if (
                !failedEditionKeySet.has(
                  editionKey
                )
              ) {
                return originalCandidate;
              }

              const correctedCandidate =
                isRecord(
                  correctedEditionSource[
                    editionKey
                  ]
                )
                  ? correctedEditionSource[
                      editionKey
                    ]
                  : {};

              return {
                ...originalCandidate,

                photo_slots:
                  correctedCandidate
                    .photo_slots,
              };
            }
          );

        const correctedEmailPhotoValidation =
          validateGeneratedEmailEditionPhotos(
            generatedEditionSource
          );

        if (
          correctedEmailPhotoValidation
            .validationError
        ) {
          throw correctedEmailPhotoValidation
            .validationError;
        }
      }

      const launchDescription =
        cleanText(
          listing
            .public_remarks ||
          listing.description,
          1600
        );

      if (!launchDescription) {
        throw new MarketingPackageError(
          'Luxury Launch requires MLS or public remarks before Samantha can compose the Email editions.',
          409,
          'email_launch_remarks_required'
        );
      }

      const nextEditions =
        {} as
          Record<
            EmailEditionKey,
            Record<
              string,
              unknown
            >
          >;

      const refreshedPhotoIdsByEdition =
        {} as
          Record<
            EmailEditionKey,
            string[]
          >;

      const generatedAt =
        new Date()
          .toISOString();

      for (
        const editionKey of
          EMAIL_EDITION_KEYS
      ) {
        const storedEdition =
          existingEditionSource[
            editionKey
          ];

        if (
          !isRecord(
            storedEdition
          )
        ) {
          throw new MarketingPackageError(
            `The ${EMAIL_EDITION_LABELS[editionKey]} edition has not been prepared yet.`,
            409,
            'email_edition_required'
          );
        }

        const generatedCandidate =
          generatedEditionSource[
            editionKey
          ];

        if (
          !isRecord(
            generatedCandidate
          )
        ) {
          throw new MarketingPackageError(
            `Samantha did not return ${EMAIL_EDITION_LABELS[editionKey]}.`,
            502,
            'email_edition_output_missing'
          );
        }

        const selectedPhotoIds =
          validateSamanthaEmailEditionPhotoIds({
            editionKey,

            candidatePhotoIds:
              emailEditionPhotoIdsFromSlots({
                editionKey,

                candidatePhotoSlots:
                  generatedCandidate
                    .photo_slots,
              }),

            validPhotoIds,

            savedSlotPhotoIds:
              photoIntelligence
                .emailSlotPhotoIdsByEdition[
                  editionKey
                ],

            lockedSlotIndexes:
              photoIntelligence
                .lockedEmailSlotIndexesByEdition[
                  editionKey
                ],
          });

        validateSamanthaEmailEditionStoryFit({
          editionKey,

          photoIds:
            selectedPhotoIds,

          analyses:
            photoIntelligence
              .analyses,

          validPhotoIds,

          lockedSlotIndexes:
            photoIntelligence
              .lockedEmailSlotIndexesByEdition[
                editionKey
              ],
        });

        refreshedPhotoIdsByEdition[
          editionKey
        ] =
          [
            ...selectedPhotoIds,
          ];

        const generatedSubject =
          cleanText(
            generatedCandidate
              .subject,
            220
          );

        const generatedPreviewText =
          cleanText(
            generatedCandidate
              .preview_text,
            400
          );

        const generatedHeadline =
          cleanText(
            generatedCandidate
              .headline,
            260
          );

        const generatedBody =
          cleanText(
            generatedCandidate
              .body,
            520
          );

        const generatedFullDescription =
          cleanText(
            generatedCandidate
              .full_description,
            1600
          );

        const generatedCtaLabel =
          cleanText(
            generatedCandidate
              .cta_label,
            100
          );

        if (
          !generatedSubject ||
          !generatedPreviewText ||
          !generatedHeadline ||
          !generatedBody ||
          !generatedFullDescription ||
          !generatedCtaLabel
        ) {
          throw new MarketingPackageError(
            `Samantha returned incomplete copy for ${EMAIL_EDITION_LABELS[editionKey]}.`,
            502,
            'email_edition_copy_incomplete'
          );
        }

        if (
          editionKey !==
            'launch' &&
          generatedFullDescription
            .length <
            260
        ) {
          throw new MarketingPackageError(
            `Samantha returned an undersized description for ${EMAIL_EDITION_LABELS[editionKey]}.`,
            502,
            'email_edition_description_too_short'
          );
        }

        const copyManualOverride =
          storedEdition
            .copy_manual_override ===
          true;

        const preserveCopy =
          copyManualOverride;

        nextEditions[
          editionKey
        ] =
          preserveCopy
            ? {
                ...storedEdition,

                photo_media_ids:
                  [
                    ...selectedPhotoIds,
                  ],

                status:
                  'needs_review',

                approved_at:
                  null,

                approved_by:
                  null,

                manual_override:
                  copyManualOverride,

                copy_manual_override:
                  copyManualOverride,
              }
            : {
                ...storedEdition,

                subject:
                  generatedSubject,

                preview_text:
                  generatedPreviewText,

                headline:
                  generatedHeadline,

                body:
                  generatedBody,

                full_description:
                  editionKey ===
                    'launch'
                    ? launchDescription
                    : generatedFullDescription,

                cta_label:
                  generatedCtaLabel,

                photo_media_ids:
                  [
                    ...selectedPhotoIds,
                  ],

                status:
                  'needs_review',

                approved_at:
                  null,

                approved_by:
                  null,

                manual_override:
                  false,

                copy_manual_override:
                  false,

                generated_at:
                  generatedAt,

                generation_model:
                  model,
              };
      }

      const selectedEditionKey =
        normalizeEmailEditionKey(
          existingEmailContent
            .luxury_edition
        );

      const selectedEdition =
        nextEditions[
          selectedEditionKey
        ];

      const assignmentRows:
        Record<
          string,
          unknown
        >[] = [];

      let lockedCount =
        0;

      for (
        const editionKey of
          EMAIL_EDITION_KEYS
      ) {
        const lockedSlotIndexes =
          new Set(
            photoIntelligence
              .lockedEmailSlotIndexesByEdition[
                editionKey
              ]
          );

        lockedCount +=
          lockedSlotIndexes.size;

        const editionPhotoIds =
          refreshedPhotoIdsByEdition[
            editionKey
          ];

        for (
          let index = 0;
          index <
            editionPhotoIds.length;
          index += 1
        ) {
          if (
            lockedSlotIndexes.has(
              index
            )
          ) {
            continue;
          }

          assignmentRows.push({
            listing_id:
              listing.id,

            org_id:
              listing.org_id,

            owner_user_id:
              listing.owner_user_id,

            section_key:
              'email',

            edition_key:
              editionKey,

            ...assignmentSlot(
              'email',
              index
            ),

            media_id:
              editionPhotoIds[
                index
              ],

            selected_by:
              'samantha',

            is_locked:
              false,

            created_by:
              requester.id,

            updated_by:
              requester.id,
          });
        }
      }

      const expectedUnlockedCount =
        EMAIL_EDITION_KEYS
          .length *
          6 -
        lockedCount;

      if (
        assignmentRows.length !==
        expectedUnlockedCount
      ) {
        throw new MarketingPackageError(
          'The complete edition-specific Email assignment set was not valid.',
          409,
          'email_assignment_set_invalid'
        );
      }

      if (
        assignmentRows.length >
        0
      ) {
        const {
          error:
            assignmentUpsertError,
        } = await supabaseAdmin
          .from(
            'listing_marketing_photo_assignments'
          )
          .upsert(
            assignmentRows,
            {
              onConflict:
                'listing_id,section_key,edition_key,slot_key,sort_order',
            }
          );

        if (
          assignmentUpsertError
        ) {
          throw new MarketingPackageError(
            assignmentUpsertError
              .message,
            500,
            'email_assignment_refresh_failed'
          );
        }
      }

      const {
        data:
          assignmentVerificationRows,
        error:
          assignmentVerificationError,
      } = await supabaseAdmin
        .from(
          'listing_marketing_photo_assignments'
        )
        .select(`
          edition_key,
          slot_key,
          sort_order,
          media_id,
          selected_by,
          is_locked
        `)
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'section_key',
          'email'
        );

      if (
        assignmentVerificationError
      ) {
        throw new MarketingPackageError(
          assignmentVerificationError
            .message,
          500,
          'email_assignment_refresh_verification_failed'
        );
      }

      const assignmentBySlot =
        new Map<
          string,
          any
        >();

      for (
        const row of
          assignmentVerificationRows ||
          []
      ) {
        assignmentBySlot.set(
          `${row.edition_key}:${row.slot_key}:${row.sort_order}`,
          row
        );
      }

      for (
        const editionKey of
          EMAIL_EDITION_KEYS
      ) {
        const lockedSlotIndexes =
          new Set(
            photoIntelligence
              .lockedEmailSlotIndexesByEdition[
                editionKey
              ]
          );

        for (
          let index = 0;
          index < 6;
          index += 1
        ) {
          const slot =
            assignmentSlot(
              'email',
              index
            );

          const row =
            assignmentBySlot.get(
              `${editionKey}:${slot.slot_key}:${slot.sort_order}`
            );

          if (
            !row ||
            row.media_id !==
              refreshedPhotoIdsByEdition[
                editionKey
              ][
                index
              ] ||
            Boolean(
              row.is_locked
            ) !==
              lockedSlotIndexes.has(
                index
              )
          ) {
            throw new MarketingPackageError(
              `The refreshed assignment for ${EMAIL_EDITION_LABELS[editionKey]} slot ${index + 1} could not be verified.`,
              500,
              'email_assignment_refresh_verification_failed'
            );
          }
        }
      }

      const nextContent = {
        ...existingEmailContent,

        subject:
          selectedEdition
            .subject,

        preview_text:
          selectedEdition
            .preview_text,

        headline:
          selectedEdition
            .headline,

        body:
          selectedEdition
            .body,

        full_description:
          selectedEdition
            .full_description,

        cta_label:
          selectedEdition
            .cta_label,

        luxury_edition:
          selectedEditionKey,

        editions: {
          ...existingEditionSource,

          ...nextEditions,
        },

        event_type:
          refreshEventType,

        event_details:
          refreshEventDetails,
      };

      const {
        error:
          emailSectionUpdateError,
      } = await supabaseAdmin
        .from(
          'listing_marketing_sections'
        )
        .update({
          content:
            nextContent,

          status:
            'needs_review',

          approved_at:
            null,

          approved_by:
            null,

          last_error:
            null,

          updated_by:
            requester.id,
        })
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'section_key',
          'email'
        );

      if (
        emailSectionUpdateError
      ) {
        throw new MarketingPackageError(
          emailSectionUpdateError
            .message,
          500,
          'email_story_refresh_section_update_failed'
        );
      }

      return NextResponse.json(
        {
          ok: true,

          message:
            'Samantha composed all seven Email edition stories around their final six-photo sequences.',

          edition_count:
            EMAIL_EDITION_KEYS
              .length,

          photo_slot_count:
            EMAIL_EDITION_KEYS
              .length *
            6,

          locked_count:
            lockedCount,

          openai_called:
            true,
        },
        {
          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      );
    }
    const openAiApiKey =
      process.env
        .OPENAI_API_KEY;

    if (!openAiApiKey) {
      throw new MarketingPackageError(
        'OPENAI_API_KEY is not configured.',
        500,
        'openai_key_missing'
      );
    }

    const model =
      process.env
        .OPENAI_LISTING_MARKETING_MODEL ||
      process.env
        .OPENAI_LISTING_WEBSITE_MODEL ||
      'gpt-4.1-mini';

    const photoIntelligence =
      await loadSavedListingPhotoIntelligence({
        listingId:
          listing.id,

        photos,
      });

    const emailSlotPhotoIdsByEdition =
      photoIntelligence
        .emailSlotPhotoIdsByEdition;

    const lockedEmailSlotIndexesByEdition =
      photoIntelligence
        .lockedEmailSlotIndexesByEdition;

    const lockedEmailPhotoSlots =
      buildLockedEmailPhotoSlotsForPrompt({
        savedSlotPhotoIdsByEdition:
          emailSlotPhotoIdsByEdition,

        lockedSlotIndexesByEdition:
          lockedEmailSlotIndexesByEdition,
      });

    const viewsLifestyleSchemaPhotoIds =
      buildViewsLifestyleSchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .views_lifestyle,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .views_lifestyle,

        validPhotoIds,
      });

    const designInteriorsSchemaPhotoIds =
      buildDesignInteriorsSchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .design_interiors,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .design_interiors,

        validPhotoIds,
      });

    const luxuryLaunchSchemaPhotoIds =
      buildLuxuryLaunchSchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .launch,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .launch,

        validPhotoIds,
      });

    const propertyInMotionSchemaPhotoIds =
      buildPropertyInMotionSchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .property_in_motion,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .property_in_motion,

        validPhotoIds,
      });

    const closerLookSchemaPhotoIds =
      buildCloserLookSchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .closer_look,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .closer_look,

        validPhotoIds,
      });

    const agentSpotlightSchemaPhotoIds =
      buildAgentSpotlightSchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .agent_spotlight,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .agent_spotlight,

        validPhotoIds,
      });

    const freshOpportunitySchemaPhotoIds =
      buildFreshOpportunitySchemaPhotoIds({
        analyses:
          photoIntelligence
            .analyses,

        savedSlotPhotoIds:
          emailSlotPhotoIdsByEdition
            .fresh_opportunity,

        lockedSlotIndexes:
          lockedEmailSlotIndexesByEdition
            .fresh_opportunity,

        validPhotoIds,
      });

    const analysisByPhotoId =
      new Map(
        photoIntelligence
          .analyses
          .map(
            (analysis) => [
              analysis.media_id,
              analysis,
            ]
          )
      );

    const analyzedPhotoCatalog =
      photoCatalog.map(
        (photo) => ({
          ...photo,

          ai_analysis:
            analysisByPhotoId.get(
              photo.photo_media_id
            ) ||
            null,
        })
      );

    const inputContent:
      Array<
        Record<string, unknown>
      > = [
      {
        type:
          'input_text',

        text: [
          'You are Samantha, the listing marketing assistant for a real estate CRM.',
          '',
          'Prepare a complete factual marketing package for the supplied listing.',
          '',
          'LISTING EMAIL EVENT:',
          JSON.stringify(
            {
              event_type:
                eventType,

              label:
                eventDefinition
                  .label,

              campaign_type:
                eventDefinition
                  .campaignType,

              verified_event_details:
                verifiedEventDetails,

              default_luxury_edition:
                eventDefinition
                  .defaultLuxuryEdition,

              default_cta_label:
                eventDefinition
                  .defaultCtaLabel,

              prefer_fresh_photos:
                eventDefinition
                  .preferFreshPhotos,

              samantha_brief:
                eventDefinition
                  .samanthaBrief,

              photo_brief:
                eventDefinition
                  .photoBrief,
            },
            null,
            2
          ),
          '',
          'Listing email event rules:',
          `- ${eventDefinition.samanthaBrief}`,
          `- Email photo direction: ${eventDefinition.photoBrief}`,
          '- Apply the selected event framing to every email edition.',
          '- Do not relabel the selected event as New Listing or another listing event.',
          '- Use only the verified event details supplied above.',
          '- Never invent event dates, times, prices, incentives, financing terms, deadlines or instructions.',
          '- Do not apply this event framing to the website, social, flyer, video or seller-report sections during this phase.',
          '',
          'Create:',
          '- property website description and calls to action',
          '- email advertisement',
          '- social media package',
          '- flyer content',
          '- video scripts and captions',
          '- future seller-report introduction and structure',
          '',
          'Rules:',
          '- Use only supported listing facts and visible details from supplied property photographs.',
          '- Never invent features, upgrades, materials, views, amenities, measurements, school information, route times, neighborhood characteristics, performance results, offers, showings, clicks, leads or seller-report metrics.',
          '- Do not describe schools as good, desirable, top, best or similar.',
          '- Do not use protected-class, demographic, safety, crime, investment-guarantee or buyer-profile language.',
          '- Select photo_media_id values only from the supplied photo catalog.',
          '- Prefer different, directly relevant photos for each major role.',
          '- Use the supplied AI-analyzed photo catalog when choosing photographs for property website, social, flyer and video sections.',
          "- Samantha must select each Email edition's exact named six-photo sequence from the supplied analyzed catalog and strict slot enums. The CRM validates ownership, uniqueness, exact locks and story fit but never chooses or substitutes a photo after Samantha responds.",
          '- Do not infer a different room classification than the one supplied in ai_analysis.',
          '- For email, create seven materially different marketing stories inside email.editions.',
          '- Luxury Launch is the complete first impression and strongest overall introduction.',
          '- Views & Lifestyle focuses on verified scenery, exterior setting, patios, yards, acreage, pools and outdoor living that are actually supported.',
          '- Design & Interiors focuses on verified kitchens, living spaces, suites, finishes, visible materials, craftsmanship and room flow.',
          '- Property in Motion is video-led and focuses on how the spaces connect and how the residence is experienced while moving through it. Do not claim a property film exists unless a video URL is supplied.',
          '- A Closer Look focuses on verified overlooked details such as offices, bonus rooms, storage, garages, shops, specialty rooms and distinctive visible features.',
          '- Agent Spotlight speaks directly to real-estate professionals about why their buyers should review or tour the property. Do not discuss compensation or make unsupported showing claims.',
          '- Fresh Opportunity gives the property a genuinely new marketing angle without claiming that the listing is new, newly listed, just listed or recently relisted.',
          '- Every edition must have its own subject, preview text, headline, body, full description and call-to-action.',
          '- Do not repeat the same headline, opening sentence or central selling argument across editions.',
          '- Each edition body must be concise, factual and under 520 characters.',
          '- Each edition full_description may contain two to four short factual paragraphs and must remain under 1600 characters.',
          '- Refer only to supported listing facts and visible details contained in the analyzed photo catalog.',
          '- Email, social, flyer and video language may be polished but must remain factual.',
          '- Seller-report content must be a reusable report introduction and outline only. Do not fabricate activity statistics.',
          '- Map destinations, driving times and school research are handled by a separate verified research process. Do not provide them.',
          '- Choose the strongest appropriate template for each section.',
          '',
          'LISTING FACTS:',
          JSON.stringify(
            listingFacts,
            null,
            2
          ),
          '',
          'ANALYZED PHOTO CATALOG:',
          JSON.stringify(
            analyzedPhotoCatalog,
            null,
            2
          ),
          '',
          'LOCKED EMAIL PHOTO SLOTS:',
          JSON.stringify(
            lockedEmailPhotoSlots,
            null,
            2
          ),
          '',
          'Email edition photo-selection and writing requirements:',
          '- For every edition, return a photo_slots object containing hero and supporting_1 through supporting_5.',
          '- Choose exactly one valid photo ID for each named slot from that slot\'s schema enum.',
          '- Before returning JSON, compare all six named slot IDs within every edition and correct any duplicate yourself.',
          '- The server converts the named slots into the existing ordered six-photo CRM format after validation.',
          '- Preserve every locked photo_media_id in its exact edition and exact slot_index. Choose all remaining slots yourself.',
          '- A locked photo counts as one of the six and must not appear in any other slot of that same edition.',
          '- Review the listing facts and MLS/public remarks to identify the property\'s dominant selling features before selecting photos.',
          '- Choose each edition\'s photos and copy together as one coordinated property-specific story.',
          '- Do not use one generic universal six-photo set across all editions.',
          ...EMAIL_EDITION_STORY_FIT_PROMPT,
          '- Luxury Launch must be the strongest complete overview and support the dominant selling features.',
          '- Views & Lifestyle must prioritize actual verified views, setting and outdoor-living imagery.',
          '- The Views & Lifestyle schema permits only qualifying outdoor, view-connected or exact manually locked photo IDs.',
          '- Design & Interiors must prioritize relevant interiors and visible design details.',
          '- The Design & Interiors schema permits only complete usable interior or exact manually locked photo IDs and limits the candidate pool to two photos per room family and normalized duplicate group.',
          '- Property in Motion must create a coherent visual progression.',
          '- A Closer Look must prioritize details, finishes and specialty spaces rather than a generic front elevation fallback.',
          '- Agent Spotlight must be a balanced professional share-ready sequence.',
          '- Fresh Opportunity must present a refreshed strongest mix without claiming the property is newly listed.',
          '- Luxury Launch full_description will be preserved from the MLS/public remarks.',
          '- The other six full descriptions must be original, property-specific, two to four factual paragraphs, at least 260 characters and no more than 1600 characters.',
          '- Do not use canned paragraphs, boilerplate, generic filler or the same opening argument across editions.',
          '- Return complete copy and a photo_slots object with hero and supporting_1 through supporting_5 for all seven editions. Invalid output must fail rather than receive fallback photos or copy.',
        ].join('\n'),
      },
    ];


    const sharedSectionProperties = {
      template_key: {
        type:
          'string',
      },

      photo_media_ids: {
        type:
          'array',

        items: {
          type:
            'string',
        },
      },
    };

    const candidatePhotoIdsByEdition:
      Record<
        EmailEditionKey,
        string[]
      > = {
      launch:
        luxuryLaunchSchemaPhotoIds,

      views_lifestyle:
        viewsLifestyleSchemaPhotoIds,

      design_interiors:
        designInteriorsSchemaPhotoIds,

      property_in_motion:
        propertyInMotionSchemaPhotoIds,

      closer_look:
        closerLookSchemaPhotoIds,

      agent_spotlight:
        agentSpotlightSchemaPhotoIds,

      fresh_opportunity:
        freshOpportunitySchemaPhotoIds,
    };

    const namedEmailEditionSchemasByEdition =
      buildEmailEditionSchemaRecord(
        (editionKey) =>
          buildEmailEditionOutputSchema({
            photoSlotsSchema:
              buildEmailEditionPhotoSlotsSchema({
                editionKey,

                analyses:
                  photoIntelligence
                    .analyses,

                candidatePhotoIds:
                  candidatePhotoIdsByEdition[
                    editionKey
                  ],

                savedSlotPhotoIds:
                  emailSlotPhotoIdsByEdition[
                    editionKey
                  ],

                lockedSlotIndexes:
                  lockedEmailSlotIndexesByEdition[
                    editionKey
                  ],

                validPhotoIds,
              }),
          })
      );
    const fullPackageEmailCorrectionSchema = {
      type:
        'object',

      properties: {
        editions: {
          type:
            'object',

          properties:
            namedEmailEditionSchemasByEdition,

          required:
            EMAIL_EDITION_KEYS,

          additionalProperties:
            false,
        },
      },

      required: [
        'editions',
      ],

      additionalProperties:
        false,
    };

    const schema = {
      type:
        'object',

      properties: {
        property_website: {
          type:
            'object',

          properties: {
            ...sharedSectionProperties,

            headline: {
              type:
                'string',
            },

            description: {
              type:
                'string',
            },

            cta_headline: {
              type:
                'string',
            },

            cta_body: {
              type:
                'string',
            },

            cta_label: {
              type:
                'string',
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'headline',
            'description',
            'cta_headline',
            'cta_body',
            'cta_label',
          ],

          additionalProperties:
            false,
        },

        email: {
          type:
            'object',

          properties: {
            ...sharedSectionProperties,

            editions: {
              type:
                'object',

              properties:
                namedEmailEditionSchemasByEdition,

              required:
                EMAIL_EDITION_KEYS,

              additionalProperties:
                false,
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'editions',
          ],

          additionalProperties:
            false,
        },

        social: {
          type:
            'object',

          properties: {
            ...sharedSectionProperties,

            headline: {
              type:
                'string',
            },

            instagram_caption: {
              type:
                'string',
            },

            facebook_caption: {
              type:
                'string',
            },

            linkedin_caption: {
              type:
                'string',
            },

            hashtags: {
              type:
                'array',

              items: {
                type:
                  'string',
              },
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'headline',
            'instagram_caption',
            'facebook_caption',
            'linkedin_caption',
            'hashtags',
          ],

          additionalProperties:
            false,
        },

        flyer: {
          type:
            'object',

          properties: {
            ...sharedSectionProperties,

            headline: {
              type:
                'string',
            },

            subheadline: {
              type:
                'string',
            },

            description: {
              type:
                'string',
            },

            feature_bullets: {
              type:
                'array',

              items: {
                type:
                  'string',
              },
            },

            call_to_action: {
              type:
                'string',
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'headline',
            'subheadline',
            'description',
            'feature_bullets',
            'call_to_action',
          ],

          additionalProperties:
            false,
        },

        video: {
          type:
            'object',

          properties: {
            ...sharedSectionProperties,

            hook: {
              type:
                'string',
            },

            script_30_seconds: {
              type:
                'string',
            },

            script_60_seconds: {
              type:
                'string',
            },

            script_90_seconds: {
              type:
                'string',
            },

            social_caption: {
              type:
                'string',
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'hook',
            'script_30_seconds',
            'script_60_seconds',
            'script_90_seconds',
            'social_caption',
          ],

          additionalProperties:
            false,
        },

        seller_report: {
          type:
            'object',

          properties: {
            ...sharedSectionProperties,

            headline: {
              type:
                'string',
            },

            introduction: {
              type:
                'string',
            },

            section_outline: {
              type:
                'array',

              items: {
                type:
                  'string',
              },
            },

            closing_note: {
              type:
                'string',
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'headline',
            'introduction',
            'section_outline',
            'closing_note',
          ],

          additionalProperties:
            false,
        },
      },

      required:
        SECTION_KEYS,

      additionalProperties:
        false,
    };

    const openAiResponse =
      await fetch(
        'https://api.openai.com/v1/responses',
        {
          method:
            'POST',

          headers: {
            Authorization:
              `Bearer ${openAiApiKey}`,

            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              model,
              store:
                false,

              input: [
                {
                  role:
                    'user',

                  content:
                    inputContent,
                },
              ],

              text: {
                format: {
                  type:
                    'json_schema',

                  name:
                    'listing_marketing_package',

                  strict:
                    true,

                  schema,
                },
              },

              max_output_tokens:
                14000,
            }),
        }
      );

    const openAiPayload =
      await openAiResponse
        .json()
        .catch(
          () => ({})
        );

    if (
      !openAiResponse.ok
    ) {
      throw new MarketingPackageError(
        openAiPayload
          ?.error
          ?.message ||
          'Samantha could not prepare the marketing package.',
        502,
        'openai_package_failed'
      );
    }

    const outputText =
      getOutputText(
        openAiPayload
      );

    if (!outputText) {
      throw new MarketingPackageError(
        'Samantha returned no marketing-package content.',
        502,
        'openai_output_missing'
      );
    }

    let generated:
      Record<
        SectionKey,
        GeneratedSection
      >;

    try {
      generated =
        JSON.parse(
          outputText
        );
    }
    catch {
      throw new MarketingPackageError(
        'Samantha returned invalid marketing-package content.',
        502,
        'openai_output_invalid'
      );
    }

    const generatedEmailOutput =
      generated.email;

    if (
      !isRecord(
        generatedEmailOutput
      )
    ) {
      throw new MarketingPackageError(
        'Samantha did not return the Email section.',
        502,
        'email_section_output_missing'
      );
    }

    let generatedFullPackageEditionSource =
      isRecord(
        generatedEmailOutput
          .editions
      )
        ? generatedEmailOutput
            .editions
        : {};

    const validateFullPackageEmailEditionPhotos =
      (
        editionSource:
          Record<
            string,
            unknown
          >
      ) => {
        const failedEditionKeys:
          EmailEditionKey[] = [];

        const validationIssuesByEdition:
          Partial<
            Record<
              EmailEditionKey,
              string
            >
          > = {};

        let firstValidationError:
          MarketingPackageError |
          null =
          null;

        for (
          const editionKey of
            EMAIL_EDITION_KEYS
        ) {
          try {
            const generatedCandidate =
              editionSource[
                editionKey
              ];

            if (
              !isRecord(
                generatedCandidate
              )
            ) {
              throw new MarketingPackageError(
                `Samantha did not return ${EMAIL_EDITION_LABELS[editionKey]}.`,
                502,
                'email_edition_output_missing'
              );
            }

            const selectedPhotoIds =
              validateSamanthaEmailEditionPhotoIds({
                editionKey,

                candidatePhotoIds:
                  emailEditionPhotoIdsFromSlots({
                    editionKey,

                    candidatePhotoSlots:
                      generatedCandidate
                        .photo_slots,
                  }),

                validPhotoIds,

                savedSlotPhotoIds:
                  emailSlotPhotoIdsByEdition[
                    editionKey
                  ],

                lockedSlotIndexes:
                  lockedEmailSlotIndexesByEdition[
                    editionKey
                  ],
              });

            validateSamanthaEmailEditionStoryFit({
              editionKey,

              photoIds:
                selectedPhotoIds,

              analyses:
                photoIntelligence
                  .analyses,

              validPhotoIds,

              lockedSlotIndexes:
                lockedEmailSlotIndexesByEdition[
                  editionKey
                ],
            });
          }
          catch (
            validationError:
              unknown
          ) {
            if (
              !isCorrectableEmailEditionError(
                validationError
              )
            ) {
              throw validationError;
            }

            failedEditionKeys.push(
              editionKey
            );

            validationIssuesByEdition[
              editionKey
            ] =
              validationError.message;

            if (!firstValidationError) {
              firstValidationError =
                validationError;
            }
          }
        }

        return {
          failedEditionKeys,

          validationIssuesByEdition,

          validationError:
            firstValidationError,
        };
      };

    const initialFullPackagePhotoValidation =
      validateFullPackageEmailEditionPhotos(
        generatedFullPackageEditionSource
      );

    if (
      initialFullPackagePhotoValidation
        .validationError
    ) {
      const failedEditionKeySet =
        new Set(
          initialFullPackagePhotoValidation
            .failedEditionKeys
        );

      const correctedEditionSource =
        await requestCorrectedEmailEditionSource({
          openAiApiKey,
          model,

          emailSchema:
            fullPackageEmailCorrectionSchema,

          originalEditionSource:
            generatedFullPackageEditionSource,

          validationError:
            initialFullPackagePhotoValidation
              .validationError,

          correctionContext: {
            failed_edition_keys:
              initialFullPackagePhotoValidation
                .failedEditionKeys,

            validation_issues_by_edition:
              initialFullPackagePhotoValidation
                .validationIssuesByEdition,

            listing_facts:
              listingFacts,

            listing_email_event: {
              event_type:
                eventType,

              label:
                eventDefinition
                  .label,

              campaign_type:
                eventDefinition
                  .campaignType,

              verified_event_details:
                verifiedEventDetails,

              samantha_brief:
                eventDefinition
                  .samanthaBrief,

              photo_brief:
                eventDefinition
                  .photoBrief,
            },

            analyzed_photo_catalog:
              analyzedPhotoCatalog,

            locked_photo_slots:
              lockedEmailPhotoSlots,

            candidate_photo_ids_by_edition:
              candidatePhotoIdsByEdition,
          },
        });

      const originalEditionSource =
        generatedFullPackageEditionSource;

      generatedFullPackageEditionSource =
        buildEmailEditionSchemaRecord(
          (editionKey) => {
            const originalCandidate =
              isRecord(
                originalEditionSource[
                  editionKey
                ]
              )
                ? originalEditionSource[
                    editionKey
                  ]
                : {};

            if (
              !failedEditionKeySet.has(
                editionKey
              )
            ) {
              return originalCandidate;
            }

            const correctedCandidate =
              isRecord(
                correctedEditionSource[
                  editionKey
                ]
              )
                ? correctedEditionSource[
                    editionKey
                  ]
                : {};

            return {
              ...originalCandidate,

              photo_slots:
                correctedCandidate
                  .photo_slots,
            };
          }
        );

      const correctedFullPackagePhotoValidation =
        validateFullPackageEmailEditionPhotos(
          generatedFullPackageEditionSource
        );

      if (
        correctedFullPackagePhotoValidation
          .validationError
      ) {
        throw correctedFullPackagePhotoValidation
          .validationError;
      }

      generated.email = {
        ...generatedEmailOutput,

        editions:
          generatedFullPackageEditionSource,
      };
    }

    const existingEmailSectionForValidation =
      existingSections.get(
        'email'
      ) ||
      null;

    const existingEmailContentForValidation =
      isRecord(
        existingEmailSectionForValidation
          ?.content
      )
        ? existingEmailSectionForValidation
            ?.content ||
          {}
        : {};

    const existingEmailEditionSourceForValidation =
      isRecord(
        existingEmailContentForValidation
          .editions
      )
        ? existingEmailContentForValidation
            .editions
        : {};

    const launchDescriptionForValidation =
      cleanText(
        listing.public_remarks ||
        listing.description,
        1600
      );

    for (
      const editionKey of
        EMAIL_EDITION_KEYS
    ) {
      const generatedCandidate =
        generatedFullPackageEditionSource[
          editionKey
        ];

      if (
        !isRecord(
          generatedCandidate
        )
      ) {
        throw new MarketingPackageError(
          `Samantha did not return ${EMAIL_EDITION_LABELS[editionKey]}.`,
          502,
          'email_edition_output_missing'
        );
      }

      const storedCandidate =
        isRecord(
          existingEmailEditionSourceForValidation[
            editionKey
          ]
        )
          ? existingEmailEditionSourceForValidation[
              editionKey
            ] as
              Record<
                string,
                unknown
              >
          : (
              editionKey ===
                'launch' &&
              (
                existingEmailSectionForValidation
                  ?.generation_version ||
                0
              ) > 0
                ? {
                    status:
                      existingEmailSectionForValidation
                        ?.status ||
                      'needs_review',
                  }
                : null
            );

      const preserveStored =
        Boolean(
          storedCandidate
        ) &&
        (
          storedCandidate
            ?.status ===
            'approved' ||
          storedCandidate
            ?.copy_manual_override ===
            true
        );

      if (preserveStored) {
        continue;
      }

      const generatedSubject =
        cleanText(
          generatedCandidate
            .subject,
          220
        );

      const generatedPreviewText =
        cleanText(
          generatedCandidate
            .preview_text,
          400
        );

      const generatedHeadline =
        cleanText(
          generatedCandidate
            .headline,
          260
        );

      const generatedBody =
        cleanText(
          generatedCandidate
            .body,
          520
        );

      const generatedFullDescription =
        cleanText(
          generatedCandidate
            .full_description,
          1600
        );

      const generatedCtaLabel =
        cleanText(
          generatedCandidate
            .cta_label,
          100
        );

      if (
        !generatedSubject ||
        !generatedPreviewText ||
        !generatedHeadline ||
        !generatedBody ||
        !generatedFullDescription ||
        !generatedCtaLabel
      ) {
        throw new MarketingPackageError(
          `Samantha returned incomplete copy for ${EMAIL_EDITION_LABELS[editionKey]}.`,
          502,
          'email_edition_copy_incomplete'
        );
      }

      if (
        editionKey !==
          'launch' &&
        generatedFullDescription
          .length <
          260
      ) {
        throw new MarketingPackageError(
          `Samantha returned an undersized description for ${EMAIL_EDITION_LABELS[editionKey]}.`,
          502,
          'email_edition_description_too_short'
        );
      }

      if (
        editionKey ===
          'launch' &&
        !launchDescriptionForValidation
      ) {
        throw new MarketingPackageError(
          'Luxury Launch requires MLS or public remarks before Samantha can prepare the Email editions.',
          409,
          'email_launch_remarks_required'
        );
      }
    }

    const inputHash =
      createHash(
        'sha256'
      )
        .update(
          JSON.stringify({
            listing,
            photo_ids:
              photos.map(
                (photo) =>
                  photo.id
              ),
            document_id:
              document?.id ||
              null,
          })
        )
        .digest('hex');

    const preparedAt =
      new Date()
        .toISOString();

    const savedSections:
      Record<
        string,
        unknown
      >[] = [];

    let finalEmailSlotPhotoIdsByEdition:
      Record<
        EmailEditionKey,
        string[]
      > | null =
      null;

    for (
      const sectionKey of
        SECTION_KEYS
    ) {
      const output =
        generated[
          sectionKey
        ];

      if (
        !output ||
        typeof output !==
          'object'
      ) {
        throw new MarketingPackageError(
          `Samantha did not return the ${sectionKey} section.`,
          502,
          'section_output_missing'
        );
      }

      const existing =
        existingSections.get(
          sectionKey
        ) || null;

      const templateKey =
        normalizeTemplate(
          sectionKey,
          output.template_key,
          existing
        );

      let photoIds =
        normalizePhotoIds(
          output.photo_media_ids,
          validPhotoIds
        );

      if (
        sectionKey ===
        'email'
      ) {
        photoIds =
          emailSlotPhotoIdsByEdition
            .launch
            .filter(
              (
                photoId
              ): photoId is string =>
                Boolean(
                  photoId
                )
            );
      }

      let content:
        Record<string, unknown>;

      if (
        sectionKey ===
        'email'
      ) {
        const existingContent =
          isRecord(
            existing?.content
          )
            ? existing
                ?.content ||
              {}
            : {};

        const existingEditionSource =
          isRecord(
            existingContent
              .editions
          )
            ? existingContent
                .editions
            : {};

        const generatedEditionSource =
          isRecord(
            output.editions
          )
            ? output.editions
            : {};

        const legacyLaunch:
          Record<
            string,
            unknown
          > = {
          subject:
            cleanText(
              existingContent
                .subject,
              220
            ),

          preview_text:
            cleanText(
              existingContent
                .preview_text,
              400
            ),

          headline:
            cleanText(
              existingContent
                .headline,
              260
            ),

          body:
            cleanText(
              existingContent
                .body,
              520
            ),

          full_description:
            cleanText(
              existingContent
                .full_description,
              1600
            ),

          cta_label:
            cleanText(
              existingContent
                .cta_label,
              100
            ) ||
            'View Full Listing',

          photo_media_ids:
            emailSlotPhotoIdsByEdition
              .launch
              .filter(
                (
                  photoId
                ): photoId is string =>
                  Boolean(
                    photoId
                  )
              ),

          status:
            existing?.status ||
            'needs_review',

          approved_at:
            existing
              ?.approved_at ||
            null,

          approved_by:
            existing
              ?.approved_by ||
            null,

          manual_override:
            Boolean(
              existing
                ?.manual_override
            ),
        };

        const editionContent:
          Record<
            EmailEditionKey,
            Record<string, unknown>
          > = {} as
            Record<
              EmailEditionKey,
              Record<string, unknown>
            >;

        for (
          const editionKey of
          EMAIL_EDITION_KEYS
        ) {
          const generatedCandidate =
            isRecord(
              generatedEditionSource[
                editionKey
              ]
            )
              ? generatedEditionSource[
                  editionKey
                ] as
                  Record<
                    string,
                    unknown
                  >
              : {};

          const storedCandidate =
            isRecord(
              existingEditionSource[
                editionKey
              ]
            )
              ? existingEditionSource[
                  editionKey
                ] as
                  Record<
                    string,
                    unknown
                  >
              : (
                  editionKey ===
                    'launch' &&
                  (
                    existing
                      ?.generation_version ||
                    0
                  ) > 0
                    ? legacyLaunch
                    : null
                );

          const preserveStored =
            Boolean(
              storedCandidate
            ) &&
            (
              storedCandidate
                ?.status ===
                'approved' ||
              storedCandidate
                ?.copy_manual_override ===
                true
            );

          const completedPhotoIds =
            validateSamanthaEmailEditionPhotoIds({
              editionKey,

              candidatePhotoIds:
                emailEditionPhotoIdsFromSlots({
                  editionKey,

                  candidatePhotoSlots:
                    generatedCandidate
                      .photo_slots,
                }),

              validPhotoIds,

              savedSlotPhotoIds:
                emailSlotPhotoIdsByEdition[
                  editionKey
                ],

              lockedSlotIndexes:
                lockedEmailSlotIndexesByEdition[
                  editionKey
                ],
            });

          validateSamanthaEmailEditionStoryFit({
            editionKey,

            photoIds:
              completedPhotoIds,

            analyses:
              photoIntelligence
                .analyses,

            validPhotoIds,

            lockedSlotIndexes:
              lockedEmailSlotIndexesByEdition[
                editionKey
              ],
          });

          if (
            preserveStored &&
            storedCandidate
          ) {
            editionContent[
              editionKey
            ] = {
              ...storedCandidate,

              photo_media_ids:
                completedPhotoIds,
            };

            continue;
          }

          const generatedSubject =
            cleanText(
              generatedCandidate
                .subject,
              220
            );

          const generatedPreviewText =
            cleanText(
              generatedCandidate
                .preview_text,
              400
            );

          const generatedHeadline =
            cleanText(
              generatedCandidate
                .headline,
              260
            );

          const generatedBody =
            cleanText(
              generatedCandidate
                .body,
              520
            );

          const generatedFullDescription =
            cleanText(
              generatedCandidate
                .full_description,
              1600
            );

          const generatedCtaLabel =
            cleanText(
              generatedCandidate
                .cta_label,
              100
            );

          if (
            !generatedSubject ||
            !generatedPreviewText ||
            !generatedHeadline ||
            !generatedBody ||
            !generatedFullDescription ||
            !generatedCtaLabel
          ) {
            throw new MarketingPackageError(
              `Samantha returned incomplete copy for ${EMAIL_EDITION_LABELS[editionKey]}.`,
              502,
              'email_edition_copy_incomplete'
            );
          }

          if (
            editionKey !==
              'launch' &&
            generatedFullDescription
              .length <
              260
          ) {
            throw new MarketingPackageError(
              `Samantha returned an undersized description for ${EMAIL_EDITION_LABELS[editionKey]}.`,
              502,
              'email_edition_description_too_short'
            );
          }

          const launchDescription =
            cleanText(
              listing
                .public_remarks ||
              listing.description,
              1600
            );

          if (
            editionKey ===
              'launch' &&
            !launchDescription
          ) {
            throw new MarketingPackageError(
              'Luxury Launch requires MLS or public remarks before Samantha can prepare the Email editions.',
              409,
              'email_launch_remarks_required'
            );
          }

          editionContent[
            editionKey
          ] = {
            subject:
              generatedSubject,

            preview_text:
              generatedPreviewText,

            headline:
              generatedHeadline,

            body:
              generatedBody,

            full_description:
              editionKey ===
                'launch'
                ? launchDescription
                : generatedFullDescription,

            cta_label:
              generatedCtaLabel,

            photo_media_ids:
              completedPhotoIds,

            status:
              'needs_review',

            approved_at:
              null,

            approved_by:
              null,

            manual_override:
              false,

            copy_manual_override:
              false,

            generated_at:
              preparedAt,

            generation_model:
              model,
          };
        }
        const storedSelectedEdition =
          cleanText(
            existingContent
              .luxury_edition,
            100
          );

        const selectedEditionKey:
          EmailEditionKey =
          EMAIL_EDITION_KEYS.includes(
            storedSelectedEdition as
              EmailEditionKey
          )
            ? storedSelectedEdition as
                EmailEditionKey
            : eventDefaultEditionKey;

        const finalizedEditionPhotoIds =
          {} as
            Record<
              EmailEditionKey,
              string[]
            >;

        for (
          const editionKey of
            EMAIL_EDITION_KEYS
        ) {
          const normalizedEditionPhotoIds =
            normalizePhotoIds(
              editionContent[
                editionKey
              ]
                .photo_media_ids,
              validPhotoIds
            );

          if (
            normalizedEditionPhotoIds
              .length !== 6 ||
            new Set(
              normalizedEditionPhotoIds
            ).size !== 6
          ) {
            throw new MarketingPackageError(
              `Samantha could not verify six unique valid photos for ${EMAIL_EDITION_LABELS[editionKey]}.`,
              409,
              'email_edition_photo_set_incomplete'
            );
          }

          finalizedEditionPhotoIds[
            editionKey
          ] =
            [
              ...normalizedEditionPhotoIds,
            ];

          editionContent[
            editionKey
          ] = {
            ...editionContent[
              editionKey
            ],

            photo_media_ids:
              [
                ...normalizedEditionPhotoIds,
              ],
          };
        }

        finalEmailSlotPhotoIdsByEdition =
          finalizedEditionPhotoIds;

        const selectedEdition =
          editionContent[
            selectedEditionKey
          ];

        photoIds =
          [
            ...finalizedEditionPhotoIds[
              selectedEditionKey
            ],
          ];

        content = {
          ...existingContent,

          subject:
            selectedEdition
              .subject,

          preview_text:
            selectedEdition
              .preview_text,

          headline:
            selectedEdition
              .headline,

          body:
            selectedEdition
              .body,

          full_description:
            selectedEdition
              .full_description,

          cta_label:
            selectedEdition
              .cta_label,

          luxury_edition:
            selectedEditionKey,

          editions:
            editionContent,

          event_type:
            eventType,

          event_details:
            verifiedEventDetails,

          event_metadata: {
            label:
              eventDefinition
                .label,

            subject_prefix:
              eventDefinition
                .subjectPrefix,

            campaign_type:
              eventDefinition
                .campaignType,

            default_luxury_edition:
              eventDefaultEditionKey,

            default_cta_label:
              eventDefinition
                .defaultCtaLabel,

            required_details:
              [
                ...eventDefinition
                  .requiredDetails,
              ],

            prefer_fresh_photos:
              eventDefinition
                .preferFreshPhotos,

            samantha_brief:
              eventDefinition
                .samanthaBrief,

            photo_brief:
              eventDefinition
                .photoBrief,

            generated_at:
              preparedAt,

            generation_model:
              model,
          },

          generated_asset_id:
            null,

          generated_asset_url:
            null,

          generated_asset_format:
            null,
        };
      }
      else {
        const preservedCanvaPackage =
          sectionKey ===
            'flyer'
            ? canvaPackageForPreservation(
                isRecord(
                  existing?.content
                )
                  ? existing
                      .content
                      .canva_package
                  : null
              )
            : null;

        content = {
          ...output,

          template_key:
            undefined,

          photo_media_ids:
            undefined,

          location_research_status:
            sectionKey ===
            'property_website'
              ? 'not_started'
              : undefined,

          school_research_status:
            sectionKey ===
              'property_website'
              ? 'not_started'
              : undefined,

          ...(
            preservedCanvaPackage
              ? {
                  canva_package:
                    preservedCanvaPackage,
                }
              : {}
          ),
        };
      }

      const shouldSaveSection =
        sectionKey ===
          'email' ||
        !existing
          ?.manual_override;

      if (
        shouldSaveSection
      ) {
        const {
          data:
            savedSection,
          error:
            sectionSaveError,
        } = await supabaseAdmin
          .from(
            'listing_marketing_sections'
          )
          .upsert(
            {
              listing_id:
                listing.id,

              org_id:
                listing.org_id,

              owner_user_id:
                listing.owner_user_id,

              section_key:
                sectionKey,

              status:
                sectionKey ===
                  'email' &&
                existing
                  ?.status
                  ? existing.status
                  : 'needs_review',

              template_key:
                templateKey,

              template_locked:
                existing
                  ?.template_locked ||
                false,

              content,

              manual_override:
                sectionKey ===
                  'email'
                  ? Boolean(
                      existing
                        ?.manual_override
                    )
                  : false,

              generation_version:
                (
                  existing
                    ?.generation_version ||
                  0
                ) + 1,

              generation_model:
                model,

              input_hash:
                inputHash,

              prepared_at:
                preparedAt,

              approved_at:
                sectionKey ===
                  'email'
                  ? existing
                      ?.approved_at ||
                    null
                  : null,

              approved_by:
                sectionKey ===
                  'email'
                  ? existing
                      ?.approved_by ||
                    null
                  : null,

              last_error:
                null,

              created_by:
                requester.id,

              updated_by:
                requester.id,
            },
            {
              onConflict:
                'listing_id,section_key',
            }
          )
          .select()
          .single();

        if (
          sectionSaveError
        ) {
          throw new MarketingPackageError(
            sectionSaveError.message,
            500,
            'section_save_failed'
          );
        }

        savedSections.push(
          savedSection
        );
      }

      if (
        sectionKey ===
        'email'
      ) {
        if (
          !finalEmailSlotPhotoIdsByEdition
        ) {
          throw new MarketingPackageError(
            'The Email edition photo assignments were not prepared.',
            409,
            'email_assignment_set_missing'
          );
        }

        const assignmentRows:
          Record<
            string,
            unknown
          >[] = [];

        let expectedUnlockedCount =
          0;

        for (
          const editionKey of
            EMAIL_EDITION_KEYS
        ) {
          const editionPhotoIds =
            finalEmailSlotPhotoIdsByEdition[
              editionKey
            ];

          const lockedIndexes =
            new Set(
              lockedEmailSlotIndexesByEdition[
                editionKey
              ]
            );

          if (
            editionPhotoIds.length !==
              6 ||
            new Set(
              editionPhotoIds
            ).size !== 6
          ) {
            throw new MarketingPackageError(
              `The ${EMAIL_EDITION_LABELS[editionKey]} assignment set is incomplete.`,
              409,
              'email_assignment_set_invalid'
            );
          }

          expectedUnlockedCount +=
            6 -
            lockedIndexes.size;

          for (
            let index = 0;
            index <
              editionPhotoIds.length;
            index += 1
          ) {
            if (
              lockedIndexes.has(
                index
              )
            ) {
              continue;
            }

            assignmentRows.push({
              listing_id:
                listing.id,

              org_id:
                listing.org_id,

              owner_user_id:
                listing.owner_user_id,

              section_key:
                'email',

              edition_key:
                editionKey,

              ...assignmentSlot(
                'email',
                index
              ),

              media_id:
                editionPhotoIds[
                  index
                ],

              selected_by:
                'samantha',

              is_locked:
                false,

              created_by:
                requester.id,

              updated_by:
                requester.id,
            });
          }
        }

        if (
          assignmentRows.length !==
            expectedUnlockedCount
        ) {
          throw new MarketingPackageError(
            'The complete edition-specific Email assignment set was not valid.',
            409,
            'email_assignment_set_invalid'
          );
        }

        if (
          assignmentRows.length >
          0
        ) {
          const {
            error:
              assignmentUpsertError,
          } = await supabaseAdmin
            .from(
              'listing_marketing_photo_assignments'
            )
            .upsert(
              assignmentRows,
              {
                onConflict:
                  'listing_id,section_key,edition_key,slot_key,sort_order',
              }
            );

          if (
            assignmentUpsertError
          ) {
            throw new MarketingPackageError(
              assignmentUpsertError
                .message,
              500,
              'email_assignment_upsert_failed'
            );
          }
        }
      }
      else {
        const assignmentRows =
          photoIds.map(
            (
              mediaId,
              index
            ) => ({
              listing_id:
                listing.id,

              org_id:
                listing.org_id,

              owner_user_id:
                listing.owner_user_id,

              section_key:
                sectionKey,

              edition_key:
                'shared',

              ...assignmentSlot(
                sectionKey,
                index
              ),

              media_id:
                mediaId,

              selected_by:
                'samantha',

              is_locked:
                false,

              created_by:
                requester.id,

              updated_by:
                requester.id,
            })
          );

        const {
          error:
            assignmentDeleteError,
        } = await supabaseAdmin
          .from(
            'listing_marketing_photo_assignments'
          )
          .delete()
          .eq(
            'listing_id',
            listing.id
          )
          .eq(
            'section_key',
            sectionKey
          )
          .eq(
            'is_locked',
            false
          );

        if (
          assignmentDeleteError
        ) {
          throw new MarketingPackageError(
            assignmentDeleteError
              .message,
            500,
            'old_assignment_delete_failed'
          );
        }

        if (
          assignmentRows.length >
          0
        ) {
          const {
            error:
              assignmentInsertError,
          } = await supabaseAdmin
            .from(
              'listing_marketing_photo_assignments'
            )
            .insert(
              assignmentRows
            );

          if (
            assignmentInsertError
          ) {
            throw new MarketingPackageError(
              assignmentInsertError
                .message,
              500,
              'assignment_save_failed'
            );
          }
        }
      }
    }

    return NextResponse.json(
      {
        ok:
          true,

        message:
          'Samantha prepared the complete marketing package for review.',

        prepared_at:
          preparedAt,

        sections:
          savedSections,
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
  catch (
    error: unknown
  ) {
    console.error(
      'Listing marketing package error:',
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Samantha could not prepare the marketing package.',

        code:
          responseCode(
            error
          ),
      },
      {
        status:
          responseStatus(
            error
          ),

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
}
