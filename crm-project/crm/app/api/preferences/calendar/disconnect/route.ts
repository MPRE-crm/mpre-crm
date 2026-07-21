// crm/app/api/preferences/calendar/disconnect/route.ts
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
    const { provider = "google" } = body;

    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .update({
        account_email: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        scope: null,
        calendar_connected: false,
        is_active: false,
        is_default: false,
        default_calendar_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", profile.id)
      .eq("provider", provider)
      .eq("is_active", true)
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
      `);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, updated: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to disconnect calendar" },
      { status: requestErrorStatus(err) }
    );
  }
}