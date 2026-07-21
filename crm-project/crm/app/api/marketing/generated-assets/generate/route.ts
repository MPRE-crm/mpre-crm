import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../../lib/server/authenticatedProfile";

import {
  supabaseAdmin,
} from "../../../../../lib/supabaseAdmin";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

const MODEL =
  "gpt-image-2";

const STORAGE_BUCKET =
  "generated-marketing-assets";

const ASSET_FORMAT =
  "email_banner";

const PROMPT_VERSION =
  "decorative-email-banner-v1";

const OUTPUT_FORMAT =
  "webp";

const OUTPUT_MIME_TYPE =
  "image/webp";

const OUTPUT_SIZE =
  "1536x1024";

const OUTPUT_WIDTH =
  1536;

const OUTPUT_HEIGHT =
  1024;

const OUTPUT_QUALITY =
  "low";

type Role =
  | "agent"
  | "admin"
  | "org_admin"
  | "platform_admin";

type RequesterRow = {
  id: string;
  name: string | null;
  role: Role;
  org_id: string | null;
};

type ListingRow = {
  id: string;
  org_id: string;
  owner_user_id:
    | string
    | null;

  title: string;

  property_type:
    | string
    | null;

  property_address: string;

  city:
    | string
    | null;

  state:
    | string
    | null;

  campaign_headline:
    | string
    | null;

  short_marketing_description:
    | string
    | null;
};

type CampaignRow = {
  id: string;
  org_id: string;

  owner_user_id:
    | string
    | null;

  listing_id:
    | string
    | null;
};

class GeneratedAssetError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 500,
    code =
      "generated_asset_error"
  ) {
    super(message);

    this.name =
      "GeneratedAssetError";

    this.status =
      status;

    this.code =
      code;
  }
}

function jsonResponse(
  body:
    Record<
      string,
      unknown
    >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function canManageOwnedRecord(
  requester: RequesterRow,
  orgId: string,
  ownerUserId:
    | string
    | null
) {
  if (
    requester.role ===
    "platform_admin"
  ) {
    return true;
  }

  if (
    requester.org_id !==
    orgId
  ) {
    return false;
  }

  if (
    requester.role ===
      "admin" ||
    requester.role ===
      "org_admin"
  ) {
    return true;
  }

  return (
    requester.role ===
      "agent" &&
    requester.id ===
      ownerUserId
  );
}

function normalizeTemplateKey(
  value: unknown
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return [
    "luxury",
    "standard",
    "modern",
    "realtor_blast",
  ].includes(normalized)
    ? normalized
    : "luxury";
}

function templateDirection(
  templateKey: string
) {
  if (
    templateKey ===
    "modern"
  ) {
    return [
      "modern minimalist editorial design",
      "precise architectural geometry",
      "soft white, charcoal and warm neutral tones",
      "clean negative space",
      "restrained premium presentation",
    ].join(", ");
  }

  if (
    templateKey ===
    "standard"
  ) {
    return [
      "polished professional real-estate design",
      "soft architectural shapes",
      "confident blue and neutral tones",
      "welcoming natural light",
      "clean contemporary presentation",
    ].join(", ");
  }

  if (
    templateKey ===
    "realtor_blast"
  ) {
    return [
      "high-impact real-estate editorial design",
      "strong visual rhythm",
      "deep blue, restrained red and crisp neutral tones",
      "energetic but professional presentation",
      "clear negative space",
    ].join(", ");
  }

  return [
    "luxury real-estate editorial design",
    "high-end architectural magazine styling",
    "deep navy, warm ivory and restrained antique-gold tones",
    "soft natural light",
    "elegant contrast",
    "rich but uncluttered visual depth",
  ].join(", ");
}

function cleanColor(
  value: unknown,
  fallback: string
) {
  const color =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return /^#[0-9a-f]{6}$/.test(
    color
  )
    ? color
    : fallback;
}

function openAiErrorMessage(
  payload: unknown
) {
  if (
    typeof payload ===
      "object" &&
    payload !== null &&
    "error" in payload
  ) {
    const apiError =
      (
        payload as {
          error?: {
            message?: unknown;
          };
        }
      ).error;

    if (
      typeof apiError
        ?.message ===
      "string"
    ) {
      return apiError.message;
    }
  }

  return "";
}

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
    GeneratedAssetError
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
    GeneratedAssetError
  ) {
    return error.code;
  }

  if (
    error instanceof
    RequestAuthError
  ) {
    return "authorization_error";
  }

  return "unexpected_error";
}

export async function POST(
  request: Request
) {
  let assetId = "";
  let storagePath = "";
  let provenanceId = "";
  let completed = false;

  try {
    const authenticatedProfile =
      await requireAuthenticatedProfile(
        request
      );

    const {
      data: requesterData,
      error: requesterError,
    } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        name,
        role,
        org_id
      `)
      .eq(
        "id",
        authenticatedProfile.id
      )
      .single();

    if (
      requesterError ||
      !requesterData
    ) {
      throw new GeneratedAssetError(
        requesterError?.message ||
          "CRM profile not found.",
        403,
        "profile_not_found"
      );
    }

    const requester =
      requesterData as
        RequesterRow;

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const listingId =
      String(
        body?.listing_id ||
          ""
      ).trim();

    const campaignId =
      String(
        body?.campaign_id ||
          ""
      ).trim();

    const templateKey =
      normalizeTemplateKey(
        body?.template_key
      );

    if (!listingId) {
      throw new GeneratedAssetError(
        "Choose a listing before generating artwork.",
        400,
        "listing_required"
      );
    }

    const {
      data: listingData,
      error: listingError,
    } = await supabaseAdmin
      .from("listings")
      .select(`
        id,
        org_id,
        owner_user_id,
        title,
        property_type,
        property_address,
        city,
        state,
        campaign_headline,
        short_marketing_description
      `)
      .eq(
        "id",
        listingId
      )
      .single();

    if (
      listingError ||
      !listingData
    ) {
      throw new GeneratedAssetError(
        listingError?.message ||
          "Listing not found.",
        404,
        "listing_not_found"
      );
    }

    const listing =
      listingData as
        ListingRow;

    if (
      !listing.owner_user_id
    ) {
      throw new GeneratedAssetError(
        "The listing must have an owner before artwork can be generated.",
        400,
        "listing_owner_required"
      );
    }

    if (
      !canManageOwnedRecord(
        requester,
        listing.org_id,
        listing.owner_user_id
      )
    ) {
      throw new GeneratedAssetError(
        "You do not have access to generate artwork for this listing.",
        403,
        "listing_access_denied"
      );
    }

    if (campaignId) {
      const {
        data: campaignData,
        error: campaignError,
      } = await supabaseAdmin
        .from(
          "email_campaigns"
        )
        .select(`
          id,
          org_id,
          owner_user_id,
          listing_id
        `)
        .eq(
          "id",
          campaignId
        )
        .single();

      if (
        campaignError ||
        !campaignData
      ) {
        throw new GeneratedAssetError(
          campaignError?.message ||
            "Campaign not found.",
          404,
          "campaign_not_found"
        );
      }

      const campaign =
        campaignData as
          CampaignRow;

      if (
        campaign.listing_id !==
        listing.id
      ) {
        throw new GeneratedAssetError(
          "The selected campaign belongs to a different listing.",
          400,
          "campaign_listing_mismatch"
        );
      }

      if (
        !canManageOwnedRecord(
          requester,
          campaign.org_id,
          campaign.owner_user_id
        )
      ) {
        throw new GeneratedAssetError(
          "You do not have access to this campaign.",
          403,
          "campaign_access_denied"
        );
      }
    }

    const [
      brandResult,
      organizationResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          "platform_brand_settings"
        )
        .select(`
          brand_name,
          primary_color,
          secondary_color,
          accent_color
        `)
        .eq(
          "brand_key",
          "mpre"
        )
        .maybeSingle(),

      supabaseAdmin
        .from(
          "organizations"
        )
        .select(`
          id,
          name,
          org_display,
          market_name,
          brokerage_name
        `)
        .eq(
          "id",
          listing.org_id
        )
        .single(),
    ]);

    if (
      brandResult.error
    ) {
      throw new GeneratedAssetError(
        brandResult.error.message,
        500,
        "brand_load_failed"
      );
    }

    if (
      organizationResult.error ||
      !organizationResult.data
    ) {
      throw new GeneratedAssetError(
        organizationResult
          .error?.message ||
          "Organization not found.",
        500,
        "organization_load_failed"
      );
    }

    const brand =
      brandResult.data;

    const organization =
      organizationResult.data;

    const brandName =
      brand?.brand_name ||
      "MPRE";

    const organizationName =
      organization
        .org_display ||
      organization.name ||
      brandName;

    const primaryColor =
      cleanColor(
        brand?.primary_color,
        "#0f172a"
      );

    const secondaryColor =
      cleanColor(
        brand
          ?.secondary_color,
        "#ffffff"
      );

    const accentColor =
      cleanColor(
        brand?.accent_color,
        "#d97706"
      );

    const prompt = [
      "Create a wide decorative banner for a premium real-estate marketing email.",
      "",
      `Visual direction: ${templateDirection(
        templateKey
      )}.`,
      "",
      `Brand palette references: primary ${primaryColor}, secondary ${secondaryColor}, accent ${accentColor}.`,
      `Brand context: ${brandName}. Market context: ${organizationName}.`,
      "",
      "This image is decorative brand artwork only.",
      "It must not depict the listed property or imply that an invented home is the listing.",
      "Use abstract architectural forms, refined materials, subtle landscape-inspired shapes, elegant light and sophisticated editorial composition.",
      "Create a strong landscape composition suitable for the top of an email.",
      "Leave calm visual breathing room near the center and edges.",
      "",
      "Do not include:",
      "- any letters, words, numbers or typography",
      "- prices, addresses or property facts",
      "- logos, trademarks or watermarks",
      "- people, faces or agents",
      "- a specific identifiable house",
      "- buttons, user-interface elements or mock email screens",
      "",
      "The actual listing photograph, factual property information, branding logos and compliance language will be added separately as HTML.",
    ].join("\n");

    assetId =
      randomUUID();

    const {
      error:
        creatingAssetError,
    } = await supabaseAdmin
      .from(
        "generated_marketing_assets"
      )
      .insert({
        id: assetId,

        org_id:
          listing.org_id,

        owner_user_id:
          listing.owner_user_id,

        created_by:
          requester.id,

        listing_id:
          listing.id,

        campaign_id:
          campaignId ||
          null,

        asset_format:
          ASSET_FORMAT,

        template_key:
          templateKey,

        generation_status:
          "generating",

        model:
          MODEL,

        prompt_version:
          PROMPT_VERSION,

        prompt_text:
          prompt,

        source_media_ids:
          [],

        width:
          OUTPUT_WIDTH,

        height:
          OUTPUT_HEIGHT,

        quality:
          OUTPUT_QUALITY,

        mime_type:
          OUTPUT_MIME_TYPE,

        storage_bucket:
          STORAGE_BUCKET,

        generation_metadata: {
          provider:
            "openai",

          decorative_only:
            true,

          property_depiction:
            false,

          output_format:
            OUTPUT_FORMAT,

          requested_size:
            OUTPUT_SIZE,
        },
      });

    if (
      creatingAssetError
    ) {
      throw new GeneratedAssetError(
        creatingAssetError.message,
        500,
        "asset_record_failed"
      );
    }

    const apiKey =
      process.env
        .OPENAI_API_KEY
        ?.trim();

    if (!apiKey) {
      throw new GeneratedAssetError(
        "OPENAI_API_KEY is not configured.",
        503,
        "missing_openai_key"
      );
    }

    const headers:
      Record<
        string,
        string
      > = {
        Authorization:
          `Bearer ${apiKey}`,

        "Content-Type":
          "application/json",
      };

    const projectId =
      process.env
        .OPENAI_PROJECT_ID
        ?.trim();

    if (projectId) {
      headers[
        "OpenAI-Project"
      ] = projectId;
    }

    const organizationId =
      process.env
        .OPENAI_ORGANIZATION_ID
        ?.trim();

    if (organizationId) {
      headers[
        "OpenAI-Organization"
      ] = organizationId;
    }

    let openAiResponse:
      Response;

    try {
      openAiResponse =
        await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method:
              "POST",

            headers,

            body:
              JSON.stringify({
                model:
                  MODEL,

                prompt,

                size:
                  OUTPUT_SIZE,

                quality:
                  OUTPUT_QUALITY,

                output_format:
                  OUTPUT_FORMAT,

                background:
                  "opaque",

                n: 1,
              }),

            signal:
              AbortSignal.timeout(
                55000
              ),
          }
        );
    }
    catch (error) {
      console.error(
        "GPT Image 2 connection failed:",
        error
      );

      throw new GeneratedAssetError(
        "The server could not connect to OpenAI while generating the artwork.",
        504,
        "openai_connection_failed"
      );
    }

    const openAiRequestId =
      openAiResponse
        .headers
        .get(
          "x-request-id"
        );

    const openAiPayload =
      await openAiResponse
        .json()
        .catch(
          () => null
        );

    if (
      !openAiResponse.ok
    ) {
      throw new GeneratedAssetError(
        openAiErrorMessage(
          openAiPayload
        ) ||
          "OpenAI rejected the artwork-generation request.",
        502,
        "openai_generation_failed"
      );
    }

    const firstImage =
      Array.isArray(
        (
          openAiPayload as {
            data?: unknown;
          }
        )?.data
      )
        ? (
            openAiPayload as {
              data: Array<{
                b64_json?: string;
                revised_prompt?: string;
              }>;
            }
          ).data[0]
        : null;

    if (
      !firstImage ||
      typeof firstImage
        .b64_json !==
        "string" ||
      !firstImage.b64_json
    ) {
      throw new GeneratedAssetError(
        "OpenAI responded without image data.",
        502,
        "openai_image_missing"
      );
    }

    const imageBuffer =
      Buffer.from(
        firstImage.b64_json,
        "base64"
      );

    if (
      imageBuffer.length === 0
    ) {
      throw new GeneratedAssetError(
        "The generated image was empty.",
        502,
        "empty_generated_image"
      );
    }

    if (
      imageBuffer.length >
      20 * 1024 * 1024
    ) {
      throw new GeneratedAssetError(
        "The generated image exceeded the 20 MB storage limit.",
        502,
        "generated_image_too_large"
      );
    }

    storagePath = [
      listing.org_id,
      listing.owner_user_id,
      listing.id,
      "email-banners",
      `${Date.now()}-${assetId}.webp`,
    ].join("/");

    const {
      error: uploadError,
    } = await supabaseAdmin
      .storage
      .from(
        STORAGE_BUCKET
      )
      .upload(
        storagePath,
        imageBuffer,
        {
          contentType:
            OUTPUT_MIME_TYPE,

          cacheControl:
            "31536000",

          upsert:
            false,
        }
      );

    if (uploadError) {
      throw new GeneratedAssetError(
        uploadError.message,
        500,
        "generated_image_upload_failed"
      );
    }

    const {
      data: publicUrlData,
    } = supabaseAdmin
      .storage
      .from(
        STORAGE_BUCKET
      )
      .getPublicUrl(
        storagePath
      );

    const publicUrl =
      publicUrlData.publicUrl;

    const contentHash =
      createHash(
        "sha256"
      )
        .update(
          imageBuffer
        )
        .digest(
          "hex"
        );

    const {
      data:
        provenanceData,
      error:
        provenanceError,
    } = await supabaseAdmin
      .from(
        "marketing_asset_provenance"
      )
      .insert({
        organization_id:
          listing.org_id,

        created_by:
          requester.id,

        source_entity_type:
          "generated_asset",

        source_entity_id:
          assetId,

        asset_type:
          "image",

        asset_name:
          `${listing.title} decorative email banner`,

        storage_bucket:
          STORAGE_BUCKET,

        storage_path:
          storagePath,

        source_url:
          publicUrl,

        content_hash:
          contentHash,

        origin_type:
          "ai_generated",

        owner_name:
          organizationName,

        permission_source:
          "Generated through the authenticated CRM GPT Image 2 route.",

        permission_granted_at:
          new Date()
            .toISOString(),

        email_use_allowed:
          true,

        social_use_allowed:
          true,

        website_use_allowed:
          true,

        print_use_allowed:
          false,

        video_use_allowed:
          false,

        sms_mms_use_allowed:
          true,

        samantha_use_allowed:
          false,

        is_ai_generated:
          true,

        is_materially_altered:
          false,

        alteration_description:
          "Decorative AI-generated artwork. It does not depict or modify the listed property.",

        requires_disclosure:
          false,

        verification_status:
          "verified",

        verified_by:
          requester.id,

        verified_at:
          new Date()
            .toISOString(),

        metadata: {
          provider:
            "openai",

          model:
            MODEL,

          openai_request_id:
            openAiRequestId,

          prompt_version:
            PROMPT_VERSION,

          template_key:
            templateKey,

          asset_format:
            ASSET_FORMAT,

          decorative_only:
            true,

          property_depiction:
            false,
        },

        notes:
          "Use as a decorative visual layer only. Keep actual listing photography and factual property details separate.",
      })
      .select(
        "id"
      )
      .single();

    if (
      provenanceError ||
      !provenanceData
    ) {
      throw new GeneratedAssetError(
        provenanceError
          ?.message ||
          "The asset-provenance record was not created.",
        500,
        "provenance_record_failed"
      );
    }

    provenanceId =
      provenanceData.id;

    const {
      data: readyAsset,
      error: readyAssetError,
    } = await supabaseAdmin
      .from(
        "generated_marketing_assets"
      )
      .update({
        provenance_id:
          provenanceId,

        generation_status:
          "ready",

        storage_path:
          storagePath,

        public_url:
          publicUrl,

        error_message:
          null,

        generation_metadata: {
          provider:
            "openai",

          model:
            MODEL,

          openai_request_id:
            openAiRequestId,

          prompt_version:
            PROMPT_VERSION,

          decorative_only:
            true,

          property_depiction:
            false,

          output_format:
            OUTPUT_FORMAT,

          requested_size:
            OUTPUT_SIZE,

          revised_prompt:
            firstImage
              .revised_prompt ||
            null,

          usage:
            (
              openAiPayload as {
                usage?: unknown;
              }
            )?.usage ||
            null,
        },
      })
      .eq(
        "id",
        assetId
      )
      .select(`
        id,
        listing_id,
        campaign_id,
        asset_format,
        template_key,
        generation_status,
        model,
        width,
        height,
        quality,
        mime_type,
        public_url,
        is_selected,
        created_at
      `)
      .single();

    if (
      readyAssetError ||
      !readyAsset
    ) {
      throw new GeneratedAssetError(
        readyAssetError
          ?.message ||
          "The generated asset was not returned after saving.",
        500,
        "generated_asset_update_failed"
      );
    }

    completed = true;

    return jsonResponse({
      ok: true,
      asset:
        readyAsset,
    });
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Artwork generation failed.";

    console.error(
      "Generated marketing artwork error:",
      error
    );

    if (
      assetId &&
      !completed
    ) {
      await supabaseAdmin
        .from(
          "generated_marketing_assets"
        )
        .update({
          generation_status:
            "failed",

          error_message:
            message.slice(
              0,
              4000
            ),
        })
        .eq(
          "id",
          assetId
        );
    }

    if (
      provenanceId &&
      !completed
    ) {
      await supabaseAdmin
        .from(
          "marketing_asset_provenance"
        )
        .delete()
        .eq(
          "id",
          provenanceId
        );
    }

    if (
      storagePath &&
      !completed
    ) {
      await supabaseAdmin
        .storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          storagePath,
        ]);
    }

    return jsonResponse(
      {
        ok: false,

        code:
          responseCode(
            error
          ),

        error:
          message,
      },
      responseStatus(
        error
      )
    );
  }
}
