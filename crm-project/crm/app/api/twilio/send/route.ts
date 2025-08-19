// crm/app/api/twilio/send/route.ts
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// Helper to require envs
function req(name: string, val: string | undefined): string {
  if (!val) throw new Error(`Missing env: ${name}`)
  return val
}

const toE164 = (p: string): string => {
  const digits = p.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+1${digits}`
}

function displayName(first?: string, last?: string, fallback?: string) {
  const full = `${first || ''} ${last || ''}`.trim()
  return full || fallback || 'there'
}

export async function GET() {
  try {
    // 🔹 Lazy-load envs and Twilio client here
    const ACCOUNT_SID = req('TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID)
    const AUTH_TOKEN = req('TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN)
    const FROM_NUMBER = req('TWILIO_PHONE_NUMBER', process.env.TWILIO_PHONE_NUMBER)
    const STATUS_CALLBACK =
      process.env.TWILIO_STATUS_CALLBACK_URL ||
      process.env.VOICE_STATUS_WEBHOOK_URL ||
      undefined

    const client = twilio(ACCOUNT_SID, AUTH_TOKEN)

    // 🔹 Query leads with appt in next 48h
    const nowIso = new Date().toISOString()
    const in48hIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: leads, error: dbError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .gte('appointment_date', nowIso)
      .lte('appointment_date', in48hIso)
      .is('appointment_attended', null)

    if (dbError) {
      console.error('DB query error:', dbError)
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })
    }

    if (!leads?.length) {
      return NextResponse.json({ success: false, message: 'No upcoming appointments found' }, { status: 404 })
    }

    for (const lead of leads) {
      const firstName = displayName(lead.first_name, lead.last_name, lead.name)
      const phoneRaw: string | undefined = (lead.phone_number || lead.phone) as string | undefined

      if (!phoneRaw) {
        console.warn(`Lead ${lead.id} missing phone; skipping.`)
        continue
      }

      const toNumber = toE164(phoneRaw)

      const messageBody = `Hi ${firstName}, reminder: your appointment is scheduled for ${lead.appointment_date}${
        lead.appointment_time ? ` at ${lead.appointment_time}` : ''
      }. Reply YES to confirm or NO to reschedule.`

      try {
        const message = await client.messages.create({
          body: messageBody,
          from: FROM_NUMBER,
          to: toNumber,
          ...(STATUS_CALLBACK ? { statusCallback: STATUS_CALLBACK } : {}),
        })

        const { error: insertErr } = await supabaseAdmin.from('messages').insert({
          lead_phone: toNumber,
          direction: 'outgoing',
          body: messageBody,
          status: 'queued',
          twilio_sid: message.sid,
        })
        if (insertErr) console.error('Supabase insert error:', insertErr)
      } catch (twilioErr) {
        console.error('Twilio send error:', twilioErr)
      }
    }

    return NextResponse.json({ success: true, message: 'Reminders sent' })
  } catch (err: any) {
    console.error('Error sending reminders:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
