// crm/app/api/twilio/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin' // server-only client

// Twilio sends form-encoded POST bodies, so we need to parse them
async function parseFormData(req: NextRequest) {
  const text = await req.text()
  return Object.fromEntries(new URLSearchParams(text))
}

export async function POST(req: NextRequest) {
  try {
    const data = await parseFormData(req)

    // Basic Twilio webhook payload fields
    const from = data.From || ''
    const to = data.To || ''
    const body = data.Body || ''
    const callStatus = data.CallStatus || null
    const messageSid = data.MessageSid || null
    const callSid = data.CallSid || null
    const direction = data.SmsStatus || callStatus ? 'incoming' : 'incoming'

    // Attempt to match lead by phone number (normalized to last 10 digits)
    const phoneDigits = from.replace(/\D/g, '').slice(-10)
    const { data: leads, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('id, phone, phone_number')
      .or(`phone.ilike.%${phoneDigits}%,phone_number.ilike.%${phoneDigits}%`)
      .limit(1)

    if (leadErr) {
      console.error('Lead lookup error:', leadErr)
    }

    const leadId = leads?.[0]?.id || null

    // Insert into messages table
    const { error: insertErr } = await supabaseAdmin.from('messages').insert({
      lead_id: leadId,
      lead_phone: from,
      direction,
      body: body || callStatus,
      status: callStatus || data.SmsStatus || 'received',
      twilio_sid: messageSid || callSid || null,
    })

    if (insertErr) {
      console.error('Supabase insert error:', insertErr)
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })
    }

    // Respond to Twilio to stop retries (Twilio expects XML for calls/SMS)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )

  } catch (err: any) {
    console.error('Inbound webhook error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
