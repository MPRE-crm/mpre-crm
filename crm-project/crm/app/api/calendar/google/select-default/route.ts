export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profileId, providerCalendarId } = body;

    if (!profileId || !providerCalendarId) {
      return NextResponse.json(
        { error: "Missing profileId or providerCalendarId" },
        { status: 400 }
      );
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("agent_id", profileId)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Google connection not found", details: connectionError?.message },
        { status: 404 }
      );
    }

    const { error: updateConnectionError } = await supabaseAdmin
      .from("calendar_connections")
      .update({
        default_calendar_id: providerCalendarId,
        is_default: true,
      })
      .eq("id", connection.id);

    if (updateConnectionError) {
      return NextResponse.json(
        { error: "Failed to update default calendar", details: updateConnectionError.message },
        { status: 500 }
      );
    }

    const { error: clearSelectedError } = await supabaseAdmin
      .from("calendar_calendars")
      .update({ is_selected: false })
      .eq("calendar_connection_id", connection.id);

    if (clearSelectedError) {
      return NextResponse.json(
        { error: "Failed clearing selected calendars", details: clearSelectedError.message },
        { status: 500 }
      );
    }

    const { error: setSelectedError } = await supabaseAdmin
      .from("calendar_calendars")
      .update({ is_selected: true })
      .eq("calendar_connection_id", connection.id)
      .eq("provider_calendar_id", providerCalendarId);

    if (setSelectedError) {
      return NextResponse.json(
        { error: "Failed setting selected calendar", details: setSelectedError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      default_calendar_id: providerCalendarId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Select default calendar failed", details: error.message },
      { status: 500 }
    );
  }
}