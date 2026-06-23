export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthorizedGoogleOAuthClient } from "../../../../lib/calendar/getAuthorizedGoogleOAuthClient";

function extractGoogleEventId(notes: string | null) {
  if (!notes) return null;

  const matches = Array.from(
    notes.matchAll(/Google Calendar Event ID:\s*([^\n\r]+)/gi)
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { org_id, lead_id } = body;

    if (!org_id || !lead_id) {
      return NextResponse.json(
        { error: "Missing org_id or lead_id" },
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

    const googleEventId = extractGoogleEventId(lead.notes);

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("organization_id", org_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        {
          error: "Failed to load calendar connection",
          details: connectionError.message,
        },
        { status: 500 }
      );
    }

    if (connection && googleEventId) {
      const oauth2Client = await getAuthorizedGoogleOAuthClient(connection);

      const calendar = google.calendar({
        version: "v3",
        auth: oauth2Client,
      });

      try {
        await calendar.events.delete({
          calendarId: connection.default_calendar_id || connection.account_email,
          eventId: googleEventId,
        });
      } catch (googleError: any) {
        const status = googleError?.response?.status;

        if (status !== 404) {
          return NextResponse.json(
            {
              error: "Failed to cancel Google Calendar event",
              details: googleError.message,
            },
            { status: 500 }
          );
        }
      }
    }

    const canceledStamp = new Date().toISOString();
    const cleanedNotes = cleanAppointmentNotes(lead.notes);

    const updatedNotes = [
      cleanedNotes,
      `Appointment canceled: ${canceledStamp}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        appointment_status: "Canceled",
        agent_status: "appointment_canceled",
        notes: updatedNotes,
        lead_heat: "hot",
        last_meaningful_engagement_at: canceledStamp,
        next_contact_at: canceledStamp,
        hot_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        updated_at: canceledStamp,
      })
      .eq("id", lead.id);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update canceled appointment",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      canceled_event_id: googleEventId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to cancel appointment", details: error.message },
      { status: 500 }
    );
  }
}