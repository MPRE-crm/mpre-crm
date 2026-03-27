export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { processDueFollowUps } from "../../../../../src/lib/samantha/processDueFollowUps";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processDueFollowUps(100);

    return NextResponse.json({
      success: true,
      scheduled: true,
      ran_at: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    console.error("❌ follow-up schedule route error:", error);
    return NextResponse.json(
      { error: error.message || "Follow-up schedule failed" },
      { status: 500 }
    );
  }
}

export const POST = GET;