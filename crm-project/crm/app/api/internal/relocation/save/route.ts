import { NextRequest, NextResponse } from "next/server";
import { saveRelocationLead } from "../../../../../lib/persistence/relocation-intake";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-internal-secret");
    const expected = process.env.INTERNAL_API_SECRET;

    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "Missing INTERNAL_API_SECRET on CRM" },
        { status: 500 }
      );
    }

    if (secret !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const result = await saveRelocationLead(body);

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error || "Failed to save relocation lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lead: result.lead,
      assigned_agent: result.assigned_agent,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save relocation lead",
      },
      { status: 500 }
    );
  }
}