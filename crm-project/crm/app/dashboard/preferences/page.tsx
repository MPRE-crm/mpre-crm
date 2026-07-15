"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import MarketingIdentityCard from "./MarketingIdentityCard";
import OrganizationComplianceCard from "./OrganizationComplianceCard";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type LenderUser = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
};

type PreferenceRow = {
  lender_user_id: number;
  position: number;
  is_active: boolean;
};

type CalendarProfile = {
  id: string;
  org_id: string;
  email: string | null;
};

type CalendarConnection = {
  id: string;
  agent_id: string;
  organization_id: string;
  provider: string;
  account_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  calendar_connected: boolean;
  is_active: boolean;
  is_default: boolean;
  default_calendar_id: string | null;
  created_at: string;
  updated_at: string;
};

type AvailabilityBlock = {
  id: string;
  agent_id: string;
  org_id: string;
  block_type: "one_time" | "recurring_weekly" | "vacation" | "same_day_pause" | "out_of_office";
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

type ScheduleSettings = {
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

type WeeklyHour = {
  agent_id?: string;
  org_id?: string;
  weekday: number;
  is_enabled: boolean;
  start_hour: number;
  end_hour: number;
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label:
    hour === 0
      ? "12:00 AM"
      : hour < 12
      ? `${hour}:00 AM`
      : hour === 12
      ? "12:00 PM"
      : `${hour - 12}:00 PM`,
}));

const TRAVEL_BUFFER_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "60 minutes" },
];

const DAILY_CAP_OPTIONS = Array.from({ length: 20 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} appointments`,
}));

const DEFAULT_WEEKLY_HOURS: WeeklyHour[] = WEEKDAY_OPTIONS.map((day) => ({
  weekday: day.value,
  is_enabled: day.value === 0 ? false : true,
  start_hour: 9,
  end_hour: 18,
}));

function formatBlockType(type: AvailabilityBlock["block_type"]) {
  if (type === "one_time") return "One-Time Block";
  if (type === "recurring_weekly") return "Recurring Weekly Block";
  if (type === "vacation") return "Vacation";
  if (type === "same_day_pause") return "Same-Day Pause";
  return "Out of Office";
}

function localDateTimeToIso(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function formatDateTimeBoise(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    timeZone: "America/Boise",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  return formatDateTimeBoise(value);
}

export default function PreferencesPage() {
  const [sessionProfileId, setSessionProfileId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [lenders, setLenders] = useState<LenderUser[]>([]);
  const [selectedLenderIds, setSelectedLenderIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [creatingLender, setCreatingLender] = useState(false);
  const [deletingLenderId, setDeletingLenderId] = useState<number | null>(null);

  const [newLenderName, setNewLenderName] = useState("");
  const [newLenderEmail, setNewLenderEmail] = useState("");
  const [newLenderPhone, setNewLenderPhone] = useState("");

  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [calendarProfile, setCalendarProfile] = useState<CalendarProfile | null>(null);
  const [calendarConnection, setCalendarConnection] = useState<CalendarConnection | null>(null);
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
  const [calendarProvider, setCalendarProvider] = useState("google");

  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [deletingAvailabilityId, setDeletingAvailabilityId] = useState<string | null>(null);

  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>(DEFAULT_WEEKLY_HOURS);

  const [oneTimeTitle, setOneTimeTitle] = useState("");
  const [oneTimeNotes, setOneTimeNotes] = useState("");
  const [oneTimeStartAt, setOneTimeStartAt] = useState("");
  const [oneTimeEndAt, setOneTimeEndAt] = useState("");

  const [recurringTitle, setRecurringTitle] = useState("");
  const [recurringNotes, setRecurringNotes] = useState("");
  const [recurringBlockScope, setRecurringBlockScope] = useState<"personal" | "team">("team");
  const [recurringWeekday, setRecurringWeekday] = useState("1");
  const [recurringStartTime, setRecurringStartTime] = useState("09:00");
  const [recurringEndTime, setRecurringEndTime] = useState("10:00");

  const [vacationTitle, setVacationTitle] = useState("Vacation");
  const [vacationNotes, setVacationNotes] = useState("");
  const [vacationStartAt, setVacationStartAt] = useState("");
  const [vacationEndAt, setVacationEndAt] = useState("");

  const [pauseTitle, setPauseTitle] = useState("Same-Day Pause");
  const [pauseNotes, setPauseNotes] = useState("");
  const [pauseStartAt, setPauseStartAt] = useState("");
  const [pauseEndAt, setPauseEndAt] = useState("");

  const [oooTitle, setOooTitle] = useState("Out of Office");
  const [oooNotes, setOooNotes] = useState("");
  const [oooStartAt, setOooStartAt] = useState("");
  const [oooEndAt, setOooEndAt] = useState("");

  useEffect(() => {
    loadData();
    loadSessionProfileId();
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    loadCalendarData();
    loadAvailabilityData();
    loadScheduleData();
  }, [sessionLoading, sessionProfileId]);

  async function loadSessionProfileId() {
    try {
      setSessionLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();

      if (userErr || !userRes?.user?.id) {
        setSessionProfileId(null);
        return;
      }

      setSessionProfileId(userRes.user.id);
    } catch {
      setSessionProfileId(null);
    } finally {
      setSessionLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/preferences/lenders", {
        method: "GET",
        cache: "no-store",
      });

      const raw = await res.text();
      let json: any = {};

      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || "Calendar preferences returned a non-JSON response");
      }

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load preferences");
      }

      setLenders(json.lenders || []);

      const orderedPreferenceIds = (json.preferences || [])
        .filter((row: PreferenceRow) => row.is_active)
        .sort((a: PreferenceRow, b: PreferenceRow) => a.position - b.position)
        .map((row: PreferenceRow) => row.lender_user_id);

      setSelectedLenderIds(orderedPreferenceIds);
    } catch (err: any) {
      setMessage(err.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarData() {
    try {
      setCalendarLoading(true);
      setCalendarMessage("");

      if (!sessionProfileId) {
        setCalendarProfile(null);
        setCalendarConnection(null);
        setCalendarConnections([]);
        setCalendarMessage("No logged-in profile ID found.");
        return;
      }

      const res = await fetch(
        `/api/preferences/calendar?profileId=${encodeURIComponent(sessionProfileId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const raw = await res.text();
      let json: any = {};

      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || "Calendar preferences returned a non-JSON response");
      }

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load calendar preferences");
      }

      setCalendarProfile(json.profile || null);
      setCalendarConnection(json.connection || null);
      setCalendarConnections(json.connections || []);

      if (json.connection?.provider) {
        setCalendarProvider(json.connection.provider);
      }
    } catch (err: any) {
      setCalendarMessage(err.message || "Failed to load calendar preferences");
    } finally {
      setCalendarLoading(false);
    }
  }

  async function loadAvailabilityData() {
    try {
      setAvailabilityLoading(true);
      setAvailabilityMessage("");

      if (!sessionProfileId) {
        setAvailabilityBlocks([]);
        setAvailabilityMessage("No logged-in profile ID found.");
        return;
      }

      const res = await fetch(
        `/api/preferences/availability?profileId=${encodeURIComponent(sessionProfileId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load availability blocks");
      }

      setAvailabilityBlocks(json.blocks || []);
    } catch (err: any) {
      setAvailabilityMessage(err.message || "Failed to load availability blocks");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function loadScheduleData() {
    try {
      setScheduleLoading(true);
      setScheduleMessage("");

      if (!sessionProfileId) {
        setScheduleSettings(null);
        setScheduleMessage("No logged-in profile ID found.");
        return;
      }

      const res = await fetch(
        `/api/preferences/schedule?profileId=${encodeURIComponent(sessionProfileId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load schedule settings");
      }

      setScheduleSettings(json.settings || null);
setWeeklyHours(
  Array.isArray(json.weekly_hours) && json.weekly_hours.length === 7
    ? json.weekly_hours
        .map((row: WeeklyHour) => ({
          weekday: Number(row.weekday),
          is_enabled: Boolean(row.is_enabled),
          start_hour: Number(row.start_hour),
          end_hour: Number(row.end_hour),
        }))
        .sort((a: WeeklyHour, b: WeeklyHour) => a.weekday - b.weekday)
    : DEFAULT_WEEKLY_HOURS
);
    } catch (err: any) {
      setScheduleMessage(err.message || "Failed to load schedule settings");
    } finally {
      setScheduleLoading(false);
    }
  }

  function addLender(lenderId: number) {
    if (selectedLenderIds.includes(lenderId)) return;
    setSelectedLenderIds((prev) => [...prev, lenderId]);
  }

  function moveUp(index: number) {
    if (index === 0) return;

    const updated = [...selectedLenderIds];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setSelectedLenderIds(updated);
  }

  function moveDown(index: number) {
    if (index === selectedLenderIds.length - 1) return;

    const updated = [...selectedLenderIds];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setSelectedLenderIds(updated);
  }

  async function savePreferences() {
    try {
      setSaving(true);
      setMessage("");

      const res = await fetch("/api/preferences/lenders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lenderIds: selectedLenderIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save preferences");
      }

      setMessage("Preferences saved.");
      await loadData();
    } catch (err: any) {
      setMessage(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  async function createLender() {
    try {
      setCreatingLender(true);
      setMessage("");

      if (!newLenderName.trim()) {
        throw new Error("Lender name is required");
      }

      const res = await fetch("/api/preferences/lenders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newLenderName.trim(),
          email: newLenderEmail.trim() || null,
          phone: newLenderPhone.trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create lender");
      }

      setNewLenderName("");
      setNewLenderEmail("");
      setNewLenderPhone("");
      setMessage("Lender added.");
      await loadData();
    } catch (err: any) {
      setMessage(err.message || "Failed to create lender");
    } finally {
      setCreatingLender(false);
    }
  }

  async function deleteLender(lenderId: number) {
    try {
      setDeletingLenderId(lenderId);
      setMessage("");

      const lender = lenders.find((l) => l.id === lenderId);
      const ok = window.confirm(
        `Remove lender "${lender?.name || lenderId}" from my list?`
      );

      if (!ok) return;

      const res = await fetch("/api/preferences/lenders", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lenderUserId: lenderId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to remove lender from your list");
      }

      setSelectedLenderIds((prev) => prev.filter((id) => id !== lenderId));
      setMessage("Lender removed from your list.");
      await loadData();
    } catch (err: any) {
      setMessage(err.message || "Failed to remove lender from your list");
    } finally {
      setDeletingLenderId(null);
    }
  }

  async function saveCalendarProvider() {
    try {
      setCalendarSaving(true);
      setCalendarMessage("");

      if (!sessionProfileId) {
        throw new Error("No logged-in profile ID found.");
      }

      const res = await fetch("/api/preferences/calendar", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: sessionProfileId,
          provider: calendarProvider,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save calendar provider");
      }

      setCalendarMessage("Calendar provider saved.");
      await loadCalendarData();
    } catch (err: any) {
      setCalendarMessage(err.message || "Failed to save calendar provider");
    } finally {
      setCalendarSaving(false);
    }
  }

  async function syncGoogleCalendars() {
    try {
      setCalendarSyncing(true);
      setCalendarMessage("");

      if (!sessionProfileId) {
        throw new Error("No logged-in profile ID found.");
      }

      const res = await fetch("/api/calendar/google/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: sessionProfileId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to sync Google calendars");
      }

      setCalendarMessage("Google calendar sync complete.");
      await loadCalendarData();
    } catch (err: any) {
      setCalendarMessage(err.message || "Failed to sync Google calendars");
    } finally {
      setCalendarSyncing(false);
    }
  }

  async function saveScheduleSettings() {
    try {
      setScheduleSaving(true);
      setScheduleMessage("");

      if (!sessionProfileId) {
        throw new Error("No logged-in profile ID found.");
      }

      if (!scheduleSettings) {
        throw new Error("Schedule settings are not loaded yet.");
      }

      const res = await fetch("/api/preferences/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: sessionProfileId,
          workday_start_hour: scheduleSettings.workday_start_hour,
          workday_end_hour: scheduleSettings.workday_end_hour,
          saturday_enabled: scheduleSettings.saturday_enabled,
          sunday_enabled: scheduleSettings.sunday_enabled,
          travel_buffer_minutes: scheduleSettings.travel_buffer_minutes,
          daily_appointment_cap: scheduleSettings.daily_appointment_cap,
          allow_after_hours_appointments: scheduleSettings.allow_after_hours_appointments,
          after_hours_start_hour: scheduleSettings.allow_after_hours_appointments
            ? scheduleSettings.after_hours_start_hour
            : null,
          after_hours_end_hour: scheduleSettings.allow_after_hours_appointments
            ? scheduleSettings.after_hours_end_hour
            : null,
          is_active: scheduleSettings.is_active,
          weekly_hours: weeklyHours.map((row) => ({
            weekday: row.weekday,
            is_enabled: row.is_enabled,
            start_hour: row.start_hour,
            end_hour: row.end_hour,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save schedule settings");
      }

      setScheduleMessage("Schedule settings saved.");
      await loadScheduleData();
    } catch (err: any) {
      setScheduleMessage(err.message || "Failed to save schedule settings");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function createAvailabilityBlock(payload: Record<string, any>) {
    try {
      setAvailabilitySaving(true);
      setAvailabilityMessage("");

      if (!sessionProfileId) {
        throw new Error("No logged-in profile ID found.");
      }

      const res = await fetch("/api/preferences/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: sessionProfileId,
          ...payload,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create availability block");
      }

      setAvailabilityMessage("Availability block saved.");
      await loadAvailabilityData();
    } catch (err: any) {
      setAvailabilityMessage(err.message || "Failed to create availability block");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function deleteAvailabilityBlock(id: string) {
    try {
      setDeletingAvailabilityId(id);
      setAvailabilityMessage("");

      if (!sessionProfileId) {
        throw new Error("No logged-in profile ID found.");
      }

      const ok = window.confirm("Delete this availability block?");
      if (!ok) return;

      const res = await fetch("/api/preferences/availability", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          profileId: sessionProfileId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete availability block");
      }

      setAvailabilityMessage("Availability block deleted.");
      await loadAvailabilityData();
    } catch (err: any) {
      setAvailabilityMessage(err.message || "Failed to delete availability block");
    } finally {
      setDeletingAvailabilityId(null);
    }
  }

  function connectGoogleCalendar() {
    if (!sessionProfileId) {
      setCalendarMessage("Missing logged-in profile ID.");
      return;
    }

    window.location.href = `/api/calendar/google/connect?profileId=${encodeURIComponent(
      sessionProfileId
    )}`;
  }

  const selectedLenders = selectedLenderIds
    .map((id) => lenders.find((lender) => lender.id === id))
    .filter(Boolean) as LenderUser[];

  const availableLenders = lenders.filter(
    (lender) => !selectedLenderIds.includes(lender.id)
  );

const sortedAvailabilityBlocks = useMemo(
  () =>
    [...availabilityBlocks].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    }),
  [availabilityBlocks]
);

function updateWeeklyHour(
  weekday: number,
  patch: Partial<Pick<WeeklyHour, "is_enabled" | "start_hour" | "end_hour">>
) {
  setWeeklyHours((prev) =>
    prev
      .map((row) =>
        row.weekday === weekday
          ? {
              ...row,
              ...patch,
            }
          : row
      )
      .sort((a, b) => a.weekday - b.weekday)
  );
}

return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Preferences</h1>
        <p className="mt-1 text-sm text-gray-600">
          Set your preferred lender order here. Samantha will use this list first,
          then fall back to the organization lender pool if needed.
        </p>
      </div>

      {message ? (
        <div className="rounded border px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

            <MarketingIdentityCard />

      <OrganizationComplianceCard />

      <div className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Calendar Preferences</h2>

        {calendarMessage ? (
          <div className="mb-4 rounded border px-4 py-3 text-sm">
            {calendarMessage}
          </div>
        ) : null}

        {calendarLoading ? (
          <div className="text-sm text-gray-600">Loading calendar preferences...</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Provider</div>
                <select
                  value={calendarProvider}
                  onChange={(e) => setCalendarProvider(e.target.value)}
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="google">Google</option>
                  <option value="microsoft">Microsoft</option>
                  <option value="apple">iCloud</option>
                </select>
              </div>

              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Connection Status</div>
                <div className="mt-2 font-medium">
                  {calendarConnection?.calendar_connected ? "Connected" : "Not connected"}
                </div>
              </div>

              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Connected Account</div>
                <div className="mt-2 font-medium">
                  {calendarConnection?.account_email || "No connected account"}
                </div>
              </div>

              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Default Calendar</div>
                <div className="mt-2 font-medium">
                  {calendarConnection?.default_calendar_id || "No default calendar selected"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveCalendarProvider}
                disabled={calendarSaving}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {calendarSaving ? "Saving..." : "Save Calendar Provider"}
              </button>

              <button
                type="button"
                onClick={connectGoogleCalendar}
                className="rounded border px-4 py-2 text-sm"
              >
                {calendarConnection?.calendar_connected ? "Reconnect Google" : "Connect Google"}
              </button>

              <button
                type="button"
                onClick={syncGoogleCalendars}
                disabled={calendarSyncing || !calendarConnection?.calendar_connected}
                className="rounded border px-4 py-2 text-sm disabled:opacity-60"
              >
                {calendarSyncing ? "Syncing..." : "Sync Google Calendars"}
              </button>
            </div>

            {calendarProfile ? (
              <div className="mt-4 rounded border p-3 text-sm">
                <div>
                  <span className="font-medium">Profile ID:</span> {calendarProfile.id}
                </div>
                <div>
                  <span className="font-medium">Org ID:</span> {calendarProfile.org_id}
                </div>
                <div>
                  <span className="font-medium">Profile Email:</span> {calendarProfile.email || "N/A"}
                </div>
              </div>
            ) : null}

            {calendarConnections.length > 0 ? (
              <div className="mt-4 rounded border p-4">
                <h3 className="mb-3 text-base font-semibold">Saved Calendar Connections</h3>
                <div className="space-y-3">
                  {calendarConnections.map((connection) => (
                    <div key={connection.id} className="rounded border p-3">
                      <div className="font-medium">
                        {connection.provider} {connection.is_default ? "• Default" : ""}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {connection.account_email || "No account email"} •{" "}
                        {connection.calendar_connected ? "Connected" : "Not connected"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Default calendar: {connection.default_calendar_id || "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Working Hours & Weekend Settings</h2>

        {scheduleMessage ? (
          <div className="mb-4 rounded border px-4 py-3 text-sm">
            {scheduleMessage}
          </div>
        ) : null}

        {scheduleLoading || !scheduleSettings ? (
          <div className="text-sm text-gray-600">Loading schedule settings...</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Workday Start</div>
                <select
                  value={scheduleSettings.workday_start_hour}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            workday_start_hour: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                >
                  {HOUR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Workday End</div>
                <select
                  value={scheduleSettings.workday_end_hour}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            workday_end_hour: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                >
                  {HOUR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Travel Buffer</div>
                <select
                  value={scheduleSettings.travel_buffer_minutes}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            travel_buffer_minutes: Number(e.target.value) as 15 | 30 | 60,
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                >
                  {TRAVEL_BUFFER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Daily Appointment Cap</div>
                <select
                  value={scheduleSettings.daily_appointment_cap}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            daily_appointment_cap: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                >
                  {DAILY_CAP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 rounded border p-3">
                <input
                  type="checkbox"
                  checked={scheduleSettings.saturday_enabled}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            saturday_enabled: e.target.checked,
                          }
                        : prev
                    )
                  }
                />
                <span className="text-sm">Allow Saturday appointments</span>
              </label>

              <label className="flex items-center gap-3 rounded border p-3">
                <input
                  type="checkbox"
                  checked={scheduleSettings.sunday_enabled}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            sunday_enabled: e.target.checked,
                          }
                        : prev
                    )
                  }
                />
                <span className="text-sm">Allow Sunday appointments</span>
              </label>
            </div>

            <div className="mt-6 rounded border p-4">
              <div className="mb-3">
                <h3 className="text-base font-semibold">After-Hours Appointments</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Only offer evening appointment slots when this is turned on.
                </p>
              </div>

              <label className="mb-3 flex items-center gap-3 rounded border p-3">
                <input
                  type="checkbox"
                  checked={scheduleSettings.allow_after_hours_appointments}
                  onChange={(e) =>
                    setScheduleSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            allow_after_hours_appointments: e.target.checked,
                            after_hours_start_hour: e.target.checked
                              ? prev.after_hours_start_hour ?? 18
                              : null,
                            after_hours_end_hour: e.target.checked
                              ? prev.after_hours_end_hour ?? 20
                              : null,
                          }
                        : prev
                    )
                  }
                />
                <span className="text-sm">Allow after-hours appointments</span>
              </label>

              {scheduleSettings.allow_after_hours_appointments ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-gray-600">After-Hours Start</div>
                    <select
                      value={scheduleSettings.after_hours_start_hour ?? 18}
                      onChange={(e) =>
                        setScheduleSettings((prev) =>
                          prev
                            ? {
                                ...prev,
                                after_hours_start_hour: Number(e.target.value),
                              }
                            : prev
                        )
                      }
                      className="mt-2 w-full rounded border px-3 py-2 text-sm"
                    >
                      {HOUR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">After-Hours End</div>
                    <select
                      value={scheduleSettings.after_hours_end_hour ?? 20}
                      onChange={(e) =>
                        setScheduleSettings((prev) =>
                          prev
                            ? {
                                ...prev,
                                after_hours_end_hour: Number(e.target.value),
                              }
                            : prev
                        )
                      }
                      className="mt-2 w-full rounded border px-3 py-2 text-sm"
                    >
                      {HOUR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

<div className="mt-6 rounded border p-4">
  <div className="mb-3">
    <h3 className="text-base font-semibold">Specific Day Hours</h3>
    <p className="mt-1 text-sm text-gray-600">
      Set different working hours for each day. Disabled days will not be offered for appointments.
    </p>
  </div>

  <div className="space-y-3">
    {weeklyHours.map((row) => {
      const dayLabel =
        WEEKDAY_OPTIONS.find((day) => day.value === row.weekday)?.label ||
        `Day ${row.weekday}`;

      return (
        <div
          key={row.weekday}
          className="grid gap-3 rounded border p-3 md:grid-cols-[1fr_1fr_1fr_1fr]"
        >
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={row.is_enabled}
              onChange={(e) =>
                updateWeeklyHour(row.weekday, {
                  is_enabled: e.target.checked,
                })
              }
            />
            <span className="text-sm font-medium">{dayLabel}</span>
          </label>

          <div>
            <div className="text-xs text-gray-600">Start</div>
            <select
              value={row.start_hour}
              onChange={(e) =>
                updateWeeklyHour(row.weekday, {
                  start_hour: Number(e.target.value),
                })
              }
              disabled={!row.is_enabled}
              className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-60"
            >
              {HOUR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-600">End</div>
            <select
              value={row.end_hour}
              onChange={(e) =>
                updateWeeklyHour(row.weekday, {
                  end_hour: Number(e.target.value),
                })
              }
              disabled={!row.is_enabled}
              className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-60"
            >
              {HOUR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end text-sm text-gray-600">
            {row.is_enabled
              ? `${HOUR_OPTIONS.find((option) => option.value === row.start_hour)?.label} to ${
                  HOUR_OPTIONS.find((option) => option.value === row.end_hour)?.label
                }`
              : "Unavailable"}
          </div>
        </div>
      );
    })}
  </div>
</div>

<div className="mt-4">
  <button
    type="button"
    onClick={saveScheduleSettings}
    disabled={scheduleSaving}
    className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
  >
    {scheduleSaving ? "Saving..." : "Save Working Hours"}
  </button>
</div>
          </>
        )}
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Availability Controls</h2>

        {availabilityMessage ? (
          <div className="mb-4 rounded border px-4 py-3 text-sm">
            {availabilityMessage}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded border p-4">
            <h3 className="mb-3 text-base font-semibold">One-Time Block</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={oneTimeTitle}
                onChange={(e) => setOneTimeTitle(e.target.value)}
                placeholder="Showing, personal errand, meeting..."
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={oneTimeNotes}
                onChange={(e) => setOneTimeNotes(e.target.value)}
                placeholder="Notes"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={oneTimeStartAt}
                onChange={(e) => setOneTimeStartAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={oneTimeEndAt}
                onChange={(e) => setOneTimeEndAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={async () => {
                  await createAvailabilityBlock({
                    block_type: "one_time",
                    title: oneTimeTitle || "One-Time Block",
                    notes: oneTimeNotes || null,
                    start_at: localDateTimeToIso(oneTimeStartAt),
                    end_at: localDateTimeToIso(oneTimeEndAt),
                  });
                  setOneTimeTitle("");
                  setOneTimeNotes("");
                  setOneTimeStartAt("");
                  setOneTimeEndAt("");
                }}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {availabilitySaving ? "Saving..." : "Save One-Time Block"}
              </button>
            </div>
          </div>

          <div className="rounded border p-4">
            <h3 className="mb-3 text-base font-semibold">Team Meeting / Weekly Block</h3>
              <div className="space-y-3">
              <input
                type="text"
                value={recurringTitle}
                onChange={(e) => setRecurringTitle(e.target.value)}
                placeholder="Weekly team meeting, lunch block..."
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={recurringNotes}
                onChange={(e) => setRecurringNotes(e.target.value)}
                placeholder="Notes"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <select
                value={recurringBlockScope}
                onChange={(e) => setRecurringBlockScope(e.target.value as "personal" | "team")}
                className="w-full rounded border px-3 py-2 text-sm"
              >
              <option value="team">Team / Org Block</option>
              <option value="personal">Personal Agent Block</option>
            </select>
              <select
                value={recurringWeekday}
                onChange={(e) => setRecurringWeekday(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                {WEEKDAY_OPTIONS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={recurringStartTime}
                onChange={(e) => setRecurringStartTime(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={recurringEndTime}
                onChange={(e) => setRecurringEndTime(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={async () => {
                await createAvailabilityBlock({
                  block_type: "recurring_weekly",
                  block_scope: recurringBlockScope,
                  title:
                    recurringTitle ||
                    (recurringBlockScope === "team" ? "Team Meeting" : "Recurring Weekly Block"),
                  notes: recurringNotes || null,
                  weekday: Number(recurringWeekday),
                  start_time: recurringStartTime,
                  end_time: recurringEndTime,
                });
                  setRecurringTitle("");
                  setRecurringNotes("");
                  setRecurringBlockScope("team");
                  setRecurringWeekday("1");
                  setRecurringStartTime("09:00");
                  setRecurringEndTime("10:00");
                }}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {availabilitySaving ? "Saving..." : "Save Recurring Block"}
              </button>
            </div>
          </div>

          <div className="rounded border p-4">
            <h3 className="mb-3 text-base font-semibold">Vacation</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={vacationTitle}
                onChange={(e) => setVacationTitle(e.target.value)}
                placeholder="Vacation"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={vacationNotes}
                onChange={(e) => setVacationNotes(e.target.value)}
                placeholder="Notes"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={vacationStartAt}
                onChange={(e) => setVacationStartAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={vacationEndAt}
                onChange={(e) => setVacationEndAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={async () => {
                  await createAvailabilityBlock({
                    block_type: "vacation",
                    title: vacationTitle || "Vacation",
                    notes: vacationNotes || null,
                    start_at: localDateTimeToIso(vacationStartAt),
                    end_at: localDateTimeToIso(vacationEndAt),
                  });
                  setVacationTitle("Vacation");
                  setVacationNotes("");
                  setVacationStartAt("");
                  setVacationEndAt("");
                }}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {availabilitySaving ? "Saving..." : "Save Vacation"}
              </button>
            </div>
          </div>

          <div className="rounded border p-4">
            <h3 className="mb-3 text-base font-semibold">Same-Day Pause</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={pauseTitle}
                onChange={(e) => setPauseTitle(e.target.value)}
                placeholder="Pause title"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={pauseNotes}
                onChange={(e) => setPauseNotes(e.target.value)}
                placeholder="Notes"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={pauseStartAt}
                onChange={(e) => setPauseStartAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={pauseEndAt}
                onChange={(e) => setPauseEndAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={async () => {
                  await createAvailabilityBlock({
                    block_type: "same_day_pause",
                    title: pauseTitle || "Same-Day Pause",
                    notes: pauseNotes || null,
                    start_at: localDateTimeToIso(pauseStartAt),
                    end_at: localDateTimeToIso(pauseEndAt),
                  });
                  setPauseTitle("Same-Day Pause");
                  setPauseNotes("");
                  setPauseStartAt("");
                  setPauseEndAt("");
                }}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {availabilitySaving ? "Saving..." : "Save Same-Day Pause"}
              </button>
            </div>
          </div>

          <div className="rounded border p-4 lg:col-span-2">
            <h3 className="mb-3 text-base font-semibold">Out of Office</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={oooTitle}
                onChange={(e) => setOooTitle(e.target.value)}
                placeholder="Out of Office"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={oooNotes}
                onChange={(e) => setOooNotes(e.target.value)}
                placeholder="Notes"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={oooStartAt}
                onChange={(e) => setOooStartAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={oooEndAt}
                onChange={(e) => setOooEndAt(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3">
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={async () => {
                  await createAvailabilityBlock({
                    block_type: "out_of_office",
                    title: oooTitle || "Out of Office",
                    notes: oooNotes || null,
                    start_at: localDateTimeToIso(oooStartAt),
                    end_at: localDateTimeToIso(oooEndAt),
                  });
                  setOooTitle("Out of Office");
                  setOooNotes("");
                  setOooStartAt("");
                  setOooEndAt("");
                }}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {availabilitySaving ? "Saving..." : "Save Out of Office"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded border p-4">
          <h3 className="mb-3 text-base font-semibold">Saved Availability Blocks</h3>

          {availabilityLoading ? (
            <div className="text-sm text-gray-600">Loading availability blocks...</div>
          ) : sortedAvailabilityBlocks.length === 0 ? (
            <div className="text-sm text-gray-600">No availability blocks saved yet.</div>
          ) : (
            <div className="space-y-3">
              {sortedAvailabilityBlocks.map((block) => (
                <div key={block.id} className="rounded border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium">
                        {formatBlockType(block.block_type)} {block.is_active ? "" : "• Inactive"}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Title: {block.title || "N/A"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Notes: {block.notes || "N/A"}
                      </div>

                      {block.block_type === "recurring_weekly" ? (
                        <>
                          <div className="text-sm text-gray-600">
                            Day:{" "}
                            {WEEKDAY_OPTIONS.find((d) => d.value === block.weekday)?.label || "N/A"}
                          </div>
                          <div className="text-sm text-gray-600">
                            Time: {block.start_time || "—"} to {block.end_time || "—"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-600">
                            Start: {formatDateTime(block.start_at)}
                          </div>
                          <div className="text-sm text-gray-600">
                            End: {formatDateTime(block.end_at)}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteAvailabilityBlock(block.id)}
                      disabled={deletingAvailabilityId === block.id}
                      className="rounded border px-3 py-2 text-sm"
                    >
                      {deletingAvailabilityId === block.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Add New Lender</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            value={newLenderName}
            onChange={(e) => setNewLenderName(e.target.value)}
            placeholder="Lender name"
            className="rounded border px-3 py-2 text-sm"
          />

          <input
            type="email"
            value={newLenderEmail}
            onChange={(e) => setNewLenderEmail(e.target.value)}
            placeholder="Lender email"
            className="rounded border px-3 py-2 text-sm"
          />

          <input
            type="text"
            value={newLenderPhone}
            onChange={(e) => setNewLenderPhone(e.target.value)}
            placeholder="Lender phone"
            className="rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={createLender}
            disabled={creatingLender}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {creatingLender ? "Adding..." : "Add Lender"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading preferences...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded border p-4">
            <h2 className="mb-4 text-lg font-semibold">Available Lenders</h2>

            {availableLenders.length === 0 ? (
              <p className="text-sm text-gray-600">No more lenders available.</p>
            ) : (
              <div className="space-y-3">
                {availableLenders.map((lender) => (
                  <div
                    key={lender.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <div className="font-medium">{lender.name}</div>
                      <div className="text-sm text-gray-600">
                        {lender.email || "No email"}{" "}
                        {lender.phone ? `• ${lender.phone}` : ""}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addLender(lender.id)}
                        className="rounded bg-black px-3 py-2 text-sm text-white"
                      >
                        Add
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteLender(lender.id)}
                        disabled={deletingLenderId === lender.id}
                        className="rounded border px-3 py-2 text-sm"
                      >
                        {deletingLenderId === lender.id ? "Removing..." : "Remove from My List"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border p-4">
            <h2 className="mb-4 text-lg font-semibold">My Preferred Lender Order</h2>

            {selectedLenders.length === 0 ? (
              <p className="text-sm text-gray-600">
                No preferred lenders selected yet.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedLenders.map((lender, index) => (
                  <div
                    key={lender.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        #{index + 1} {lender.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {lender.email || "No email"}{" "}
                        {lender.phone ? `• ${lender.phone}` : ""}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        className="rounded border px-3 py-2 text-sm"
                      >
                        Up
                      </button>

                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        className="rounded border px-3 py-2 text-sm"
                      >
                        Down
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteLender(lender.id)}
                        disabled={deletingLenderId === lender.id}
                        className="rounded border px-3 py-2 text-sm"
                      >
                        {deletingLenderId === lender.id ? "Removing..." : "Remove from My List"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={savePreferences}
                disabled={saving}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

