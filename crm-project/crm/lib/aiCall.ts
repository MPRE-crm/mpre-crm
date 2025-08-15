// crm/lib/aiCall.ts
import twilio from 'twilio'
import { supabaseAdmin } from './supabaseAdmin' // server-only client

// Helper: require an env var and return a string (TS-safe)
function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

const ACCOUNT_SID = req('TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID)
const AUTH_TOKEN  = req('TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN)
const FROM_NUMBER = req('TWILIO_PHONE_NUMBER', process.env.TWILIO_PHONE_NUMBER)
const VOICE_URL   = req('NEXT_PUBLIC_VOICE_WEBHOOK_URL', process.env.NEXT_PUBLIC_VOICE_WEBHOOK_URL)
const STATUS_CB   = req('VOICE_STATUS_WEBHOOK_URL', process.env.VOICE_STATUS_WEBHOOK_URL)

const client = twilio(ACCOUNT_SID, AUTH_TOKEN)

type LeadForCall = {
  id: string
  name?: string | null
  phone: string
  move_timeline?: string | null
  price_range?: string | null
  preferred_area?: string | null
  bedrooms?: string | number | null
  home_type?: string | null
}

const normalizeE164 = (p: string) => {
  const digits = p.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+1${digits}` // default US if missing +
}

export async function aiCall(lead: LeadForCall) {
  const firstName = (lead.name || '').split(' ')[0] || 'there'

  // Only pass lead_id to the public voice webhook
  const voiceUrl = new URL(VOICE_URL)
  voiceUrl.searchParams.set('lead_id', lead.id)

  try {
    const call = await client.calls.create({
      url: voiceUrl.toString(),
      to: normalizeE164(lead.phone),
      from: FROM_NUMBER,
      statusCallback: STATUS_CB,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: 'Enable',
      machineDetectionTimeout: 5,
    })

    await supabaseAdmin.from('calls').insert({
      lead_id: lead.id,
      twilio_call_sid: call.sid,
      status: 'initiated',
      type: 'AI Follow-up',
      appointment_requested: true,
      created_at: new Date().toISOString(),
    })

    return call.sid
  } catch (error) {
    console.error('aiCall failed, sending fallback SMS...', error)
    try {
      await client.messages.create({
        body: `Hi ${firstName}, this is Samantha from MPRE Boise. Missed you—want me to text a few homes that match your budget/timeline? Or book a 15‑min Zoom at mpre.homes/booking`,
        to: normalizeE164(lead.phone),
        from: FROM_NUMBER,
      })
    } catch (smsErr) {
      console.error('Fallback SMS failed:', smsErr)
    }

    await supabaseAdmin.from('calls').insert({
      lead_id: lead.id,
      status: 'fallback_sms_sent',
      type: 'SMS',
      created_at: new Date().toISOString(),
    })

    throw error
  }
}

export const initiateAICall = aiCall
