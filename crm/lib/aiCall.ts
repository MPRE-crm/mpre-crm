import twilio from 'twilio'
import { supabase } from './supabase'

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  NEXT_PUBLIC_VOICE_WEBHOOK_URL,
  VOICE_STATUS_WEBHOOK_URL,
} = process.env

const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!)

type LeadForCall = {
  id: string
  name?: string
  phone: string
  move_timeline?: string
  price_range?: string
  preferred_area?: string | null
  bedrooms?: string | number | null
  home_type?: string | null
}

export async function aiCall(lead: LeadForCall) {
  const firstName = (lead.name || '').split(' ')[0] || 'there'

  // Send only the lead_id; API route will fetch details securely
  const voiceUrl = new URL(NEXT_PUBLIC_VOICE_WEBHOOK_URL!)
  voiceUrl.searchParams.set('lead_id', lead.id)

  try {
    const call = await client.calls.create({
      url: voiceUrl.toString(),
      to: lead.phone,
      from: TWILIO_PHONE_NUMBER!,
      statusCallback: VOICE_STATUS_WEBHOOK_URL!,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: 'Enable',
      machineDetectionTimeout: 5,
    })

    await supabase.from('calls').insert({
      lead_id: lead.id,
      twilio_call_sid: call.sid,
      status: 'initiated',
      type: 'AI Follow-up',
      appointment_requested: true,
      created_at: new Date().toISOString(),
    })

    return call.sid
  } catch (error) {
    console.error('❌ aiCall failed, sending fallback SMS...', error)
    try {
      await client.messages.create({
        body: `Hi ${firstName}, this is Samantha from MPRE Boise. Missed you—want me to text a few homes that match your budget/timeline? Or book a 15‑min Zoom at mpre.homes/booking`,
        to: lead.phone,
        from: TWILIO_PHONE_NUMBER!,
      })
    } catch (smsErr) {
      console.error('❌ Fallback SMS failed:', smsErr)
    }

    await supabase.from('calls').insert({
      lead_id: lead.id,
      status: 'fallback_sms_sent',
      type: 'SMS',
      created_at: new Date().toISOString(),
    })

    throw error
  }
}

export const initiateAICall = aiCall
