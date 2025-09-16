// crm-project/crm/lib/calendar/getTwoSlots.ts
// Minimal placeholder: returns two future slots in ISO + simple human strings.
// Upgrade later to read Google Calendar availability per org/agent.

type GetTwoSlotsArgs = { org_id: string; lead_id?: string | null };

export type CalendarSlot = { slot_iso: string; slot_human: string };
export type TwoCalendarSlots = { A: CalendarSlot; B: CalendarSlot };

function toHuman(d: Date): string {
  // Simple humanization (e.g., "Tue 2:00 PM MDT")
  // You can localize/format better once you wire real calendar logic.
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  return `${day} ${time} ${tz}`;
}

export async function getTwoSlots(_args: GetTwoSlotsArgs): Promise<TwoCalendarSlots> {
  const now = new Date();

  const a = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
  a.setHours(10, 0, 0, 0); // 10:00
  const b = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
  b.setHours(14, 0, 0, 0); // 2:00

  const A: CalendarSlot = { slot_iso: a.toISOString(), slot_human: toHuman(a) };
  const B: CalendarSlot = { slot_iso: b.toISOString(), slot_human: toHuman(b) };

  return { A, B };
}

