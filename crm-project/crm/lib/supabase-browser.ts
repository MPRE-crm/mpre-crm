'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!anon) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');

declare global {
  // eslint-disable-next-line no-var
  var __mpreSupabaseBrowserClient: SupabaseClient | undefined;
}

function createBrowserClient(): SupabaseClient {
  return createClient(url, anon, {
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
}

export function getSupabaseBrowser(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createBrowserClient();
  }

  if (!globalThis.__mpreSupabaseBrowserClient) {
    globalThis.__mpreSupabaseBrowserClient = createBrowserClient();
  }

  return globalThis.__mpreSupabaseBrowserClient;
}

export const supabase = getSupabaseBrowser();

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
