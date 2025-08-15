import { createClient } from "@supabase/supabase-js";

export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service key so it can listen server-side
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);
