export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const profile = await getProfile(profileId);

    const { data, error } = await supabaseAdmin
      .from("agent_schedule_settings")
      .select("*")
      .eq("agent_id", profile.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      profile: {
        id: profile.id,
        org_id: profile.org_id,
        role: profile.role,
        email: profile.email,
      },
      settings:
        data || {
          agent_id: profile.id,
          org_id: profile.org_id,
          workday_start_hour: 9,
          workday_end_hour: 18,
          saturday_enabled: true,
          sunday_enabled: false,
          travel_buffer_minutes: 30,
          daily_appointment_cap: 6,
          is_active: true,
        },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load schedule settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      profileId,
      workday_start_hour,
      workday_end_hour,
      saturday_enabled,
      sunday_enabled,
      travel_buffer_minutes,
      daily_appointment_cap,
      is_active,
    } = body;

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    if (
      typeof workday_start_hour !== "number" ||
      typeof workday_end_hour !== "number"
    ) {
      return NextResponse.json(
        { error: "workday_start_hour and workday_end_hour must be numbers" },
        { status: 400 }
      );
    }

    if (workday_start_hour < 0 || workday_start_hour > 23) {
      return NextResponse.json(
        { error: "workday_start_hour must be between 0 and 23" },
        { status: 400 }
      );
    }

    if (workday_end_hour < 0 || workday_end_hour > 23) {
      return NextResponse.json(
        { error: "workday_end_hour must be between 0 and 23" },
        { status: 400 }
      );
    }

    if (workday_end_hour <= workday_start_hour) {
      return NextResponse.json(
        { error: "workday_end_hour must be greater than workday_start_hour" },
        { status: 400 }
      );
    }

    if (
      typeof travel_buffer_minutes !== "number" ||
      ![15, 30, 60].includes(travel_buffer_minutes)
    ) {
      return NextResponse.json(
        { error: "travel_buffer_minutes must be 15, 30, or 60" },
        { status: 400 }
      );
    }

    if (
      typeof daily_appointment_cap !== "number" ||
      daily_appointment_cap < 1 ||
      daily_appointment_cap > 20
    ) {
      return NextResponse.json(
        { error: "daily_appointment_cap must be between 1 and 20" },
        { status: 400 }
      );
    }

    const profile = await getProfile(profileId);

    const payload = {
      agent_id: profile.id,
      org_id: profile.org_id,
      workday_start_hour,
      workday_end_hour,
      saturday_enabled: Boolean(saturday_enabled),
      sunday_enabled: Boolean(sunday_enabled),
      travel_buffer_minutes,
      daily_appointment_cap,
      is_active: typeof is_active === "boolean" ? is_active : true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("agent_schedule_settings")
      .upsert(payload, { onConflict: "agent_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, settings: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save schedule settings" },
      { status: 500 }
    );
  }
}