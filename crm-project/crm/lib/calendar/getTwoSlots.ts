// crm-project/crm/lib/calendar/getTwoSlots.ts

import { google } from "googleapis";
import { supabaseAdmin } from "../supabaseAdmin";
import { getGoogleOAuthClient } from "../googleCalendar";

type GetTwoSlotsArgs = { org_id: string; lead_id?: string | null };

export type CalendarSlot = { slot_iso: string; slot_human: string };
export type TwoCalendarSlots = { A: CalendarSlot; B: CalendarSlot };

const BOISE_TZ = "America/Boise";
const SLOT_MINUTES = 30;
const POST_APPOINTMENT_BUFFER_MINUTES = 60;
const SAME_DAY_MIN_NOTICE_MINUTES = 120;
const SEARCH_DAYS = 14;

// Appointment offer window
const START_HOUR = 9;
const END_HOUR = 17; // last slot can start at 5:00 PM if allowed by rules

// Lunch block
const LUNCH_START_HOUR = 12;
const LUNCH_END_HOUR = 13;

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
    weekday: map.weekday, // Sun, Mon, Tue...
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
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 12, 0, 0));
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

function isSunday(d: Date): boolean {
  return getTzParts(d, BOISE_TZ).weekday === "Sun";
}

function isLunchBlocked(d: Date): boolean {
  const parts = getTzParts(d, BOISE_TZ);
  return parts.hour >= LUNCH_START_HOUR && parts.hour < LUNCH_END_HOUR;
}

function hasEnoughNotice(d: Date, now: Date): boolean {
  return d.getTime() - now.getTime() >= SAME_DAY_MIN_NOTICE_MINUTES * 60 * 1000;
}

function isWithinOfferWindow(d: Date): boolean {
  const parts = getTzParts(d, BOISE_TZ);
  if (parts.hour < START_HOUR) return false;
  if (parts.hour > END_HOUR) return false;
  if (parts.hour === END_HOUR && parts.minute > 0) return false;
  return true;
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
    `No active Google calendar connection found for org ${org_id} agent ${agent_id || "unknown"}`
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

async function isSlotAllowed(
  calendarId: string,
  start: Date,
  oauth2Client: any,
  now: Date
): Promise<boolean> {
  if (isSunday(start)) return false;
  if (!isWithinOfferWindow(start)) return false;
  if (isLunchBlocked(start)) return false;
  if (!hasEnoughNotice(start, now)) return false;

  const appointmentEnd = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
  const bufferedEnd = new Date(
    appointmentEnd.getTime() + POST_APPOINTMENT_BUFFER_MINUTES * 60 * 1000
  );

  return isSlotFree(calendarId, start, bufferedEnd, oauth2Client);
}

export async function getTwoSlots(args: GetTwoSlotsArgs): Promise<TwoCalendarSlots> {
  const agent_id = await getLeadAgentId(args.lead_id);
  const connection = await getAgentGoogleConnection({
    org_id: args.org_id,
    agent_id,
  });

  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : undefined,
  });

  const calendarId = await resolveCalendarId(connection);

  console.log("📅 getTwoSlots calendar resolution", {
    lead_id: args.lead_id || null,
    org_id: args.org_id,
    agent_id,
    connection_id: connection.id,
    calendarId,
    account_email: connection.account_email,
  });

  const found: CalendarSlot[] = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < SEARCH_DAYS; dayOffset++) {
    const daySeed = addDaysInZone(now, dayOffset, BOISE_TZ);
    const dayParts = getTzParts(daySeed, BOISE_TZ);

    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      for (const minute of [0, 30]) {
        const start = makeZonedDate(
          dayParts.year,
          dayParts.month,
          dayParts.day,
          hour,
          minute,
          BOISE_TZ
        );

        const allowed = await isSlotAllowed(calendarId, start, oauth2Client, now);
        if (!allowed) continue;

        found.push({
          slot_iso: start.toISOString(),
          slot_human: toHuman(start),
        });

        if (found.length === 2) {
          console.log("✅ getTwoSlots found two slots", {
            A: found[0],
            B: found[1],
          });

          return {
            A: found[0],
            B: found[1],
          };
        }
      }
    }
  }

  throw new Error("Could not find two open Google Calendar slots");
}