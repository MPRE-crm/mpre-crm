// crm/lib/market/summary.ts
// Pull latest Ada/Canyon CSVs from Supabase Storage and return a short summary string for the prompt.

import { createClient } from "@supabase/supabase-js";

// --- helpers ---
function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim()));
}

function median(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function summarize(csv: string, label: string): string {
  const rows = parseCsv(csv);
  if (rows.length < 2) return `${label}: no data`;

  const header = rows[0].map((h) => h.toLowerCase());
  const priceIdx = header.indexOf("median_price");
  const domIdx = header.indexOf("dom");
  const invIdx = header.indexOf("inventory");

  const prices: number[] = [];
  const doms: number[] = [];
  const invs: number[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const p = Number((r[priceIdx] ?? "").toString().replace(/[^0-9.]/g, ""));
    const d = Number((r[domIdx] ?? "").toString().replace(/[^0-9.]/g, ""));
    const v = Number((r[invIdx] ?? "").toString().replace(/[^0-9.]/g, ""));
    if (p) prices.push(p);
    if (d) doms.push(d);
    if (v) invs.push(v);
  }

  const mp = median(prices);
  const md = median(doms);
  const mi = median(invs);

  const parts: string[] = [];
  parts.push(`${label}:`);
  if (mp != null) parts.push(`median ~$${Math.round(mp).toLocaleString()}`);
  if (md != null) parts.push(`DOM ~${Math.round(md)}`);
  if (mi != null) parts.push(`inventory ~${mi.toFixed(1)} mo`);
  return parts.join(" · ");
}

// --- main ---
export async function getMarketSummaryText(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return "Ada/Canyon: data unavailable";

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let adaText = "";
  let canText = "";

  try {
    // Ada
    const { data: adaFiles } = await supabase.storage.from("market-updates").list("");
    const adaFile = adaFiles?.filter((f) => f.name.includes("ada.csv")).sort((a, b) => b.name.localeCompare(a.name))[0];
    if (adaFile) {
      const { data } = await supabase.storage.from("market-updates").download(adaFile.name);
      if (data) adaText = summarize(await data.text(), "Ada");
    }

    // Canyon
    const { data: canFiles } = await supabase.storage.from("market-updates").list("");
    const canFile = canFiles?.filter((f) => f.name.includes("canyon.csv")).sort((a, b) => b.name.localeCompare(a.name))[0];
    if (canFile) {
      const { data } = await supabase.storage.from("market-updates").download(canFile.name);
      if (data) canText = summarize(await data.text(), "Canyon");
    }
  } catch (e) {
    console.warn("[market/summary] failed", e);
  }

  const joined = [adaText, canText].filter(Boolean).join(" | ");
  return joined || "Ada/Canyon: latest data unavailable";
}
