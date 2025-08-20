// crm/lib/supabase-browser.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!anon) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  _client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });

  if (typeof window !== 'undefined') {
    (window as any).supabase = _client; // expose globally for debugging
  }

  return _client;
}

