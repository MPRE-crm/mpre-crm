import { createClient } from '@supabase/supabase-js'

// Prefer public vars for browser/client, fallback to server vars for backend
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('❌ Missing environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('❌ Missing environment variable: SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Standard Supabase client for use in client & server components
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

