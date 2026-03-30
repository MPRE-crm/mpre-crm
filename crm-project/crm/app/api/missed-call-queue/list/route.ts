import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("missed_call_logs")
      .select(`
        id,
        lead_id,
        call_sid,
        from_number,
        to_number,
        direction,
        call_status,
        detected_at,
        callback_due_at,
        callback_status,
        callback_action,
        callback_reason,
        callback_result,
        callback_attempted_at,
        resolved_at,
        created_at,
        updated_at,
        leads (
          first_name,
          last_name,
          phone
        )
      `)
      .order("detected_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("missed-call-queue list error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []).map((row: any) => {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;

      return {
        ...row,
        lead_name: lead
          ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
          : "Unknown Lead",
        lead_phone: lead?.phone || null,
      };
    });

    return NextResponse.json({
      ok: true,
      rows,
    });
  } catch (error: any) {
    console.error("missed-call-queue route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}