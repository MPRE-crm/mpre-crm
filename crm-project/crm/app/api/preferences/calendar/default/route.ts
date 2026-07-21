// crm/app/api/preferences/calendar/default/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../../lib/server/authenticatedProfile";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const profile =
      await requireAuthenticatedProfile(req);
    const body = await req.json();
    const { calendarId } = body;

    if (!calendarId) {
      return NextResponse.json(
        { error: "Missing calendarId" },
        { status: 400 }
      );
    }

    const { data: connection, error: findError } = await supabaseAdmin
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

    if (findError) throw new Error(findError.message);
    if (!connection) {
      return NextResponse.json(
        { error: "No active Google connection found" },
        { status: 404 }
      );
    }

    const {
      data: selectedCalendar,
      error: selectedCalendarError,
    } = await supabaseAdmin
      .from("calendar_calendars")
      .select("id")
      .eq("calendar_connection_id", connection.id)
      .eq("provider_calendar_id", String(calendarId))
      .maybeSingle();

    if (selectedCalendarError) {
      throw new Error(selectedCalendarError.message);
    }

    if (!selectedCalendar) {
      return NextResponse.json(
        {
          error:
            "The selected calendar does not belong to this Google connection.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .update({
        default_calendar_id: calendarId,
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .select(`
        id,
        agent_id,
        organization_id,
        provider,
        account_email,
        token_expires_at,
        scope,
        calendar_connected,
        is_active,
        is_default,
        default_calendar_id,
        created_at,
        updated_at
      `)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, connection: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save default calendar" },
      { status: requestErrorStatus(err) }
    );
  }
}