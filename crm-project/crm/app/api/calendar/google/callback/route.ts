export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getGoogleOAuthClient,
  fetchGoogleAccountEmail,
  fetchGoogleCalendars,
} from "../../../../../lib/googleCalendar";

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

async function resolveCalendarTargetProfile(profile: {
  id: string;
  org_id: string;
  role: string;
  email: string | null;
}) {
  if (profile.role === "agent") return profile;

  if (profile.role === "admin" || profile.role === "platform_admin") {
    const { data: rotationMember, error: rotationError } = await supabaseAdmin
      .from("rotation_members")
      .select("user_id")
      .eq("org_id", profile.org_id)
      .eq("is_active", true)
      .order("last_assigned_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    if (rotationError) throw new Error(rotationError.message);

    if (rotationMember?.user_id) {
      const { data: routedUser, error: routedUserError } = await supabaseAdmin
        .from("users")
        .select("user_id, email, org_id")
        .eq("id", rotationMember.user_id)
        .eq("org_id", profile.org_id)
        .maybeSingle();

      if (routedUserError) throw new Error(routedUserError.message);

      if (routedUser?.user_id) {
        const { data: routedProfile, error: routedProfileError } =
          await supabaseAdmin
            .from("profiles")
            .select("id, org_id, role, email")
            .eq("id", routedUser.user_id)
            .eq("org_id", profile.org_id)
            .maybeSingle();

        if (routedProfileError) throw new Error(routedProfileError.message);
        if (routedProfile?.id) return routedProfile;
      }
    }

    const { data: fallbackAgent, error: fallbackAgentError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, org_id, role, email")
        .eq("org_id", profile.org_id)
        .eq("role", "agent")
        .order("email", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (fallbackAgentError) throw new Error(fallbackAgentError.message);
    if (fallbackAgent?.id) return fallbackAgent;
  }

  return profile;
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

    const parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    const profileId = parsedState?.profileId;

    if (!profileId) {
      return NextResponse.json(
        { error: "Invalid state / missing profileId" },
        { status: 400 }
      );
    }

    const profile = await getProfile(profileId);
    const targetProfile = await resolveCalendarTargetProfile(profile);

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

    await supabaseAdmin
      .from("calendar_connections")
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", targetProfile.id)
      .eq("provider", "google")
      .neq("id", connection.id);

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
    return NextResponse.json(
      { error: "Google callback failed", details: error.message },
      { status: 500 }
    );
  }
}