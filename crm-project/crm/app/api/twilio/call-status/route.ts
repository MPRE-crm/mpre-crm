// crm-project/crm/app/api/twilio/call-status/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase server-side client
const supabase = createClient(
  process.env.SUPABASE_URL!,              // ✅ use server-side var
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ✅ service role for writes
)

export async function POST(req: Request) {
  const bodyText = await req.text()
  const data = new URLSearchParams(bodyText)

  const callSid = String(data.get('CallSid') || '')
  const status = String(data.get('CallStatus') || '')
  const answeredBy = String(data.get('AnsweredBy') || '')
  const to = String(data.get('To') || '')
  const from = String(data.get('From') || '')
  const leadId = String(data.get('lead_id') || '')
  const conversationSummary = String(data.get('conversation_summary') || '')

  if (!callSid) return NextResponse.json({ ok: true })

  try {
    // Voicemail path first
    if (status === 'completed' && answeredBy?.startsWith('machine')) {
      await supabase
        .from('follow_ups')
        .update({
          final_status: 'voicemail',
          do_not_contact: true,
          next_attempt_at: null,
        })
        .eq('call_sid', callSid)
    }
    // Connected calls
    else if (status === 'in-progress' || status === 'completed') {
      await supabase
        .from('follow_ups')
        .update({
          final_status: 'answered',
          do_not_contact: true,
          next_attempt_at: null,
        })
        .eq('call_sid', callSid)
    }
    // Missed, busy, failed — mark attempt time
    else if (['busy', 'no-answer', 'failed', 'canceled'].includes(status)) {
      await supabase
        .from('follow_ups')
        .update({ last_attempt_at: new Date().toISOString() })
        .eq('call_sid', callSid)
    }

    // Save AI conversation notes if provided
    if (leadId && conversationSummary) {
      await supabase
        .from('leads')
        .update({
          notes: conversationSummary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
    }

    // Always log it in call_logs
    await supabase.from('call_logs').insert({
      call_sid: callSid,
      status,
      answered_by: answeredBy || null,
      from_number: from,
      to_number: to,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('❌ call-status error', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
