import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const profile =
      await requireAuthenticatedProfile(req);
    const targetProfile = profile;

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
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
      { status: requestErrorStatus(err) }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Missing provider" },
        { status: 400 }
      );
    }

    const normalizedProvider = String(provider).toLowerCase();

    if (!["google", "microsoft", "apple"].includes(normalizedProvider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const profile =
      await requireAuthenticatedProfile(req);
    const targetProfile = profile;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("calendar_connections")
      .select("id")
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

    return NextResponse.json({
      ok: true,
      connection: data,
      profile,
      targetProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save provider" },
      { status: requestErrorStatus(err) }
    );
  }
}