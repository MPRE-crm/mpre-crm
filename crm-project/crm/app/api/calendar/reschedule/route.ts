export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getGoogleOAuthClient } from "../../../../lib/googleCalendar";

const BOISE_TZ = "America/Boise";
const SLOT_MINUTES = 30;

function formatTimeParts(slotIso: string) {
  const d = new Date(slotIso);

  const timeText = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOISE_TZ,
  });

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: BOISE_TZ,
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const ampm =
    parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() || "";

  const dateText = d.toLocaleDateString("en-CA", {
    timeZone: BOISE_TZ,
  });

  return {
    dateText,
    timeText,
    hour,
    minute,
    ampm,
  };
}

function extractGoogleEventId(notes: string | null) {
  if (!notes) return null;

  const matches = Array.from(
    notes.matchAll(/Google Calendar Event ID:\s*([^\n\r]+)/gi)
  );

  const latest = matches[matches.length - 1];
  return latest?.[1]?.trim() || null;
}

function extractGoogleEventLink(notes: string | null) {
  if (!notes) return null;

  const matches = Array.from(
    notes.matchAll(/Google Calendar Link:\s*([^\n\r]+)/gi)
  );

  const latest = matches[matches.length - 1];
  return latest?.[1]?.trim() || null;
}

function cleanAppointmentNotes(notes: string | null) {
  if (!notes) return "";

  return notes
    .replace(/Google Calendar Event ID:\s*[^\n\r]+/gi, "")
    .replace(/Google Calendar Link:\s*[^\n\r]+/gi, "")
    .replace(/Appointment canceled:\s*[^\n\r]+/gi, "")
    .replace(/Appointment rescheduled:\s*[^\n\r]+/gi, "")
    .replace(/Appointment booked:\s*[^\n\r]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { org_id, lead_id, slot } = body;

    if (!org_id || !lead_id || !slot?.slot_iso) {
      return NextResponse.json(
        { error: "Missing org_id, lead_id, or slot.slot_iso" },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("org_id", org_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found", details: leadError?.message },
        { status: 404 }
      );
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("organization_id", org_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json(
        {
          error: "No active default Google calendar connection found",
          details: connectionError?.message,
        },
        { status: 404 }
      );
    }

    const oauth2Client = getGoogleOAuthClient();

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : undefined,
    });

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    const start = new Date(slot.slot_iso);
    const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

    const googleEventId = extractGoogleEventId(lead.notes);
    let eventLink = extractGoogleEventLink(lead.notes);

    if (!googleEventId) {
      return NextResponse.json(
        { error: "No Google Calendar Event ID found on this lead" },
        { status: 400 }
      );
    }

    const updateResponse = await calendar.events.patch({
      calendarId: connection.default_calendar_id || connection.account_email,
      eventId: googleEventId,
      requestBody: {
        start: {
          dateTime: start.toISOString(),
          timeZone: BOISE_TZ,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: BOISE_TZ,
        },
      },
    });

    if (updateResponse.data?.htmlLink) {
      eventLink = updateResponse.data.htmlLink;
    }

    const { dateText, timeText, hour, minute, ampm } = formatTimeParts(
      slot.slot_iso
    );

    const nowIso = new Date().toISOString();
    const cleanedNotes = cleanAppointmentNotes(lead.notes);

    const notesWithEvent = [
      cleanedNotes,
      `Appointment rescheduled: ${nowIso}`,
      `Google Calendar Event ID: ${googleEventId}`,
      `Google Calendar Link: ${eventLink || "N/A"}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const hotUntilIso = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    ).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        appointment_date: dateText,
        appointment_time: timeText,
        appointment_hour: hour,
        appointment_minute: minute,
        appointment_ampm: ampm,
        appointment_requested_slot_iso: slot.slot_iso,
        appointment_requested_slot_human: slot.slot_human,
        appointment_status: "Rescheduled",
        agent_status: "appointment_rescheduled",
        notes: notesWithEvent,
        lead_heat: "hot",
        last_meaningful_engagement_at: nowIso,
        next_contact_at: null,
        hot_until: hotUntilIso,
        updated_at: nowIso,
      })
      .eq("id", lead.id);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Google event updated but lead update failed",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      event_id: googleEventId,
      event_link: eventLink,
      slot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to reschedule appointment", details: error.message },
      { status: 500 }
    );
  }
}