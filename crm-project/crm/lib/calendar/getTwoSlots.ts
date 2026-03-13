// crm-project/crm/lib/calendar/getTwoSlots.ts

import { google } from "googleapis";
import { supabaseAdmin } from "../supabaseAdmin";
import { getGoogleOAuthClient } from "../googleCalendar";

type GetTwoSlotsArgs = { org_id: string; lead_id?: string | null };

export type CalendarSlot = { slot_iso: string; slot_human: string };
export type TwoCalendarSlots = { A: CalendarSlot; B: CalendarSlot };

const BOISE_TZ = "America/Boise";
const SLOT_MINUTES = 30;
const CANDIDATE_HOURS = [10, 14];

function toBoiseNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: BOISE_TZ }));
}

function toHuman(d: Date): string {
  const day = d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: BOISE_TZ,
  });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOISE_TZ,
  });

  return `${day} ${time} America/Boise`;
}

function makeCandidate(dayOffset: number, hour: number): Date {
  const d = toBoiseNow();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

async function getOrgGoogleConnection(org_id: string) {
  const preferred = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", org_id)
    .eq("provider", "google")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (preferred.data) return preferred.data;

  const fallback = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", org_id)
    .eq("provider", "google")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!fallback.data) {
    throw new Error(`No active Google calendar connection found for org ${org_id}`);
  }

  return fallback.data;
}

async function isSlotFree(calendarId: string, start: Date, end: Date, oauth2Client: any) {
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

export async function getTwoSlots(args: GetTwoSlotsArgs): Promise<TwoCalendarSlots> {
  const connection = await getOrgGoogleConnection(args.org_id);

  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : undefined,
  });

  const calendarId = connection.default_calendar_id || connection.account_email;

  if (!calendarId) {
    throw new Error("No default Google calendar id found on connection");
  }

  const found: CalendarSlot[] = [];
  const now = toBoiseNow();

  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    for (const hour of CANDIDATE_HOURS) {
      const start = makeCandidate(dayOffset, hour);

      if (isWeekend(start)) continue;
      if (start <= now) continue;

      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

      const free = await isSlotFree(calendarId, start, end, oauth2Client);

      if (!free) continue;

      found.push({
        slot_iso: start.toISOString(),
        slot_human: toHuman(start),
      });

      if (found.length === 2) {
        return {
          A: found[0],
          B: found[1],
        };
      }
    }
  }

  throw new Error("Could not find two open Google Calendar slots");
}