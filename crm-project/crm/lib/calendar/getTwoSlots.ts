// crm-project/crm/lib/calendar/getTwoSlots.ts

import { google } from "googleapis";
import { supabaseAdmin } from "../supabaseAdmin";
import { getAuthorizedGoogleOAuthClient } from "./getAuthorizedGoogleOAuthClient";

type GetTwoSlotsArgs = { org_id: string; lead_id?: string | null };

export type CalendarSlot = { slot_iso: string; slot_human: string };
export type TwoCalendarSlots = {
  A: CalendarSlot;
  B: CalendarSlot;
  agent_id?: string | null;
};

type AvailabilityBlock = {
  id: string;
  agent_id: string;
  org_id: string;
  block_type:
    | "one_time"
    | "recurring_weekly"
    | "vacation"
    | "same_day_pause"
    | "out_of_office";
  title: string | null;
  notes: string | null;
  start_at: string | null;
  end_at: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AgentScheduleSettings = {
  agent_id: string;
  org_id: string;
  workday_start_hour: number;
  workday_end_hour: number;
  saturday_enabled: boolean;
  sunday_enabled: boolean;
  travel_buffer_minutes: 15 | 30 | 60;
  daily_appointment_cap: number;
  allow_after_hours_appointments: boolean;
  after_hours_start_hour: number | null;
  after_hours_end_hour: number | null;
  is_active: boolean;
};

type AgentWeeklyHour = {
  id?: string;
  agent_id: string;
  org_id: string;
  weekday: number;
  is_enabled: boolean;
  start_hour: number;
  end_hour: number;
  created_at?: string;
  updated_at?: string;
};

const BOISE_TZ = "America/Boise";
const SLOT_MINUTES = 30;
const SAME_DAY_MIN_NOTICE_MINUTES = 120;
const SEARCH_DAYS = 14;

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;
const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;

const LUNCH_START_HOUR = 12;
const LUNCH_END_HOUR = 13;
const PREFERRED_REGULAR_APPOINTMENT_HOURS = [10, 14];

function buildPreferredAppointmentHours(
  settings: AgentScheduleSettings | null
): number[] {
  const hours = [...PREFERRED_REGULAR_APPOINTMENT_HOURS];

  if (
    settings?.allow_after_hours_appointments &&
    typeof settings.after_hours_start_hour === "number" &&
    typeof settings.after_hours_end_hour === "number" &&
    settings.after_hours_end_hour > settings.after_hours_start_hour
  ) {
    hours.push(settings.after_hours_start_hour);
  }

  return Array.from(new Set(hours)).filter((hour) => hour >= 0 && hour <= 23);
}

function buildFallbackAppointmentHours(): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour);
}

function getBoiseDateKey(date: Date): string {
  const parts = getTzParts(date, BOISE_TZ);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;
}

async function getDailyAppointmentCounts(args: {
  org_id: string;
  agent_id?: string | null;
  now: Date;
}): Promise<Record<string, number>> {
  const { org_id, agent_id, now } = args;

  if (!agent_id) return {};

  const searchEnd = new Date(now.getTime() + SEARCH_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("appointment_approvals")
    .select("slot_iso, status")
    .eq("org_id", org_id)
    .eq("current_agent_id", agent_id)
    .in("status", ["pending", "accepted"])
    .gte("slot_iso", now.toISOString())
    .lte("slot_iso", searchEnd.toISOString());

  if (error) {
    console.error("❌ getTwoSlots daily appointment cap lookup error", error);
    return {};
  }

  const counts: Record<string, number> = {};

  for (const row of data || []) {
    if (!row.slot_iso) continue;

    const key = getBoiseDateKey(new Date(row.slot_iso));
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

function isDayAtAppointmentCap(
  start: Date,
  settings: AgentScheduleSettings | null,
  dailyAppointmentCounts: Record<string, number>
): boolean {
  const cap = settings?.daily_appointment_cap ?? 6;
  const key = getBoiseDateKey(start);
  const count = dailyAppointmentCounts[key] || 0;

  return count >= cap;
}

function getTzParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday,
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getTzParts(date, timeZone);
  const utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return (utcMs - date.getTime()) / 60000;
}

function makeZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}

function addDaysInZone(base: Date, dayOffset: number, timeZone: string) {
  const parts = getTzParts(base, timeZone);
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 12, 0, 0)
  );
}

function toHuman(d: Date): string {
  const day = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: BOISE_TZ,
  });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOISE_TZ,
  });

  return `${day}, ${time} America/Boise`;
}

function isLunchBlocked(d: Date): boolean {
  const parts = getTzParts(d, BOISE_TZ);
  return parts.hour >= LUNCH_START_HOUR && parts.hour < LUNCH_END_HOUR;
}

function hasEnoughNotice(d: Date, now: Date): boolean {
  return d.getTime() - now.getTime() >= SAME_DAY_MIN_NOTICE_MINUTES * 60 * 1000;
}

function overlapsRange(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getWeekdayNumberInBoise(date: Date): number {
  const weekday = getTzParts(date, BOISE_TZ).weekday;
  if (weekday === "Sun") return 0;
  if (weekday === "Mon") return 1;
  if (weekday === "Tue") return 2;
  if (weekday === "Wed") return 3;
  if (weekday === "Thu") return 4;
  if (weekday === "Fri") return 5;
  return 6;
}

function getWeeklyHourForDate(
  date: Date,
  weeklyHours: AgentWeeklyHour[]
): AgentWeeklyHour | null {
  const weekday = getWeekdayNumberInBoise(date);
  return weeklyHours.find((row) => row.weekday === weekday) || null;
}

function getDailyWindow(
  date: Date,
  settings: AgentScheduleSettings | null,
  weeklyHours: AgentWeeklyHour[]
): {
  isEnabled: boolean;
  startHour: number;
  endHour: number;
} {
  const weeklyHour = getWeeklyHourForDate(date, weeklyHours);

  if (weeklyHour) {
    return {
      isEnabled: Boolean(weeklyHour.is_enabled),
      startHour: weeklyHour.start_hour,
      endHour: weeklyHour.end_hour,
    };
  }

  const weekday = getWeekdayNumberInBoise(date);

  if (weekday === 0) {
    return {
      isEnabled: settings?.sunday_enabled ?? false,
      startHour: settings?.workday_start_hour ?? DEFAULT_START_HOUR,
      endHour: settings?.workday_end_hour ?? DEFAULT_END_HOUR,
    };
  }

  if (weekday === 6) {
    return {
      isEnabled: settings?.saturday_enabled ?? true,
      startHour: settings?.workday_start_hour ?? DEFAULT_START_HOUR,
      endHour: settings?.workday_end_hour ?? DEFAULT_END_HOUR,
    };
  }

  return {
    isEnabled: true,
    startHour: settings?.workday_start_hour ?? DEFAULT_START_HOUR,
    endHour: settings?.workday_end_hour ?? DEFAULT_END_HOUR,
  };
}

function isWithinOfferWindow(
  date: Date,
  settings: AgentScheduleSettings | null,
  weeklyHours: AgentWeeklyHour[]
): boolean {
  const parts = getTzParts(date, BOISE_TZ);
  const dailyWindow = getDailyWindow(date, settings, weeklyHours);

  if (!dailyWindow.isEnabled) return false;

  const startMinutes = parts.hour * 60 + parts.minute;

  const regularStartMinutes = dailyWindow.startHour * 60;
  const regularEndMinutes = dailyWindow.endHour * 60;

  const insideRegularWindow =
    startMinutes >= regularStartMinutes && startMinutes <= regularEndMinutes;

  if (insideRegularWindow) return true;

  const afterHoursEnabled = Boolean(settings?.allow_after_hours_appointments);
  const afterStart = settings?.after_hours_start_hour;
  const afterEnd = settings?.after_hours_end_hour;

  if (
    afterHoursEnabled &&
    typeof afterStart === "number" &&
    typeof afterEnd === "number" &&
    afterEnd > afterStart
  ) {
    const afterStartMinutes = afterStart * 60;
    const afterEndMinutes = afterEnd * 60;

    return startMinutes >= afterStartMinutes && startMinutes <= afterEndMinutes;
  }

  return false;
}
 
function fitsInsideWorkHours(
  start: Date,
  end: Date,
  settings: AgentScheduleSettings | null,
  weeklyHours: AgentWeeklyHour[]
): boolean {
  const startParts = getTzParts(start, BOISE_TZ);
  const endParts = getTzParts(end, BOISE_TZ);
  const dailyWindow = getDailyWindow(start, settings, weeklyHours);

  if (!dailyWindow.isEnabled) return false;

  const startMinutes = startParts.hour * 60 + startParts.minute;
  const endMinutes = endParts.hour * 60 + endParts.minute;

  const regularStartMinutes = dailyWindow.startHour * 60;
  const regularEndMinutes = dailyWindow.endHour * 60;

  const fitsRegularWindow =
    startMinutes >= regularStartMinutes && endMinutes <= regularEndMinutes;

  if (fitsRegularWindow) return true;

  const afterHoursEnabled = Boolean(settings?.allow_after_hours_appointments);
  const afterStart = settings?.after_hours_start_hour;
  const afterEnd = settings?.after_hours_end_hour;

  if (
    afterHoursEnabled &&
    typeof afterStart === "number" &&
    typeof afterEnd === "number" &&
    afterEnd > afterStart
  ) {
    const afterStartMinutes = afterStart * 60;
    const afterEndMinutes = afterEnd * 60;

    return startMinutes >= afterStartMinutes && endMinutes <= afterEndMinutes;
  }

  return false;
}

async function getLeadAgentId(lead_id?: string | null): Promise<string | null> {
  if (!lead_id) return null;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, agent_id, org_id")
    .eq("id", lead_id)
    .maybeSingle();

  if (error) {
    console.error("❌ getTwoSlots lead lookup error", error);
    return null;
  }

  return data?.agent_id || null;
}

type RotationAgentCandidate = {
  agent_id: string;
  user_table_id: number | null;
  source: "lead" | "rotation" | "active_agent";
};

async function getRotationAgentCandidates(
  args: GetTwoSlotsArgs
): Promise<RotationAgentCandidate[]> {
  const candidates: RotationAgentCandidate[] = [];
  const seenAgentIds = new Set<string>();

  function addCandidate(
    agent_id?: string | null,
    user_table_id?: number | null,
    source: RotationAgentCandidate["source"] = "rotation"
  ) {
    if (!agent_id) return;
    if (seenAgentIds.has(agent_id)) return;

    seenAgentIds.add(agent_id);
    candidates.push({
      agent_id,
      user_table_id: user_table_id ?? null,
      source,
    });
  }

  const leadAgentId = await getLeadAgentId(args.lead_id);
  addCandidate(leadAgentId, null, "lead");

  const { data: rotationRows, error: rotationError } = await supabaseAdmin
    .from("rotation_members")
    .select("user_id, last_assigned_at")
    .eq("org_id", args.org_id)
    .eq("is_active", true)
    .order("last_assigned_at", { ascending: true, nullsFirst: true });

  if (rotationError) {
    console.error("❌ getTwoSlots rotation lookup error", rotationError);
  }

  const rotationUserIds = Array.from(
    new Set(
      (rotationRows || [])
        .map((row: any) => row.user_id)
        .filter((id: any): id is number => typeof id === "number")
    )
  );

  if (rotationUserIds.length > 0) {
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, user_id, name, email, role, is_active")
      .eq("org_id", args.org_id)
      .in("id", rotationUserIds)
      .eq("role", "agent")
      .eq("is_active", true);

    if (usersError) {
      console.error("❌ getTwoSlots rotation users lookup error", usersError);
    }

    const usersById = new Map<number, any>(
      (users || []).map((user: any) => [user.id, user])
    );

    for (const row of rotationRows || []) {
      const user = usersById.get(row.user_id);
      addCandidate(user?.user_id, row.user_id, "rotation");
    }
  }

  if (candidates.length === 0) {
    const { data: activeAgents, error: activeAgentsError } = await supabaseAdmin
      .from("users")
      .select("id, user_id, name, email, role, is_active")
      .eq("org_id", args.org_id)
      .eq("role", "agent")
      .eq("is_active", true);

    if (activeAgentsError) {
      console.error("❌ getTwoSlots active agents lookup error", activeAgentsError);
    }

    for (const agent of activeAgents || []) {
      addCandidate(agent.user_id, agent.id, "active_agent");
    }
  }

  return candidates;
}

async function getAgentAvailabilityBlocks(args: {
  org_id: string;
  agent_id?: string | null;
}): Promise<AvailabilityBlock[]> {
  const { org_id, agent_id } = args;

  if (!agent_id) return [];

  const { data, error } = await supabaseAdmin
    .from("agent_availability_blocks")
    .select("*")
    .eq("org_id", org_id)
    .or(`agent_id.eq.${agent_id},block_scope.eq.team`)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ getTwoSlots availability block lookup error", error);
    return [];
  }

  return (data || []) as AvailabilityBlock[];
}

async function getAgentScheduleSettings(args: {
  org_id: string;
  agent_id?: string | null;
}): Promise<AgentScheduleSettings | null> {
  const { org_id, agent_id } = args;

  if (!agent_id) return null;

  const { data, error } = await supabaseAdmin
    .from("agent_schedule_settings")
    .select("*")
    .eq("org_id", org_id)
    .eq("agent_id", agent_id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("❌ getTwoSlots schedule settings lookup error", error);
    return null;
  }

  return (data as AgentScheduleSettings | null) || null;
}

async function getAgentWeeklyHours(args: {
  org_id: string;
  agent_id?: string | null;
}): Promise<AgentWeeklyHour[]> {
  const { org_id, agent_id } = args;

  if (!agent_id) return [];

  const { data, error } = await supabaseAdmin
    .from("agent_weekly_hours")
    .select("*")
    .eq("org_id", org_id)
    .eq("agent_id", agent_id)
    .order("weekday", { ascending: true });

  if (error) {
    console.error("❌ getTwoSlots weekly hours lookup error", error);
    return [];
  }

  return (data || []) as AgentWeeklyHour[];
}

async function getAgentGoogleConnection(args: {
  org_id: string;
  agent_id?: string | null;
}) {
  const { org_id, agent_id } = args;

  if (agent_id) {
    const preferredAgent = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("organization_id", org_id)
      .eq("agent_id", agent_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (preferredAgent.data) {
      console.log("✅ getTwoSlots using default agent Google connection", {
        org_id,
        agent_id,
        connection_id: preferredAgent.data.id,
      });
      return preferredAgent.data;
    }

    const fallbackAgent = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("organization_id", org_id)
      .eq("agent_id", agent_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (fallbackAgent.data) {
      console.log("✅ getTwoSlots using fallback agent Google connection", {
        org_id,
        agent_id,
        connection_id: fallbackAgent.data.id,
      });
      return fallbackAgent.data;
    }
  }

  const preferredOrg = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", org_id)
    .eq("provider", "google")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (preferredOrg.data) {
    console.log("⚠️ getTwoSlots falling back to org Google connection", {
      org_id,
      agent_id,
      connection_id: preferredOrg.data.id,
    });
    return preferredOrg.data;
  }

  const fallbackOrg = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", org_id)
    .eq("provider", "google")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (fallbackOrg.data) {
    console.log("⚠️ getTwoSlots using last-resort org Google connection", {
      org_id,
      agent_id,
      connection_id: fallbackOrg.data.id,
    });
    return fallbackOrg.data;
  }

  throw new Error(
    `No active Google calendar connection found for org ${org_id} agent ${
      agent_id || "unknown"
    }`
  );
}

async function resolveCalendarId(connection: any): Promise<string> {
  const { data: selectedCalendar, error } = await supabaseAdmin
    .from("calendar_calendars")
    .select("provider_calendar_id, is_selected, is_primary")
    .eq("calendar_connection_id", connection.id)
    .eq("is_selected", true)
    .maybeSingle();

  if (error) {
    console.error("❌ getTwoSlots selected calendar lookup error", error);
  }

  if (selectedCalendar?.provider_calendar_id) {
    return selectedCalendar.provider_calendar_id;
  }

  const { data: primaryCalendar } = await supabaseAdmin
    .from("calendar_calendars")
    .select("provider_calendar_id, is_selected, is_primary")
    .eq("calendar_connection_id", connection.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryCalendar?.provider_calendar_id) {
    return primaryCalendar.provider_calendar_id;
  }

  if (connection.default_calendar_id) {
    return connection.default_calendar_id;
  }

  if (connection.account_email) {
    return connection.account_email;
  }

  throw new Error("No default Google calendar id found on connection");
}

async function isSlotFree(
  calendarId: string,
  start: Date,
  end: Date,
  oauth2Client: any
) {
  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client,
  });

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: BOISE_TZ,
      items: [{ id: calendarId }],
    },
  });

  const busy = data.calendars?.[calendarId]?.busy || [];
  return busy.length === 0;
}

function isBlockedByAvailability(
  start: Date,
  end: Date,
  blocks: AvailabilityBlock[]
): boolean {
  const slotWeekday = getWeekdayNumberInBoise(start);
  const startParts = getTzParts(start, BOISE_TZ);
  const endParts = getTzParts(end, BOISE_TZ);
  const slotStartMinutes = startParts.hour * 60 + startParts.minute;
  const slotEndMinutes = endParts.hour * 60 + endParts.minute;

  for (const block of blocks) {
    if (!block.is_active) continue;

    if (block.block_type === "recurring_weekly") {
      if (block.weekday !== slotWeekday) continue;

      const blockStartMinutes = parseTimeToMinutes(block.start_time);
      const blockEndMinutes = parseTimeToMinutes(block.end_time);

      if (blockStartMinutes === null || blockEndMinutes === null) continue;

      const recurringOverlap =
        slotStartMinutes < blockEndMinutes && slotEndMinutes > blockStartMinutes;

      if (recurringOverlap) return true;
      continue;
    }

    if (!block.start_at || !block.end_at) continue;

    const blockStart = new Date(block.start_at);
    const blockEnd = new Date(block.end_at);

    if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) {
      continue;
    }

    if (overlapsRange(start, end, blockStart, blockEnd)) {
      return true;
    }
  }

  return false;
}

async function isSlotAllowed(
  calendarId: string,
  start: Date,
  oauth2Client: any,
  now: Date,
  blocks: AvailabilityBlock[],
  scheduleSettings: AgentScheduleSettings | null,
  weeklyHours: AgentWeeklyHour[],
  dailyAppointmentCounts: Record<string, number>
): Promise<boolean> {
  if (isDayAtAppointmentCap(start, scheduleSettings, dailyAppointmentCounts)) {
    return false;
  }
  if (!isWithinOfferWindow(start, scheduleSettings, weeklyHours)) return false;
  if (isLunchBlocked(start)) return false;
  if (!hasEnoughNotice(start, now)) return false;

  const appointmentEnd = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
  const travelBufferMinutes =
    scheduleSettings?.travel_buffer_minutes ?? DEFAULT_TRAVEL_BUFFER_MINUTES;
  const bufferedEnd = new Date(
    appointmentEnd.getTime() + travelBufferMinutes * 60 * 1000
  );

  if (!fitsInsideWorkHours(start, bufferedEnd, scheduleSettings, weeklyHours)) {
    return false;
  }

  if (isBlockedByAvailability(start, bufferedEnd, blocks)) return false;

  return isSlotFree(calendarId, start, bufferedEnd, oauth2Client);
}

export async function getTwoSlots(
  args: GetTwoSlotsArgs
): Promise<TwoCalendarSlots> {
  const candidates = await getRotationAgentCandidates(args);

  console.log("📅 getTwoSlots rotation candidates", {
    lead_id: args.lead_id || null,
    org_id: args.org_id,
    candidates,
  });

  async function findSlotsForAgent(
    candidate: RotationAgentCandidate
  ): Promise<TwoCalendarSlots | null> {
    const agent_id = candidate.agent_id;

    let connection: any;
    let availabilityBlocks: AvailabilityBlock[] = [];
    let scheduleSettings: AgentScheduleSettings | null = null;
    let weeklyHours: AgentWeeklyHour[] = [];

    try {
      [connection, availabilityBlocks, scheduleSettings, weeklyHours] =
        await Promise.all([
          getAgentGoogleConnection({
            org_id: args.org_id,
            agent_id,
          }),
          getAgentAvailabilityBlocks({
            org_id: args.org_id,
            agent_id,
          }),
          getAgentScheduleSettings({
            org_id: args.org_id,
            agent_id,
          }),
          getAgentWeeklyHours({
            org_id: args.org_id,
            agent_id,
          }),
        ]);
    } catch (error) {
      console.error("❌ getTwoSlots candidate setup failed", {
        lead_id: args.lead_id || null,
        org_id: args.org_id,
        agent_id,
        source: candidate.source,
        error,
      });

      return null;
    }

    const oauth2Client = await getAuthorizedGoogleOAuthClient(connection);

    let calendarId: string;

    try {
      calendarId = await resolveCalendarId(connection);
    } catch (error) {
      console.error("❌ getTwoSlots calendar id resolution failed", {
        lead_id: args.lead_id || null,
        org_id: args.org_id,
        agent_id,
        source: candidate.source,
        connection_id: connection?.id,
        error,
      });

      return null;
    }

    console.log("📅 getTwoSlots checking candidate calendar", {
      lead_id: args.lead_id || null,
      org_id: args.org_id,
      agent_id,
      source: candidate.source,
      connection_id: connection.id,
      calendarId,
      account_email: connection.account_email,
      availability_blocks: availabilityBlocks.length,
      weekly_hours: weeklyHours.length,
      workday_start_hour:
        scheduleSettings?.workday_start_hour ?? DEFAULT_START_HOUR,
      workday_end_hour:
        scheduleSettings?.workday_end_hour ?? DEFAULT_END_HOUR,
      saturday_enabled: scheduleSettings?.saturday_enabled ?? true,
      sunday_enabled: scheduleSettings?.sunday_enabled ?? false,
      travel_buffer_minutes:
        scheduleSettings?.travel_buffer_minutes ??
        DEFAULT_TRAVEL_BUFFER_MINUTES,
    });

    const found: CalendarSlot[] = [];
    const now = new Date();

    const dailyAppointmentCounts = await getDailyAppointmentCounts({
      org_id: args.org_id,
      agent_id,
      now,
    });

    const preferredHours = buildPreferredAppointmentHours(scheduleSettings);
    const fallbackHours = buildFallbackAppointmentHours();
    const hourPasses = [preferredHours, fallbackHours];

    const checkedStarts = new Set<string>();

    for (const candidateHours of hourPasses) {
      for (let dayOffset = 0; dayOffset < SEARCH_DAYS; dayOffset++) {
        const daySeed = addDaysInZone(now, dayOffset, BOISE_TZ);
        const dayParts = getTzParts(daySeed, BOISE_TZ);
        const dailyWindow = getDailyWindow(
          daySeed,
          scheduleSettings,
          weeklyHours
        );

        if (!dailyWindow.isEnabled) {
          continue;
        }

        for (const hour of candidateHours) {
          const minutesToCheck =
            candidateHours === preferredHours ? [0] : [0, 30];

          for (const minute of minutesToCheck) {
            const start = makeZonedDate(
              dayParts.year,
              dayParts.month,
              dayParts.day,
              hour,
              minute,
              BOISE_TZ
            );

            const startKey = start.toISOString();

            if (checkedStarts.has(startKey)) {
              continue;
            }

            checkedStarts.add(startKey);

            const allowed = await isSlotAllowed(
              calendarId,
              start,
              oauth2Client,
              now,
              availabilityBlocks,
              scheduleSettings,
              weeklyHours,
              dailyAppointmentCounts
            ).catch((error) => {
              console.error("❌ getTwoSlots slot check failed", {
                lead_id: args.lead_id || null,
                org_id: args.org_id,
                agent_id,
                source: candidate.source,
                start: start.toISOString(),
                error,
              });

              return false;
            });

            if (!allowed) continue;

            found.push({
              slot_iso: start.toISOString(),
              slot_human: toHuman(start),
            });

            if (found.length === 2) {
              console.log("✅ getTwoSlots found two slots for candidate", {
                lead_id: args.lead_id || null,
                org_id: args.org_id,
                agent_id,
                source: candidate.source,
                A: found[0],
                B: found[1],
              });

              return {
                A: found[0],
                B: found[1],
                agent_id,
              };
            }
          }
        }
      }
    }

    console.warn("⚠️ getTwoSlots found no live slots for candidate", {
      lead_id: args.lead_id || null,
      org_id: args.org_id,
      agent_id,
      source: candidate.source,
    });

    return null;
  }

  for (const candidate of candidates) {
    const result = await findSlotsForAgent(candidate);

    if (result) {
      return result;
    }
  }

  console.error(
    "⚠️ getTwoSlots could not find live Google slots for any rotation candidate, using fallback slots",
    {
      lead_id: args.lead_id || null,
      org_id: args.org_id,
      candidates,
    }
  );

  const fallbackNow = new Date();
  const fallbackFound: CalendarSlot[] = [];
  const fallbackAgentId = candidates[0]?.agent_id || null;

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const daySeed = addDaysInZone(fallbackNow, dayOffset, BOISE_TZ);
    const dayParts = getTzParts(daySeed, BOISE_TZ);
    const weekday = getWeekdayNumberInBoise(daySeed);

    if (weekday === 0 || weekday === 6) continue;

    for (const hour of [10, 14]) {
      const start = makeZonedDate(
        dayParts.year,
        dayParts.month,
        dayParts.day,
        hour,
        0,
        BOISE_TZ
      );

      fallbackFound.push({
        slot_iso: start.toISOString(),
        slot_human: toHuman(start),
      });

      if (fallbackFound.length === 2) {
        return {
          A: fallbackFound[0],
          B: fallbackFound[1],
          agent_id: fallbackAgentId,
        };
      }
    }
  }

  throw new Error("Could not find two open Google Calendar slots or fallback slots");
}
