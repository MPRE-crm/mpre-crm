import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MessageRow = {
  id: string;
  lead_id: string | null;
  lead_phone: string | null;
  direction: string | null;
  body: string | null;
  status: string | null;
  created_at: string;
  twilio_sid: string | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export async function GET() {
  try {
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
      .order("created_at", { ascending: false })
      .limit(500);

    if (messagesError) {
      return NextResponse.json(
        { ok: false, error: messagesError.message },
        { status: 500 }
      );
    }

    const rows = (messages || []) as MessageRow[];

    const grouped = new Map<string, MessageRow>();

    for (const msg of rows) {
      const key = msg.lead_id || `phone:${msg.lead_phone || "unknown"}`;
      if (!grouped.has(key)) {
        grouped.set(key, msg);
      }
    }

    const latestThreads = Array.from(grouped.values());

    const leadIds = Array.from(
      new Set(
        latestThreads
          .map((m) => m.lead_id)
          .filter((v): v is string => Boolean(v))
      )
    );

    let leadMap: Record<string, LeadRow> = {};

    if (leadIds.length > 0) {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone")
        .in("id", leadIds);

      if (leadsError) {
        return NextResponse.json(
          { ok: false, error: leadsError.message },
          { status: 500 }
        );
      }

      leadMap = Object.fromEntries(
        ((leads || []) as LeadRow[]).map((lead) => [lead.id, lead])
      );
    }

    const inbox = latestThreads.map((msg) => {
      const lead = msg.lead_id ? leadMap[msg.lead_id] : undefined;
      const leadName = lead
        ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unknown Lead"
        : "Unknown Lead";

      return {
        thread_key: msg.lead_id || `phone:${msg.lead_phone || "unknown"}`,
        lead_id: msg.lead_id,
        lead_name: leadName,
        lead_phone: lead?.phone || msg.lead_phone || null,
        latest_message_id: msg.id,
        latest_body: msg.body || "",
        latest_direction: msg.direction || null,
        latest_status: msg.status || null,
        latest_created_at: msg.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      rows: inbox,
    });
  } catch (error: any) {
    console.error("conversations list route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}