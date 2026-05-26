// crm/app/api/preferences/calendar/calendars/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getGoogleOauthClient } from "../../../../../lib/calendar/googleOauthClient";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const { data: connection, error } = await supabase
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

    if (!connection.refresh_token) {
      return NextResponse.json(
        { error: "Missing Google refresh token" },
        { status: 400 }
      );
    }

    const oauth2Client = getGoogleOauthClient();
    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
      access_token: connection.access_token || undefined,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : undefined,
    });

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