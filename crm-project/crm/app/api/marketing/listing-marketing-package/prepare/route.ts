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
  template_key: string;
  template_locked: boolean;
  manual_override: boolean;
  generation_version: number;
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

    if (!listingId) {
      throw new MarketingPackageError(
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
          'listing_marketing_sections'
        )
        .select(`
          section_key,
          template_key,
          template_locked,
          manual_override,
          generation_version
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

      inputContent.push({
        type:
          'input_text',

        text:
          `The following image is PHOTO_MEDIA_ID ${photo.id}.`,
      });

      inputContent.push({
        type:
          'input_image',

        image_url:
          imageUrl,

        detail:
          'auto',
      });
    }

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
            },

            cta_label: {
              type:
                'string',
            },
          },

          required: [
            'template_key',
            'photo_media_ids',
            'subject',
            'preview_text',
            'headline',
            'body',
            'cta_label',
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

      const photoIds =
        normalizePhotoIds(
          output.photo_media_ids,
          validPhotoIds
        );

      const content = {
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
      };

      if (
        !existing
          ?.manual_override
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
                'needs_review',

              template_key:
                templateKey,

              template_locked:
                existing
                  ?.template_locked ||
                false,

              content,

              manual_override:
                false,

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
                null,

              approved_by:
                null,

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
          assignmentDeleteError.message,
          500,
          'old_assignment_delete_failed'
        );
      }

      if (
        photoIds.length >
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
            )
          );

        if (
          assignmentInsertError
        ) {
          throw new MarketingPackageError(
            assignmentInsertError.message,
            500,
            'assignment_save_failed'
          );
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
