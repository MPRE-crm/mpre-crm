// crm-project/crm/app/api/twilio/call-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MISSED_STATUSES = new Set(["busy", "no-answer", "failed", "canceled"]);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const data = new URLSearchParams(bodyText);

  const qs = req.nextUrl.searchParams;

  const callSid = String(data.get("CallSid") || "");
  const status = String(data.get("CallStatus") || "");
  const answeredBy = String(data.get("AnsweredBy") || "");
  const to = String(data.get("To") || "");
  const from = String(data.get("From") || "");
  const direction = String(data.get("Direction") || "");
  const conversationSummary =
    String(data.get("conversation_summary") || qs.get("conversation_summary") || "");
  let leadId = String(data.get("id") || qs.get("id") || "");

  if (!callSid) return NextResponse.json({ ok: true });

  const now = new Date();
  const nowIso = now.toISOString();
  const callbackDueAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  try {
    if (!leadId) {
      const { data: followUpRow } = await supabase
        .from("follow_ups")
        .select("lead_id")
        .eq("call_sid", callSid)
        .maybeSingle();

      leadId = String(followUpRow?.lead_id || "");
    }

    if (MISSED_STATUSES.has(status) && leadId) {
      await supabase
        .from("missed_call_logs")
        .upsert(
          {
            lead_id: leadId,
            call_sid: callSid,
            from_number: from || null,
            to_number: to || null,
            direction: direction || null,
            call_status: status,
            detected_at: nowIso,
            callback_due_at: callbackDueAt,
            callback_status: "pending",
            metadata: {
              answeredBy: answeredBy || null,
              conversationSummary: conversationSummary || null,
              source: "twilio_call_status_webhook",
            },
            updated_at: nowIso,
          },
          { onConflict: "call_sid" }
        );
    }

    if (status === "completed" && answeredBy?.startsWith("machine")) {
      await supabase
        .from("follow_ups")
        .update({
          final_status: "voicemail",
          do_not_contact: true,
          next_attempt_at: null,
          last_attempt_at: nowIso,
        })
        .eq("call_sid", callSid);
    } else if (
      status === "in-progress" ||
      (status === "completed" && !answeredBy?.startsWith("machine"))
    ) {
      await supabase
        .from("follow_ups")
        .update({
          final_status: "answered",
          do_not_contact: true,
          next_attempt_at: null,
          last_attempt_at: nowIso,
        })
        .eq("call_sid", callSid);
    } else if (["busy", "no-answer", "failed", "canceled"].includes(status)) {
      await supabase
        .from("follow_ups")
        .update({
          final_status: status,
          last_attempt_at: nowIso,
        })
        .eq("call_sid", callSid);
    }

    if (leadId) {
      const leadPatch: Record<string, any> = {
        call_status: status || null,
        last_call_attempt_at: nowIso,
        last_contact_attempt_at: nowIso,
        updated_at: nowIso,
      };

      if (
        status === "in-progress" ||
        (status === "completed" && !answeredBy?.startsWith("machine"))
      ) {
        leadPatch.last_answered_call_at = nowIso;
        leadPatch.last_meaningful_engagement_at = nowIso;
        leadPatch.lead_heat = "hot";
        leadPatch.hot_until = addHours(now, 48).toISOString();
        leadPatch.next_contact_at = null;
      }

      if (conversationSummary) {
        leadPatch.notes = conversationSummary;
      }

      await supabase
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId);
    }

    await supabase.from("call_logs").insert({
      call_sid: callSid,
      status,
      from_number: from || null,
      to_number: to || null,
      direction: direction || null,
      timestamp: nowIso,
      updated_at: nowIso,
      created_at: nowIso,
      lead_id: leadId || null,
      call_outcome: status || null,
      meta: {
        answeredBy: answeredBy || null,
        conversationSummary: conversationSummary || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("❌ call-status error", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export const GET = POST;