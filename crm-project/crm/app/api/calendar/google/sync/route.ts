import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getGoogleOAuthClient, fetchGoogleCalendars } from "../../../../../lib/googleCalendar";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profileId)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Google calendar connection not found", details: connectionError?.message },
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

    const calendars = await fetchGoogleCalendars(oauth2Client);

    const rows = calendars.map((cal: any) => ({
      calendar_connection_id: connection.id,
      provider_calendar_id: cal.provider_calendar_id,
      name: cal.name,
      timezone: cal.timezone,
      is_primary: cal.is_primary,
      is_selected: cal.provider_calendar_id === connection.default_calendar_id,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("calendar_calendars")
        .upsert(rows, {
          onConflict: "calendar_connection_id,provider_calendar_id",
        });

      if (upsertError) {
        return NextResponse.json(
          { error: "Failed to sync Google calendars", details: upsertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      synced: rows.length,
      default_calendar_id: connection.default_calendar_id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Google calendar sync failed", details: error.message },
      { status: 500 }
    );
  }
}