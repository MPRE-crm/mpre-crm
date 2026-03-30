"use client";

import { useEffect, useState } from "react";

type MissedCallRow = {
  id: string;
  lead_id: string;
  call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: string | null;
  call_status: string;
  detected_at: string;
  callback_due_at: string;
  callback_status: string;
  callback_action: string | null;
  callback_reason: string | null;
  callback_result: string | null;
  callback_attempted_at: string | null;
  resolved_at: string | null;
  lead_name: string;
  lead_phone: string | null;
};

export default function MissedCallQueuePage() {
  const [rows, setRows] = useState<MissedCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRows() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/missed-call-queue/list", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load missed call queue");
      }

      setRows(data.rows || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load missed call queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Missed Call Queue</h1>
          <p className="text-sm text-gray-500">
            View missed calls and Samantha callback decisions.
          </p>
        </div>

        <button
          onClick={loadRows}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-md border p-4">Loading...</div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Call Status</th>
                <th className="px-4 py-3 font-medium">Callback Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Detected</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Attempted</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                    No missed call rows found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.lead_name}</div>
                      <div className="text-xs text-gray-500">{row.lead_id}</div>
                    </td>
                    <td className="px-4 py-3">{row.lead_phone || "-"}</td>
                    <td className="px-4 py-3">{row.call_status}</td>
                    <td className="px-4 py-3">{row.callback_status}</td>
                    <td className="px-4 py-3">{row.callback_action || "-"}</td>
                    <td className="px-4 py-3">{row.callback_reason || "-"}</td>
                    <td className="px-4 py-3">
                      {row.detected_at
                        ? new Date(row.detected_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {row.callback_due_at
                        ? new Date(row.callback_due_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {row.callback_attempted_at
                        ? new Date(row.callback_attempted_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{row.callback_result || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}