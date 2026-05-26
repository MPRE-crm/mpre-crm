import { NextRequest, NextResponse } from "next/server";
import { processMissedAppointmentFollowUps } from "../../../../../src/lib/samantha/processMissedAppointmentFollowUps";

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET || "";
  return auth === `Bearer ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await processMissedAppointmentFollowUps();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("process-missed-followups route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}