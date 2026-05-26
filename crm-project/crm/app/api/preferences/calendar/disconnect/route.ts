// crm/app/api/preferences/calendar/disconnect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profileId, provider = "google" } = body;

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("calendar_connections")
      .update({
        account_email: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        scope: null,
        calendar_connected: false,
        is_default: false,
        default_calendar_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", profileId)
      .eq("provider", provider)
      .eq("is_active", true)
      .select();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, updated: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}