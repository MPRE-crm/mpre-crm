"use client";

import { useEffect, useMemo, useState } from "react";

type EscalationRow = {
  id: string;
  lead_id: string | null;
  org_id: string | null;
  escalation_reason: string;
  status_at_escalation: string | null;
  escalated_by: string | null;
  status: string;
  handled_at: string | null;
  handled_by: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
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

export default function EscalationsPage() {
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [leadMap, setLeadMap] = useState<Record<string, LeadRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/escalations/list", {
        method: "GET",
        cache: "no-store",
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result?.error || "Failed to load escalations");
      }

      const escalationRows = (result?.escalations || []) as EscalationRow[];
      const leads = (result?.leads || []) as LeadRow[];

      setRows(escalationRows);

      const nextLeadMap: Record<string, LeadRow> = {};
      for (const lead of leads) {
        nextLeadMap[lead.id] = lead;
      }

      setLeadMap(nextLeadMap);
    } catch (err: any) {
      setError(err.message || "Failed to load escalations");
      setRows([]);
      setLeadMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function markHandled(escalationId: string) {
    try {
      setSavingId(escalationId);

      const res = await fetch("/api/escalations/mark-handled", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          escalation_id: escalationId,
          handled_by: "dashboard_user",
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result?.error || "Failed to mark handled");
      }

      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to mark handled");
    } finally {
      setSavingId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;

      const lead = row.lead_id ? leadMap[row.lead_id] : null;
      const leadName = formatLeadName(lead).toLowerCase();
      const phone = String(lead?.phone || "").toLowerCase();
      const email = String(lead?.email || "").toLowerCase();

      return (
        leadName.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        String(row.escalation_reason || "").toLowerCase().includes(q) ||
        String(row.status || "").toLowerCase().includes(q) ||
        String(row.escalated_by || "").toLowerCase().includes(q)
      );
    });
  }, [rows, leadMap, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: filteredRows.length,
      open: filteredRows.filter((r) => r.status === "open").length,
      handled: filteredRows.filter((r) => r.status === "handled").length,
    };
  }, [filteredRows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Escalations</h1>
        <p className="text-sm text-gray-500 mt-1">
          See leads Samantha escalated for human follow-up.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Open</div>
          <div className="text-2xl font-bold">{summary.open}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Handled</div>
          <div className="text-2xl font-bold">{summary.handled}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          className="border rounded-lg px-3 py-2 w-full md:w-80"
          placeholder="Search lead, phone, reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded-lg px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="handled">Handled</option>
        </select>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading escalations...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No escalations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status at Escalation</th>
                  <th className="px-4 py-3">Escalated By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Handled</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const lead = row.lead_id ? leadMap[row.lead_id] : null;
                  const isHandled = row.status === "handled";

                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{formatLeadName(lead)}</div>
                        <div className="text-xs text-gray-500">
                          {lead?.phone || lead?.email || row.lead_id || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.escalation_reason}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status_at_escalation || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.escalated_by || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isHandled
                          ? `${formatDate(row.handled_at)}${row.handled_by ? ` by ${row.handled_by}` : ""}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          className={`rounded-lg px-3 py-2 text-sm ${
                            isHandled
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-gray-900 text-white hover:bg-gray-800"
                          }`}
                          disabled={isHandled || savingId === row.id}
                          onClick={() => markHandled(row.id)}
                        >
                          {savingId === row.id
                            ? "Saving..."
                            : isHandled
                            ? "Handled"
                            : "Mark Handled"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}