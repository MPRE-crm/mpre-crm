import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { runRelocationSmsBrain } from '../../../../../src/lib/sms/relocationSmsBrain'

export const runtime = 'nodejs'

const DEFAULT_AGENT_ID = '09a50cdb-3518-446d-891d-396bfca7fa1d'
const DEFAULT_ORG_ID = '2486c9e9-d0bc-4a3d-be91-9406c52d178c'

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

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function isRelocationLead(lead: any) {
  const sourceDetail = String(lead?.lead_source_detail || '').toLowerCase()
  const smsCampaign = String(lead?.sms_campaign || '').toLowerCase()

  return smsCampaign === 'relocation' || sourceDetail.includes('relocation')
}

function genericReply(firstName?: string | null) {
  const name = clean(firstName) || 'there'
  return `Hi ${name}, this is Samantha with MPRE Boise. I got your message and will follow up shortly. If you'd like, text me your timeline, price range, and the area you're thinking about.`
}

// Placeholder until we wire exact preferred-lender lookup
async function handlePreferredLenderIntro(args: {
  leadId: string
  agentId?: string | null
  orgId?: string | null
  phone: string
}) {
  try {
    const { leadId, agentId, orgId, phone } = args

    if (!agentId || !orgId || !phone) {
      console.error('❌ lender intro missing agentId/orgId/phone', args)
      return
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      console.error('❌ lender intro missing Twilio env vars')
      return
    }

    const { data: agentUser, error: agentLookupError } = await supabaseAdmin
      .from('users')
      .select('id, user_id, org_id, name, email')
      .eq('user_id', agentId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (agentLookupError) {
      console.error('❌ lender intro agent lookup error', agentLookupError)
      return
    }

    if (!agentUser?.id) {
      console.error('❌ lender intro could not map lead.agent_id to users.id', {
        agentId,
        orgId,
      })
      return
    }

    const { data: preferences, error: prefsError } = await supabaseAdmin
      .from('agent_lender_preferences')
      .select('lender_user_id, position, is_active')
      .eq('org_id', orgId)
      .eq('agent_user_id', agentUser.id)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (prefsError) {
      console.error('❌ lender intro prefs lookup error', prefsError)
      return
    }

    if (!preferences || preferences.length === 0) {
      console.error('❌ lender intro no active preferred lenders found', {
        agentUserId: agentUser.id,
        orgId,
      })
      return
    }

    const { data: rotationState, error: rotationError } = await supabaseAdmin
      .from('agent_lender_rotation_state')
      .select('last_lender_user_id')
      .eq('org_id', orgId)
      .eq('agent_user_id', agentUser.id)
      .maybeSingle()

    if (rotationError) {
      console.error('❌ lender intro rotation lookup error', rotationError)
      return
    }

    let selectedPref = preferences[0]

    if (rotationState?.last_lender_user_id) {
      const lastIndex = preferences.findIndex(
        (p) => p.lender_user_id === rotationState.last_lender_user_id
      )

      if (lastIndex >= 0) {
        selectedPref = preferences[(lastIndex + 1) % preferences.length]
      }
    }

    const { data: lenderUser, error: lenderLookupError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, is_active, org_id')
      .eq('id', selectedPref.lender_user_id)
      .eq('org_id', orgId)
      .eq('role', 'lender')
      .eq('is_active', true)
      .maybeSingle()

    if (lenderLookupError) {
      console.error('❌ lender intro lender lookup error', lenderLookupError)
      return
    }

    if (!lenderUser?.phone) {
      console.error('❌ lender intro lender missing phone', {
        lenderUserId: selectedPref.lender_user_id,
      })
      return
    }

        const { data: leadRow, error: leadLookupError } = await supabaseAdmin
      .from('leads')
      .select(
        'id, name, first_name, owner_name, phone, email, move_timeline, price_range'
    )
      .eq('id', leadId)
      .maybeSingle()

    if (leadLookupError) {
      console.error('❌ lender intro lead lookup error', leadLookupError)
      return
    }

    const { data: orgRow, error: orgLookupError } = await supabaseAdmin
      .from('organizations')
      .select('name, org_display, market_name, city, state')
      .eq('id', orgId)
      .maybeSingle()

    if (orgLookupError) {
      console.error('❌ lender intro org lookup error', orgLookupError)
      return
    }

    const twilioClient = twilio(accountSid, authToken)

    const leadName =
      leadRow?.name ||
      leadRow?.first_name ||
      leadRow?.owner_name ||
      'Unknown Lead'
      
    const requestedAt = new Date().toLocaleString('en-US')

    const orgDisplay =
      orgRow?.org_display ||
      orgRow?.name ||
      'Organization'

    const lenderMessage =
      `${orgDisplay} lender follow-up needed.\n` +
      `Requested By Agent: ${agentUser.name || agentUser.email || 'Unknown Agent'}\n` +
      `Requested At: ${requestedAt}\n` +
      `Lead: ${leadName}\n` +
      `Phone: ${leadRow?.phone || phone || 'N/A'}\n` +
      `Email: ${leadRow?.email || 'N/A'}\n` +
      `Timeline: ${leadRow?.move_timeline || 'N/A'}\n` +
      `Price Range: ${leadRow?.price_range || 'N/A'}\n` +
      `Reason: Requested lender after Samantha SMS conversation.\n` +
      `Please contact them as soon as possible.`

    const sent = await twilioClient.messages.create({
      from: fromNumber,
      to: normalizePhone(lenderUser.phone),
      body: lenderMessage,
    })

    const { error: rotationUpsertError } = await supabaseAdmin
      .from('agent_lender_rotation_state')
      .upsert({
        org_id: orgId,
        agent_user_id: agentUser.id,
        last_lender_user_id: selectedPref.lender_user_id,
        updated_at: new Date().toISOString(),
      })

    if (rotationUpsertError) {
      console.error('❌ lender intro rotation upsert error', rotationUpsertError)
    }

    console.log('✅ lender intro sent', {
      leadId,
      lenderUserId: selectedPref.lender_user_id,
      lenderMessageSid: sent.sid,
    })
  } catch (error) {
    console.error('❌ lender intro unexpected error', error)
  }
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

    const now = new Date()
    const nowIso = now.toISOString()

    if (messageSid) {
      const { data: existingMessage } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('twilio_sid', messageSid)
        .maybeSingle()

      if (existingMessage?.id) {
        const twiml = new twilio.twiml.MessagingResponse()
        return new NextResponse(twiml.toString(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        })
      }
    }

    const { data: existingLead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select(
        `
        id,
        first_name,
        last_name,
        name,
        email,
        phone,
        status,
        lead_heat,
        lead_source_detail,
        sms_state,
        sms_campaign,
        move_timeline,
        price_range,
        motivation,
        preferred_areas,
        agent_status,
        mortgage_or_cash,
        spoken_to_local_lender,
        lender_intro_permission,
        lender_need_type,
        wants_lender_connection,
        preferred_next_step,
        primary_objection,
        secondary_objection,
        biggest_concern,
        biggest_unknown,
        notes,
        ai_summary,
        agent_id,
        org_id,
        sms_timeline_answered,
        sms_budget_answered,
        sms_area_answered,
        sms_agent_status_answered,
        sms_confidence,
        sms_current_objective,
        sms_appointment_readiness,
        sms_conversation_tone,
        sms_sentiment,
        sms_should_escalate,
        sms_debug_reason,
        sms_last_question,
        sms_lpmama_current_step,
        sms_lpmama_next_step,
        sms_resume_step,
        sms_detour_reason
      `
      )
      .eq('phone', from)
      .maybeSingle()

    let lead = existingLead
    let leadId: string | null = lead?.id ?? null

    if (!lead && !leadError) {
      const { data: newLead, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert({
          phone: from,
          email: `${from.replace('+', '')}@sms.local`,
          agent_id: DEFAULT_AGENT_ID,
          org_id: DEFAULT_ORG_ID,
          lead_type: 'buyer',
          lead_source: 'Direct',
          lead_source_detail: 'SMS Inbound',
          status: 'new',
          lead_heat: 'hot',
          sms_state: 'NEW_HOT',
          sms_campaign: 'general',
          sms_confidence: 'medium',
          sms_current_objective: 'location_timeline',
          sms_timeline_answered: false,
          sms_budget_answered: false,
          sms_area_answered: false,
          sms_agent_status_answered: false,
          sms_appointment_readiness: 0,
          sms_conversation_tone: 'warm',
          sms_sentiment: 'neutral',
          sms_should_escalate: false,
          sms_debug_reason: 'new_inbound_sms_lead',
          sms_last_question: 'timeline',
          sms_lpmama_current_step: 'location_timeline',
          sms_lpmama_next_step: 'location_timeline',
          sms_resume_step: 'location_timeline',
          sms_detour_reason: null,
          last_text_attempt_at: nowIso,
          last_contact_attempt_at: nowIso,
          last_meaningful_engagement_at: nowIso,
          updated_at: nowIso,
        })
        .select(
          `
          id,
          first_name,
          last_name,
          name,
          email,
          phone,
          status,
          lead_heat,
          lead_source_detail,
          sms_state,
          sms_campaign,
          move_timeline,
          price_range,
          motivation,
          preferred_areas,
          agent_status,
          mortgage_or_cash,
          spoken_to_local_lender,
          lender_intro_permission,
          lender_need_type,
          wants_lender_connection,
          preferred_next_step,
          primary_objection,
          secondary_objection,
          biggest_concern,
          biggest_unknown,
          notes,
          ai_summary,
          agent_id,
          org_id,
          sms_timeline_answered,
          sms_budget_answered,
          sms_area_answered,
          sms_agent_status_answered,
          sms_confidence,
          sms_current_objective,
          sms_appointment_readiness,
          sms_conversation_tone,
          sms_sentiment,
          sms_should_escalate,
          sms_debug_reason,
          sms_last_question,
          sms_lpmama_current_step,
          sms_lpmama_next_step,
          sms_resume_step,
          sms_detour_reason
        `
        )
        .single()

      if (insertError) {
        console.error('❌ inbound sms lead insert error', insertError)
      } else {
        lead = newLead
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
    }

    let replyText = genericReply(lead?.first_name || lead?.name)

    if (leadId && lead && isRelocationLead(lead)) {
      const { data: recentMessages } = await supabaseAdmin
        .from('messages')
        .select('direction, body, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
        .limit(10)

      const brain = await runRelocationSmsBrain({
        lead,
        inboundText: body,
        recentMessages: (recentMessages || []) as Array<{
          direction: 'incoming' | 'outgoing'
          body: string
          created_at?: string | null
        }>,
        availableSlots: [],
      })

      replyText = brain.replyText

      const leadPatch: Record<string, any> = {
        sms_campaign: 'relocation',
        sms_state: brain.nextState,
        sms_confidence: brain.confidence,
        sms_current_objective: brain.currentObjective,
        sms_timeline_answered:
          brain.extractedFields.timeline_answered ??
          lead.sms_timeline_answered ??
          false,
        sms_budget_answered:
          brain.extractedFields.budget_answered ??
          lead.sms_budget_answered ??
          false,
        sms_area_answered:
          brain.extractedFields.area_answered ??
          lead.sms_area_answered ??
          false,
        sms_agent_status_answered:
          brain.extractedFields.agent_status_answered ??
          lead.sms_agent_status_answered ??
          false,
        sms_appointment_readiness: brain.appointmentReadiness,
        sms_conversation_tone: brain.conversationTone,
        sms_sentiment: brain.sentiment,
        sms_should_escalate: brain.shouldEscalate,
        sms_debug_reason: brain.debugReason,
        sms_last_question: brain.lastQuestion,
        sms_lpmama_current_step: brain.lpmamaCurrentStep,
        sms_lpmama_next_step: brain.lpmamaNextStep,
        sms_resume_step: brain.resumeStep,
        sms_detour_reason: brain.detourReason,
        lead_heat: brain.temperature,
        move_timeline:
          brain.extractedFields.move_timeline || lead.move_timeline || null,
        price_range:
          brain.extractedFields.price_range || lead.price_range || null,
        motivation:
          brain.extractedFields.motivation || lead.motivation || null,
        preferred_areas:
          brain.extractedFields.preferred_areas || lead.preferred_areas || null,
        agent_status:
          brain.extractedFields.agent_status || lead.agent_status || null,
        mortgage_or_cash:
          brain.extractedFields.mortgage_or_cash || lead.mortgage_or_cash || null,
        spoken_to_local_lender:
          brain.extractedFields.spoken_to_local_lender || lead.spoken_to_local_lender || null,
        lender_intro_permission:
          brain.extractedFields.lender_intro_permission ?? lead.lender_intro_permission ?? false,
        lender_need_type:
          brain.extractedFields.lender_need_type || lead.lender_need_type || null,
        wants_lender_connection:
          brain.extractedFields.wants_lender_connection ?? lead.wants_lender_connection ?? false,
        preferred_next_step:
          brain.extractedFields.preferred_next_step ||
          (brain.bestNextStep === 'agent_call'
            ? 'appointment'
            : brain.bestNextStep === 'lender_intro'
              ? 'lender_connection'
              : brain.bestNextStep === 'nurture'
                ? 'nurture'
                : brain.bestNextStep === 'stop'
                  ? 'stop'
                  : lead.preferred_next_step || null),
        primary_objection:
          brain.extractedFields.primary_objection ||
          lead.primary_objection ||
          null,
        secondary_objection:
          brain.extractedFields.secondary_objection ||
          lead.secondary_objection ||
          null,
        biggest_concern:
          brain.extractedFields.biggest_concern ||
          lead.biggest_concern ||
          null,
        biggest_unknown:
          brain.extractedFields.biggest_unknown ||
          lead.biggest_unknown ||
          null,
        ai_summary: brain.aiSummary,
        last_replied_text_at: nowIso,
        last_meaningful_engagement_at: nowIso,
        last_contact_attempt_at: nowIso,
        last_text_attempt_at: nowIso,
        best_contact_channel: 'text',
        hot_until:
          brain.temperature === 'hot' ? addHours(now, 48).toISOString() : null,
        updated_at: nowIso,
      }

      if (brain.extractedFields.notes_append) {
        leadPatch.notes = brain.extractedFields.notes_append
      } else if (body) {
        leadPatch.notes = body
      }

      const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update(leadPatch)
        .eq('id', leadId)

      if (leadUpdateError) {
        console.error('❌ relocation sms lead update error', leadUpdateError)
      }

      if (
        (brain.extractedFields.lender_intro_permission === true ||
          leadPatch.lender_intro_permission === true) &&
        leadPatch.wants_lender_connection === true
      ) {
        await handlePreferredLenderIntro({
          leadId,
          agentId: lead?.agent_id,
          orgId: lead?.org_id,
          phone: from,
        })
      }
    } else if (leadId) {
      const leadPatch: Record<string, any> = {
        last_replied_text_at: nowIso,
        last_meaningful_engagement_at: nowIso,
        last_contact_attempt_at: nowIso,
        last_text_attempt_at: nowIso,
        lead_heat: 'hot',
        best_contact_channel: 'text',
        hot_until: addHours(now, 48).toISOString(),
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

    if (leadId && replyText) {
      const { error: outgoingMessageInsertError } = await supabaseAdmin
        .from('messages')
        .insert({
          lead_id: leadId,
          lead_phone: from,
          direction: 'outgoing',
          body: replyText,
          status: 'twiml_reply_prepared',
          twilio_sid: null,
          created_at: nowIso,
        })

      if (outgoingMessageInsertError) {
        console.error(
          '❌ outbound sms message insert error',
          outgoingMessageInsertError
        )
      }
    }

    const twiml = new twilio.twiml.MessagingResponse()
    twiml.message(replyText)

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