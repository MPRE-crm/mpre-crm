export function cleanText(t) {
  return (t || "").toString().trim();
}

export function parseEmail(t) {
  const s = (t || "").toLowerCase();
  const m = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0] : null;
}

export function parsePhone(t) {
  const s = (t || "").replace(/[^\d]/g, "");
  if (s.length < 10) return null;
  return s.slice(-10);
}

export function parseName(t) {
  const s = cleanText(t);
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: null, last_name: null };
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export function parseYesNo(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("yes") || s.includes("yeah") || s.includes("yep") || s.includes("sure")) return true;
  if (s.includes("no") || s.includes("nope") || s.includes("nah")) return false;
  return null;
}

export function parsePriceRangeNumbers(t) {
  const s = (t || "").toLowerCase().replace(/,/g, "");
  const nums = [];
  const re = /(\$?\s*\d+(\.\d+)?\s*(k|m)?)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    let raw = m[0].replace(/\$/g, "").trim();
    let mult = 1;
    if (raw.endsWith("k")) { mult = 1000; raw = raw.slice(0, -1); }
    if (raw.endsWith("m")) { mult = 1000000; raw = raw.slice(0, -1); }
    const val = Number(raw);
    if (!Number.isNaN(val)) nums.push(val * mult);
  }
  if (!nums.length) return { min: null, max: null };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  nums.sort((a, b) => a - b);
  return { min: nums[0], max: nums[nums.length - 1] };
}

export function parseBedsBathsSqft(t) {
  const s = (t || "").toLowerCase();
  const beds = (() => {
    const m = s.match(/(\d+)\s*(bed|beds|br)\b/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const baths = (() => {
    const m = s.match(/(\d+(\.\d+)?)\s*(bath|baths|ba)\b/);
    return m ? Math.round(parseFloat(m[1])) : null;
  })();
  const sqft = (() => {
    const m = s.match(/(\d{3,5})\s*(sq\s*ft|sqft|square\s*feet)\b/);
    return m ? parseInt(m[1], 10) : null;
  })();
  return { beds, baths, sqft };
}
