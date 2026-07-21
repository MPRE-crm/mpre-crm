// crm/lib/rotation/getNextAssignee.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export type Assignee = { user_id: number } | null;

type RotationMemberRow = {
  user_id: number;
  last_assigned_at: string | null;
};

type AvailabilityBlockRow = {
  agent_id: string;
  block_type:
    | "one_time"
    | "recurring_weekly"
    | "vacation"
    | "same_day_pause"
    | "out_of_office";
  start_at: string | null;
  end_at: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
};

type ScheduleSettingsRow = {
  agent_id: string;
  org_id: string;
  workday_start_hour: number;
  workday_end_hour: number;
  saturday_enabled: boolean;
  sunday_enabled: boolean;
  travel_buffer_minutes?: 15 | 30 | 60;
  daily_appointment_cap?: number;
  is_active: boolean;
};

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;
const DEFAULT_SATURDAY_ENABLED = true;
const DEFAULT_SUNDAY_ENABLED = false;
const DEFAULT_DAILY_APPOINTMENT_CAP = 6;

function overlapsNow(
  startAt: string | null,
  endAt: string | null,
  now: Date
): boolean {
  if (!startAt || !endAt) return false;

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  return now >= start && now < end;
}

function getWeekdayNumber(date: Date): number {
  return date.getDay();
}

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) return null;

  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function getNowMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isBlockedNow(
  blocks: AvailabilityBlockRow[],
  now: Date
): boolean {
  const weekday = getWeekdayNumber(now);
  const nowMinutes = getNowMinutes(now);

  for (const block of blocks) {
    if (!block.is_active) continue;

    if (block.block_type === "recurring_weekly") {
      if (block.weekday !== weekday) continue;

      const startMinutes = parseTimeToMinutes(block.start_time);
      const endMinutes = parseTimeToMinutes(block.end_time);

      if (startMinutes === null || endMinutes === null) continue;

      if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
        return true;
      }

      continue;
    }

    if (
      block.block_type === "one_time" ||
      block.block_type === "vacation" ||
      block.block_type === "same_day_pause" ||
      block.block_type === "out_of_office"
    ) {
      if (overlapsNow(block.start_at, block.end_at, now)) {
        return true;
      }
    }
  }

  return false;
}

function isWithinWorkingSchedule(
  settings: ScheduleSettingsRow | null,
  now: Date
): boolean {
  const weekday = getWeekdayNumber(now);
  const hour = now.getHours();
  const minute = now.getMinutes();

  const startHour = settings?.workday_start_hour ?? DEFAULT_START_HOUR;
  const endHour = settings?.workday_end_hour ?? DEFAULT_END_HOUR;
  const saturdayEnabled =
    settings?.saturday_enabled ?? DEFAULT_SATURDAY_ENABLED;
  const sundayEnabled =
    settings?.sunday_enabled ?? DEFAULT_SUNDAY_ENABLED;

  if (weekday === 6 && !saturdayEnabled) return false;
  if (weekday === 0 && !sundayEnabled) return false;

  if (hour < startHour) return false;
  if (hour > endHour) return false;
  if (hour === endHour && minute > 0) return false;

  return true;
}

async function getProfileIdForUserId(
  userId: number,
  orgId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("❌ getNextAssignee users lookup error", error);
    return null;
  }

  return data?.user_id || null;
}

async function getAgentScheduleSettings(
  profileId: string,
  orgId: string
): Promise<ScheduleSettingsRow | null> {
  const { data, error } = await supabase
    .from("agent_schedule_settings")
    .select(`
      agent_id,
      org_id,
      workday_start_hour,
      workday_end_hour,
      saturday_enabled,
      sunday_enabled,
      travel_buffer_minutes,
      daily_appointment_cap,
      is_active
    `)
    .eq("org_id", orgId)
    .eq("agent_id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("❌ getNextAssignee schedule lookup error", error);
    return null;
  }

  return (data as ScheduleSettingsRow | null) || null;
}

async function hasPendingAppointmentApproval(
  profileId: string,
  orgId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("appointment_approvals")
    .select("id")
    .eq("org_id", orgId)
    .eq("current_agent_id", profileId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ getNextAssignee pending approval lookup error", error);
    return false;
  }

  return Boolean(data?.id);
}

async function getTodayAppointmentCount(
  profileId: string,
  orgId: string,
  now: Date
): Promise<number> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from("appointment_approvals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("current_agent_id", profileId)
    .in("status", ["pending", "accepted"])
    .gte("slot_iso", startOfDay.toISOString())
    .lte("slot_iso", endOfDay.toISOString());

  if (error) {
    console.error("❌ getNextAssignee daily cap lookup error", error);
    return 0;
  }

  return count || 0;
}

async function isAgentAvailableNow(
  userId: number,
  orgId: string,
  now: Date
): Promise<boolean> {
  const profileId = await getProfileIdForUserId(userId, orgId);

  if (!profileId) {
    return true;
  }

  const [availabilityRes, scheduleSettings, hasPendingApproval, todayCount] =
    await Promise.all([
      supabase
        .from("agent_availability_blocks")
        .select(`
          agent_id,
          block_type,
          start_at,
          end_at,
          weekday,
          start_time,
          end_time,
          is_active
        `)
        .eq("org_id", orgId)
        .or(`agent_id.eq.${profileId},block_scope.eq.team`)
        .eq("is_active", true),
      getAgentScheduleSettings(profileId, orgId),
      hasPendingAppointmentApproval(profileId, orgId),
      getTodayAppointmentCount(profileId, orgId, now),
    ]);

  if (availabilityRes.error) {
    console.error(
      "❌ getNextAssignee availability lookup error",
      availabilityRes.error
    );
    return true;
  }

  if (hasPendingApproval) {
    return false;
  }

  const dailyCap =
    scheduleSettings?.daily_appointment_cap ?? DEFAULT_DAILY_APPOINTMENT_CAP;

  if (todayCount >= dailyCap) {
    return false;
  }

  if (!isWithinWorkingSchedule(scheduleSettings, now)) {
    return false;
  }

  return !isBlockedNow(
    (availabilityRes.data || []) as AvailabilityBlockRow[],
    now
  );
}

export async function getNextAssignee(org_id: string): Promise<Assignee> {
  const now = new Date();

  const { data, error } = await supabase
    .from("rotation_members")
    .select("user_id, last_assigned_at")
    .eq("org_id", org_id)
    .eq("is_active", true)
    .order("last_assigned_at", { ascending: true, nullsFirst: true });

  if (!error && data && data.length > 0) {
    for (const member of data as RotationMemberRow[]) {
      const available = await isAgentAvailableNow(member.user_id, org_id, now);
      if (!available) continue;

      await supabase
        .from("rotation_members")
        .update({ last_assigned_at: now.toISOString() })
        .eq("org_id", org_id)
        .eq("user_id", member.user_id);

      return { user_id: member.user_id as number };
    }
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id")
    .eq("org_id", org_id)
    .eq("role", "agent")
    .eq("is_active", true);

  if (usersError) {
    console.error("❌ getNextAssignee fallback users lookup error", usersError);
    return null;
  }

  if (users && users.length > 0) {
    for (const user of users) {
      const available = await isAgentAvailableNow(user.id as number, org_id, now);
      if (!available) continue;

      return { user_id: user.id as number };
    }
  }

  return null;
}