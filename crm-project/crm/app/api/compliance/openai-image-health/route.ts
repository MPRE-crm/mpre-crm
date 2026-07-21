import { NextResponse } from "next/server";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

class OpenAiImageHealthError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status: number,
    code = "unknown_error"
  ) {
    super(message);

    this.name =
      "OpenAiImageHealthError";

    this.status =
      status;

    this.code =
      code;
  }
}

async function requirePlatformAdmin(
  request: Request
) {
  const profile =
    await requireAuthenticatedProfile(
      request
    );

  if (
    profile.role !==
    "platform_admin"
  ) {
    throw new RequestAuthError(
      "Platform-admin access is required.",
      403
    );
  }

  return profile;
}

function errorStatus(
  error: unknown
) {
  if (
    error instanceof
    OpenAiImageHealthError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function errorCode(
  error: unknown
) {
  if (
    error instanceof
    OpenAiImageHealthError
  ) {
    return error.code;
  }

  return "unexpected_error";
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

function classifyOpenAiError(
  status: number,
  payload: unknown
) {
  const apiMessage =
    typeof payload ===
      "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (
      payload as {
        error?: {
          message?: unknown;
        };
      }
    ).error?.message ===
      "string"
      ? (
          payload as {
            error: {
              message: string;
            };
          }
        ).error.message
      : "";

  const message =
    apiMessage.toLowerCase();

  if (
    message.includes(
      "verify your organization"
    ) ||
    message.includes(
      "organization verification"
    )
  ) {
    return new OpenAiImageHealthError(
      "OpenAI organization verification appears to be required for GPT Image 2 access.",
      502,
      "organization_verification_required"
    );
  }

  if (
    status === 401
  ) {
    return new OpenAiImageHealthError(
      "OpenAI rejected the production API key.",
      502,
      "invalid_api_key"
    );
  }

  if (
    status === 403
  ) {
    return new OpenAiImageHealthError(
      "The OpenAI key does not have access to GPT Image 2 or the configured project.",
      502,
      "model_access_denied"
    );
  }

  if (
    status === 404 ||
    message.includes(
      "model"
    ) &&
    (
      message.includes(
        "not found"
      ) ||
      message.includes(
        "does not exist"
      ) ||
      message.includes(
        "unavailable"
      )
    )
  ) {
    return new OpenAiImageHealthError(
      "GPT Image 2 appears unavailable for this API project or endpoint.",
      502,
      "model_unavailable"
    );
  }

  if (
    status === 429 ||
    message.includes(
      "rate limit"
    ) ||
    message.includes(
      "quota"
    ) ||
    message.includes(
      "billing"
    )
  ) {
    return new OpenAiImageHealthError(
      "OpenAI authenticated the request but blocked it because of rate limits, quota, or billing.",
      502,
      "rate_limit_or_quota"
    );
  }

  if (
    status >= 500
  ) {
    return new OpenAiImageHealthError(
      "OpenAI returned a server error during the GPT Image 2 test.",
      502,
      "openai_server_error"
    );
  }

  return new OpenAiImageHealthError(
    apiMessage ||
      "OpenAI rejected the GPT Image 2 runtime test.",
    502,
    "openai_request_failed"
  );
}

export async function POST(
  request: Request
) {
  try {
    await requirePlatformAdmin(
      request
    );

    const apiKey =
      process.env
        .OPENAI_API_KEY
        ?.trim();

    if (!apiKey) {
      throw new OpenAiImageHealthError(
        "OPENAI_API_KEY is not configured in the production runtime.",
        503,
        "missing_api_key"
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

    let response:
      Response;

    try {
      response =
        await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method:
              "POST",

            headers,

            body:
              JSON.stringify({
                model:
                  "gpt-image-2",

                prompt:
                  "Create a simple luxury real-estate editorial background with clean premium styling, soft light, elegant contrast, and no visible text.",

                size:
                  "1024x1024",

                quality:
                  "low",

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
        "OpenAI GPT Image 2 connection failed:",
        error
      );

      throw new OpenAiImageHealthError(
        "The Vercel runtime could not connect to OpenAI for the GPT Image 2 test.",
        504,
        "connection_failed"
      );
    }

    const requestId =
      response.headers.get(
        "x-request-id"
      );

    const payload =
      await response
        .json()
        .catch(
          () => null
        );

    if (!response.ok) {
      console.error(
        "OpenAI GPT Image 2 test failed:",
        {
          status:
            response.status,
          requestId,
        }
      );

      throw classifyOpenAiError(
        response.status,
        payload
      );
    }

    const firstImage =
      Array.isArray(
        (
          payload as {
            data?: unknown;
          }
        )?.data
      )
        ? (
            payload as {
              data: Array<{
                b64_json?: string;
              }>;
            }
          ).data[0]
        : null;

    if (
      !firstImage ||
      typeof firstImage.b64_json !==
        "string" ||
      firstImage.b64_json.length === 0
    ) {
      console.error(
        "OpenAI GPT Image 2 test returned an unexpected payload:",
        {
          requestId,
        }
      );

      throw new OpenAiImageHealthError(
        "OpenAI responded, but the GPT Image 2 payload was missing image data.",
        502,
        "unexpected_response"
      );
    }

    console.info(
      "OpenAI GPT Image 2 test passed:",
      {
        requestId,
      }
    );

    return jsonResponse({
      ok: true,
      valid: true,
      model: "gpt-image-2",

      checked_at:
        new Date()
          .toISOString(),
    });
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "The GPT Image 2 runtime test failed.";

    console.error(
      "OpenAI GPT Image 2 health endpoint failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        valid: false,
        code:
          errorCode(error),
        error: message,
      },
      errorStatus(
        error
      )
    );
  }
}
