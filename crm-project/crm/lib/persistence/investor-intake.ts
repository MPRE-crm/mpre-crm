// crm/lib/persistence/investor-intake.ts
import { createClient } from "@supabase/supabase-js";
import { getNextAssignee } from "../rotation/getNextAssignee";
import { getTwoSlots } from "../calendar/getTwoSlots";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

type InvestorResult = {
  org_id: string;
  lead_id: string;
  call_sid?: string;

  price_cap?: number | null;
  min_cap_rate?: number | null;
  cash_or_finance?: string | null; // 'cash' | 'finance' | 'mixed'
  units?: number | null;
  property_type?: string | null;
  markets?: string | null;
  wants_1031?: boolean | null;
  timeline?: string | null;
  notes?: string | null;

  appointment_set?: boolean;
  appointment_iso?: string | null;
  attendee_name?: string | null;
  attendee_phone?: string | null;
  attendee_email?: string | null;
};

export async function persistInvestorIntake(payload: InvestorResult) {
  const {
    org_id, lead_id, call_sid,
    price_cap, min_cap_rate, cash_or_finance, units, property_type,
    markets, wants_1031, timeline, notes,
    appointment_set, appointment_iso, attendee_name, attendee_phone, attendee_email
  } = payload;

  // 1) Upsert investor_intake (idempotent per call_sid)
  {
    const { error } = await supabase
      .from("investor_intake")
      .upsert(
        {
          org_id, lead_id, call_sid,
          price_cap, min_cap_rate, cash_or_finance, units, property_type,
          markets, wants_1031, timeline, notes,
          appointment_iso,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "call_sid" }
      );
    if (error) console.error("❌ investor_intake upsert error:", error.message);
  }

  // 2) Optionally seed IDX search request (uses params JSONB in your schema)
  if (markets || property_type || typeof price_cap === "number") {
    const { error } = await supabase.from("idx_search_requests").insert({
      org_id,
      lead_id,
      params: { markets, property_type, price_cap, min_cap_rate, units, wants_1031 },
      status: "pending",
      created_at: new Date().toISOString(),
    });
    if (error) console.error("❌ idx_search_requests insert error:", error.message);
  }

  // 3) Lead assignment via rotation (assigned_user_id is int4 in your schema)
  const assignee = await getNextAssignee(org_id).catch(() => null); // { user_id: number } | null
  if (assignee?.user_id != null) {
    const { error } = await supabase.from("lead_assignments").upsert(
      {
        lead_id,
        org_id,
        assigned_user_id: assignee.user_id, // int4
        source: "investor_intake",
        status: "pending",
        ack_deadline_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        notes: "Assigned by rotation",
        created_at: new Date().toISOString(),
      },
      { onConflict: "lead_id" }
    );
    if (error) console.error("❌ lead_assignments upsert error:", error.message);
  }

  // 4) (Skip appointments table insert: your schema differs; bridge already sets leads.appointment_*)

  // 5) Notify endpoints (fire-and-forget)
  const notifyBase = process.env.PUBLIC_URL || "";
  if (notifyBase) {
    fetch(`${notifyBase}/api/notify/agent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ org_id, lead_id, kind: "investor_intake_complete" }),
    }).catch(() => {});
    if (appointment_set && appointment_iso) {
      fetch(`${notifyBase}/api/notify/admin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ org_id, lead_id, kind: "appointment_set", starts_at: appointment_iso }),
      }).catch(() => {});
    }
  }

  // 6) Offer two slots for AI to propose
  const slots = await getTwoSlots({ org_id, lead_id }).catch(() => null);

  return { ok: true, assignee: assignee?.user_id ?? null, slots };
}
