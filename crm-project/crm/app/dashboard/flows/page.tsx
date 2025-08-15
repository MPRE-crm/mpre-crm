'use client';

import { useEffect, useState } from "react";

type FlowRow = { key: string; env_var: string; active: boolean };

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [leadSource, setLeadSource] = useState("idx_signup");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    // fetch via RPC API route if you expose one; for now, static list fallback:
    fetch("/api/flows/list").then(async r => {
      if (r.ok) { setFlows(await r.json()); }
      else { setFlows([]); }
    }).catch(() => setFlows([]));
  }, []);

  const handleTest = async () => {
    setResult(null);
    const res = await fetch("/api/twilio/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        lead_source: leadSource,
        variables: { first_name: "Test", price_range: "$500k-$650k" },
        channels: { phone: true, sms: true, email: true }
      })
    });
    const json = await res.json();
    setResult(json);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Flow Tester</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Lead Source</label>
        <input
          className="border rounded px-3 py-2 w-full"
          value={leadSource}
          onChange={(e) => setLeadSource(e.target.value)}
          placeholder="e.g. idx_signup, relocation_form, fsbo_csv"
        />
        <p className="text-xs text-gray-500 mt-1">
          Mapped in Supabase table <code>lead_source_flow_map</code>.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Phone (E.164)</label>
        <input
          className="border rounded px-3 py-2 w-full"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1208XXXXXXX"
        />
      </div>

      <button
        onClick={handleTest}
        className="px-4 py-2 rounded bg-black text-white"
      >
        Run Test (Call + SMS + Email)
      </button>

      {result && (
        <pre className="mt-4 bg-gray-100 p-3 rounded text-xs overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <hr className="my-6" />

      <h2 className="text-xl font-semibold mb-2">Flows (from API if available)</h2>
      {flows.length === 0 ? (
        <p className="text-sm text-gray-500">No flow list API wired yet. (Optional)</p>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {flows.map(f => (
            <li key={f.key}>
              <span className="font-mono">{f.key}</span> — <code>{f.env_var}</code> ({f.active ? "active" : "inactive"})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
