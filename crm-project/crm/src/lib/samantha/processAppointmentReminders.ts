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
  appointment_date: string | null;
  appointment_time: string | null;
  org_id: string | null;
};

function buildReminderMessage(lead: LeadRow, reminderType: string) {
  const firstName = (lead.first_name || "there").trim();
  const dateText = lead.appointment_date || "your scheduled date";
  const timeText = lead.appointment_time || "your scheduled time";

  if (reminderType === "24h") {
    return `Hi ${firstName}, this is Samantha with MPRE Boise. Just a reminder that your appointment is tomorrow, ${dateText} at ${timeText}. Reply here if you need to reschedule.`;
  }

  if (reminderType === "2h") {
    return `Hi ${firstName}, this is Samantha with MPRE Boise. Just a quick reminder that your appointment is today at ${timeText}. Reply here if anything changes.`;
  }

  if (reminderType === "30m") {
    return `Hi ${firstName}, this is Samantha with MPRE Boise. Your appointment starts in about 30 minutes at ${timeText}. Looking forward to it.`;
  }

  return `Hi ${firstName}, this is Samantha with MPRE Boise. This is a reminder about your appointment on ${dateText} at ${timeText}.`;
}

export async function processAppointmentReminders() {
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
        updated_at: new Date().toISOString(),
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
        appointment_date,
        appointment_time,
        org_id
      `)
      .eq("id", row.lead_id)
      .single();

    if (leadError || !lead) {
      await supabaseAdmin
        .from("appointment_reminders")
        .update({
          status: "failed",
          reason: leadError?.message || "Lead not found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        id: row.id,
        ok: false,
        error: leadError?.message || "Lead not found",
      });
      continue;
    }

    if (!lead.phone) {
      await supabaseAdmin
        .from("appointment_reminders")
        .update({
          status: "skipped",
          reason: "Missing lead phone",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        id: row.id,
        ok: true,
        skipped: true,
        reason: "Missing lead phone",
      });
      continue;
    }

    const message = buildReminderMessage(lead as LeadRow, row.reminder_type);

    await logSamanthaAction({
      db: supabaseAdmin,
      leadId: row.lead_id,
      orgId: (lead as LeadRow).org_id ?? null,
      source: "appointment_reminder",
      triggerType: row.reminder_type,
      plannedAction: "text_now",
      executedAction: "text_now",
      executionMode: executionMode === "live" ? "live" : "mock",
      status: executionMode === "mock" ? "executed" : "executed",
      reasonCodes: ["APPOINTMENT_REMINDER"],
      details: {
        reminder_id: row.id,
        reminder_type: row.reminder_type,
        scheduled_for: row.scheduled_for,
        channel: row.channel,
        mock: executionMode === "mock",
        to: lead.phone,
        message,
      },
    });

    await supabaseAdmin.from("messages").insert({
      lead_id: row.lead_id,
      lead_phone: lead.phone,
      direction: "outgoing",
      body: message,
      status: executionMode === "mock" ? "mock_queued" : "queued",
      twilio_sid: executionMode === "mock" ? `mock-reminder-${Date.now()}` : null,
      created_at: new Date().toISOString(),
    });

    await supabaseAdmin
      .from("appointment_reminders")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        details: {
          ...(row.details || {}),
          processed_mode: executionMode,
          message,
        },
      })
      .eq("id", row.id);

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