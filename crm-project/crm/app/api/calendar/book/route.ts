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
  const ampm = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() || "";

  const dateText = d.toLocaleDateString("en-CA", {
    timeZone: BOISE_TZ,
  }); // YYYY-MM-DD

  return {
    dateText,
    timeText,
    hour,
    minute,
    ampm,
  };
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
        { error: "No active default Google calendar connection found", details: connectionError?.message },
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

    const leadName =
      lead.name ||
      [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
      lead.email ||
      lead.phone ||
      "Relocation Lead";

    const summary = `Relocation Consultation - ${leadName}`;

    const descriptionLines = [
      `Lead ID: ${lead.id}`,
      `Name: ${lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "N/A"}`,
      `Email: ${lead.email || "N/A"}`,
      `Phone: ${lead.phone || "N/A"}`,
      `Timeline: ${lead.move_timeline || "N/A"}`,
      `Price Range: ${lead.price_range || "N/A"}`,
      `Preferred Areas: ${lead.preferred_areas || "N/A"}`,
      `Source: ${lead.lead_source || lead.source || "N/A"}`,
    ];

    const event = {
      summary,
      description: descriptionLines.join("\n"),
      start: {
        dateTime: start.toISOString(),
        timeZone: BOISE_TZ,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: BOISE_TZ,
      },
      attendees: lead.email ? [{ email: lead.email }] : [],
    };

    const { data: createdEvent } = await calendar.events.insert({
      calendarId: connection.default_calendar_id || connection.account_email,
      requestBody: event,
    });

    const { dateText, timeText, hour, minute, ampm } = formatTimeParts(slot.slot_iso);

    const notesPrefix = lead.notes ? `${lead.notes}\n\n` : "";
    const notesWithEvent = `${notesPrefix}Google Calendar Event ID: ${createdEvent.id || "N/A"}\nGoogle Calendar Link: ${createdEvent.htmlLink || "N/A"}`;

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        appointment_date: dateText,
        appointment_time: timeText,
        appointment_hour: hour,
        appointment_minute: minute,
        appointment_ampm: ampm,
        appointment_requested: true,
        appointment_status: "booked",
        appointment_type: "relocation",
        agent_status: "appointment_booked",
        notes: notesWithEvent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Event created but failed updating lead", details: updateError.message, event_id: createdEvent.id },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      event_id: createdEvent.id,
      event_link: createdEvent.htmlLink,
      slot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to book calendar event", details: error.message },
      { status: 500 }
    );
  }
}