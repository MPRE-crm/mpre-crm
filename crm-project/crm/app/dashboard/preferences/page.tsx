"use client";

import { useEffect, useState } from "react";

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

export default function PreferencesPage() {
  const [lenders, setLenders] = useState<LenderUser[]>([]);
  const [selectedLenderIds, setSelectedLenderIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

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

  function addLender(lenderId: number) {
    if (selectedLenderIds.includes(lenderId)) return;
    setSelectedLenderIds((prev) => [...prev, lenderId]);
  }

  function removeLender(lenderId: number) {
    setSelectedLenderIds((prev) => prev.filter((id) => id !== lenderId));
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
    } catch (err: any) {
      setMessage(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
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

                    <button
                      type="button"
                      onClick={() => addLender(lender.id)}
                      className="rounded bg-black px-3 py-2 text-sm text-white"
                    >
                      Add
                    </button>
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
                        onClick={() => removeLender(lender.id)}
                        className="rounded border px-3 py-2 text-sm"
                      >
                        Remove
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