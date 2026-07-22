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

type RequesterRow = {
  id: string;
  org_id: string | null;
  role: Role;
};

type ListingRow = {
  id: string;
  org_id: string;

  owner_user_id:
    | string
    | null;

  title:
    | string
    | null;

  property_type:
    | string
    | null;

  property_address:
    | string
    | null;

  city:
    | string
    | null;

  state:
    | string
    | null;

  zip:
    | string
    | null;

  mls_number:
    | string
    | null;

  list_price:
    | number
    | null;

  listing_status:
    | string
    | null;

  review_status:
    | string
    | null;

  bedrooms:
    | number
    | null;

  bathrooms:
    | number
    | null;

  levels:
    | string
    | null;

  garage_spaces:
    | number
    | null;

  square_feet:
    | number
    | null;

  year_built:
    | number
    | null;

  lot_size_text:
    | string
    | null;

  acres:
    | number
    | null;

  county:
    | string
    | null;

  subdivision:
    | string
    | null;

  school_district:
    | string
    | null;

  elementary_school:
    | string
    | null;

  middle_school:
    | string
    | null;

  high_school:
    | string
    | null;

  hoa_fee:
    | number
    | null;

  hoa_frequency:
    | string
    | null;

  features: unknown;

  inclusions:
    | string
    | null;

  public_remarks:
    | string
    | null;

  description:
    | string
    | null;

  campaign_headline:
    | string
    | null;

  short_marketing_description:
    | string
    | null;

  source_last_refreshed_at:
    | string
    | null;
};

type PhotoRow = {
  id: string;

  public_url:
    | string
    | null;

  thumbnail_url:
    | string
    | null;

  file_name:
    | string
    | null;

  title:
    | string
    | null;

  caption:
    | string
    | null;

  sort_order:
    | number
    | null;

  is_primary:
    | boolean
    | null;
};

type DocumentRow = {
  id: string;

  file_name:
    | string
    | null;

  extracted_data: unknown;

  extracted_at:
    | string
    | null;
};

type ExistingEnrichmentRow = {
  research_version:
    | number
    | null;
};

type GeneratedHighlight = {
  headline: unknown;
  summary: unknown;
  bullet_points: unknown;
  photo_media_id: unknown;
  source_facts: unknown;
};

class ListingResearchError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status: number,
    code = 'listing_research_error'
  ) {
    super(message);

    this.name =
      'ListingResearchError';

    this.status =
      status;

    this.code =
      code;
  }
}

function canManageListing(
  requester: RequesterRow,
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

function cleanText(
  value: unknown,
  maximumLength: number
) {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function cleanStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  const unique =
    new Set<string>();

  for (
    const item of value
  ) {
    const cleaned =
      cleanText(
        item,
        maximumLength
      );

    if (cleaned) {
      unique.add(cleaned);
    }

    if (
      unique.size >=
      maximumItems
    ) {
      break;
    }
  }

  return Array.from(unique);
}

function getOutputText(
  payload: any
) {
  for (
    const item of
      payload?.output || []
  ) {
    if (
      item?.type !==
      'message'
    ) {
      continue;
    }

    for (
      const content of
        item?.content || []
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

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
    ListingResearchError
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
    ListingResearchError
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

function jsonResponse(
  body:
    Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  );
}

function createInputHash(
  listing: ListingRow,
  photos: PhotoRow[],
  document:
    | DocumentRow
    | null
) {
  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify({
        listing,
        photos:
          photos.map(
            (photo) => ({
              id:
                photo.id,

              public_url:
                photo.public_url,

              thumbnail_url:
                photo.thumbnail_url,

              title:
                photo.title,

              caption:
                photo.caption,

              sort_order:
                photo.sort_order,
            })
          ),

        document: document
          ? {
              id:
                document.id,

              extracted_at:
                document.extracted_at,
            }
          : null,
      })
    )
    .digest('hex');
}

function normalizeHighlights(
  value: unknown,
  photos: PhotoRow[]
) {
  if (
    !Array.isArray(value)
  ) {
    throw new ListingResearchError(
      'Samantha did not return a valid highlight list.',
      502,
      'invalid_highlight_response'
    );
  }

  const validPhotoIds =
    new Set(
      photos.map(
        (photo) =>
          photo.id
      )
    );

  const usedPhotoIds =
    new Set<string>();

  const normalized =
    value
      .map(
        (
          raw,
          index
        ) => {
          const item =
            raw as GeneratedHighlight;

          const headline =
            cleanText(
              item?.headline,
              120
            );

          const summary =
            cleanText(
              item?.summary,
              600
            );

          const bulletPoints =
            cleanStringArray(
              item?.bullet_points,
              3,
              180
            );

          const sourceFacts =
            cleanStringArray(
              item?.source_facts,
              6,
              240
            );

          const requestedPhotoId =
            cleanText(
              item?.photo_media_id,
              100
            );

          const photoMediaId =
            requestedPhotoId &&
            validPhotoIds.has(
              requestedPhotoId
            ) &&
            !usedPhotoIds.has(
              requestedPhotoId
            )
              ? requestedPhotoId
              : null;

          if (
            !headline ||
            !summary ||
            bulletPoints.length < 2 ||
            !photoMediaId
          ) {
            return null;
          }

          usedPhotoIds.add(
            photoMediaId
          );

          return {
            headline,
            summary,

            bullet_points:
              bulletPoints,

            source_facts:
              sourceFacts,

            photo_media_id:
              photoMediaId,

            sort_order:
              index,

            is_visible:
              true,

            manual_override:
              false,
          };
        }
      )
      .filter(Boolean)
      .slice(
        0,
        6
      );

  if (
    normalized.length !==
    6
  ) {
    throw new ListingResearchError(
      'Samantha must return exactly six usable property highlights with six unique matching photographs.',
      502,
      'incomplete_highlight_response'
    );
  }

  return normalized;
}

export async function POST(
  request: Request
) {
  let listingForFailure:
    | ListingRow
    | null =
    null;

  try {
    const authenticatedProfile =
      await requireAuthenticatedProfile(
        request
      );

    const requester:
      RequesterRow = {
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

    if (!listingId) {
      throw new ListingResearchError(
        'Choose a listing first.',
        400,
        'listing_required'
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
        review_status,
        bedrooms,
        bathrooms,
        levels,
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
        source_last_refreshed_at
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
      throw new ListingResearchError(
        listingError?.message ||
          'Listing not found.',
        404,
        'listing_not_found'
      );
    }

    const listing =
      listingData as ListingRow;

    listingForFailure =
      listing;

    if (
      !canManageListing(
        requester,
        listing
      )
    ) {
      throw new ListingResearchError(
        'You do not have access to research this listing.',
        403,
        'listing_access_denied'
      );
    }

    if (
      !listing.owner_user_id
    ) {
      throw new ListingResearchError(
        'Assign a listing owner before Samantha begins website research.',
        400,
        'listing_owner_required'
      );
    }

    if (
      listing.review_status !==
      'confirmed'
    ) {
      throw new ListingResearchError(
        'Review and confirm the listing facts before Samantha begins website research.',
        400,
        'listing_confirmation_required'
      );
    }

    const [
      photoResult,
      documentResult,
      enrichmentResult,
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
        .limit(18),

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
          'listing_website_enrichment'
        )
        .select(
          'research_version'
        )
        .eq(
          'listing_id',
          listing.id
        )
        .maybeSingle(),
    ]);

    if (
      photoResult.error
    ) {
      throw new ListingResearchError(
        photoResult.error.message,
        500,
        'photo_load_failed'
      );
    }

    if (
      documentResult.error
    ) {
      throw new ListingResearchError(
        documentResult.error.message,
        500,
        'document_load_failed'
      );
    }

    if (
      enrichmentResult.error
    ) {
      throw new ListingResearchError(
        enrichmentResult.error.message,
        500,
        'enrichment_load_failed'
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
      throw new ListingResearchError(
        'Select at least one listing photo for marketing before Samantha begins website research.',
        400,
        'marketing_photos_required'
      );
    }

    const document =
      (
        documentResult.data ||
        null
      ) as
        | DocumentRow
        | null;

    const existingEnrichment =
      (
        enrichmentResult.data ||
        null
      ) as
        | ExistingEnrichmentRow
        | null;

    const researchVersion =
      (
        existingEnrichment
          ?.research_version ||
        0
      ) + 1;

    const inputHash =
      createInputHash(
        listing,
        photos,
        document
      );

    const now =
      new Date().toISOString();

    const {
      error:
        researchingError,
    } = await supabaseAdmin
      .from(
        'listing_website_enrichment'
      )
      .upsert(
        {
          listing_id:
            listing.id,

          org_id:
            listing.org_id,

          owner_user_id:
            listing.owner_user_id,

          status:
            'researching',

          research_version:
            researchVersion,

          input_hash:
            inputHash,

          research_error:
            null,

          approved_at:
            null,

          approved_by:
            null,

          created_by:
            requester.id,
        },
        {
          onConflict:
            'listing_id',
        }
      );

    if (
      researchingError
    ) {
      throw new ListingResearchError(
        researchingError.message,
        500,
        'research_status_save_failed'
      );
    }

    const openAiApiKey =
      process.env
        .OPENAI_API_KEY;

    if (!openAiApiKey) {
      throw new ListingResearchError(
        'OPENAI_API_KEY is not configured.',
        500,
        'openai_key_missing'
      );
    }

    const model =
      process.env
        .OPENAI_LISTING_WEBSITE_MODEL ||
      process.env
        .OPENAI_LISTING_EXTRACTION_MODEL ||
      'gpt-4.1-mini';

    const listingFacts = {
      title:
        listing.title,

      property_type:
        listing.property_type,

      property_address:
        listing.property_address,

      city:
        listing.city,

      state:
        listing.state,

      zip:
        listing.zip,

      mls_number:
        listing.mls_number,

      list_price:
        listing.list_price,

      listing_status:
        listing.listing_status,

      bedrooms:
        listing.bedrooms,

      bathrooms:
        listing.bathrooms,

      levels:
        listing.levels,

      garage_spaces:
        listing.garage_spaces,

      square_feet:
        listing.square_feet,

      year_built:
        listing.year_built,

      lot_size_text:
        listing.lot_size_text,

      acres:
        listing.acres,

      county:
        listing.county,

      subdivision:
        listing.subdivision,

      hoa_fee:
        listing.hoa_fee,

      hoa_frequency:
        listing.hoa_frequency,

      features:
        listing.features,

      inclusions:
        listing.inclusions,

      public_remarks:
        listing.public_remarks,

      description:
        listing.description,

      campaign_headline:
        listing.campaign_headline,

      short_marketing_description:
        listing
          .short_marketing_description,

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

    const content:
      Array<
        Record<string, unknown>
      > = [
      {
        type:
          'input_text',

        text: [
          'You are Samantha, the listing-website marketing assistant for a real estate CRM.',
          '',
          'Create exactly six premium property-highlight cards.',
          '',
          'Use only facts supported by the supplied listing record, extracted public MLS data, and visible listing photographs.',
          '',
          'Rules:',
          '- Inspect every supplied photograph before choosing any marketing themes.',
          '- Determine what room, exterior area, view, or property feature each photograph visibly depicts.',
          '- The selected photograph must directly and clearly show the main subject named in the card headline.',
          '- Never pair a kitchen photograph with a bathroom card, a bathroom photograph with a living-area card, or an exterior photograph with an interior-feature card.',
          '- Use six different photo_media_id values. Never reuse the same photograph for multiple cards.',
          '- If no supplied photograph clearly supports a potential theme, do not create that theme. Choose another strongly supported feature instead.',
          '- Each card must contain one coherent marketing theme. Every bullet must directly support that card headline.',
          '- Do not mix unrelated items such as community amenities, air conditioning, and garage features inside one card.',
          '- Prefer specific factual language over generic claims such as spectacular, luxurious, comfortable, premium, elegant, or ideal.',
          '- Do not create a generic city or location card. Views may be highlighted only when visible in the photograph and supported by the listing facts.',
          '- Never invent, assume, or exaggerate a property feature.',
          '- Materials, appliance brands, garage configuration, community amenities, renovations, dimensions, and view descriptions must be supported by verified listing facts before they are stated.',
          '- A photograph may support a verified written fact, but the photograph alone must not be used to guess a hidden material, measurement, brand, community amenity, or property condition.',
          '- Do not include school quality, neighborhood demographics, protected-class language, safety claims, investment guarantees, or subjective buyer-profile language.',
          '- Do not mention nearby destinations, travel times, or school assignments. Those are researched separately.',
          '- Choose the strongest six distinct property themes and avoid overlapping cards.',
          '- Strong themes may include views and setting, architecture and layout, kitchen features, primary suite or bathroom, outdoor living, garage or utility features, or photographed community amenities when actually supported.',
          '- Keep headlines concise, specific, and polished.',
          '- Keep summaries factual and approximately two sentences.',
          '- Return two or three short factual bullet points per card.',
          '- Use only photo_media_id values from the supplied photo catalog.',
          '- Put the verified supporting facts used for each card into source_facts.',
          '- Before returning the answer, audit all six cards for photo match, factual support, unique photos, distinct themes, and unrelated bullet points.',
          '',
          'LISTING FACTS:',
          JSON.stringify(
            listingFacts,
            null,
            2
          ),
          '',
          'PHOTO CATALOG:',
          JSON.stringify(
            photoCatalog,
            null,
            2
          ),
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
          'auto',
      });
    }

    const schema = {
      type:
        'object',

      properties: {
        summary: {
          type:
            'string',
        },

        highlights: {
          type:
            'array',

          items: {
            type:
              'object',

            properties: {
              headline: {
                type:
                  'string',
              },

              summary: {
                type:
                  'string',
              },

              bullet_points: {
                type:
                  'array',

                items: {
                  type:
                    'string',
                },
              },

              photo_media_id: {
                anyOf: [
                  {
                    type:
                      'string',
                  },
                  {
                    type:
                      'null',
                  },
                ],
              },

              source_facts: {
                type:
                  'array',

                items: {
                  type:
                    'string',
                },
              },
            },

            required: [
              'headline',
              'summary',
              'bullet_points',
              'photo_media_id',
              'source_facts',
            ],

            additionalProperties:
              false,
          },
        },
      },

      required: [
        'summary',
        'highlights',
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

                  content,
                },
              ],

              text: {
                format: {
                  type:
                    'json_schema',

                  name:
                    'listing_website_highlights',

                  strict:
                    true,

                  schema,
                },
              },

              max_output_tokens:
                5000,
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
      throw new ListingResearchError(
        openAiPayload
          ?.error
          ?.message ||
          'OpenAI listing website research failed.',
        502,
        'openai_research_failed'
      );
    }

    const outputText =
      getOutputText(
        openAiPayload
      );

    if (!outputText) {
      throw new ListingResearchError(
        'Samantha did not return listing website research.',
        502,
        'openai_output_missing'
      );
    }

    let generated:
      Record<string, unknown>;

    try {
      generated =
        JSON.parse(
          outputText
        );
    }
    catch {
      throw new ListingResearchError(
        'Samantha returned invalid listing website research.',
        502,
        'openai_output_invalid'
      );
    }

    const highlights =
      normalizeHighlights(
        generated.highlights,
        photos
      );

    const samanthaSummary =
      cleanText(
        generated.summary,
        2000
      );

    const {
      error:
        highlightDeleteError,
    } = await supabaseAdmin
      .from(
        'listing_website_highlights'
      )
      .delete()
      .eq(
        'listing_id',
        listing.id
      )
      .eq(
        'manual_override',
        false
      );

    if (
      highlightDeleteError
    ) {
      throw new ListingResearchError(
        highlightDeleteError.message,
        500,
        'old_highlights_delete_failed'
      );
    }

    const {
      data:
        savedHighlights,
      error:
        highlightInsertError,
    } = await supabaseAdmin
      .from(
        'listing_website_highlights'
      )
      .insert(
        highlights.map(
          (highlight) => ({
            ...highlight,

            listing_id:
              listing.id,

            org_id:
              listing.org_id,

            owner_user_id:
              listing.owner_user_id,

            created_by:
              requester.id,

            updated_by:
              requester.id,
          })
        )
      )
      .select(`
        id,
        listing_id,
        photo_media_id,
        headline,
        summary,
        bullet_points,
        source_facts,
        sort_order,
        is_visible,
        manual_override
      `)
      .order(
        'sort_order',
        {
          ascending:
            true,
        }
      );

    if (
      highlightInsertError
    ) {
      throw new ListingResearchError(
        highlightInsertError.message,
        500,
        'highlight_save_failed'
      );
    }

    const {
      error:
        oldSourceDeleteError,
    } = await supabaseAdmin
      .from(
        'listing_website_sources'
      )
      .delete()
      .eq(
        'listing_id',
        listing.id
      )
      .in(
        'source_type',
        [
          'listing_record',
          'listing_document',
          'listing_media',
        ]
      );

    if (
      oldSourceDeleteError
    ) {
      throw new ListingResearchError(
        oldSourceDeleteError.message,
        500,
        'old_sources_delete_failed'
      );
    }

    const sourceRows:
      Array<
        Record<string, unknown>
      > = [
      {
        listing_id:
          listing.id,

        org_id:
          listing.org_id,

        owner_user_id:
          listing.owner_user_id,

        source_type:
          'listing_record',

        source_label:
          'Confirmed CRM listing record',

        source_identifier:
          listing.id,

        verification_status:
          'verified',

        source_metadata: {
          input_hash:
            inputHash,

          listing_review_status:
            listing.review_status,

          source_last_refreshed_at:
            listing
              .source_last_refreshed_at,
        },

        retrieved_at:
          now,

        created_by:
          requester.id,
      },

      {
        listing_id:
          listing.id,

        org_id:
          listing.org_id,

        owner_user_id:
          listing.owner_user_id,

        source_type:
          'listing_media',

        source_label:
          `${photos.length} approved marketing photographs`,

        source_identifier:
          listing.id,

        verification_status:
          'verified',

        source_metadata: {
          photo_ids:
            photos.map(
              (photo) =>
                photo.id
            ),
        },

        retrieved_at:
          now,

        created_by:
          requester.id,
      },
    ];

    if (document) {
      sourceRows.push({
        listing_id:
          listing.id,

        org_id:
          listing.org_id,

        owner_user_id:
          listing.owner_user_id,

        source_type:
          'listing_document',

        source_label:
          document.file_name ||
          'Extracted client-detail MLS document',

        source_identifier:
          document.id,

        verification_status:
          'verified',

        source_metadata: {
          extracted_at:
            document.extracted_at,
        },

        retrieved_at:
          now,

        created_by:
          requester.id,
      });
    }

    const {
      error:
        sourceInsertError,
    } = await supabaseAdmin
      .from(
        'listing_website_sources'
      )
      .insert(
        sourceRows
      );

    if (
      sourceInsertError
    ) {
      throw new ListingResearchError(
        sourceInsertError.message,
        500,
        'research_source_save_failed'
      );
    }

    const {
      data:
        enrichmentData,
      error:
        enrichmentSaveError,
    } = await supabaseAdmin
      .from(
        'listing_website_enrichment'
      )
      .upsert(
        {
          listing_id:
            listing.id,

          org_id:
            listing.org_id,

          owner_user_id:
            listing.owner_user_id,

          status:
            'needs_review',

          research_version:
            researchVersion,

          input_hash:
            inputHash,

          samantha_summary:
            samanthaSummary ||
            'Samantha prepared six property highlights for agent review.',

          research_notes:
            'Property highlights were generated from the confirmed listing record, extracted public MLS data, and approved listing photographs.',

          research_error:
            null,

          generation_model:
            model,

          source_last_refreshed_at:
            now,

          researched_at:
            now,

          approved_at:
            null,

          approved_by:
            null,

          created_by:
            requester.id,
        },
        {
          onConflict:
            'listing_id',
        }
      )
      .select(`
        id,
        listing_id,
        status,
        research_version,
        input_hash,
        samantha_summary,
        generation_model,
        researched_at
      `)
      .single();

    if (
      enrichmentSaveError
    ) {
      throw new ListingResearchError(
        enrichmentSaveError.message,
        500,
        'enrichment_save_failed'
      );
    }

    return jsonResponse({
      ok:
        true,

      message:
        'Samantha prepared six property highlights for review.',

      enrichment:
        enrichmentData,

      highlights:
        savedHighlights ||
        [],
    });
  }
  catch (
    error: unknown
  ) {
    console.error(
      'Listing website research error:',
      error
    );

    if (
      listingForFailure
        ?.owner_user_id
    ) {
      await supabaseAdmin
        .from(
          'listing_website_enrichment'
        )
        .upsert(
          {
            listing_id:
              listingForFailure.id,

            org_id:
              listingForFailure.org_id,

            owner_user_id:
              listingForFailure
                .owner_user_id,

            status:
              'failed',

            research_error:
              error instanceof Error
                ? error.message
                : 'Listing website research failed.',
          },
          {
            onConflict:
              'listing_id',
          }
        );
    }

    return jsonResponse(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Listing website research failed.',

        code:
          responseCode(
            error
          ),
      },
      responseStatus(
        error
      )
    );
  }
}
