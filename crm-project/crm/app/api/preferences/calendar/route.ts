import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

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
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const profile = await getProfile(profileId);
    const targetProfile = await resolveCalendarTargetProfile(profile);

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", targetProfile.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const connections = data || [];

    const active =
      connections.find((row) => row.is_active && row.calendar_connected && row.is_default) ||
      connections.find((row) => row.is_active && row.calendar_connected) ||
      connections.find((row) => row.is_active && row.is_default) ||
      connections.find((row) => row.is_active) ||
      connections[0] ||
      null;

    return NextResponse.json({
      profile: {
        id: profile.id,
        org_id: profile.org_id,
        role: profile.role,
        email: profile.email,
      },
      targetProfile: {
        id: targetProfile.id,
        org_id: targetProfile.org_id,
        role: targetProfile.role,
        email: targetProfile.email,
      },
      connection: active,
      connections,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load calendar preferences" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { profileId, provider } = body;

    if (!profileId || !provider) {
      return NextResponse.json(
        { error: "Missing profileId or provider" },
        { status: 400 }
      );
    }

    const normalizedProvider = String(provider).toLowerCase();

    if (!["google", "microsoft", "apple"].includes(normalizedProvider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const profile = await getProfile(profileId);
    const targetProfile = await resolveCalendarTargetProfile(profile);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", targetProfile.id)
      .eq("provider", normalizedProvider)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("calendar_connections")
        .update({
          organization_id: targetProfile.org_id,
          provider: normalizedProvider,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return NextResponse.json({
        ok: true,
        connection: data,
        profile,
        targetProfile,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .insert({
        agent_id: targetProfile.id,
        organization_id: targetProfile.org_id,
        provider: normalizedProvider,
        account_email: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        scope: null,
        calendar_connected: false,
        is_active: true,
        is_default: false,
        default_calendar_id: null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      connection: data,
      profile,
      targetProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save provider" },
      { status: 500 }
    );
  }
}