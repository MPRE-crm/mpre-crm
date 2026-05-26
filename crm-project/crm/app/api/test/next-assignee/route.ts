export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getNextAssignee } from "../../../../lib/rotation/getNextAssignee";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { org_id } = body;

    if (!org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }

    const assignee = await getNextAssignee(org_id);

    return NextResponse.json({
      success: true,
      assignee,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to get next assignee",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}