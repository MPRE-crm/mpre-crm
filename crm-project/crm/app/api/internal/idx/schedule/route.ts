export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3000";
  }

  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  ).replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const baseUrl = getBaseUrl(req);

    const response = await fetch(`${baseUrl}/api/internal/idx/process-recent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 100 }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "IDX process-recent failed",
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduled: true,
      ran_at: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    console.error("❌ IDX schedule route error:", error);
    return NextResponse.json(
      { error: error.message || "IDX schedule failed" },
      { status: 500 }
    );
  }
}

export const POST = GET;