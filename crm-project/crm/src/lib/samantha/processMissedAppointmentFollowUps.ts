import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { logSamanthaAction } from "./logSamanthaAction";

type ReminderRow = {
  id: string;
  lead_id: string;
  reminder_type: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  channel: string;
  reason: string | null;
  details: Record<string, any> | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  org_id: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_status: string | null;
  appointment_attended: boolean | null;
  notes: string | null;
};

function buildMissedAppointmentCallNote(lead: LeadRow) {
  const firstName = (lead.first_name || "there").trim();
  const dateText = lead.appointment_date || "your appointment date";
  const timeText = lead.appointment_time || "your appointment time";

  return `Hi ${firstName}, this is Samantha with MPRE Boise. We missed you for your appointment on ${dateText} at ${timeText}. I wanted to follow up and help you reschedule when you're ready.`;
}

function isCanceledOrRescheduled(status: string) {
  const s = status.toLowerCase();
  return s.includes("cancel") || s.includes("resched");
}

function isMissedStatus(status: string) {
  return status.toLowerCase().includes("missed");
}

async function markReminder(
  id: string,
  payload: Record<string, any>
) {
  await supabaseAdmin
    .from("appointment_reminders")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function processMissedAppointmentFollowUps() {
  const nowIso = new Date().toISOString();
  const executionMode = process.env.SAMANTHA_EXECUTION_MODE || "mock";

  const { data: dueRows, error: dueError } = await supabaseAdmin
    .from("appointment_reminders")
    .select(`
      id,
      lead_id,
      reminder_type,
      scheduled_for,
      sent_at,
      status,
      channel,
      reason,
      details
    `)
    .eq("status", "pending")
    .eq("reminder_type", "missed_followup")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (dueError) throw dueError;

  const results: any[] = [];

  for (const row of (dueRows || []) as ReminderRow[]) {
    const { data: claimRows, error: claimError } = await supabaseAdmin
      .from("appointment_reminders")
      .update({
        status: "processing",
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");

    if (claimError || !claimRows?.length) {
      results.push({
        id: row.id,
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
        org_id,
        appointment_date,
        appointment_time,
        appointment_status,
        appointment_attended,
        notes
      `)
      .eq("id", row.lead_id)
      .single();

    if (leadError || !lead) {
      await markReminder(row.id, {
        status: "failed",
        reason: leadError?.message || "Lead not found",
      });

      results.push({
        id: row.id,
        ok: false,
        error: leadError?.message || "Lead not found",
      });
      continue;
    }

    const leadRow = lead as LeadRow;
    const status = String(leadRow.appointment_status || "").trim();

    if (!leadRow.phone) {
      await markReminder(row.id, {
        status: "skipped",
        reason: "Missing lead phone",
      });

      results.push({
        id: row.id,
        ok: true,
        skipped: true,
        reason: "Missing lead phone",
      });
      continue;
    }

    if (leadRow.appointment_attended === true) {
      await markReminder(row.id, {
        status: "canceled",
        reason: "Appointment already attended",
      });

      results.push({
        id: row.id,
        ok: true,
        skipped: true,
        reason: "Appointment already attended",
      });
      continue;
    }

    if (isCanceledOrRescheduled(status)) {
      await markReminder(row.id, {
        status: "canceled",
        reason: "Appointment canceled or rescheduled",
      });

      results.push({
        id: row.id,
        ok: true,
        skipped: true,
        reason: "Appointment canceled or rescheduled",
      });
      continue;
    }

    if (!isMissedStatus(status)) {
      await markReminder(row.id, {
        status: "canceled",
        reason: "Appointment is no longer in missed state",
      });

      results.push({
        id: row.id,
        ok: true,
        skipped: true,
        reason: "Appointment is no longer in missed state",
      });
      continue;
    }

    const callNote = buildMissedAppointmentCallNote(leadRow);

    await logSamanthaAction({
      db: supabaseAdmin,
      leadId: row.lead_id,
      orgId: leadRow.org_id ?? null,
      source: "missed_appointment_followup",
      triggerType: "missed_followup",
      plannedAction: "call_now",
      executedAction: "call_now",
      executionMode: executionMode === "live" ? "live" : "mock",
      status: "executed",
      reasonCodes: ["MISSED_APPOINTMENT_FOLLOWUP"],
      details: {
        reminder_id: row.id,
        scheduled_for: row.scheduled_for,
        channel: row.channel,
        mock: executionMode === "mock",
        to: leadRow.phone,
        note: callNote,
      },
    });

    const existingNotes = typeof leadRow.notes === "string" ? leadRow.notes.trim() : "";
    const logLine = `[${nowIso}] Samantha processed missed appointment follow-up (${executionMode}).`;
    const nextNotes = existingNotes ? `${existingNotes}\n\n${logLine}` : logLine;

    await supabaseAdmin
      .from("leads")
      .update({
        notes: nextNotes,
        updated_at: nowIso,
      })
      .eq("id", row.lead_id);

    await markReminder(row.id, {
      status: "sent",
      sent_at: nowIso,
      details: {
        ...(row.details || {}),
        processed_mode: executionMode,
        note: callNote,
      },
    });

    results.push({
      id: row.id,
      ok: true,
      lead_id: row.lead_id,
      reminder_type: row.reminder_type,
      mode: executionMode,
    });
  }

  return {
    ok: true,
    processed: results.length,
    results,
  };
}