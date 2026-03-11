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

  const [creatingLender, setCreatingLender] = useState(false);
  const [deletingLenderId, setDeletingLenderId] = useState<number | null>(null);

  const [newLenderName, setNewLenderName] = useState("");
  const [newLenderEmail, setNewLenderEmail] = useState("");
  const [newLenderPhone, setNewLenderPhone] = useState("");

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
                        onClick={() => removeLender(lender.id)}
                        className="rounded border px-3 py-2 text-sm"
                      >
                        Remove
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