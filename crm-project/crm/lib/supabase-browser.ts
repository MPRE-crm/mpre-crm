'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!anon) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// One-time cleanup: remove any stale Supabase tokens from prior builds
// so nothing "sticks" between sessions.
(function hardLogoutLocalStorageArtifacts() {
  if (typeof window === 'undefined') return;
  try {
    const wipe = (store: Storage) => {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        // Supabase stores tokens with keys starting with "sb-"
        if (k.startsWith('sb-')) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    };
    wipe(window.localStorage);
    wipe(window.sessionStorage);
  } catch {
    // ignore storage access issues
  }
})();

// Keep a single instance across Fast Refresh / HMR in Next.js
const globalForSupabase = globalThis as unknown as {
  supabase?: SupabaseClient;
};

export const supabase =
  globalForSupabase.supabase ??
  (globalForSupabase.supabase = createClient(url, anon, {
    auth: {
      // 🚫 Do not persist session in localStorage; browser close = fresh login
      persistSession: false,
      // 🚫 Do not silently refresh; forces explicit re-auth when needed
      autoRefreshToken: false,
      // Needed for the OAuth/callback flow to pick up the session in URL
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  }));
