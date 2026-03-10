import { createClient } from "@supabase/supabase-js";
import { getNextAssignee } from "../rotation/getNextAssignee";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function saveRelocationLead({
  org_id,
  first_name,
  last_name,
  email,
  phone,
  city,
  county,
  price_range,
  move_timeline,
  preferred_areas,
  notes,
}: {
  org_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  county?: string;
  price_range?: string;
  move_timeline?: string;
  preferred_areas?: string;
  notes?: string;
}) {

  /* -------------------------------------------------- */
  /* ROTATION                                           */
  /* -------------------------------------------------- */

  const assignee = await getNextAssignee(org_id).catch(() => null);

  const agent_id = assignee?.user_id ?? null;

  /* -------------------------------------------------- */
  /* INSERT LEAD                                        */
  /* -------------------------------------------------- */

  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id,
      first_name,
      last_name,
      name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
      email,
      phone,
      city,
      county,
      price_range,
      move_timeline,
      preferred_areas,
      notes,
      lead_source: "Relocation AI",
      agent_id,
      status: "new",
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Relocation lead insert failed:", error);
    return { ok: false, error };
  }

  return {
    ok: true,
    lead: data,
    assigned_agent: agent_id,
  };
}