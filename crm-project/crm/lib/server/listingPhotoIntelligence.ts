import {
  supabaseAdmin,
} from '../supabaseAdmin';

const PHOTO_CATEGORIES = [
  'front_exterior',
  'exterior',
  'kitchen',
  'living_room',
  'dining_room',
  'primary_bedroom',
  'bedroom',
  'primary_bathroom',
  'bathroom',
  'office',
  'bonus_room',
  'hallway',
  'foyer',
  'laundry',
  'garage',
  'shop',
  'backyard',
  'patio',
  'view',
  'pool',
  'community',
  'detail',
  'floor_plan',
  'other',
] as const;

export type ListingPhotoCategory =
  typeof PHOTO_CATEGORIES[number];

export type ListingPhotoInput = {
  id: string;
  public_url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  title: string | null;
  caption: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
};

export type ListingPhotoAnalysis = {
  media_id: string;
  analysis_status:
    | 'complete'
    | 'failed'
    | 'needs_review';
  primary_category:
    ListingPhotoCategory;
  room_label: string | null;
  feature_tags: string[];
  quality_score: number;
  marketing_score: number;
  confidence: number;
  is_usable: boolean;
  rejection_reason: string | null;
  duplicate_group: string | null;
  visual_summary: string | null;
  source_url: string | null;
  analysis_model: string;
  analysis_version: number;
  label_source:
    | 'samantha'
    | 'user';
  label_locked: boolean;
  label_locked_by: string | null;
  label_locked_at: string | null;
};

type PreparePhotoIntelligenceInput = {
  listingId: string;
  orgId: string;
  ownerUserId: string;
  requesterId: string;
  apiKey: string;
  model: string;
  photos: ListingPhotoInput[];
};

export type ListingPhotoIntelligenceResult = {
  analyses: ListingPhotoAnalysis[];
  emailSlotPhotoIds:
    Array<string | null>;
  lockedEmailSlotIndexes: number[];
};

const PHOTO_CATEGORY_SET =
  new Set<string>(
    PHOTO_CATEGORIES
  );

const EXCLUDED_EMAIL_CATEGORIES =
  new Set<ListingPhotoCategory>([
    'hallway',
    'foyer',
    'laundry',
    'community',
    'detail',
    'floor_plan',
  ]);

export const LISTING_PHOTO_ANALYSIS_VERSION =
  1;

const ANALYSIS_VERSION =
  LISTING_PHOTO_ANALYSIS_VERSION;

function cleanText(
  value: unknown,
  maximumLength = 300
) {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function nullableText(
  value: unknown,
  maximumLength = 300
) {
  const cleaned =
    cleanText(
      value,
      maximumLength
    );

  return cleaned ||
    null;
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return minimum;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      numeric
    )
  );
}

function cleanTags(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const output:
    string[] = [];

  for (
    const item of value
  ) {
    const tag =
      cleanText(
        item,
        80
      );

    if (
      tag &&
      !output.includes(
        tag
      )
    ) {
      output.push(
        tag
      );
    }

    if (
      output.length >=
      12
    ) {
      break;
    }
  }

  return output;
}

function getOutputText(
  payload: any
) {
  if (
    typeof payload
      ?.output_text ===
    'string'
  ) {
    return payload
      .output_text
      .trim();
  }

  for (
    const outputItem of
    payload?.output ||
    []
  ) {
    for (
      const contentItem of
      outputItem?.content ||
      []
    ) {
      if (
        contentItem?.type ===
          'output_text' &&
        typeof contentItem
          ?.text ===
          'string'
      ) {
        return contentItem
          .text
          .trim();
      }
    }
  }

  return '';
}

function normalizeCategory(
  value: unknown
): ListingPhotoCategory {
  const cleaned =
    cleanText(
      value,
      100
    );

  return PHOTO_CATEGORY_SET.has(
    cleaned
  )
    ? (
        cleaned as
          ListingPhotoCategory
      )
    : 'other';
}

function normalizeStoredAnalysis(
  row: any
): ListingPhotoAnalysis {
  const status =
    row
      ?.analysis_status ===
        'failed' ||
    row
      ?.analysis_status ===
        'needs_review'
      ? row.analysis_status
      : 'complete';

  return {
    media_id:
      String(
        row?.media_id ||
        ''
      ),

    analysis_status:
      status,

    primary_category:
      normalizeCategory(
        row
          ?.primary_category
      ),

    room_label:
      nullableText(
        row?.room_label,
        120
      ),

    feature_tags:
      cleanTags(
        row?.feature_tags
      ),

    quality_score:
      Math.round(
        clampNumber(
          row?.quality_score,
          0,
          100
        )
      ),

    marketing_score:
      Math.round(
        clampNumber(
          row
            ?.marketing_score,
          0,
          100
        )
      ),

    confidence:
      clampNumber(
        row?.confidence,
        0,
        1
      ),

    is_usable:
      Boolean(
        row?.is_usable
      ),

    rejection_reason:
      nullableText(
        row
          ?.rejection_reason,
        240
      ),

    duplicate_group:
      nullableText(
        row
          ?.duplicate_group,
        100
      ),

    visual_summary:
      nullableText(
        row
          ?.visual_summary,
        300
      ),

    source_url:
      nullableText(
        row?.source_url,
        2000
      ),

    analysis_model:
      cleanText(
        row?.analysis_model,
        120
      ),

    analysis_version:
      Math.max(
        1,
        Math.round(
          clampNumber(
            row
              ?.analysis_version,
            1,
            1000
          )
        )
      ),

    label_source:
      row?.label_source ===
        'user'
        ? 'user'
        : 'samantha',

    label_locked:
      Boolean(
        row?.label_locked
      ),

    label_locked_by:
      nullableText(
        row?.label_locked_by,
        100
      ),

    label_locked_at:
      nullableText(
        row?.label_locked_at,
        100
      ),
  };
}

async function classifyPhotos(
  photos:
    ListingPhotoInput[],
  apiKey: string,
  model: string
) {
  const photoIds =
    new Set(
      photos.map(
        (photo) =>
          photo.id
      )
    );

  const content:
    Array<
      Record<
        string,
        unknown
      >
    > = [
    {
      type:
        'input_text',

      text: [
        'You are Samantha, a visual real-estate photograph classifier.',
        '',
        'Analyze each supplied photograph independently.',
        'Do not write marketing copy and do not select the final email layout.',
        'Return exactly one analysis object for every PHOTO_MEDIA_ID supplied.',
        '',
        'Classification requirements:',
        '- front_exterior means a clear primary street-facing exterior.',
        '- exterior means another exterior angle that is not the main street-facing view.',
        '- kitchen means the principal kitchen, not merely a wine bar, pantry or cabinet detail.',
        '- living_room means a clear living room or great-room composition.',
        '- primary_bedroom should be used only when the photograph visibly appears to be the principal bedroom; otherwise use bedroom.',
        '- primary_bathroom should be used only when the photograph visibly appears to be the principal bathroom; otherwise use bathroom.',
        '- hallway and foyer must be classified accurately and must not be disguised as living rooms.',
        '- backyard, patio, view, pool, garage and shop must be classified by what is actually visible.',
        '- detail is for isolated decorative, cabinet, appliance, fireplace or feature closeups.',
        '',
        'Scoring requirements:',
        '- quality_score measures lighting, composition, sharpness and room visibility from 0 through 100.',
        '- marketing_score measures usefulness in a primary real-estate marketing presentation from 0 through 100.',
        '- confidence is from 0 through 1.',
        '- is_usable must be false for blurry photographs, poor partial-room angles, hallways, foyers, floor plans and weak detail photographs that should not be used in the six-photo email.',
        '',
        'Duplicate requirements:',
        '- Give photographs of the same room or near-identical angle the same non-empty duplicate_group.',
        '- Use an empty duplicate_group only when the photograph is visually distinct.',
        '',
        `Allowed categories: ${PHOTO_CATEGORIES.join(', ')}.`,
      ].join('\n'),
    },
  ];

  for (
    const photo of photos
  ) {
    const imageUrl =
      photo.public_url ||
      photo.thumbnail_url;

    if (!imageUrl) {
      continue;
    }

    content.push({
      type:
        'input_text',

      text:
        `The following image is PHOTO_MEDIA_ID ${photo.id}.`,
    });

    content.push({
      type:
        'input_image',

      image_url:
        imageUrl,

      detail:
        'high',
    });
  }

  const schema = {
    type:
      'object',

    properties: {
      photos: {
        type:
          'array',

        items: {
          type:
            'object',

          properties: {
            photo_media_id: {
              type:
                'string',
            },

            primary_category: {
              type:
                'string',

              enum:
                PHOTO_CATEGORIES,
            },

            room_label: {
              type:
                'string',
            },

            feature_tags: {
              type:
                'array',

              items: {
                type:
                  'string',
              },
            },

            quality_score: {
              type:
                'integer',
            },

            marketing_score: {
              type:
                'integer',
            },

            confidence: {
              type:
                'number',
            },

            is_usable: {
              type:
                'boolean',
            },

            rejection_reason: {
              type:
                'string',
            },

            duplicate_group: {
              type:
                'string',
            },

            visual_summary: {
              type:
                'string',
            },
          },

          required: [
            'photo_media_id',
            'primary_category',
            'room_label',
            'feature_tags',
            'quality_score',
            'marketing_score',
            'confidence',
            'is_usable',
            'rejection_reason',
            'duplicate_group',
            'visual_summary',
          ],

          additionalProperties:
            false,
        },
      },
    },

    required: [
      'photos',
    ],

    additionalProperties:
      false,
  };

  const response =
    await fetch(
      'https://api.openai.com/v1/responses',
      {
        method:
          'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

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

                content,
              },
            ],

            text: {
              format: {
                type:
                  'json_schema',

                name:
                  'listing_photo_analysis',

                strict:
                  true,

                schema,
              },
            },

            max_output_tokens:
              6000,
          }),
      }
    );

  const payload =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    throw new Error(
      payload
        ?.error
        ?.message ||
      'Samantha could not analyze the listing photographs.'
    );
  }

  const outputText =
    getOutputText(
      payload
    );

  if (!outputText) {
    throw new Error(
      'Samantha returned no photograph analysis.'
    );
  }

  let parsed:
    any;

  try {
    parsed =
      JSON.parse(
        outputText
      );
  }
  catch {
    throw new Error(
      'Samantha returned invalid photograph analysis.'
    );
  }

  const outputRows =
    Array.isArray(
      parsed?.photos
    )
      ? parsed.photos
      : [];

  const normalizedById =
    new Map<
      string,
      ListingPhotoAnalysis
    >();

  for (
    const row of outputRows
  ) {
    const mediaId =
      cleanText(
        row
          ?.photo_media_id,
        100
      );

    if (
      !mediaId ||
      !photoIds.has(
        mediaId
      ) ||
      normalizedById.has(
        mediaId
      )
    ) {
      continue;
    }

    const confidence =
      clampNumber(
        row?.confidence,
        0,
        1
      );

    normalizedById.set(
      mediaId,
      {
        media_id:
          mediaId,

        analysis_status:
          confidence >=
          0.55
            ? 'complete'
            : 'needs_review',

        primary_category:
          normalizeCategory(
            row
              ?.primary_category
          ),

        room_label:
          nullableText(
            row?.room_label,
            120
          ),

        feature_tags:
          cleanTags(
            row?.feature_tags
          ),

        quality_score:
          Math.round(
            clampNumber(
              row
                ?.quality_score,
              0,
              100
            )
          ),

        marketing_score:
          Math.round(
            clampNumber(
              row
                ?.marketing_score,
              0,
              100
            )
          ),

        confidence,

        is_usable:
          Boolean(
            row?.is_usable
          ),

        rejection_reason:
          nullableText(
            row
              ?.rejection_reason,
            240
          ),

        duplicate_group:
          nullableText(
            row
              ?.duplicate_group,
            100
          ),

        visual_summary:
          nullableText(
            row
              ?.visual_summary,
            300
          ),

        source_url:
          null,

        analysis_model:
          model,

        analysis_version:
          ANALYSIS_VERSION,

        label_source:
          'samantha',

        label_locked:
          false,

        label_locked_by:
          null,

        label_locked_at:
          null,
      }
    );
  }

  return normalizedById;
}

function scoreAnalysis(
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

function emailSlotIndex(
  slotKey: string,
  sortOrder: number
) {
  if (
    slotKey ===
      'hero' &&
    sortOrder ===
      0
  ) {
    return 0;
  }

  if (
    slotKey ===
      'supporting' &&
    sortOrder >=
      0 &&
    sortOrder <=
      4
  ) {
    return sortOrder +
      1;
  }

  return null;
}

function selectEmailSlots(
  photos:
    ListingPhotoInput[],
  analyses:
    ListingPhotoAnalysis[],
  lockedRows:
    any[]
) {
  const slotPhotoIds:
    Array<
      string | null
    > = [
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const lockedIndexes =
    new Set<number>();

  const currentPhotoIds =
    new Set(
      photos.map(
        (photo) =>
          photo.id
      )
    );

  const analysisById =
    new Map(
      analyses.map(
        (analysis) => [
          analysis.media_id,
          analysis,
        ]
      )
    );

  const photoOrder =
    new Map(
      photos.map(
        (photo, index) => [
          photo.id,
          photo.sort_order ??
            index,
        ]
      )
    );

  const usedIds =
    new Set<string>();

  const usedDuplicateGroups =
    new Set<string>();

  const usedCategories =
    new Set<
      ListingPhotoCategory
    >();

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
    const row of lockedRows
  ) {
    const index =
      emailSlotIndex(
        String(
          row?.slot_key ||
          ''
        ),
        Number(
          row?.sort_order ||
          0
        )
      );

    const mediaId =
      String(
        row?.media_id ||
        ''
      );

    if (
      index ===
        null ||
      !mediaId ||
      !currentPhotoIds.has(
        mediaId
      )
    ) {
      continue;
    }

    slotPhotoIds[
      index
    ] = mediaId;

    lockedIndexes.add(
      index
    );

    markUsed(
      mediaId
    );
  }

  const ranked =
    analyses
      .filter(
        (analysis) =>
          currentPhotoIds.has(
            analysis.media_id
          )
      )
      .slice()
      .sort(
        (
          left,
          right
        ) => {
          const scoreDifference =
            scoreAnalysis(
              right
            ) -
            scoreAnalysis(
              left
            );

          if (
            scoreDifference !==
            0
          ) {
            return scoreDifference;
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
      ListingPhotoAnalysis
  ) {
    if (
      usedIds.has(
        analysis.media_id
      ) ||
      analysis
        .analysis_status ===
        'failed' ||
      !analysis.is_usable ||
      analysis.confidence <
        0.35 ||
      EXCLUDED_EMAIL_CATEGORIES.has(
        analysis
          .primary_category
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

  function chooseCategory(
    categories:
      ListingPhotoCategory[]
  ) {
    for (
      const category of
      categories
    ) {
      const candidate =
        ranked.find(
          (analysis) =>
            analysis
              .primary_category ===
              category &&
            isAvailable(
              analysis
            )
        );

      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  function placeAnalysis(
    index: number,
    analysis:
      ListingPhotoAnalysis |
      null
  ) {
    if (
      slotPhotoIds[
        index
      ] ||
      !analysis
    ) {
      return;
    }

    slotPhotoIds[
      index
    ] =
      analysis.media_id;

    markUsed(
      analysis.media_id
    );
  }

  if (
    !slotPhotoIds[0]
  ) {
    const primaryPhoto =
      photos.find(
        (photo) =>
          photo.is_primary
      );

    if (primaryPhoto) {
      slotPhotoIds[0] =
        primaryPhoto.id;

      markUsed(
        primaryPhoto.id
      );
    }
    else {
      placeAnalysis(
        0,
        chooseCategory([
          'front_exterior',
          'exterior',
        ])
      );
    }
  }

  placeAnalysis(
    1,
    chooseCategory([
      'kitchen',
    ])
  );

  placeAnalysis(
    2,
    chooseCategory([
      'living_room',
    ])
  );

  placeAnalysis(
    3,
    chooseCategory([
      'primary_bedroom',
      'bedroom',
    ])
  );

  placeAnalysis(
    4,
    chooseCategory([
      'primary_bathroom',
      'bathroom',
    ])
  );

  placeAnalysis(
    5,
    chooseCategory([
      'backyard',
      'patio',
      'view',
      'pool',
      'shop',
      'garage',
      'exterior',
      'office',
      'bonus_room',
      'dining_room',
    ])
  );

  for (
    let index = 0;
    index <
      slotPhotoIds.length;
    index += 1
  ) {
    if (
      slotPhotoIds[
        index
      ]
    ) {
      continue;
    }

    const unusedCategoryCandidate =
      ranked.find(
        (analysis) =>
          isAvailable(
            analysis
          ) &&
          !usedCategories.has(
            analysis
              .primary_category
          )
      );

    if (
      unusedCategoryCandidate
    ) {
      placeAnalysis(
        index,
        unusedCategoryCandidate
      );

      continue;
    }

    const remainingCandidate =
      ranked.find(
        (analysis) =>
          isAvailable(
            analysis
          )
      );

    placeAnalysis(
      index,
      remainingCandidate ||
        null
    );
  }

  return {
    slotPhotoIds,
    lockedIndexes:
      Array.from(
        lockedIndexes
      ),
  };
}

export async function loadSavedListingPhotoIntelligence(
  input: {
    listingId: string;
    photos:
      ListingPhotoInput[];
  }
): Promise<ListingPhotoIntelligenceResult> {
  const [
    existingAnalysisResult,
    lockedAssignmentResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        'listing_media_ai_analysis'
      )
      .select(`
        media_id,
        analysis_status,
        primary_category,
        room_label,
        feature_tags,
        quality_score,
        marketing_score,
        confidence,
        is_usable,
        rejection_reason,
        duplicate_group,
        visual_summary,
        source_url,
        analysis_model,
        analysis_version,
        label_source,
        label_locked,
        label_locked_by,
        label_locked_at
      `)
      .eq(
        'listing_id',
        input.listingId
      ),

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
        input.listingId
      )
      .eq(
        'section_key',
        'email'
      )
      .eq(
        'is_locked',
        true
      ),
  ]);

  if (
    existingAnalysisResult.error
  ) {
    throw new Error(
      existingAnalysisResult
        .error
        .message
    );
  }

  if (
    lockedAssignmentResult.error
  ) {
    throw new Error(
      lockedAssignmentResult
        .error
        .message
    );
  }

  const currentPhotoIds =
    new Set(
      input.photos.map(
        (photo) =>
          photo.id
      )
    );

  const analyses =
    (
      existingAnalysisResult
        .data ||
      []
    )
      .map(
        (row: any) =>
          normalizeStoredAnalysis(
            row
          )
      )
      .filter(
        (analysis) =>
          currentPhotoIds.has(
            analysis.media_id
          )
      );

  const selection =
    selectEmailSlots(
      input.photos,
      analyses,
      lockedAssignmentResult
        .data ||
        []
    );

  return {
    analyses,

    emailSlotPhotoIds:
      selection.slotPhotoIds,

    lockedEmailSlotIndexes:
      selection.lockedIndexes,
  };
}

export async function prepareListingPhotoIntelligence(
  input:
    PreparePhotoIntelligenceInput
): Promise<ListingPhotoIntelligenceResult> {
  const photoAnalysisModel =
    process.env
      .OPENAI_LISTING_PHOTO_MODEL ||
    input.model;

  const [
    existingAnalysisResult,
    lockedAssignmentResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        'listing_media_ai_analysis'
      )
      .select(`
        media_id,
        analysis_status,
        primary_category,
        room_label,
        feature_tags,
        quality_score,
        marketing_score,
        confidence,
        is_usable,
        rejection_reason,
        duplicate_group,
        visual_summary,
        source_url,
        analysis_model,
        analysis_version,
        label_source,
        label_locked,
        label_locked_by,
        label_locked_at
      `)
      .eq(
        'listing_id',
        input.listingId
      ),

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
        input.listingId
      )
      .eq(
        'section_key',
        'email'
      )
      .eq(
        'is_locked',
        true
      ),
  ]);

  if (
    existingAnalysisResult.error
  ) {
    throw new Error(
      existingAnalysisResult
        .error
        .message
    );
  }

  if (
    lockedAssignmentResult.error
  ) {
    throw new Error(
      lockedAssignmentResult
        .error
        .message
    );
  }

  const existingById =
    new Map<
      string,
      ListingPhotoAnalysis
    >(
      (
        existingAnalysisResult
          .data ||
        []
      ).map(
        (row: any) => {
          const normalized =
            normalizeStoredAnalysis(
              row
            );

          return [
            normalized.media_id,
            normalized,
          ];
        }
      )
    );

  const photosToAnalyze:
    ListingPhotoInput[] = [];

  const unavailableAnalyses:
    ListingPhotoAnalysis[] = [];

  for (
    const photo of
    input.photos
  ) {
    const sourceUrl =
      photo.public_url ||
      photo.thumbnail_url ||
      null;

    const existing =
      existingById.get(
        photo.id
      );

    const isLocked =
      Boolean(
        existing
          ?.label_locked
      );

    const isCurrent =
      isLocked ||
      (
        Boolean(existing) &&
        existing
          ?.analysis_version ===
          ANALYSIS_VERSION &&
        existing
          ?.source_url ===
          sourceUrl &&
        existing
          ?.analysis_status !==
          'failed'
      );

    if (isCurrent) {
      continue;
    }

    if (!sourceUrl) {
      unavailableAnalyses.push({
        media_id:
          photo.id,

        analysis_status:
          'failed',

        primary_category:
          'other',

        room_label:
          null,

        feature_tags:
          [],

        quality_score:
          0,

        marketing_score:
          0,

        confidence:
          0,

        is_usable:
          false,

        rejection_reason:
          'No image URL was available for visual analysis.',

        duplicate_group:
          null,

        visual_summary:
          null,

        source_url:
          null,

        analysis_model:
          photoAnalysisModel,

        analysis_version:
          ANALYSIS_VERSION,

        label_source:
          'samantha',

        label_locked:
          false,

        label_locked_by:
          null,

        label_locked_at:
          null,
      });

      continue;
    }

    photosToAnalyze.push(
      photo
    );
  }

  const newlyAnalyzedById =
    new Map<
      string,
      ListingPhotoAnalysis
    >();

  const classifyAndMerge =
    async (
      batch:
        ListingPhotoInput[]
    ) => {
      const batchResults =
        await classifyPhotos(
          batch,
          input.apiKey,
          photoAnalysisModel
        );

      for (
        const [
          mediaId,
          analysis,
        ] of batchResults
      ) {
        newlyAnalyzedById.set(
          mediaId,
          analysis
        );
      }
    };

  const batchSize =
    6;

  for (
    let startIndex = 0;
    startIndex <
      photosToAnalyze.length;
    startIndex +=
      batchSize
  ) {
    const batch =
      photosToAnalyze.slice(
        startIndex,
        startIndex +
          batchSize
      );

    try {
      await classifyAndMerge(
        batch
      );
    }
    catch {
      // Missing photographs from a failed batch
      // are retried individually below.
    }
  }

  const photosMissingAfterBatches =
    photosToAnalyze.filter(
      (photo) =>
        !newlyAnalyzedById.has(
          photo.id
        )
    );

  for (
    const photo of
    photosMissingAfterBatches
  ) {
    try {
      await classifyAndMerge([
        photo,
      ]);
    }
    catch {
      // An unresolved photograph becomes a saved
      // failed analysis instead of stopping all photos.
    }
  }

  for (
    const photo of
    photosToAnalyze
  ) {
    if (
      newlyAnalyzedById.has(
        photo.id
      )
    ) {
      continue;
    }

    newlyAnalyzedById.set(
      photo.id,
      {
        media_id:
          photo.id,

        analysis_status:
          'failed',

        primary_category:
          'other',

        room_label:
          null,

        feature_tags:
          [],

        quality_score:
          0,

        marketing_score:
          0,

        confidence:
          0,

        is_usable:
          false,

        rejection_reason:
          'Samantha could not complete visual analysis after small-batch and individual retries.',

        duplicate_group:
          null,

        visual_summary:
          null,

        source_url:
          null,

        analysis_model:
          photoAnalysisModel,

        analysis_version:
          ANALYSIS_VERSION,

        label_source:
          'samantha',

        label_locked:
          false,

        label_locked_by:
          null,

        label_locked_at:
          null,
      }
    );
  }

  const analysesToSave:
    ListingPhotoAnalysis[] = [
    ...unavailableAnalyses,
  ];

  for (
    const photo of
    photosToAnalyze
  ) {
    const analysis =
      newlyAnalyzedById.get(
        photo.id
      );

    if (!analysis) {
      continue;
    }

    analysis.source_url =
      photo.public_url ||
      photo.thumbnail_url ||
      null;

    analysesToSave.push(
      analysis
    );
  }

  let analysesAllowedToSave =
    analysesToSave;

  if (
    analysesToSave.length >
    0
  ) {
    const mediaIdsToSave =
      analysesToSave.map(
        (analysis) =>
          analysis.media_id
      );

    const {
      data:
        lockedLabelRows,
      error:
        lockedLabelLoadError,
    } = await supabaseAdmin
      .from(
        'listing_media_ai_analysis'
      )
      .select(
        'media_id'
      )
      .in(
        'media_id',
        mediaIdsToSave
      )
      .eq(
        'label_locked',
        true
      );

    if (
      lockedLabelLoadError
    ) {
      throw new Error(
        lockedLabelLoadError
          .message
      );
    }

    const lockedLabelIds =
      new Set<string>(
        (
          lockedLabelRows ||
          []
        ).map(
          (row: any) =>
            String(
              row.media_id
            )
        )
      );

    analysesAllowedToSave =
      analysesToSave.filter(
        (analysis) =>
          !lockedLabelIds.has(
            analysis.media_id
          )
      );
  }

  if (
    analysesAllowedToSave.length >
    0
  ) {
    const analyzedAt =
      new Date()
        .toISOString();

    const {
      error:
        analysisSaveError,
    } = await supabaseAdmin
      .from(
        'listing_media_ai_analysis'
      )
      .upsert(
        analysesAllowedToSave.map(
          (analysis) => ({
            listing_id:
              input.listingId,

            org_id:
              input.orgId,

            owner_user_id:
              input.ownerUserId,

            media_id:
              analysis.media_id,

            analysis_status:
              analysis
                .analysis_status,

            primary_category:
              analysis
                .primary_category,

            room_label:
              analysis
                .room_label,

            feature_tags:
              analysis
                .feature_tags,

            quality_score:
              analysis
                .quality_score,

            marketing_score:
              analysis
                .marketing_score,

            confidence:
              analysis
                .confidence,

            is_usable:
              analysis
                .is_usable,

            rejection_reason:
              analysis
                .rejection_reason,

            duplicate_group:
              analysis
                .duplicate_group,

            visual_summary:
              analysis
                .visual_summary,

            source_url:
              analysis
                .source_url,

            analysis_payload: {
              category:
                analysis
                  .primary_category,

              room_label:
                analysis
                  .room_label,

              tags:
                analysis
                  .feature_tags,

              quality_score:
                analysis
                  .quality_score,

              marketing_score:
                analysis
                  .marketing_score,

              confidence:
                analysis
                  .confidence,

              is_usable:
                analysis
                  .is_usable,

              rejection_reason:
                analysis
                  .rejection_reason,

              duplicate_group:
                analysis
                  .duplicate_group,

              visual_summary:
                analysis
                  .visual_summary,
            },

            analysis_model:
              analysis
                .analysis_model,

            analysis_version:
              analysis
                .analysis_version,

            analyzed_at:
              analyzedAt,

            created_by:
              input.requesterId,

            updated_by:
              input.requesterId,
          })
        ),
        {
          onConflict:
            'media_id',
        }
      );

    if (
      analysisSaveError
    ) {
      throw new Error(
        analysisSaveError
          .message
      );
    }
  }

  const mergedById =
    new Map(
      existingById
    );

  for (
    const analysis of
    analysesAllowedToSave
  ) {
    mergedById.set(
      analysis.media_id,
      analysis
    );
  }

  const analyses =
    input.photos
      .map(
        (photo) =>
          mergedById.get(
            photo.id
          )
      )
      .filter(
        (
          analysis
        ): analysis is
          ListingPhotoAnalysis =>
          Boolean(
            analysis
          )
      );

  const selection =
    selectEmailSlots(
      input.photos,
      analyses,
      lockedAssignmentResult
        .data ||
        []
    );

  return {
    analyses,

    emailSlotPhotoIds:
      selection
        .slotPhotoIds,

    lockedEmailSlotIndexes:
      selection
        .lockedIndexes,
  };
}