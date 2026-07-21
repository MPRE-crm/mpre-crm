export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getGoogleOAuthClient,
  fetchGoogleAccountEmail,
  fetchGoogleCalendars,
} from "../../../../../lib/googleCalendar";
import {
  readGoogleOAuthState,
} from "../../../../../lib/calendar/googleOAuthState";

async function getProfile(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id, role, email")
    .eq("id", profileId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");

  return data;
}

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

    const parsedState =
      readGoogleOAuthState(state);
    const profile =
      await getProfile(parsedState.profileId);
    const targetProfile = profile;

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const accountEmail = await fetchGoogleAccountEmail(oauth2Client);
    const calendars = await fetchGoogleCalendars(oauth2Client);

    const { data: existingConnection } = await supabaseAdmin
      .from("calendar_connections")
      .select("id, refresh_token, account_email")
      .eq("agent_id", targetProfile.id)
      .eq("provider", "google")
      .eq("account_email", accountEmail || targetProfile.email || profile.email || "")
      .maybeSingle();

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    const primaryCalendar = calendars.find((c) => c.is_primary) || calendars[0] || null;

    const upsertPayload = {
      agent_id: targetProfile.id,
      organization_id: targetProfile.org_id,
      provider: "google",
      account_email: accountEmail || targetProfile.email || profile.email || null,
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || existingConnection?.refresh_token || null,
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
        {
          error: "Failed to save calendar connection",
          details: connectionError?.message,
        },
        { status: 500 }
      );
    }

    const { error: defaultResetError } = await supabaseAdmin
      .from("calendar_connections")
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", targetProfile.id)
      .eq("provider", "google")
      .neq("id", connection.id);

    if (defaultResetError) {
      throw new Error(
        `Failed to update the default Google connection: ${defaultResetError.message}`
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
          {
            error: "Connection saved, but calendar sync failed",
            details: calendarsError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.redirect(`${origin}/dashboard/preferences?calendar=google_connected`);
  } catch (error: any) {
    const status =
      String(error?.message || "")
        .toLowerCase()
        .includes("state")
        ? 400
        : 500;

    return NextResponse.json(
      { error: "Google callback failed", details: error.message },
      { status }
    );
  }
}