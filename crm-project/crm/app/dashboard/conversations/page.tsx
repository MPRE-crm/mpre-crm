"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ConversationRow = {
  thread_key: string;
  lead_id: string | null;
  lead_name: string;
  lead_phone: string | null;
  latest_message_id: string;
  latest_body: string;
  latest_direction: string | null;
  latest_status: string | null;
  latest_created_at: string;
};

export default function ConversationsInboxPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInbox() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/conversations/list", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load conversations");
      }

      setRows(data.rows || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-gray-500">
            Messaging inbox for inbound and outbound text threads.
          </p>
        </div>

        <button
          onClick={loadInbox}
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
      ) : rows.length === 0 ? (
        <div className="rounded-md border bg-white p-6 text-gray-500">
          No conversations found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Latest Direction</th>
                <th className="px-4 py-3 font-medium">Latest Message</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Activity</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.thread_key} className="border-t align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.lead_name}</div>
                    <div className="text-xs text-gray-500">{row.lead_id || row.thread_key}</div>
                  </td>
                  <td className="px-4 py-3">{row.lead_phone || "-"}</td>
                  <td className="px-4 py-3">{row.latest_direction || "-"}</td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="line-clamp-2">{row.latest_body || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{row.latest_status || "-"}</td>
                  <td className="px-4 py-3">
                    {row.latest_created_at
                      ? new Date(row.latest_created_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {row.lead_id ? (
                      <button
                        onClick={() => router.push(`/dashboard/conversations/${row.lead_id}`)}
                        className="rounded border px-3 py-1.5 text-xs hover:bg-gray-100"
                      >
                        Open
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">No lead link</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}