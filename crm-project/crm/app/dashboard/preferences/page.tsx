"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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

  useEffect(() => {
    loadData();
    loadSessionProfileId();
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    loadCalendarData();
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

      const json = await res.json();

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

      const json = await res.json();

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Preferences</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set your preferred lender order here. Samantha will use this list first,
          then fall back to the organization lender pool if needed.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded border px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="mb-6 rounded border p-4">
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
                  <option value="icloud">iCloud</option>
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
                      <div className="text-sm text-gray-600 mt-1">
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

      <div className="mb-6 rounded border p-4">
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