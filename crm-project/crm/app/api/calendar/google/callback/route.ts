import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getGoogleOAuthClient,
  fetchGoogleAccountEmail,
  fetchGoogleCalendars,
} from "../../../../../lib/googleCalendar";

export async function GET(req: NextRequest) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    if (!state) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    const parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    const profileId = parsedState?.profileId;

    if (!profileId) {
      return NextResponse.json({ error: "Invalid state / missing profileId" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, org_id, email")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found", details: profileError?.message },
        { status: 404 }
      );
    }

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const accountEmail = await fetchGoogleAccountEmail(oauth2Client);
    const calendars = await fetchGoogleCalendars(oauth2Client);

    const expiresAt =
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    const primaryCalendar = calendars.find((c) => c.is_primary) || calendars[0] || null;

    const upsertPayload = {
      agent_id: profile.id,
      organization_id: profile.org_id,
      provider: "google",
      account_email: accountEmail || profile.email || null,
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt,
      scope: Array.isArray(tokens.scope) ? tokens.scope.join(" ") : tokens.scope || null,
      calendar_connected: true,
      is_active: true,
      is_default: true,
      default_calendar_id: primaryCalendar?.provider_calendar_id || null,
    };

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .upsert(upsertPayload, {
        onConflict: "agent_id,provider,account_email",
      })
      .select()
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Failed to save calendar connection", details: connectionError?.message },
        { status: 500 }
      );
    }

    if (calendars.length > 0) {
      const rows = calendars.map((cal) => ({
        calendar_connection_id: connection.id,
        provider_calendar_id: cal.provider_calendar_id,
        name: cal.name,
        timezone: cal.timezone,
        is_primary: cal.is_primary,
        is_selected: cal.provider_calendar_id === connection.default_calendar_id,
      }));

      const { error: calendarsError } = await supabaseAdmin
        .from("calendar_calendars")
        .upsert(rows, {
          onConflict: "calendar_connection_id,provider_calendar_id",
        });

      if (calendarsError) {
        return NextResponse.json(
          { error: "Connection saved, but calendar sync failed", details: calendarsError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.redirect(`${origin}/dashboard?calendar=google_connected`);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Google callback failed", details: error.message },
      { status: 500 }
    );
  }
}