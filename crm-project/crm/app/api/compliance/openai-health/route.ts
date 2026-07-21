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
  30;

class OpenAiHealthError
  extends Error {
  status: number;

  constructor(
    message: string,
    status: number
  ) {
    super(message);

    this.name =
      "OpenAiHealthError";

    this.status =
      status;
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
    OpenAiHealthError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
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
      throw new OpenAiHealthError(
        "OPENAI_API_KEY is not configured in the production runtime.",
        503
      );
    }

    const model =
      (
        process.env
          .OPENAI_COMPLIANCE_MODEL ||
        process.env
          .OPENAI_MODEL ||
        "gpt-5-mini"
      ).trim();

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
          "https://api.openai.com/v1/responses",
          {
            method:
              "POST",

            headers,

            body:
              JSON.stringify({
                model,

                input:
                  "Reply with exactly OK.",

                max_output_tokens:
                  64,

                store:
                  false,
              }),

            signal:
              AbortSignal.timeout(
                30000
              ),
          }
        );
    }
    catch (error) {
      console.error(
        "OpenAI runtime health connection failed:",
        error
      );

      throw new OpenAiHealthError(
        "The Vercel runtime could not connect to OpenAI.",
        504
      );
    }

    const requestId =
      response.headers.get(
        "x-request-id"
      );

    await response
      .json()
      .catch(
        () => null
      );

    if (!response.ok) {
      let message =
        "OpenAI rejected the production runtime request.";

      if (
        response.status ===
        401
      ) {
        message =
          "OpenAI rejected the production API key.";
      }
      else if (
        response.status ===
        403
      ) {
        message =
          "The OpenAI key does not have access to the configured project or model.";
      }
      else if (
        response.status ===
        429
      ) {
        message =
          "OpenAI authenticated the request but blocked it because of a rate limit or account quota.";
      }

      console.error(
        "OpenAI runtime health request failed:",
        {
          status:
            response.status,

          requestId,
        }
      );

      throw new OpenAiHealthError(
        message,
        502
      );
    }

    console.info(
      "OpenAI runtime health request passed:",
      {
        requestId,
      }
    );

    return jsonResponse({
      ok: true,
      valid: true,

      checked_at:
        new Date()
          .toISOString(),
    });
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "The OpenAI runtime test failed.";

    console.error(
      "OpenAI runtime health endpoint failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        valid: false,
        error: message,
      },
      errorStatus(
        error
      )
    );
  }
}