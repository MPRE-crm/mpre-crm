"use client";

import { useEffect, useMemo, useState } from "react";

type LeadRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  lead_heat?: string | null;
  next_contact_at?: string | null;
  idx_followup_trigger_type?: string | null;
  idx_followup_trigger_count?: number | null;
};

type QueueRow = {
  lead: LeadRow;
  decision: {
    action: string;
    governor_action: string;
    heat_status: string;
    reason_codes: string[];
    escalate_to_agent: boolean;
  };
};

function formatLeadName(lead?: LeadRow | null) {
  if (!lead) return "Unknown Lead";
  const full =
    lead.name ||
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  return full || lead.phone || lead.email || "Unknown Lead";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function FollowUpQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/follow-up-queue/list", {
          method: "GET",
          cache: "no-store",
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(result?.error || "Failed to load follow-up queue");
        }

        if (!mounted) return;
        setRows((result?.queue || []) as QueueRow[]);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || "Failed to load follow-up queue");
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (actionFilter !== "all" && row.decision.action !== actionFilter) {
        return false;
      }

      if (!q) return true;

      const lead = row.lead;
      const leadName = formatLeadName(lead).toLowerCase();

      return (
        leadName.includes(q) ||
        String(lead.phone || "").toLowerCase().includes(q) ||
        String(lead.email || "").toLowerCase().includes(q) ||
        String(row.decision.action || "").toLowerCase().includes(q) ||
        String(row.decision.heat_status || "").toLowerCase().includes(q) ||
        (row.decision.reason_codes || []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [rows, search, actionFilter]);

  const summary = useMemo(() => {
    return {
      total: filteredRows.length,
      text_now: filteredRows.filter((r) => r.decision.action === "text_now").length,
      call_now: filteredRows.filter((r) => r.decision.action === "call_now").length,
      notify_agent: filteredRows.filter((r) => r.decision.action === "notify_agent").length,
      wait: filteredRows.filter((r) => r.decision.action === "wait").length,
    };
  }, [filteredRows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Follow-Up Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          See which leads are due next and what Samantha would do.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Text Now</div>
          <div className="text-2xl font-bold">{summary.text_now}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Call Now</div>
          <div className="text-2xl font-bold">{summary.call_now}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Notify Agent</div>
          <div className="text-2xl font-bold">{summary.notify_agent}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Wait</div>
          <div className="text-2xl font-bold">{summary.wait}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          className="border rounded-lg px-3 py-2 w-full md:w-80"
          placeholder="Search lead, phone, action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded-lg px-3 py-2"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="all">All Actions</option>
          <option value="text_now">Text Now</option>
          <option value="call_now">Call Now</option>
          <option value="notify_agent">Notify Agent</option>
          <option value="wait">Wait</option>
        </select>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading follow-up queue...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No queued follow-ups found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Next Contact</th>
                  <th className="px-4 py-3">Lead Heat</th>
                  <th className="px-4 py-3">Planned Action</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.lead.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatLeadName(row.lead)}</div>
                      <div className="text-xs text-gray-500">
                        {row.lead.phone || row.lead.email || row.lead.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(row.lead.next_contact_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.decision.heat_status || row.lead.lead_heat || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.decision.action}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{row.lead.idx_followup_trigger_type || "-"}</div>
                      <div className="text-xs text-gray-500">
                        Count: {row.lead.idx_followup_trigger_count ?? 0}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(row.decision.reason_codes || []).map((reason) => (
                          <span
                            key={reason}
                            className="text-xs bg-gray-100 border rounded-full px-2 py-1"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}