export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolvePostIdxAction } from "../../../../src/lib/samantha/resolvePostIdxAction";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .not("next_contact_at", "is", null)
      .order("next_contact_at", { ascending: true })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load follow-up queue", details: error.message },
        { status: 500 }
      );
    }

    const now = new Date();

    const queue = (leads || []).map((lead: any) => {
      const decision = resolvePostIdxAction({ lead, now });

      return {
        lead,
        decision,
      };
    });

    return NextResponse.json({
      success: true,
      queue,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load follow-up queue" },
      { status: 500 }
    );
  }
}