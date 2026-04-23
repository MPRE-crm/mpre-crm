import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

async function getProfile(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id, email")
    .eq("id", profileId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");

  return data;
}

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const profile = await getProfile(profileId);

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profileId)
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
        email: profile.email,
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
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

    const profile = await getProfile(profileId);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profileId)
      .eq("provider", normalizedProvider)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("calendar_connections")
        .update({
          organization_id: profile.org_id,
          provider: normalizedProvider,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return NextResponse.json({ ok: true, connection: data });
    }

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .insert({
        agent_id: profileId,
        organization_id: profile.org_id,
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

    return NextResponse.json({ ok: true, connection: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save provider" },
      { status: 500 }
    );
  }
}