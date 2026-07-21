import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  runAdvertisingComplianceAudit,
} from "../../../../../lib/compliance/runAdvertisingComplianceAudit";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

type CronAuthorization =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function constantTimeEqual(
  provided: string,
  expected: string
) {
  const providedBytes =
    Buffer.from(
      provided,
      "utf8"
    );

  const expectedBytes =
    Buffer.from(
      expected,
      "utf8"
    );

  if (
    providedBytes.length !==
    expectedBytes.length
  ) {
    return false;
  }

  return timingSafeEqual(
    providedBytes,
    expectedBytes
  );
}

function authorizeCron(
  request: Request
): CronAuthorization {
  const expected =
    process.env.CRON_SECRET;

  if (!expected) {
    return {
      ok: false,

      status: 503,

      error:
        "Cron authentication is not configured.",
    };
  }

  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  const prefix =
    "Bearer ";

  if (
    !authorization.startsWith(
      prefix
    )
  ) {
    return {
      ok: false,

      status: 401,

      error:
        "Unauthorized",
    };
  }

  const provided =
    authorization.slice(
      prefix.length
    );

  if (
    !provided ||
    !constantTimeEqual(
      provided,
      expected
    )
  ) {
    return {
      ok: false,

      status: 401,

      error:
        "Unauthorized",
    };
  }

  return {
    ok: true,
  };
}

async function handler(
  request: Request
) {
  const authorization =
    authorizeCron(
      request
    );

  if (!authorization.ok) {
    return NextResponse.json(
      {
        ok: false,

        error:
          authorization.error,
      },
      {
        status:
          authorization.status,
      }
    );
  }

  try {
    const result =
      await runAdvertisingComplianceAudit(
        {
          auditType:
            "change_scan",

          triggerSource:
            "cron",

          requestedBy:
            null,

          jurisdictionCode:
            null,

          dueOnly:
            true,
        }
      );

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Compliance change scan failed.";

    console.error(
      "Compliance change scan failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}

export const GET =
  handler;

export const POST =
  handler;