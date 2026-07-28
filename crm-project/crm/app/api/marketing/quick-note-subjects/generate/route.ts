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

const AUDIENCES = [
  'reverse_prospecting_realtor',
  'realtor',
  'lender',
  'title_escrow',
  'professional',
  'active_client',
  'past_client',
  'sphere',
  'vendor_partner',
  'prospect',
  'unknown',
] as const;
type Audience =
  (typeof AUDIENCES)[number];

type ListingRow = {
  id: string;
  org_id: string;

  owner_user_id:
    | string
    | null;

  title:
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

  campaign_headline:
    | string
    | null;

  short_marketing_description:
    | string
    | null;

  public_remarks:
    | string
    | null;

  description:
    | string
    | null;

  bedrooms:
    | number
    | null;

  bathrooms:
    | number
    | null;

  square_feet:
    | number
    | null;

  acres:
    | number
    | null;

  lot_size_text:
    | string
    | null;
};

type SubjectOption = {
  subject: string;
  preview_text: string;
  reason: string;
};

class SubjectGenerationError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 400,
    code = 'subject_generation_error'
  ) {
    super(message);

    this.name =
      'SubjectGenerationError';

    this.status =
      status;

    this.code =
      code;
  }
}

const AUDIENCE_GUIDANCE:
  Record<Audience, string> = {
    reverse_prospecting_realtor:
      'A Realtor whose verified listing-specific buyer-search data may align with the listing. Use cautious language such as may, might or could. Never claim that a confirmed buyer exists.',

    realtor:
      'A Realtor who may know or represent a buyer. Make the subject professionally useful and easy to understand.',

    lender:
      'A lender or mortgage professional who may know a client or agent connection for the property.',

    title_escrow:
      'A title or escrow professional who may know a client, agent or industry contact connected to a possible buyer. Keep the wording professional and relationship-appropriate.',

    professional:
      'A professional contact who may know someone in their professional network. Do not assume that they work in real estate unless the supplied facts say so.',

    active_client:
      'A current Buyer, Seller or Buyer & Seller consumer client. Speak directly to the recipient about whether the property fits their own needs, priorities or search. Never treat them as an agent, referral source, business partner or pipeline.',

    past_client:
      'A past or closed client. The tone should feel warm, familiar and referral-oriented without sounding salesy.',

    sphere:
      'A personal sphere contact who may know someone suited to the property.',

    vendor_partner:
      'A professional vendor or partner who may know someone in their network.',

    prospect:
      'A prospective consumer or potential buyer. Speak directly to the recipient about whether the property could fit them. Never treat them as an agent, referral source, business partner or pipeline.',

    unknown:
      'An Other / General Contact or a contact whose relationship is not reliably classified. Use safe, general and non-assumptive wording.',
  };
function cleanText(
  value: unknown,
  maxLength = 500
): string {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .slice(
      0,
      maxLength
    );
}

function shortenAtWord(
  value: string,
  maxLength: number
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value;
  }

  const portion =
    value.slice(
      0,
      maxLength + 1
    );

  const lastSpace =
    portion.lastIndexOf(
      ' '
    );

  return (
    lastSpace >=
    Math.floor(
      maxLength * 0.65
    )
      ? portion.slice(
          0,
          lastSpace
        )
      : portion.slice(
          0,
          maxLength
        )
  ).trim();
}

function cleanPunctuation(
  value: string
): string {
  return value
    .replace(
      /\s+([,.;:!?])/g,
      '$1'
    )
    .replace(
      /([!?])\1+/g,
      '$1'
    )
    .replace(
      /!\?/g,
      '?'
    )
    .replace(
      /\?!/g,
      '?'
    )
    .trim();
}

function looksLikeQuestion(
  value: string
): boolean {
  return /^(any|are|can|could|did|do|does|has|have|how|is|should|what|when|where|who|why|will|would)\b/i.test(
    value
  );
}

function normalizeSubject(
  value: unknown
): string {
  let subject =
    cleanPunctuation(
      cleanText(
        value,
        120
      )
    );

  subject =
    shortenAtWord(
      subject,
      68
    );

  if (
    looksLikeQuestion(
      subject
    )
  ) {
    subject =
      subject.replace(
        /[.!?]+$/g,
        ''
      ) + '?';
  }
  else {
    subject =
      subject
        .replace(
          /!+$/g,
          ''
        )
        .replace(
          /\.+$/g,
          ''
        );
  }

  return subject.trim();
}

function normalizePreviewText(
  value: unknown
): string {
  let preview =
    cleanPunctuation(
      cleanText(
        value,
        180
      )
    );

  preview =
    shortenAtWord(
      preview,
      120
    );

  if (
    preview &&
    !/[.!?]$/.test(
      preview
    )
  ) {
    preview += '.';
  }

  return preview;
}

function normalizeReason(
  value: unknown
): string {
  let reason =
    cleanPunctuation(
      cleanText(
        value,
        380
      )
    );

  reason =
    shortenAtWord(
      reason,
      320
    );

  if (
    reason &&
    !/[.!?]$/.test(
      reason
    )
  ) {
    reason += '.';
  }

  return reason;
}

function getOutputText(
  payload: any
): string {
  if (
    typeof payload
      ?.output_text ===
    'string'
  ) {
    return payload
      .output_text
      .trim();
  }

  const output =
    Array.isArray(
      payload?.output
    )
      ? payload.output
      : [];

  for (
    const item of output
  ) {
    const content =
      Array.isArray(
        item?.content
      )
        ? item.content
        : [];

    for (
      const part of content
    ) {
      if (
        typeof part?.text ===
        'string'
      ) {
        return part
          .text
          .trim();
      }
    }
  }

  return '';
}

function canManageListing(
  profile: {
    id: string;
    org_id: string;
    role: string;
  },
  listing: ListingRow
): boolean {
  if (
    profile.role ===
    'platform_admin'
  ) {
    return true;
  }

  if (
    profile.org_id !==
    listing.org_id
  ) {
    return false;
  }

  if (
    profile.role ===
      'admin' ||
    profile.role ===
      'org_admin'
  ) {
    return true;
  }

  return (
    profile.role ===
      'agent' &&
    listing.owner_user_id ===
      profile.id
  );
}

function responseStatus(
  error: unknown
): number {
  if (
    error instanceof
    SubjectGenerationError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function responseCode(
  error: unknown
): string {
  if (
    error instanceof
    SubjectGenerationError
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
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    const body =
      await request
        .json()
        .catch(
          () => null
        ) as
          | Record<
              string,
              unknown
            >
          | null;

    const listingId =
      cleanText(
        body?.listing_id,
        100
      );

    const requestedAudience =
      cleanText(
        body?.audience,
        100
      );

    const requestedEdition =
      cleanText(
        body?.luxury_edition,
        100
      ) ||
      'launch';

    const editionHeadline =
      cleanText(
        body?.edition_headline,
        240
      );

    const editionBody =
      cleanText(
        body?.edition_body,
        1400
      );

    const editionGuidance =
      (
        {
          launch:
            'Luxury Launch is the complete first impression and strongest overall introduction.',

          views_lifestyle:
            'Views & Lifestyle focuses on verified setting, scenery, outdoor spaces and lifestyle.',

          design_interiors:
            'Design & Interiors focuses on verified finishes, kitchens, living areas, suites and interior flow.',

          property_in_motion:
            'Property in Motion focuses on how the residence flows and is experienced while moving through it.',

          closer_look:
            'A Closer Look focuses on useful details, specialty rooms and overlooked property features.',

          agent_spotlight:
            'Agent Spotlight highlights practical buyer-fit features and reasons the property deserves a closer review. Adapt the wording to the recipient relationship and never assume the recipient is a real-estate professional.',

          fresh_opportunity:
            'Fresh Opportunity presents a new marketing angle without claiming that the listing itself is new.',
        } as
          Record<
            string,
            string
          >
      )[
        requestedEdition
      ] ||
      'Match the subject and preview text to the supplied edition headline and body.';

    if (!listingId) {
      throw new SubjectGenerationError(
        'A listing is required before Samantha can prepare subject lines.',
        400,
        'listing_required'
      );
    }

    if (
      !AUDIENCES.includes(
        requestedAudience as
          Audience
      )
    ) {
      throw new SubjectGenerationError(
        'Select a valid contact relationship before generating subject lines.',
        400,
        'audience_invalid'
      );
    }

    const audience =
      requestedAudience as
        Audience;

    const {
      data:
        listingData,

      error:
        listingError,
    } =
      await supabaseAdmin
        .from(
          'listings'
        )
        .select(`
          id,
          org_id,
          owner_user_id,
          title,
          property_address,
          city,
          state,
          zip,
          mls_number,
          list_price,
          listing_status,
          campaign_headline,
          short_marketing_description,
          public_remarks,
          description,
          bedrooms,
          bathrooms,
          square_feet,
          acres,
          lot_size_text
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
      throw new SubjectGenerationError(
        listingError?.message ||
          'Listing not found.',
        404,
        'listing_not_found'
      );
    }

    const listing =
      listingData as
        ListingRow;

    if (
      !canManageListing(
        profile,
        listing
      )
    ) {
      throw new RequestAuthError(
        'You do not have access to generate marketing subjects for this listing.',
        403
      );
    }

    const apiKey =
      process.env
        .OPENAI_API_KEY;

    if (!apiKey) {
      throw new SubjectGenerationError(
        'OPENAI_API_KEY is not configured.',
        500,
        'openai_key_missing'
      );
    }

    const model =
      process.env
        .OPENAI_QUICK_NOTE_SUBJECT_MODEL ||
      process.env
        .OPENAI_LISTING_MARKETING_MODEL ||
      process.env
        .OPENAI_LISTING_WEBSITE_MODEL ||
      'gpt-4.1-mini';

    const listingFacts = {
      title:
        listing.title,

      property_address:
        listing
          .property_address,

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
        listing
          .listing_status,

      campaign_headline:
        listing
          .campaign_headline,

      short_marketing_description:
        listing
          .short_marketing_description,

      public_remarks:
        listing
          .public_remarks,

      description:
        listing.description,

      bedrooms:
        listing.bedrooms,

      bathrooms:
        listing.bathrooms,

      square_feet:
        listing.square_feet,

      acres:
        listing.acres,

      lot_size_text:
        listing
          .lot_size_text,
    };

    const schema = {
      type:
        'object',

      properties: {
        options: {
          type:
            'array',

          items: {
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

              reason: {
                type:
                  'string',
              },
            },

            required: [
              'subject',
              'preview_text',
              'reason',
            ],

            additionalProperties:
              false,
          },
        },

        recommended_index: {
          type:
            'integer',
        },
      },

      required: [
        'options',
        'recommended_index',
      ],

      additionalProperties:
        false,
    };

    const prompt = [
      'You are Samantha, the email marketing assistant inside a real estate CRM.',
      '',
      'Generate exactly three distinct email subject-line and inbox-preview-text pairs for a short personal follow-up about this listing.',
      '',
      'The subject line is crucial. Select language that is likely to earn attention from this specific relationship category while remaining honest, natural and professional.',
      '',
      'AUDIENCE:',
      audience,
      '',
      'AUDIENCE GUIDANCE:',
      AUDIENCE_GUIDANCE[
        audience
      ],
      '',
      'RELATIONSHIP MODE:',
      audience ===
        'active_client'
        ? 'Direct consumer client. Write to the recipient about their own possible fit.'
        : audience ===
            'prospect'
          ? 'Direct prospective consumer. Write to the recipient about whether the property may fit them.'
          : audience ===
                'title_escrow'
            ? 'Title or escrow professional relationship. Use professional client, agent or industry-network wording.'
            : audience ===
                  'professional'
              ? 'General professional relationship. Use professional-network wording without assuming a real-estate role.'
              : 'Professional, referral or general relationship. Follow the audience guidance above.',
      '',
      'RELATIONSHIP SAFETY RULES:',
      '- Active Client and Prospect are consumers, not professional referral partners.',
      '- For Active Client and Prospect, never mention their pipeline, buyers, clients, agent network, professional network or referrals.',
      '- For Active Client and Prospect, never ask whether they know someone who may fit.',
      '- For Active Client and Prospect, speak directly about their own needs, priorities, search, lifestyle or possible interest.',
      '- Title / Escrow and Professional are professional-network relationships, not direct consumer categories.',
      '- Professional or referral wording may only be used for categories where it genuinely fits.',
      '',
      'EMAIL EDITION:',
      requestedEdition,
      '',
      'EMAIL EDITION GUIDANCE:',
      editionGuidance,
      '',
      'CURRENT EDITION HEADLINE:',
      editionHeadline ||
        '(No edition headline supplied.)',
      '',
      'CURRENT EDITION BODY:',
      editionBody ||
        '(No edition body supplied.)',
      '',
      'FOLLOW-UP PARAGRAPH RULES:',
      '- In each option, the reason field is not internal analysis. It is the exact recipient-facing paragraph that will appear in the Quick Note.',
      '- Write one or two natural sentences, generally 28 to 55 words.',
      '- Persuasively explain why the primary property email deserves a look for this specific edition and recipient category.',
      '- For Active Client and Prospect, write directly to the recipient as the possible customer or buyer.',
      '- For Active Client and Prospect, never use pipeline, your buyers, your clients, your network, referrals or someone you know.',
      '- For Active Client and Prospect, explain why the property may fit their own needs, lifestyle, priorities or search.',
      '- Use the current edition headline, current edition body and verified listing facts.',
      '- Do not invent, exaggerate or assume any property feature that is not supported by the supplied facts.',
      '- Never use the words edition, angle, campaign, template, software, AI or Samantha in the recipient-facing paragraph.',
      '- Do not explain why the subject line works.',
      '- Keep the tone personal, useful and conversational rather than promotional or robotic.',
      '',
      'SUBJECT RULES:',
      '- Keep every subject and inbox preview aligned with this exact email edition and its property angle.',
      '- Do not drift into the angle of another edition.',
      '- Return exactly three distinct options.',
      '- Option 1 should be your strongest overall recommendation.',
      '- Aim for approximately 28 to 58 characters when practical. Never exceed 68 characters.',
      '- Use correct punctuation.',
      '- A subject written as a question must end with exactly one question mark.',
      '- Use apostrophes, contractions, hyphens and capitalization correctly.',
      '- Do not use stacked punctuation such as !!, ?? or !?.',
      '- Do not use exclamation marks in the subject.',
      '- Do not use emojis in the subject.',
      '- Do not use all caps.',
      '- Do not use fake urgency, misleading curiosity, clickbait or spam phrases.',
      '- Do not write Free, Act Now, Last Chance, Guaranteed, Urgent or similar language.',
      '- Do not claim that a buyer match exists unless the audience is reverse_prospecting_realtor, and even then use cautious may/might/could language.',
      '- Use only facts supplied below.',
      '- Vary the three approaches: relationship relevance, strongest listing hook, and an easy audience-appropriate question.',
      '',
      'PREVIEW-TEXT RULES:',
      '- Each preview must complement its subject rather than repeat it.',
      '- Aim for approximately 70 to 120 characters.',
      '- Use complete, correctly punctuated sentences.',
      '- Keep the tone personal, upbeat and easy to reply to.',
      '- No emojis, fake urgency or unsupported claims.',
      '',
      'REASON RULES:',
      '- Briefly explain why each option fits this audience.',
      '- Use one concise, correctly punctuated sentence.',
      '',
      'LISTING FACTS:',
      JSON.stringify(
        listingFacts,
        null,
        2
      ),
    ].join(
      '\n'
    );

    const headers:
      Record<
        string,
        string
      > = {
        Authorization:
          `Bearer ${apiKey}`,

        'Content-Type':
          'application/json',
      };

    const projectId =
      process.env
        .OPENAI_PROJECT_ID
        ?.trim();

    if (projectId) {
      headers[
        'OpenAI-Project'
      ] = projectId;
    }

    const organizationId =
      process.env
        .OPENAI_ORGANIZATION_ID
        ?.trim();

    if (organizationId) {
      headers[
        'OpenAI-Organization'
      ] = organizationId;
    }

    const openAiResponse =
      await fetch(
        'https://api.openai.com/v1/responses',
        {
          method:
            'POST',

          headers,

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

                      text:
                        prompt,
                    },
                  ],
                },
              ],

              text: {
                format: {
                  type:
                    'json_schema',

                  name:
                    'quick_note_subject_recommendations',

                  strict:
                    true,

                  schema,
                },
              },

              max_output_tokens:
                1000,
            }),
        }
      );

    const openAiPayload:
      any =
      await openAiResponse
        .json()
        .catch(
          () => ({})
        );

    if (
      !openAiResponse.ok
    ) {
      throw new SubjectGenerationError(
        openAiPayload
          ?.error
          ?.message ||
          'Samantha could not generate subject-line recommendations.',
        502,
        'openai_subject_generation_failed'
      );
    }

    const outputText =
      getOutputText(
        openAiPayload
      );

    if (!outputText) {
      throw new SubjectGenerationError(
        'Samantha returned no subject-line recommendations.',
        502,
        'openai_output_missing'
      );
    }

    let generated:
      any;

    try {
      generated =
        JSON.parse(
          outputText
        );
    }
    catch {
      throw new SubjectGenerationError(
        'Samantha returned invalid subject-line recommendations.',
        502,
        'openai_output_invalid'
      );
    }

    const rawOptions =
      Array.isArray(
        generated?.options
      )
        ? generated.options
        : [];

    const normalizedOptions:
      SubjectOption[] =
      rawOptions
        .map(
          (
            row: any
          ): SubjectOption => ({
            subject:
              normalizeSubject(
                row?.subject
              ),

            preview_text:
              normalizePreviewText(
                row
                  ?.preview_text
              ),

            reason:
              normalizeReason(
                row?.reason
              ),
          })
        )
        .filter(
          (
            row: SubjectOption
          ) =>
            Boolean(
              row.subject &&
              row.preview_text &&
              row.reason
            )
        );

    const uniqueOptions:
      SubjectOption[] = [];

    const seenSubjects =
      new Set<string>();

    for (
      const option of
      normalizedOptions
    ) {
      const key =
        option.subject
          .toLowerCase();

      if (
        seenSubjects.has(
          key
        )
      ) {
        continue;
      }

      seenSubjects.add(
        key
      );

      uniqueOptions.push(
        option
      );

      if (
        uniqueOptions.length ===
        3
      ) {
        break;
      }
    }

    if (
      uniqueOptions.length !==
      3
    ) {
      throw new SubjectGenerationError(
        'Samantha did not return three usable and distinct subject-line options.',
        502,
        'subject_options_incomplete'
      );
    }

    const requestedIndex =
      Number(
        generated
          ?.recommended_index
      );

    const recommendedIndex =
      Number.isInteger(
        requestedIndex
      ) &&
      requestedIndex >= 0 &&
      requestedIndex < 3
        ? requestedIndex
        : 0;

    return NextResponse.json(
      {
        ok:
          true,

        audience,

        options:
          uniqueOptions,

        recommended_index:
          recommendedIndex,

        model,
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
    const message =
      error instanceof Error
        ? error.message
        : 'Samantha subject generation failed.';

    if (
      !(
        error instanceof
        RequestAuthError
      )
    ) {
      console.error(
        'Samantha quick-note subject generation error:',
        error
      );
    }

    return NextResponse.json(
      {
        ok:
          false,

        error:
          message,

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
      }
    );
  }
}