import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

export const runtime = 'nodejs'

function clean(value?: string | null) {
  return String(value || '').trim()
}

function normalizePhone(raw?: string | null) {
  const digits = clean(raw).replace(/\D/g, '')

  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (clean(raw).startsWith('+')) return clean(raw)

  return `+${digits}`
}

function autoReply(firstName?: string | null) {
  const name = clean(firstName) || 'there'
  return `Hi ${name}, this is Samantha with MPRE Boise. I got your message and will follow up shortly. If you'd like, text me your timeline, price range, and the area you're thinking about.`
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()
    const data = new URLSearchParams(bodyText)

    const messageSid = clean(data.get('MessageSid'))
    const from = normalizePhone(data.get('From'))
    const body = clean(data.get('Body'))

    if (!from) {
      return NextResponse.json({ ok: true })
    }

    const nowIso = new Date().toISOString()

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('id, first_name, last_name, name, phone, status, lead_heat')
      .eq('phone', from)
      .maybeSingle()

    let leadId: string | null = lead?.id ?? null

    if (!lead && !leadError) {
      const { data: newLead, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert({
          phone: from,
          agent_id: '09a50cdb-3518-446d-891d-396bfca7fa1d',
          org_id: '2486c9e9-d0bc-4a3d-be91-9406c52d178c',
          lead_type: 'buyer',
          lead_source: 'Direct',
          lead_source_detail: 'SMS Inbound',
          status: 'new',
          lead_heat: 'hot',
          last_text_attempt_at: nowIso,
          last_contact_attempt_at: nowIso,
          last_meaningful_engagement_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('❌ inbound sms lead insert error', insertError)
      } else {
        leadId = newLead.id
      }
    }

    if (leadId) {
      const { error: messageInsertError } = await supabaseAdmin
        .from('messages')
        .insert({
          lead_id: leadId,
          lead_phone: from,
          direction: 'incoming',
          body,
          status: 'received',
          twilio_sid: messageSid || null,
          created_at: nowIso,
        })

      if (messageInsertError) {
        console.error('❌ inbound sms message insert error', messageInsertError)
      }

      const leadPatch: Record<string, any> = {
        last_contact_attempt_at: nowIso,
        last_text_attempt_at: nowIso,
        last_meaningful_engagement_at: nowIso,
        lead_heat: 'hot',
        updated_at: nowIso,
      }

      if (body) {
        leadPatch.notes = body
      }

      const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update(leadPatch)
        .eq('id', leadId)

      if (leadUpdateError) {
        console.error('❌ inbound sms lead update error', leadUpdateError)
      }
    }

    const twiml = new twilio.twiml.MessagingResponse()

    if (leadId) {
      twiml.message(autoReply(lead?.first_name || lead?.name))
    } else {
      twiml.message(
        `Hi there, this is Samantha with MPRE Boise. I got your message and will follow up shortly.`
      )
    }

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error: any) {
    console.error('❌ inbound sms route error', error)

    const twiml = new twilio.twiml.MessagingResponse()
    twiml.message(
      `Thanks for your message. We received it and will follow up as soon as possible.`
    )

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}

export const GET = POST