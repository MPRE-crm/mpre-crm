"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLeadName(appt: AppointmentRow) {
  return (
    appt.name ||
    [appt.first_name, appt.last_name].filter(Boolean).join(" ").trim() ||
    appt.email ||
    appt.id
  );
}

function getStatusClasses(status: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "confirmed") return "bg-green-100 text-green-800 border-green-200";
  if (s === "pending") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (s === "completed") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "missed") return "bg-red-100 text-red-800 border-red-200";
  if (s === "rescheduled") return "bg-purple-100 text-purple-800 border-purple-200";
  if (s === "canceled") return "bg-gray-100 text-gray-700 border-gray-200";

  return "bg-gray-100 text-gray-700 border-gray-200";
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

export default function CalendarPage() {
  const [sessionProfileId, setSessionProfileId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [profile, setProfile] = useState<CalendarProfile | null>(null);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [leadId, setLeadId] = useState("");
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
          "id, appointment_date, appointment_time, appointment_status, appointment_type, notes, ai_summary, created_at, first_name, last_name, name, email, phone"
        )
        .eq("org_id", orgId)
        .not("appointment_date", "is", null)
        .order("appointment_date", { ascending: true });

      if (error) {
        throw new Error(error.message || "Failed to load appointments");
      }

      const rows = (data || []) as AppointmentRow[];
      setAppointments(rows);

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

      const ok = window.confirm(
        `Cancel appointment for "${getLeadName(selectedAppointment)}"?`
      );

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

  const upcomingAppointments = useMemo(() => {
    return appointments.filter((a) => !!a.appointment_date);
  }, [appointments]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();

    for (const appt of upcomingAppointments) {
      if (!appt.appointment_date) continue;
      const list = map.get(appt.appointment_date) || [];
      list.push(appt);
      map.set(appt.appointment_date, list);
    }

    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.appointment_time || "").localeCompare(b.appointment_time || ""));
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="mt-1 text-sm text-gray-600">
          View connected calendar status, upcoming booked appointments, and manually book a lead.
        </p>
      </div>

      {message ? (
        <div className="rounded border px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="mb-3 text-lg font-semibold">Connection</h2>
          {loading ? (
            <div className="text-sm text-gray-600">Loading connection...</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Status:</span>{" "}
                {connection?.calendar_connected ? "Connected" : "Not connected"}
              </div>
              <div>
                <span className="font-medium">Provider:</span>{" "}
                {connection?.provider || "N/A"}
              </div>
              <div>
                <span className="font-medium">Account:</span>{" "}
                {connection?.account_email || "N/A"}
              </div>
              <div>
                <span className="font-medium">Default Calendar:</span>{" "}
                {connection?.default_calendar_id || "N/A"}
              </div>
              <div>
                <span className="font-medium">Org ID:</span>{" "}
                {profile?.org_id || "N/A"}
              </div>
            </div>
          )}
        </div>

        <div className="rounded border p-4">
          <h2 className="mb-3 text-lg font-semibold">Manual Booking</h2>

          <div className="space-y-3">
            <input
              type="text"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              placeholder="Enter lead ID"
              className="w-full rounded border px-3 py-2 text-sm"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadSlots}
                disabled={slotsLoading || !connection?.calendar_connected}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {slotsLoading ? "Loading Slots..." : "Load Slots"}
              </button>

              <button
                type="button"
                onClick={bookSelectedSlot}
                disabled={bookLoading || !selectedSlotIso || !connection?.calendar_connected}
                className="rounded border px-4 py-2 text-sm disabled:opacity-60"
              >
                {bookLoading ? "Booking..." : "Book Selected Slot"}
              </button>
            </div>

            {slotOptions.length > 0 ? (
              <div className="space-y-2">
                {slotOptions.map((slot) => (
                  <label
                    key={slot.slot_iso}
                    className="flex items-center gap-2 rounded border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="slot"
                      checked={selectedSlotIso === slot.slot_iso}
                      onChange={() => setSelectedSlotIso(slot.slot_iso)}
                    />
                    <span>{slot.slot_human}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Load slots for a lead to see booking options.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Booked Appointments</h2>

        {loading ? (
          <div className="text-sm text-gray-600">Loading appointments...</div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="text-sm text-gray-600">No booked appointments found.</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcomingAppointments.map((appt) => {
              const leadName = getLeadName(appt);

              return (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => {
                    setSelectedAppointmentId(appt.id);
                    if (appt.appointment_date) {
                      setSelectedDate(appt.appointment_date);
                      setMonthCursor(dayjs(appt.appointment_date).startOf("month"));
                    }
                  }}
                  className={`min-w-[280px] rounded-lg border p-4 text-left shadow-sm transition hover:shadow ${
                    selectedAppointmentId === appt.id ? "border-black" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">{leadName}</div>
                    <div
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusClasses(
                        appt.appointment_status
                      )}`}
                    >
                      {appt.appointment_status || "Pending"}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-600">
                    {appt.appointment_date || "-"}{" "}
                    {appt.appointment_time ? `• ${appt.appointment_time}` : ""}
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    <div>{appt.email || "-"}</div>
                    <div>{appt.phone || "-"}</div>
                    <div className="mt-1 font-medium">{appt.appointment_type || "-"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Calendar View</h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => prev.subtract(1, "month"))}
              className="rounded border px-3 py-2 text-sm"
            >
              Prev
            </button>

            <div className="min-w-[180px] text-center font-medium">
              {monthCursor.format("MMMM YYYY")}
            </div>

            <button
              type="button"
              onClick={() => setMonthCursor((prev) => prev.add(1, "month"))}
              className="rounded border px-3 py-2 text-sm"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="rounded bg-gray-50 px-3 py-2 text-center text-sm font-medium text-gray-600"
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
                className={`min-h-[120px] rounded border p-2 text-left align-top transition ${
                  isSelected ? "border-black" : "border-gray-200"
                } ${!isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white"} ${
                  isToday ? "ring-1 ring-black" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">{day.date()}</div>
                  {dayAppointments.length > 0 ? (
                    <div className="rounded-full bg-black px-2 py-0.5 text-[10px] text-white">
                      {dayAppointments.length}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map((appt) => (
                    <div
                      key={appt.id}
                      className={`truncate rounded border px-2 py-1 text-[11px] ${getStatusClasses(
                        appt.appointment_status
                      )}`}
                    >
                      {appt.appointment_time || "--"} • {getLeadName(appt)}
                    </div>
                  ))}

                  {dayAppointments.length > 3 ? (
                    <div className="text-[11px] text-gray-500">
                      +{dayAppointments.length - 3} more
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="mb-4 text-lg font-semibold">
            Appointments for {dayjs(selectedDate).format("MMMM D, YYYY")}
          </h2>

          {selectedDateAppointments.length === 0 ? (
            <div className="text-sm text-gray-600">No appointments on this date.</div>
          ) : (
            <div className="space-y-3">
              {selectedDateAppointments.map((appt) => (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => setSelectedAppointmentId(appt.id)}
                  className={`w-full rounded border p-3 text-left ${
                    selectedAppointmentId === appt.id ? "border-black" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{getLeadName(appt)}</div>
                      <div className="text-sm text-gray-600">
                        {appt.appointment_time || "-"} • {appt.appointment_type || "-"}
                      </div>
                    </div>

                    <div
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusClasses(
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
        </div>

        <div className="rounded border p-4">
          <h2 className="mb-4 text-lg font-semibold">Appointment Details</h2>

          {!selectedAppointment ? (
            <div className="text-sm text-gray-600">Select an appointment to view details.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Lead:</span> {getLeadName(selectedAppointment)}
              </div>
              <div>
                <span className="font-medium">Email:</span> {selectedAppointment.email || "-"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {selectedAppointment.phone || "-"}
              </div>
              <div>
                <span className="font-medium">Date:</span> {selectedAppointment.appointment_date || "-"}
              </div>
              <div>
                <span className="font-medium">Time:</span> {selectedAppointment.appointment_time || "-"}
              </div>
              <div>
                <span className="font-medium">Status:</span> {selectedAppointment.appointment_status || "-"}
              </div>
              <div>
                <span className="font-medium">Type:</span> {selectedAppointment.appointment_type || "-"}
              </div>

              {(selectedAppointment.ai_summary || selectedAppointment.notes) ? (
                <div>
                  <div className="mb-2 font-medium">Lead Notes</div>
                  <div className="whitespace-pre-line rounded bg-gray-50 p-3 text-xs text-gray-700">
                    {selectedAppointment.ai_summary || selectedAppointment.notes}
                  </div>
                </div>
              ) : null}

              <div className="rounded border p-3">
                <div className="mb-2 font-medium">Reschedule Appointment</div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadRescheduleSlots}
                    disabled={rescheduleSlotsLoading || !canRescheduleAppointment(selectedAppointment)}
                    className="rounded border px-4 py-2 text-sm disabled:opacity-60"
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
                    className="rounded border border-blue-300 px-4 py-2 text-sm text-blue-700 disabled:opacity-60"
                  >
                    {rescheduleLoading ? "Rescheduling..." : "Reschedule Appointment"}
                  </button>
                </div>

                {rescheduleSlotOptions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {rescheduleSlotOptions.map((slot) => (
                      <label
                        key={slot.slot_iso}
                        className="flex items-center gap-2 rounded border p-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="reschedule-slot"
                          checked={selectedRescheduleSlotIso === slot.slot_iso}
                          onChange={() => setSelectedRescheduleSlotIso(slot.slot_iso)}
                        />
                        <span>{slot.slot_human}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-600">
                    Load new slots to reschedule this appointment.
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={cancelSelectedAppointment}
                  disabled={cancelLoading || !canCancelAppointment(selectedAppointment)}
                  className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60"
                >
                  {cancelLoading ? "Canceling..." : "Cancel Appointment"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}