export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

type Role =
  | 'agent'
  | 'admin'
  | 'org_admin'
  | 'platform_admin';

type ProfileRow = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
};

type DocumentRow = {
  id: string;
  intake_session_id: string;
  listing_id: string | null;

  org_id: string;
  owner_user_id: string;

  storage_bucket: string;
  storage_path: string;

  file_name: string;
  mime_type: string | null;

  extraction_status: string;
};

const ALLOWED_LISTING_STATUSES = new Set([
  'draft',
  'coming_soon',
  'active',
  'pending',
  'sold',
  'withdrawn',
  'expired',
  'cancelled',
]);

function getSupabaseAuthClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      'Missing env: NEXT_PUBLIC_SUPABASE_URL'
    );
  }

  if (!anonKey) {
    throw new Error(
      'Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function canManageDocument(
  requester: ProfileRow,
  document: DocumentRow
) {
  if (requester.role === 'platform_admin') {
    return true;
  }

  if (
    requester.role === 'admin' ||
    requester.role === 'org_admin'
  ) {
    return (
      Boolean(requester.org_id) &&
      requester.org_id === document.org_id
    );
  }

  return (
    requester.role === 'agent' &&
    requester.id === document.owner_user_id &&
    requester.org_id === document.org_id
  );
}

function getOutputText(payload: any) {
  for (const item of payload?.output || []) {
    if (item?.type !== 'message') {
      continue;
    }

    for (const content of item?.content || []) {
      if (
        content?.type === 'output_text' &&
        typeof content?.text === 'string'
      ) {
        return content.text;
      }
    }
  }

  return null;
}

function normalizeStatus(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!ALLOWED_LISTING_STATUSES.has(normalized)) {
    return null;
  }

  return normalized;
}

export async function POST(req: NextRequest) {
  let documentRow: DocumentRow | null = null;

  try {
    const authorization =
      req.headers.get('authorization') || '';

    const token =
      authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : null;

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const authClient =
      getSupabaseAuthClient();

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: requester,
      error: requesterError,
    } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, org_id')
      .eq('id', user.id)
      .single();

    if (requesterError || !requester) {
      return NextResponse.json(
        {
          ok: false,
          error:
            requesterError?.message ||
            'CRM profile not found.',
        },
        {
          status: 403,
        }
      );
    }

    const typedRequester =
      requester as ProfileRow;

    const body = await req.json();

    const documentId =
      typeof body?.document_id === 'string'
        ? body.document_id
        : '';

    if (!documentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'A listing document ID is required.',
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: storedDocument,
      error: documentError,
    } = await supabaseAdmin
      .from('listing_documents')
      .select(`
        id,
        intake_session_id,
        listing_id,
        org_id,
        owner_user_id,
        storage_bucket,
        storage_path,
        file_name,
        mime_type,
        extraction_status
      `)
      .eq('id', documentId)
      .single();

    if (
      documentError ||
      !storedDocument
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            documentError?.message ||
            'Listing document not found.',
        },
        {
          status: 404,
        }
      );
    }

    documentRow =
      storedDocument as DocumentRow;

    if (
      !canManageDocument(
        typedRequester,
        documentRow
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'You do not have access to this listing document.',
        },
        {
          status: 403,
        }
      );
    }

    const openAiApiKey =
      process.env.OPENAI_API_KEY;

    if (!openAiApiKey) {
      throw new Error(
        'Missing env: OPENAI_API_KEY'
      );
    }

    await supabaseAdmin
      .from('listing_documents')
      .update({
        extraction_status: 'processing',
        extraction_error: null,
      })
      .eq('id', documentRow.id);

    await supabaseAdmin
      .from('listing_intake_sessions')
      .update({
        status: 'extracting',
      })
      .eq(
        'id',
        documentRow.intake_session_id
      );

    const {
      data: pdfBlob,
      error: downloadError,
    } = await supabaseAdmin.storage
      .from(documentRow.storage_bucket)
      .download(documentRow.storage_path);

    if (downloadError || !pdfBlob) {
      throw new Error(
        downloadError?.message ||
        'Could not download the private MLS PDF.'
      );
    }

    const pdfBuffer = Buffer.from(
      await pdfBlob.arrayBuffer()
    );

    const base64Pdf =
      pdfBuffer.toString('base64');

    const nullableString = {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    };

    const nullableNumber = {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    };

    const nullableInteger = {
      anyOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
      ],
    };

    const schema = {
      type: 'object',

      properties: {
        title: nullableString,
        property_type: nullableString,

        property_address: nullableString,
        city: nullableString,
        state: nullableString,
        zip: nullableString,

        mls_number: nullableString,
        list_price: nullableNumber,
        listing_status: nullableString,
        list_date: nullableString,

        bedrooms: nullableNumber,
        bathrooms: nullableNumber,
        levels: nullableString,
        garage_spaces: nullableInteger,
        square_feet: nullableInteger,
        year_built: nullableInteger,

        lot_size_text: nullableString,
        acres: nullableNumber,

        county: nullableString,
        subdivision: nullableString,

        school_district: nullableString,
        elementary_school: nullableString,
        middle_school: nullableString,
        high_school: nullableString,

        hoa_fee: nullableNumber,
        hoa_frequency: nullableString,
        hoa_setup_fee: nullableNumber,

        annual_taxes: nullableNumber,
        tax_year: nullableInteger,

        parcel_number: nullableString,
        legal_description: nullableString,

        inclusions: nullableString,
        exclusions: nullableString,
        directions: nullableString,

        features: {
          type: 'array',
          items: {
            type: 'string',
          },
        },

        public_remarks: nullableString,

        public_url: nullableString,
        virtual_tour_url: nullableString,
        open_house_info: nullableString,

        campaign_headline: nullableString,

        short_marketing_description:
          nullableString,

        confidence_notes: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },

      required: [
        'title',
        'property_type',

        'property_address',
        'city',
        'state',
        'zip',

        'mls_number',
        'list_price',
        'listing_status',
        'list_date',

        'bedrooms',
        'bathrooms',
        'levels',
        'garage_spaces',
        'square_feet',
        'year_built',

        'lot_size_text',
        'acres',

        'county',
        'subdivision',

        'school_district',
        'elementary_school',
        'middle_school',
        'high_school',

        'hoa_fee',
        'hoa_frequency',
        'hoa_setup_fee',

        'annual_taxes',
        'tax_year',

        'parcel_number',
        'legal_description',

        'inclusions',
        'exclusions',
        'directions',

        'features',

        'public_remarks',

        'public_url',
        'virtual_tour_url',
        'open_house_info',

        'campaign_headline',

        'short_marketing_description',

        'confidence_notes',
      ],

      additionalProperties: false,
    };

    const model =
      process.env
        .OPENAI_LISTING_EXTRACTION_MODEL ||
      'gpt-4.1-mini';

    const openAiResponse = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${openAiApiKey}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          model,
          store: false,

          input: [
            {
              role: 'user',

              content: [
                {
                  type: 'input_file',

                  filename:
                    documentRow.file_name,

                  file_data:
                    `data:application/pdf;base64,${base64Pdf}`,

                  detail: 'high',
                },

                {
                  type: 'input_text',

                  text: [
                    'You are Samantha, the listing-intake assistant for a real estate CRM.',
                    '',
                    'Extract the public property and marketing facts from this client-detail MLS PDF.',
                    '',
                    'Rules:',
                    '- Never invent a fact.',
                    '- Return null when a field is missing or uncertain.',
                    '- Do not return confidential agent remarks, showing instructions, lockbox details, tenant information, or private seller information.',
                    '- Preserve the public listing remarks accurately, correcting only obvious PDF line-break problems.',
                    '- Return dates as YYYY-MM-DD.',
                    '- Return prices, taxes, fees, acreage, bedrooms, and bathrooms as numbers without currency symbols or commas.',
                    '- Normalize listing status to one of: draft, coming_soon, active, pending, sold, withdrawn, expired, cancelled.',
                    '- The title and campaign headline may be concise factual marketing titles based only on information in the PDF.',
                    '- The short marketing description must be factual and shorter than the full public remarks.',
                    '- Features should be a clean list of useful public property features.',
                    '- Put any questionable extraction into confidence_notes.',
                  ].join('\n'),
                },
              ],
            },
          ],

          text: {
            format: {
              type: 'json_schema',
              name: 'listing_intake',
              strict: true,
              schema,
            },
          },

          max_output_tokens: 6000,
        }),
      }
    );

    const openAiPayload =
      await openAiResponse.json();

    if (!openAiResponse.ok) {
      throw new Error(
        openAiPayload?.error?.message ||
        'OpenAI listing extraction failed.'
      );
    }

    const outputText =
      getOutputText(openAiPayload);

    if (!outputText) {
      throw new Error(
        'Samantha did not return listing data.'
      );
    }

    const extracted =
      JSON.parse(outputText);

    extracted.listing_status =
      normalizeStatus(
        extracted.listing_status
      );

    await supabaseAdmin
      .from('listing_documents')
      .update({
        extraction_status: 'completed',
        extracted_data: extracted,
        extraction_model: model,
        extraction_error: null,
        extracted_at:
          new Date().toISOString(),
      })
      .eq('id', documentRow.id);

    await supabaseAdmin
      .from('listing_intake_sessions')
      .update({
        status: 'needs_review',
        extracted_data: extracted,
      })
      .eq(
        'id',
        documentRow.intake_session_id
      );

    return NextResponse.json({
      ok: true,
      document_id: documentRow.id,
      intake_session_id:
        documentRow.intake_session_id,
      model,
      extracted,
    });
  } catch (error: any) {
    console.error(
      'Listing extraction error:',
      error
    );

    if (documentRow) {
      await supabaseAdmin
        .from('listing_documents')
        .update({
          extraction_status: 'failed',

          extraction_error:
            error?.message ||
            'Listing extraction failed.',
        })
        .eq('id', documentRow.id);

      await supabaseAdmin
        .from('listing_intake_sessions')
        .update({
          status: 'needs_review',
        })
        .eq(
          'id',
          documentRow.intake_session_id
        );
    }

    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          'Listing extraction failed.',
      },
      {
        status: 500,
      }
    );
  }
}
