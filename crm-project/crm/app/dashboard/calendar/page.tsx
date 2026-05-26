"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Link2,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  calendar_connected: boolean;
  is_active: boolean;
  is_default: boolean;
  default_calendar_id: string | null;
};

type AppointmentRow = {
  id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_requested_slot_iso: string | null;
  appointment_requested_slot_human: string | null;
  appointment_status: string | null;
  appointment_type: string | null;
  notes: string | null;
  ai_summary: string | null;
  created_at: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type SlotOption = {
  slot_iso: string;
  slot_human: string;
};

type LeadOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLeadName(appt: AppointmentRow) {
  return (
    appt.name ||
    [appt.first_name, appt.last_name].filter(Boolean).join(" ").trim() ||
    appt.email ||
    appt.id
  );
}

function getAppointmentDayKey(appt: AppointmentRow) {
  if (appt.appointment_requested_slot_iso) {
    return dayjs(appt.appointment_requested_slot_iso).format("YYYY-MM-DD");
  }

  return appt.appointment_date || null;
}

function getAppointmentTimeLabel(appt: AppointmentRow) {
  if (appt.appointment_requested_slot_iso) {
    return dayjs(appt.appointment_requested_slot_iso).format("h:mm A");
  }

  return appt.appointment_time || null;
}

function getAppointmentDisplayDate(appt: AppointmentRow) {
  if (appt.appointment_requested_slot_iso) {
    return dayjs(appt.appointment_requested_slot_iso).format("ddd, MMM D");
  }

  return appt.appointment_date || "-";
}

function getStatusClasses(status: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "confirmed") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "pending") return "border-orange-200 bg-orange-50 text-orange-700";
  if (s === "completed") return "border-slate-200 bg-slate-100 text-slate-700";
  if (s === "missed") return "border-red-200 bg-red-50 text-red-700";
  if (s === "rescheduled") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (s === "canceled") return "border-gray-200 bg-gray-100 text-gray-700";

  return "border-gray-200 bg-gray-100 text-gray-700";
}

function buildCalendarDays(monthCursor: dayjs.Dayjs) {
  const startOfMonth = monthCursor.startOf("month");
  const endOfMonth = monthCursor.endOf("month");

  const gridStart = startOfMonth.startOf("week");
  const gridEnd = endOfMonth.endOf("week");

  const days: dayjs.Dayjs[] = [];
  let cursor = gridStart;

  while (cursor.isBefore(gridEnd) || cursor.isSame(gridEnd, "day")) {
    days.push(cursor);
    cursor = cursor.add(1, "day");
  }

  return days;
}

function canCancelAppointment(appt: AppointmentRow | null) {
  if (!appt) return false;
  const status = (appt.appointment_status || "").toLowerCase();
  return status !== "canceled" && status !== "completed";
}

function canRescheduleAppointment(appt: AppointmentRow | null) {
  if (!appt) return false;
  const status = (appt.appointment_status || "").toLowerCase();
  return status !== "canceled" && status !== "completed";
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function CalendarPage() {
  const [sessionProfileId, setSessionProfileId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [profile, setProfile] = useState<CalendarProfile | null>(null);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [leadId, setLeadId] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([]);
  const [selectedSlotIso, setSelectedSlotIso] = useState("");

  const [rescheduleSlotOptions, setRescheduleSlotOptions] = useState<SlotOption[]>([]);
  const [selectedRescheduleSlotIso, setSelectedRescheduleSlotIso] = useState("");

  const [monthCursor, setMonthCursor] = useState(dayjs().startOf("month"));
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    loadSessionProfileId();
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    loadPageData();
  }, [sessionLoading, sessionProfileId]);

  useEffect(() => {
    setRescheduleSlotOptions([]);
    setSelectedRescheduleSlotIso("");
  }, [selectedAppointmentId]);

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

  async function loadPageData() {
    try {
      setLoading(true);
      setMessage("");

      if (!sessionProfileId) {
        setMessage("No logged-in profile found.");
        setProfile(null);
        setConnection(null);
        setAppointments([]);
        return;
      }

      const prefRes = await fetch(
        `/api/preferences/calendar?profileId=${encodeURIComponent(sessionProfileId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const prefJson = await prefRes.json();

      if (!prefRes.ok) {
        throw new Error(prefJson?.error || "Failed to load calendar connection");
      }

      setProfile(prefJson.profile || null);
      setConnection(prefJson.connection || null);

      const orgId = prefJson?.profile?.org_id;
      if (!orgId) {
        setAppointments([]);
        return;
      }

      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, appointment_date, appointment_time, appointment_requested_slot_iso, appointment_requested_slot_human, appointment_status, appointment_type, notes, ai_summary, created_at, first_name, last_name, name, email, phone"
        )
        .eq("org_id", orgId)
        .or("appointment_date.not.is.null,appointment_requested_slot_iso.not.is.null")
        .order("appointment_requested_slot_iso", { ascending: true })
        .order("appointment_date", { ascending: true });

      if (error) {
        throw new Error(error.message || "Failed to load appointments");
      }

      const rows = (data || []) as AppointmentRow[];
      setAppointments(rows);

      const { data: leadData, error: leadError } = await supabase
  .from("leads")
  .select("id, first_name, last_name, name, email, phone")
  .eq("org_id", orgId)
  .order("created_at", { ascending: false })
  .limit(100);

if (leadError) {
  throw new Error(leadError.message || "Failed to load leads");
}

setLeadOptions((leadData || []) as LeadOption[]);

      if (rows.length > 0) {
        const stillExists = rows.some((row) => row.id === selectedAppointmentId);
        if (!selectedAppointmentId || !stillExists) {
          setSelectedAppointmentId(rows[0].id);
        }
      } else {
        setSelectedAppointmentId(null);
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to load calendar page");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSlots() {
    try {
      setSlotsLoading(true);
      setMessage("");
      setSlotOptions([]);
      setSelectedSlotIso("");

      if (!profile?.org_id) {
        throw new Error("No org_id found for this profile.");
      }

      if (!leadId.trim()) {
        throw new Error("Lead ID is required.");
      }

      const res = await fetch("/api/calendar/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: profile.org_id,
          lead_id: leadId.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load slots");
      }

      const slots = [json?.slots?.A, json?.slots?.B].filter(Boolean) as SlotOption[];
      setSlotOptions(slots);

      if (slots[0]?.slot_iso) {
        setSelectedSlotIso(slots[0].slot_iso);
      }

      if (slots.length === 0) {
        setMessage("No slots returned.");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function bookSelectedSlot() {
    try {
      setBookLoading(true);
      setMessage("");

      if (!profile?.org_id) {
        throw new Error("No org_id found for this profile.");
      }

      if (!leadId.trim()) {
        throw new Error("Lead ID is required.");
      }

      const slot = slotOptions.find((s) => s.slot_iso === selectedSlotIso);
      if (!slot) {
        throw new Error("Please select a valid slot.");
      }

      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: profile.org_id,
          lead_id: leadId.trim(),
          slot,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to book appointment");
      }

      setMessage("Appointment booked.");
      setLeadId("");
      setSlotOptions([]);
      setSelectedSlotIso("");
      await loadPageData();
    } catch (err: any) {
      setMessage(err.message || "Failed to book appointment");
    } finally {
      setBookLoading(false);
    }
  }

  async function loadRescheduleSlots() {
    try {
      setRescheduleSlotsLoading(true);
      setMessage("");
      setRescheduleSlotOptions([]);
      setSelectedRescheduleSlotIso("");

      if (!profile?.org_id) {
        throw new Error("No org_id found for this profile.");
      }

      if (!selectedAppointment) {
        throw new Error("No appointment selected.");
      }

      const res = await fetch("/api/calendar/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: profile.org_id,
          lead_id: selectedAppointment.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load reschedule slots");
      }

      const slots = [json?.slots?.A, json?.slots?.B].filter(Boolean) as SlotOption[];
      setRescheduleSlotOptions(slots);

      if (slots[0]?.slot_iso) {
        setSelectedRescheduleSlotIso(slots[0].slot_iso);
      }

      if (slots.length === 0) {
        setMessage("No reschedule slots returned.");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to load reschedule slots");
    } finally {
      setRescheduleSlotsLoading(false);
    }
  }

  async function rescheduleSelectedAppointment() {
    try {
      setRescheduleLoading(true);
      setMessage("");

      if (!profile?.org_id) {
        throw new Error("No org_id found for this profile.");
      }

      if (!selectedAppointment) {
        throw new Error("No appointment selected.");
      }

      const slot = rescheduleSlotOptions.find((s) => s.slot_iso === selectedRescheduleSlotIso);
      if (!slot) {
        throw new Error("Please select a valid reschedule slot.");
      }

      const res = await fetch("/api/calendar/reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: profile.org_id,
          lead_id: selectedAppointment.id,
          slot,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to reschedule appointment");
      }

      setMessage("Appointment rescheduled.");
      setRescheduleSlotOptions([]);
      setSelectedRescheduleSlotIso("");
      await loadPageData();
    } catch (err: any) {
      setMessage(err.message || "Failed to reschedule appointment");
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function cancelSelectedAppointment() {
    try {
      setCancelLoading(true);
      setMessage("");

      if (!profile?.org_id) {
        throw new Error("No org_id found for this profile.");
      }

      if (!selectedAppointment) {
        throw new Error("No appointment selected.");
      }

      const ok = window.confirm(`Cancel appointment for "${getLeadName(selectedAppointment)}"?`);

      if (!ok) return;

      const res = await fetch("/api/calendar/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: profile.org_id,
          lead_id: selectedAppointment.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to cancel appointment");
      }

      setMessage("Appointment canceled.");
      await loadPageData();
    } catch (err: any) {
      setMessage(err.message || "Failed to cancel appointment");
    } finally {
      setCancelLoading(false);
    }
  }

const upcomingAppointments = useMemo(() => {
  const allowedUpcomingStatuses = new Set(["pending", "confirmed", "rescheduled"]);

  return appointments.filter((a) => {
    const status = String(a.appointment_status || "").toLowerCase();

    if (!allowedUpcomingStatuses.has(status)) {
      return false;
    }

    return !!a.appointment_date || !!a.appointment_requested_slot_iso;
  });
}, [appointments]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();

    for (const appt of upcomingAppointments) {
      const dayKey = getAppointmentDayKey(appt);
      if (!dayKey) continue;

      const list = map.get(dayKey) || [];
      list.push(appt);
      map.set(dayKey, list);
    }

    for (const [key, list] of map.entries()) {
      list.sort((a, b) =>
        (getAppointmentTimeLabel(a) || "").localeCompare(getAppointmentTimeLabel(b) || "")
      );
      map.set(key, list);
    }

    return map;
  }, [upcomingAppointments]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);

  const selectedDateAppointments = useMemo(() => {
    return appointmentsByDate.get(selectedDate) || [];
  }, [appointmentsByDate, selectedDate]);

  const selectedAppointment = useMemo(() => {
    return upcomingAppointments.find((a) => a.id === selectedAppointmentId) || null;
  }, [upcomingAppointments, selectedAppointmentId]);

  const filteredLeadOptions = useMemo(() => {
  const term = leadSearch.trim().toLowerCase();

  return leadOptions.filter((lead) => {
    const label = [
      lead.name,
      lead.first_name,
      lead.last_name,
      lead.email,
      lead.phone,
      lead.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return !term || label.includes(term);
  });
}, [leadOptions, leadSearch]);

  const connected = !!connection?.calendar_connected;

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar Control Center
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              View connected calendar status, upcoming appointments, and manage bookings without
              leaving the CRM.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <div className="font-medium text-slate-900">{connected ? "Calendar Connected" : "Calendar Not Connected"}</div>
            <div className="mt-1 text-slate-500">
              {connection?.account_email || "No connected account"}
            </div>
          </div>
        </div>
      </header>

      {message ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Connection"
          subtitle="Your active calendar connection and sync basics."
        >
          {loading ? (
            <div className="text-sm text-slate-500">Loading connection...</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {connected ? "Connected" : "Not connected"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {connection?.provider || "N/A"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connected Account</div>
                <div className="mt-2 break-all text-base font-semibold text-slate-900">
                  {connection?.account_email || "N/A"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default Calendar</div>
                <div className="mt-2 break-all text-base font-semibold text-slate-900">
                  {connection?.default_calendar_id || "N/A"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Org ID</div>
                <div className="mt-2 break-all text-base font-semibold text-slate-900">
                  {profile?.org_id || "N/A"}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Manual Booking"
          subtitle="Pull two available slots and book directly from the CRM."
        >
          <div className="space-y-4">
<div className="space-y-3">
  <input
    type="text"
    value={leadSearch}
    onChange={(e) => setLeadSearch(e.target.value)}
    placeholder="Search lead by name, email, phone..."
    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
  />

  <select
    value={leadId}
    onChange={(e) => setLeadId(e.target.value)}
    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
  >
    <option value="">Select a lead...</option>
    {filteredLeadOptions.map((lead) => {
      const label =
        lead.name ||
        [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
        lead.email ||
        lead.phone ||
        lead.id;

      return (
        <option key={lead.id} value={lead.id}>
          {label} {lead.phone ? `— ${lead.phone}` : ""}
        </option>
      );
    })}
  </select>
</div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadSlots}
                disabled={slotsLoading || !connected}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Link2 className="h-4 w-4" />
                {slotsLoading ? "Loading Slots..." : "Load Slots"}
              </button>

              <button
                type="button"
                onClick={bookSelectedSlot}
                disabled={bookLoading || !selectedSlotIso || !connected}
                className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CalendarDays className="h-4 w-4" />
                {bookLoading ? "Booking..." : "Book Selected Slot"}
              </button>
            </div>

            {slotOptions.length > 0 ? (
              <div className="space-y-2">
                {slotOptions.map((slot) => (
                  <label
                    key={slot.slot_iso}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <input
                      type="radio"
                      name="slot"
                      checked={selectedSlotIso === slot.slot_iso}
                      onChange={() => setSelectedSlotIso(slot.slot_iso)}
                    />
                    <span className="font-medium text-slate-700">{slot.slot_human}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Load slots for a lead to see booking options.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Booked Appointments"
        subtitle="Quick-select cards for upcoming appointments."
      >
        {loading ? (
          <div className="text-sm text-slate-500">Loading appointments...</div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No booked appointments found.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {upcomingAppointments.map((appt) => {
              const leadName = getLeadName(appt);

              return (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => {
                    setSelectedAppointmentId(appt.id);
                    const dayKey = getAppointmentDayKey(appt);
                    if (dayKey) {
                      setSelectedDate(dayKey);
                      setMonthCursor(dayjs(dayKey).startOf("month"));
                    }
                  }}
                  className={`min-w-[300px] rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    selectedAppointmentId === appt.id
                      ? "border-blue-300 bg-blue-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-900">{leadName}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-blue-600" />
                          {getAppointmentDisplayDate(appt)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4 text-orange-600" />
                          {getAppointmentTimeLabel(appt) || "-"}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                        appt.appointment_status
                      )}`}
                    >
                      {appt.appointment_status || "Pending"}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-slate-700">
                    <div>{appt.email || "-"}</div>
                    <div>{appt.phone || "-"}</div>
                    <div className="font-medium text-slate-900">{appt.appointment_type || "-"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Calendar View"
        subtitle="Monthly view for scheduled appointments."
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => prev.subtract(1, "month"))}
              className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>

            <div className="min-w-[180px] text-center text-sm font-semibold text-slate-900">
              {monthCursor.format("MMMM YYYY")}
            </div>

            <button
              type="button"
              onClick={() => setMonthCursor((prev) => prev.add(1, "month"))}
              className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-600"
            >
              {label}
            </div>
          ))}

          {calendarDays.map((day) => {
            const dayKey = day.format("YYYY-MM-DD");
            const dayAppointments = appointmentsByDate.get(dayKey) || [];
            const isCurrentMonth = day.month() === monthCursor.month();
            const isToday = day.isSame(dayjs(), "day");
            const isSelected = dayKey === selectedDate;

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => setSelectedDate(dayKey)}
                className={`min-h-[128px] rounded-2xl border p-2 text-left align-top transition ${
                  isSelected ? "border-blue-300 bg-blue-50/40" : "border-slate-200"
                } ${!isCurrentMonth ? "bg-slate-50 text-slate-400" : "bg-white"} ${
                  isToday ? "ring-2 ring-orange-200" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">{day.date()}</div>
                  {dayAppointments.length > 0 ? (
                    <div className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {dayAppointments.length}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map((appt) => (
                    <div
                      key={appt.id}
                      className={`truncate rounded-xl border px-2 py-1 text-[11px] ${getStatusClasses(
                        appt.appointment_status
                      )}`}
                    >
                      {getAppointmentTimeLabel(appt) || "--"} • {getLeadName(appt)}
                    </div>
                  ))}

                  {dayAppointments.length > 3 ? (
                    <div className="text-[11px] text-slate-500">
                      +{dayAppointments.length - 3} more
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={`Appointments for ${dayjs(selectedDate).format("MMMM D, YYYY")}`}
          subtitle="Everything scheduled on the selected day."
        >
          {selectedDateAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No appointments on this date.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateAppointments.map((appt) => (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => setSelectedAppointmentId(appt.id)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${
                    selectedAppointmentId === appt.id
                      ? "border-blue-300 bg-blue-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{getLeadName(appt)}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {getAppointmentTimeLabel(appt) || "-"} • {appt.appointment_type || "-"}
                      </div>
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                        appt.appointment_status
                      )}`}
                    >
                      {appt.appointment_status || "Pending"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Appointment Details"
          subtitle="Review, reschedule, or cancel the selected appointment."
        >
          {!selectedAppointment ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Select an appointment to view details.
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{getLeadName(selectedAppointment)}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedAppointment.appointment_status || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {getAppointmentDayKey(selectedAppointment) || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {getAppointmentTimeLabel(selectedAppointment) || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
                  <div className="mt-2 break-all text-sm font-semibold text-slate-900">
                    {selectedAppointment.email || "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedAppointment.phone || "-"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                  <div className="font-semibold text-slate-900">Reschedule Appointment</div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={loadRescheduleSlots}
                    disabled={rescheduleSlotsLoading || !canRescheduleAppointment(selectedAppointment)}
                    className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rescheduleSlotsLoading ? "Loading Slots..." : "Load New Slots"}
                  </button>

                  <button
                    type="button"
                    onClick={rescheduleSelectedAppointment}
                    disabled={
                      rescheduleLoading ||
                      !selectedRescheduleSlotIso ||
                      !canRescheduleAppointment(selectedAppointment)
                    }
                    className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rescheduleLoading ? "Rescheduling..." : "Reschedule Appointment"}
                  </button>
                </div>

                {rescheduleSlotOptions.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {rescheduleSlotOptions.map((slot) => (
                      <label
                        key={slot.slot_iso}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                      >
                        <input
                          type="radio"
                          name="reschedule-slot"
                          checked={selectedRescheduleSlotIso === slot.slot_iso}
                          onChange={() => setSelectedRescheduleSlotIso(slot.slot_iso)}
                        />
                        <span className="font-medium text-slate-700">{slot.slot_human}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">
                    Load new slots to reschedule this appointment.
                  </div>
                )}
              </div>

              {(selectedAppointment.ai_summary || selectedAppointment.notes) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 font-semibold text-slate-900">Lead Notes</div>
                  <div className="whitespace-pre-line text-xs leading-5 text-slate-700">
                    {selectedAppointment.ai_summary || selectedAppointment.notes}
                  </div>
                </div>
              ) : null}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={cancelSelectedAppointment}
                  disabled={cancelLoading || !canCancelAppointment(selectedAppointment)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {cancelLoading ? "Canceling..." : "Cancel Appointment"}
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}