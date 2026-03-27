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
    const {
      lead_id,
      org_id = null,
      escalation_reason = "TEST_ESCALATION",
      status_at_escalation = "test",
      escalated_by = "manual_test_route",
    } = body || {};

    if (!lead_id) {
      return NextResponse.json(
        { error: "Missing lead_id" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("escalation_logs")
      .insert({
        lead_id,
        org_id,
        escalation_reason,
        status_at_escalation,
        escalated_by,
        status: "open",
        created_at: nowIso,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create test escalation", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      escalation: data,
    });
  } catch (error: any) {
    console.error("❌ test escalation route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create test escalation" },
      { status: 500 }
    );
  }
}

export const GET = POST;