export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { escalation_id, handled_by = "manual_user" } = body || {};

    if (!escalation_id) {
      return NextResponse.json(
        { error: "Missing escalation_id" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("escalation_logs")
      .update({
        status: "handled",
        handled_at: nowIso,
        handled_by,
      })
      .eq("id", escalation_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to mark escalation handled", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      escalation_id,
      status: "handled",
      handled_at: nowIso,
      handled_by,
    });
  } catch (error: any) {
    console.error("❌ mark-handled route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark escalation handled" },
      { status: 500 }
    );
  }
}

export const GET = POST;