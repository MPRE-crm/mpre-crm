import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await context.params;

    if (!leadId) {
      return NextResponse.json(
        { ok: false, error: "Missing leadId" },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json(
        { ok: false, error: leadError.message },
        { status: 500 }
      );
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select(`
        id,
        lead_id,
        lead_phone,
        direction,
        body,
        status,
        created_at,
        twilio_sid
      `)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { ok: false, error: messagesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lead: lead
        ? {
            id: lead.id,
            name:
              `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
              "Unknown Lead",
            phone: lead.phone || null,
          }
        : null,
      messages: messages || [],
    });
  } catch (error: any) {
    console.error("conversation route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}