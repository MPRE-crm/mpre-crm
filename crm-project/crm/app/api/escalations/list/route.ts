export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: escalations, error: escalationError } = await supabase
      .from("escalation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (escalationError) {
      return NextResponse.json(
        { error: "Failed to load escalations", details: escalationError.message },
        { status: 500 }
      );
    }

    const leadIds = Array.from(
      new Set((escalations || []).map((r: any) => r.lead_id).filter(Boolean))
    );

    let leads: any[] = [];

    if (leadIds.length > 0) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("id, first_name, last_name, name, phone, email")
        .in("id", leadIds);

      if (leadError) {
        return NextResponse.json(
          { error: "Failed to load leads", details: leadError.message },
          { status: 500 }
        );
      }

      leads = leadData || [];
    }

    return NextResponse.json({
      success: true,
      escalations: escalations || [],
      leads,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list escalations" },
      { status: 500 }
    );
  }
}