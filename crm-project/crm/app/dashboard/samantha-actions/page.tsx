"use client";

import { useEffect, useMemo, useState } from "react";

type SamanthaActionLogRow = {
  id: string;
  lead_id: string | null;
  org_id: string | null;
  source: string;
  trigger_type: string | null;
  planned_action: string;
  executed_action: string | null;
  execution_mode: string;
  status: string;
  reason_codes: string[] | null;
  details: Record<string, any> | null;
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

export default function SamanthaActionsPage() {
  const [rows, setRows] = useState<SamanthaActionLogRow[]>([]);
  const [leadMap, setLeadMap] = useState<Record<string, LeadRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/samantha-actions/list", {
          method: "GET",
          cache: "no-store",
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(result?.error || "Failed to load Samantha actions");
        }

        if (!mounted) return;

        const actionRows = (result?.actions || []) as SamanthaActionLogRow[];
        const leads = (result?.leads || []) as LeadRow[];

        setRows(actionRows);

        const nextLeadMap: Record<string, LeadRow> = {};
        for (const lead of leads) {
          nextLeadMap[lead.id] = lead;
        }

        setLeadMap(nextLeadMap);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || "Failed to load Samantha actions");
        setRows([]);
        setLeadMap({});
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
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (modeFilter !== "all" && row.execution_mode !== modeFilter) return false;

      if (!q) return true;

      const lead = row.lead_id ? leadMap[row.lead_id] : null;
      const leadName = formatLeadName(lead).toLowerCase();
      const phone = String(lead?.phone || "").toLowerCase();
      const email = String(lead?.email || "").toLowerCase();
      const reasons = (row.reason_codes || []).join(" ").toLowerCase();
      const source = String(row.source || "").toLowerCase();
      const planned = String(row.planned_action || "").toLowerCase();
      const executed = String(row.executed_action || "").toLowerCase();
      const status = String(row.status || "").toLowerCase();

      return (
        leadName.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        reasons.includes(q) ||
        source.includes(q) ||
        planned.includes(q) ||
        executed.includes(q) ||
        status.includes(q)
      );
    });
  }, [rows, leadMap, search, statusFilter, modeFilter]);

  const summary = useMemo(() => {
    return {
      total: filteredRows.length,
      executed: filteredRows.filter((r) => r.status === "executed").length,
      skipped: filteredRows.filter((r) => r.status === "skipped").length,
      failed: filteredRows.filter((r) => r.status === "failed").length,
      mock: filteredRows.filter((r) => r.execution_mode === "mock").length,
      live: filteredRows.filter((r) => r.execution_mode === "live").length,
    };
  }, [filteredRows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Samantha Actions</h1>
        <p className="text-sm text-gray-500 mt-1">
          See what Samantha planned, skipped, mocked, or executed.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Executed</div>
          <div className="text-2xl font-bold">{summary.executed}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Skipped</div>
          <div className="text-2xl font-bold">{summary.skipped}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Failed</div>
          <div className="text-2xl font-bold">{summary.failed}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Mock</div>
          <div className="text-2xl font-bold">{summary.mock}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-xs text-gray-500">Live</div>
          <div className="text-2xl font-bold">{summary.live}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          className="border rounded-lg px-3 py-2 w-full md:w-80"
          placeholder="Search lead, phone, reason, action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded-lg px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="executed">Executed</option>
          <option value="skipped">Skipped</option>
          <option value="failed">Failed</option>
          <option value="planned">Planned</option>
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
        >
          <option value="all">All Modes</option>
          <option value="mock">Mock</option>
          <option value="live">Live</option>
        </select>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading Samantha actions...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No Samantha actions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Planned</th>
                  <th className="px-4 py-3">Executed</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reasons</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const lead = row.lead_id ? leadMap[row.lead_id] : null;

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
                        <div>{row.source}</div>
                        <div className="text-xs text-gray-500">{row.trigger_type || "-"}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.planned_action}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.executed_action || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.execution_mode}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(row.reason_codes || []).length > 0 ? (
                            (row.reason_codes || []).map((reason) => (
                              <span
                                key={reason}
                                className="text-xs bg-gray-100 border rounded-full px-2 py-1"
                              >
                                {reason}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[320px]">
                        <pre className="text-xs whitespace-pre-wrap break-words bg-gray-50 border rounded-lg p-3">
                          {JSON.stringify(row.details || {}, null, 2)}
                        </pre>
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