'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!anon) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Keep a single instance across Fast Refresh / HMR in Next.js
const globalForSupabase = globalThis as unknown as {
  supabase?: SupabaseClient;
};

export const supabase =
  globalForSupabase.supabase ??
  (globalForSupabase.supabase = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  }));