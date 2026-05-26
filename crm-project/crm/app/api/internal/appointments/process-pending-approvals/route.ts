import { NextRequest, NextResponse } from "next/server";
import { processPendingAppointmentApprovals } from "../../../../../src/lib/samantha/processPendingAppointmentApprovals";

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET || "";

  const cronHeader = req.headers.get("x-vercel-cron");
  if (cronHeader) return true;

  return auth === `Bearer ${token}`;
}

async function handler(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await processPendingAppointmentApprovals();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("process-pending-approvals route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}