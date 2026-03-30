import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { logSamanthaAction } from "./logSamanthaAction";

type MissedCallRow = {
  id: string;
  lead_id: string;
  callback_due_at: string;
  callback_status: string;
  call_status: string;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  lead_heat: string | null;
  preferred_contact_start_hour: number | null;
  preferred_contact_end_hour: number | null;
  next_contact_at: string | null;
};

function getHourInBoise(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Boise",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(hour);
}

function contactAllowedNow(lead: LeadRow) {
  const hour = getHourInBoise();
  const start = lead.preferred_contact_start_hour ?? 8;
  const end = lead.preferred_contact_end_hour ?? 19;
  return hour >= start && hour < end;
}

function chooseMissedCallAction(lead: LeadRow, missedCountLast7d: number) {
  const heat = (lead.lead_heat || "").toLowerCase();

  if (missedCountLast7d >= 3) {
    return {
      action: "none",
      callbackStatus: "escalated",
      reason: "MISSED_CALL_REPEAT_ESCALATE",
    };
  }

  if (!contactAllowedNow(lead)) {
    return {
      action: "text",
      callbackStatus: "completed",
      reason: "MISSED_CALL_TEXT_OUTSIDE_CONTACT_HOURS",
    };
  }

  if (heat === "hot") {
    return {
      action: "ai_call",
      callbackStatus: "completed",
      reason: "MISSED_CALL_HOT_CALLBACK",
    };
  }

  if (heat === "warm") {
    return {
      action: "text",
      callbackStatus: "completed",
      reason: "MISSED_CALL_WARM_TEXT",
    };
  }

  return {
    action: "text",
    callbackStatus: "completed",
    reason: "MISSED_CALL_COLD_TEXT",
  };
}

export async function processMissedCalls() {
  const nowIso = new Date().toISOString();

  const { data: dueLogs, error: dueError } = await supabaseAdmin
    .from("missed_call_logs")
    .select("id, lead_id, callback_due_at, callback_status, call_status")
    .eq("callback_status", "pending")
    .lte("callback_due_at", nowIso)
    .order("callback_due_at", { ascending: true })
    .limit(25);

  if (dueError) throw dueError;

  const results: any[] = [];

  for (const log of (dueLogs || []) as MissedCallRow[]) {
    const { data: claimRows, error: claimError } = await supabaseAdmin
      .from("missed_call_logs")
      .update({
        callback_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", log.id)
      .eq("callback_status", "pending")
      .select("id");

    if (claimError || !claimRows?.length) {
      results.push({
        id: log.id,
        ok: false,
        error: claimError?.message || "Already claimed",
      });
      continue;
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(`
        id,
        first_name,
        last_name,
        phone,
        lead_heat,
        preferred_contact_start_hour,
        preferred_contact_end_hour,
        next_contact_at
      `)
      .eq("id", log.lead_id)
      .single();

    if (leadError || !lead) {
      await supabaseAdmin
        .from("missed_call_logs")
        .update({
          callback_status: "failed",
          callback_result: leadError?.message || "Lead not found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      results.push({
        id: log.id,
        ok: false,
        error: leadError?.message || "Lead not found",
      });
      continue;
    }

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from("missed_call_logs")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", log.lead_id)
      .gte("detected_at", sevenDaysAgo);

    if (countError) {
      await supabaseAdmin
        .from("missed_call_logs")
        .update({
          callback_status: "failed",
          callback_result: countError.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      results.push({
        id: log.id,
        ok: false,
        error: countError.message,
      });
      continue;
    }

    const decision = chooseMissedCallAction(lead as LeadRow, count || 0);
    const executionMode = process.env.SAMANTHA_EXECUTION_MODE || "mock";

    await logSamanthaAction({
      db: supabaseAdmin,
      leadId: log.lead_id,
      source: "missed_call_processor",
      triggerType: "missed_call",
      plannedAction: decision.action,
      executedAction: decision.action,
      executionMode: executionMode === "live" ? "live" : "mock",
      status: executionMode === "mock" ? "skipped" : "executed",
      reasonCodes: [decision.reason],
      details: {
        missed_call_log_id: log.id,
        original_call_status: log.call_status,
        missed_calls_last_7d: count || 0,
      },
    });

    if (decision.callbackStatus === "escalated") {
      await supabaseAdmin.from("escalation_logs").insert({
        lead_id: log.lead_id,
        escalation_type: "missed_call_repeat",
        reason: decision.reason,
        status: "open",
        metadata: {
          missed_call_log_id: log.id,
          missed_calls_last_7d: count || 0,
        },
      });
    }

    await supabaseAdmin
      .from("missed_call_logs")
      .update({
        callback_status: decision.callbackStatus,
        callback_action: decision.action,
        callback_reason: decision.reason,
        callback_result:
          executionMode === "mock"
            ? `Mock ${decision.action} recorded`
            : `Live ${decision.action} queued`,
        callback_attempted_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", log.id);

    results.push({
      id: log.id,
      ok: true,
      action: decision.action,
      reason: decision.reason,
      mode: executionMode,
    });
  }

  return {
    ok: true,
    processed: results.length,
    results,
  };
}