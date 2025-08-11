import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { sendText } from '../../../lib/sendText'
// import { aiCall } from '@/lib/aiCall'

export async function POST(req: NextRequest) {
  const data = await req.json()
  const { id, from_number, to_number, call_sid } = data

  const { data: existing, error: fetchError } = await supabase
    .from('follow_ups')
    .select('id')
    .eq('call_sid', call_sid)
    .limit(1)

  if (fetchError) {
    console.error('❌ Supabase lookup error:', fetchError)
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: false, message: 'Follow-up already sent for this call' }, { status: 200 })
  }

  try {
    await supabase.from('follow_ups').insert({
      lead_number: from_number,
      call_sid,
      method: 'sms',
      sent_at: new Date().toISOString(),
    })

    await sendText({
      to: from_number,
      message: `Sorry we missed your call! Can we help with anything related to Boise real estate?`,
    })

    // Optionally: await aiCall(from_number)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('❌ Follow-up send error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}


