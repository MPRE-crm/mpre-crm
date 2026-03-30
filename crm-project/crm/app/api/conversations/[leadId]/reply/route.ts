import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await context.params;
    const body = await req.json();
    const message = String(body?.message || "").trim();

    if (!leadId) {
      return NextResponse.json(
        { ok: false, error: "Missing leadId" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, phone")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json(
        { ok: false, error: leadError.message },
        { status: 500 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    const executionMode = process.env.SAMANTHA_EXECUTION_MODE || "mock";

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        lead_phone: lead.phone || null,
        direction: "outgoing",
        body: message,
        status: executionMode === "mock" ? "mock_queued" : "queued",
        created_at: new Date().toISOString(),
        twilio_sid: `mock-${Date.now()}`,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: executionMode,
      message: inserted,
    });
  } catch (error: any) {
    console.error("conversation reply route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}