// crm-project/crm/app/api/calendar/slots/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getTwoSlots } from "../../../../lib/calendar/getTwoSlots";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { org_id, lead_id } = body;

    if (!org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }

    const slots = await getTwoSlots({ org_id, lead_id });

    return NextResponse.json({
      success: true,
      slots,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to load calendar slots",
        details: error.message,
      },
      { status: 500 }
    );
  }
}