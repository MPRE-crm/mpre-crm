import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type LeadRow = {
  id: string;
  phone: string | null;
  first_name?: string | null;
  last_name?: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_status: string | null;
  appointment_requested: boolean | null;
  appointment_attended: boolean | null;
};

const BOISE_TZ = "America/Boise";

function getTzParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getTzParts(date, timeZone);
  const utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return (utcMs - date.getTime()) / 60000;
}

function makeZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}

function parseAppointmentTime(timeText: string): { hour: number; minute: number } | null {
  const trimmed = String(timeText || "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return { hour, minute };
}

function buildAppointmentIso(dateText: string, timeText: string) {
  const dateMatch = String(dateText || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const timeParts = parseAppointmentTime(timeText);
  if (!timeParts) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const zoned = makeZonedDate(
    year,
    month,
    day,
    timeParts.hour,
    timeParts.minute,
    BOISE_TZ
  );

  if (Number.isNaN(zoned.getTime())) return null;
  return zoned.toISOString();
}

function plusMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

function isCanceledOrRescheduled(status: string) {
  const s = status.toLowerCase();
  return s.includes("cancel") || s.includes("resched");
}

function isConfirmedStatus(status: string) {
  const s = status.toLowerCase();
  return s.includes("confirm") || s.includes("accept");
}

async function cancelPendingMissedFollowUps(leadId: string, reason: string) {
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("appointment_reminders")
    .update({
      status: "canceled",
      reason,
      updated_at: nowIso,
    })
    .eq("lead_id", leadId)
    .eq("reminder_type", "missed_followup")
    .eq("status", "pending");

  if (error) {
    console.error("❌ cancelPendingMissedFollowUps error", { leadId, reason, error });
  }
}

export async function scheduleMissedAppointmentFollowUps() {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select(`
      id,
      phone,
      first_name,
      last_name,
      appointment_date,
      appointment_time,
      appointment_status,
      appointment_requested,
      appointment_attended
    `)
    .not("appointment_date", "is", null)
    .not("appointment_time", "is", null)
    .eq("appointment_requested", true)
    .limit(500);

  if (error) throw error;

  let scheduled = 0;
  let canceled = 0;
  let skipped = 0;

  for (const lead of (leads || []) as LeadRow[]) {
    const status = String(lead.appointment_status || "").trim();

    if (!lead.phone) {
      skipped++;
      await cancelPendingMissedFollowUps(lead.id, "missing_phone");
      continue;
    }

    if (lead.appointment_attended === true) {
      skipped++;
      await cancelPendingMissedFollowUps(lead.id, "appointment_attended");
      continue;
    }

    if (isCanceledOrRescheduled(status)) {
      canceled++;
      await cancelPendingMissedFollowUps(lead.id, "appointment_canceled_or_rescheduled");
      continue;
    }

    if (!isConfirmedStatus(status) && !status.toLowerCase().includes("missed")) {
      skipped++;
      await cancelPendingMissedFollowUps(lead.id, "appointment_not_confirmed");
      continue;
    }

    const appointmentIso = buildAppointmentIso(
      lead.appointment_date!,
      lead.appointment_time!
    );

    if (!appointmentIso) {
      skipped++;
      await cancelPendingMissedFollowUps(lead.id, "invalid_appointment_datetime");
      continue;
    }

    const followupAt = plusMinutes(appointmentIso, 30);

    if (new Date(followupAt) > now) {
      skipped++;
      continue;
    }

    const { error: upsertError } = await supabaseAdmin
      .from("appointment_reminders")
      .upsert(
        {
          lead_id: lead.id,
          reminder_type: "missed_followup",
          scheduled_for: followupAt,
          status: "pending",
          channel: "ai_call",
          reason: "missed_appointment_followup",
          details: {
            appointment_date: lead.appointment_date,
            appointment_time: lead.appointment_time,
            appointment_status: lead.appointment_status,
            appointment_iso: appointmentIso,
            scheduler_run_at: nowIso,
            grace_minutes: 30,
          },
          updated_at: nowIso,
        },
        {
          onConflict: "lead_id,reminder_type,scheduled_for",
        }
      );

    if (upsertError) {
      console.error("❌ missed follow-up upsert error", {
        leadId: lead.id,
        error: upsertError,
      });
      continue;
    }

    const { error: leadUpdateError } = await supabaseAdmin
      .from("leads")
      .update({
        appointment_status: "Missed",
        updated_at: nowIso,
      })
      .eq("id", lead.id)
      .neq("appointment_status", "Missed");

    if (leadUpdateError) {
      console.error("❌ missed follow-up lead update error", {
        leadId: lead.id,
        error: leadUpdateError,
      });
    }

    scheduled++;
  }

  return {
    ok: true,
    scheduled,
    canceled,
    skipped,
  };
}