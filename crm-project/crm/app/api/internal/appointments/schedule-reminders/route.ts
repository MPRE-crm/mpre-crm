import { NextRequest, NextResponse } from "next/server";
import { scheduleAppointmentReminders } from "../../../../../src/lib/samantha/scheduleAppointmentReminders";

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

    const result = await scheduleAppointmentReminders();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("schedule-reminders route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}