export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { fetchGoogleCalendars } from "../../../../../lib/googleCalendar";
import { getAuthorizedGoogleOAuthClient } from "../../../../../lib/calendar/getAuthorizedGoogleOAuthClient";
import {
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../../lib/server/authenticatedProfile";

export async function POST(req: NextRequest) {
  try {
    const profile =
      await requireAuthenticatedProfile(req);

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("calendar_connected", true)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Google calendar connection not found", details: connectionError?.message },
        { status: 404 }
      );
    }

    const oauth2Client = await getAuthorizedGoogleOAuthClient(connection);
    const calendars = await fetchGoogleCalendars(oauth2Client);

    const rows = calendars.map((cal: any) => ({
      calendar_connection_id: connection.id,
      provider_calendar_id: cal.provider_calendar_id,
      name: cal.name,
      timezone: cal.timezone,
      is_primary: cal.is_primary,
      is_selected: cal.provider_calendar_id === connection.default_calendar_id,
      updated_at: new Date().toISOString(),
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
      { status: requestErrorStatus(error) }
    );
  }
}
