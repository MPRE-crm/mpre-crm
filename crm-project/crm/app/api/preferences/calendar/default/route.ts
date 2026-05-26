// crm/app/api/preferences/calendar/default/route.ts
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
    const { profileId, calendarId } = body;

    if (!profileId || !calendarId) {
      return NextResponse.json(
        { error: "Missing profileId or calendarId" },
        { status: 400 }
      );
    }

    const { data: connection, error: findError } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profileId)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!connection) {
      return NextResponse.json(
        { error: "No active Google connection found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("calendar_connections")
      .update({
        default_calendar_id: calendarId,
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, connection: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save default calendar" },
      { status: 500 }
    );
  }
}