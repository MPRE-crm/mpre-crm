export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type WeeklyHourInput = {
  weekday: number;
  is_enabled: boolean;
  start_hour: number;
  end_hour: number;
};

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

async function resolveScheduleTargetProfile(profile: {
  id: string;
  org_id: string;
  role: string;
  email: string | null;
}) {
  if (profile.role === "agent") {
    return profile;
  }

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

        if (routedProfile?.id) {
          return routedProfile;
        }
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

    if (fallbackAgent?.id) {
      return fallbackAgent;
    }
  }

  return profile;
}

function buildDefaultWeeklyHours(args: {
  agent_id: string;
  org_id: string;
  workday_start_hour: number;
  workday_end_hour: number;
  saturday_enabled: boolean;
  sunday_enabled: boolean;
}) {
  return Array.from({ length: 7 }, (_, weekday) => ({
    agent_id: args.agent_id,
    org_id: args.org_id,
    weekday,
    is_enabled:
      weekday === 0
        ? args.sunday_enabled
        : weekday === 6
          ? args.saturday_enabled
          : true,
    start_hour: args.workday_start_hour,
    end_hour: args.workday_end_hour,
  }));
}

function validateWeeklyHours(weeklyHours: any): WeeklyHourInput[] {
  if (!Array.isArray(weeklyHours)) {
    return [];
  }

  if (weeklyHours.length !== 7) {
    throw new Error("weekly_hours must include 7 days");
  }

  return weeklyHours.map((row: any) => {
    const weekday = Number(row.weekday);
    const start_hour = Number(row.start_hour);
    const end_hour = Number(row.end_hour);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new Error("weekly_hours weekday must be between 0 and 6");
    }

    if (!Number.isInteger(start_hour) || start_hour < 0 || start_hour > 23) {
      throw new Error("weekly_hours start_hour must be between 0 and 23");
    }

    if (!Number.isInteger(end_hour) || end_hour < 0 || end_hour > 23) {
      throw new Error("weekly_hours end_hour must be between 0 and 23");
    }

    if (end_hour <= start_hour) {
      throw new Error("weekly_hours end_hour must be greater than start_hour");
    }

    return {
      weekday,
      is_enabled: Boolean(row.is_enabled),
      start_hour,
      end_hour,
    };
  });
}

function normalizeNullableHour(value: any) {
  if (value === null || value === undefined || value === "") return null;

  const hour = Number(value);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("after-hours values must be between 0 and 23");
  }

  return hour;
}

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const profile = await getProfile(profileId);
    const targetProfile = await resolveScheduleTargetProfile(profile);

    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("agent_schedule_settings")
      .select("*")
      .eq("agent_id", targetProfile.id)
      .maybeSingle();

    if (settingsError) throw new Error(settingsError.message);

    const settings =
      settingsData || {
        agent_id: targetProfile.id,
        org_id: targetProfile.org_id,
        workday_start_hour: 9,
        workday_end_hour: 18,
        saturday_enabled: true,
        sunday_enabled: false,
        travel_buffer_minutes: 30,
        daily_appointment_cap: 6,
        allow_after_hours_appointments: false,
        after_hours_start_hour: null,
        after_hours_end_hour: null,
        is_active: true,
      };

    const { data: weeklyHoursData, error: weeklyHoursError } =
      await supabaseAdmin
        .from("agent_weekly_hours")
        .select("*")
        .eq("agent_id", targetProfile.id)
        .eq("org_id", targetProfile.org_id)
        .order("weekday", { ascending: true });

    if (weeklyHoursError) throw new Error(weeklyHoursError.message);

    const weeklyHours =
      weeklyHoursData && weeklyHoursData.length === 7
        ? weeklyHoursData
        : buildDefaultWeeklyHours({
            agent_id: targetProfile.id,
            org_id: targetProfile.org_id,
            workday_start_hour: settings.workday_start_hour,
            workday_end_hour: settings.workday_end_hour,
            saturday_enabled: settings.saturday_enabled,
            sunday_enabled: settings.sunday_enabled,
          });

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
      settings,
      weekly_hours: weeklyHours,
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
      allow_after_hours_appointments,
      after_hours_start_hour,
      after_hours_end_hour,
      is_active,
      weekly_hours,
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

    const normalizedAfterHoursEnabled = Boolean(allow_after_hours_appointments);
    const normalizedAfterHoursStart = normalizeNullableHour(after_hours_start_hour);
    const normalizedAfterHoursEnd = normalizeNullableHour(after_hours_end_hour);

    if (normalizedAfterHoursEnabled) {
      if (
        normalizedAfterHoursStart === null ||
        normalizedAfterHoursEnd === null
      ) {
        return NextResponse.json(
          {
            error:
              "after_hours_start_hour and after_hours_end_hour are required when after-hours appointments are enabled",
          },
          { status: 400 }
        );
      }

      if (normalizedAfterHoursEnd <= normalizedAfterHoursStart) {
        return NextResponse.json(
          { error: "after_hours_end_hour must be greater than after_hours_start_hour" },
          { status: 400 }
        );
      }
    }

    const profile = await getProfile(profileId);
    const targetProfile = await resolveScheduleTargetProfile(profile);

    const payload = {
      agent_id: targetProfile.id,
      org_id: targetProfile.org_id,
      workday_start_hour,
      workday_end_hour,
      saturday_enabled: Boolean(saturday_enabled),
      sunday_enabled: Boolean(sunday_enabled),
      travel_buffer_minutes,
      daily_appointment_cap,
      allow_after_hours_appointments: normalizedAfterHoursEnabled,
      after_hours_start_hour: normalizedAfterHoursEnabled
        ? normalizedAfterHoursStart
        : null,
      after_hours_end_hour: normalizedAfterHoursEnabled
        ? normalizedAfterHoursEnd
        : null,
      is_active: typeof is_active === "boolean" ? is_active : true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("agent_schedule_settings")
      .upsert(payload, { onConflict: "agent_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const weeklyHourRows = validateWeeklyHours(weekly_hours);

    if (weeklyHourRows.length) {
      const weeklyPayload = weeklyHourRows.map((row) => ({
        agent_id: targetProfile.id,
        org_id: targetProfile.org_id,
        weekday: row.weekday,
        is_enabled: row.is_enabled,
        start_hour: row.start_hour,
        end_hour: row.end_hour,
        updated_at: new Date().toISOString(),
      }));

      const { error: weeklyHoursSaveError } = await supabaseAdmin
        .from("agent_weekly_hours")
        .upsert(weeklyPayload, { onConflict: "agent_id,weekday" });

      if (weeklyHoursSaveError) {
        throw new Error(weeklyHoursSaveError.message);
      }
    }

    return NextResponse.json({
      ok: true,
      settings: data,
      profile,
      targetProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save schedule settings" },
      { status: 500 }
    );
  }
}