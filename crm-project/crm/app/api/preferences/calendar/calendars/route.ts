// crm/app/api/preferences/calendar/calendars/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getAuthorizedGoogleOAuthClient } from "../../../../../lib/calendar/getAuthorizedGoogleOAuthClient";

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const { data: connection, error } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profileId)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!connection) {
      return NextResponse.json(
        { error: "No active Google calendar connection found" },
        { status: 404 }
      );
    }

    const oauth2Client = await getAuthorizedGoogleOAuthClient(connection);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const result = await calendar.calendarList.list();

    const calendars =
      result.data.items?.map((item) => ({
        id: item.id,
        summary: item.summary,
        primary: !!item.primary,
        accessRole: item.accessRole,
      })) || [];

    return NextResponse.json({
      ok: true,
      calendars,
      selectedDefaultCalendarId: connection.default_calendar_id || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load Google calendars" },
      { status: 500 }
    );
  }
}
