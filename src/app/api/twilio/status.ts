import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const { To, MessageStatus, SmsStatus } = req.body

  try {
    // Update latest outgoing message for this recipient
    const { error } = await supabase
      .from('messages')
      .update({ status: MessageStatus || SmsStatus })
      .eq('lead_phone', To)
      .eq('direction', 'outgoing')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw error

    return res.status(200).send('OK')
  } catch (error) {
    const err = error as Error
    console.error('Error in status handler:', err.message)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}

