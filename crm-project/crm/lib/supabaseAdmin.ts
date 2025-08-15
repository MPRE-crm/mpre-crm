import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!url) throw new Error('Missing env: SUPABASE_URL')
if (!serviceKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY')

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

