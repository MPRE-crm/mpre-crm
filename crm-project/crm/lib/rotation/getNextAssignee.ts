// crm/lib/rotation/getNextAssignee.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

export type Assignee = { user_id: number } | null;

export async function getNextAssignee(org_id: string): Promise<Assignee> {
  // Use rotation_members (user_id int4, is_active, last_assigned_at)
  const { data, error } = await supabase
    .from("rotation_members")
    .select("user_id, last_assigned_at")
    .eq("org_id", org_id)
    .eq("is_active", true)
    .order("last_assigned_at", { ascending: true, nullsFirst: true })
    .limit(1);

  if (!error && data && data.length > 0) {
    const picked = data[0];
    await supabase
      .from("rotation_members")
      .update({ last_assigned_at: new Date().toISOString() })
      .eq("org_id", org_id)
      .eq("user_id", picked.user_id);
    return { user_id: picked.user_id as number };
  }

  // Fallback: first active agent in users for this org (users.id is int4)
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("org_id", org_id)
    .eq("role", "agent")
    .eq("is_active", true)
    .limit(1);

  if (users && users.length > 0) {
    return { user_id: users[0].id as number };
  }

  return null;
}
