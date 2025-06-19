import { createClient } from '@supabase/supabase-js'

// Use server-side environment variables (remove NEXT_PUBLIC_ prefix)
const supabaseUrl = process.env.SUPABASE_URL // without NEXT_PUBLIC_ prefix
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY // without NEXT_PUBLIC_ prefix

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


