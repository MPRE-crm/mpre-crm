import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { runRelocationSmsBrain } from '../../../../../src/lib/sms/relocationSmsBrain'
import { getTwoSlots } from '../../../../../lib/calendar/getTwoSlots'

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

type SlotChoice = {
  slot_iso: string
  slot_human: string
}

function normalizeTextForMatch(value?: string | null) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildSlotChoices(slots?: { A?: any; B?: any } | null): SlotChoice[] {
  const out: SlotChoice[] = []

  if (slots?.A?.slot_iso && slots?.A?.slot_human) {
    out.push({
      slot_iso: slots.A.slot_iso,
      slot_human: slots.A.slot_human,
    })
  }

  if (slots?.B?.slot_iso && slots?.B?.slot_human) {
    out.push({
      slot_iso: slots.B.slot_iso,
      slot_human: slots.B.slot_human,
    })
  }

  return out
}

function detectChosenSlot(inboundText: string, slotChoices: SlotChoice[]): SlotChoice | null {
  if (!slotChoices.length) return null

  const raw = clean(inboundText).toLowerCase()
  const normalized = normalizeTextForMatch(raw)

  const picksFirst =
    /\b(a|1|one|first)\b/i.test(raw) ||
    /option\s*a/i.test(raw) ||
    /slot\s*a/i.test(raw) ||
    /first\s+one/i.test(raw) ||
    /go\s+with\s+(option\s+)?a/i.test(raw) ||
    /take\s+(option\s+)?a/i.test(raw)

  const picksSecond =
    /\b(b|2|two|second)\b/i.test(raw) ||
    /option\s*b/i.test(raw) ||
    /slot\s*b/i.test(raw) ||
    /second\s+one/i.test(raw) ||
    /go\s+with\s+(option\s+)?b/i.test(raw) ||
    /take\s+(option\s+)?b/i.test(raw)

  if (slotChoices[0] && picksFirst && !picksSecond) return slotChoices[0]
  if (slotChoices[1] && picksSecond && !picksFirst) return slotChoices[1]

  for (const slot of slotChoices) {
    const slotHumanRaw = String(slot.slot_human || "").toLowerCase()
    const slotHumanNormalized = normalizeTextForMatch(slot.slot_human)

    if (normalized === slotHumanNormalized) return slot
    if (raw.includes(slotHumanRaw)) return slot
  }

  return null
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
}): Promise<boolean> {
  try {
    const { leadId, agentId, orgId, phone } = args

    if (!agentId || !orgId || !phone) {
      console.error('❌ lender intro missing agentId/orgId/phone', args)
      return false
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      console.error('❌ lender intro missing Twilio env vars')
      return false
    }

    const { data: agentUser, error: agentLookupError } = await supabaseAdmin
      .from('users')
      .select('id, user_id, org_id, name, email')
      .eq('user_id', agentId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (agentLookupError) {
      console.error('❌ lender intro agent lookup error', agentLookupError)
      return false
    }

    // Fallback: some leads store profiles.id in lead.agent_id instead of users.user_id.
    // If no users row exists, use the lead.agent_id directly for agent_lender_preferences.
    const resolvedAgentUserId = agentUser?.id || agentId
    const resolvedAgentName = agentUser?.name || agentUser?.email || 'Assigned Agent'

    if (!resolvedAgentUserId) {
      console.error('❌ lender intro could not resolve agent id', {
        agentId,
        orgId,
      })
      return false
    }

    const { data: preferences, error: prefsError } = await supabaseAdmin
      .from('agent_lender_preferences')
      .select('lender_user_id, position, is_active')
      .eq('org_id', orgId)
      .eq('agent_user_id', resolvedAgentUserId)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (prefsError) {
      console.error('❌ lender intro prefs lookup error', prefsError)
      return false
    }

    if (!preferences || preferences.length === 0) {
      console.error('❌ lender intro no active preferred lenders found', {
        agentUserId: resolvedAgentUserId,
        orgId,
      })
      return false
    }

    const { data: rotationState, error: rotationError } = await supabaseAdmin
      .from('agent_lender_rotation_state')
      .select('last_lender_user_id')
      .eq('org_id', orgId)
      .eq('agent_user_id', resolvedAgentUserId)
      .maybeSingle()

    if (rotationError) {
      console.error('❌ lender intro rotation lookup error', rotationError)
      return false
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
      return false
    }

    if (!lenderUser?.phone) {
      console.error('❌ lender intro lender missing phone', {
        lenderUserId: selectedPref.lender_user_id,
      })
      return false
    }

    const { data: leadRow, error: leadLookupError } = await supabaseAdmin
      .from('leads')
      .select('id, name, first_name, phone, email, move_timeline, price_range')
      .eq('id', leadId)
      .maybeSingle()

    if (leadLookupError) {
      console.error('❌ lender intro lead lookup error', leadLookupError)
      return false
    }

    const { data: orgRow, error: orgLookupError } = await supabaseAdmin
      .from('organizations')
      .select('name, org_display, market_name, city, state')
      .eq('id', orgId)
      .maybeSingle()

    if (orgLookupError) {
      console.error('❌ lender intro org lookup error', orgLookupError)
      return false
    }

    const twilioClient = twilio(accountSid, authToken)

    const leadName = leadRow?.name || leadRow?.first_name || 'Unknown Lead'
    const requestedAt = new Date().toLocaleString('en-US')
    const orgDisplay = orgRow?.org_display || orgRow?.name || 'Organization'

    const lenderMessage =
      `${orgDisplay} lender follow-up needed.\n` +
      `Requested By Agent: ${resolvedAgentName}\n` +
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
        agent_user_id: resolvedAgentUserId,
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

    return true
  } catch (error) {
    console.error('❌ lender intro unexpected error', error)
    return false
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

    const fromDigits = from.replace(/\D/g, '')
    const from10 =
      fromDigits.length === 11 && fromDigits.startsWith('1')
        ? fromDigits.slice(1)
        : fromDigits

    const leadSelect = `
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
  appointment_requested_slot_iso,
  appointment_requested_slot_human,
  appointment_pending_agent_id,
  appointment_pending_expires_at,
  appointment_rotation_attempt,
  appointment_decline_reason,
  appointment_offer_slot_a_iso,
  appointment_offer_slot_a_human,
  appointment_offer_slot_b_iso,
  appointment_offer_slot_b_human,
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

    let existingLead: any = null
    let leadError: any = null

    const exactLeadResult = await supabaseAdmin
      .from('leads')
      .select(leadSelect)
      .eq('phone', from)
      .maybeSingle()

    existingLead = exactLeadResult.data
    leadError = exactLeadResult.error

    if (!existingLead && !leadError && from10) {
      const altLeadResult = await supabaseAdmin
        .from('leads')
        .select(leadSelect)
        .in('phone', [from10, `1${from10}`])
        .maybeSingle()

      existingLead = altLeadResult.data
      leadError = altLeadResult.error
    }

    let lead = existingLead
    let leadId: string | null = lead?.id ?? null

    if (lead?.id && lead.phone !== from) {
      await supabaseAdmin
        .from('leads')
        .update({
          phone: from,
          updated_at: nowIso,
        })
        .eq('id', lead.id)

      lead.phone = from
    }

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
          appointment_requested_slot_iso,
          appointment_requested_slot_human,
          appointment_pending_agent_id,
          appointment_pending_expires_at,
          appointment_rotation_attempt,
          appointment_decline_reason,
          appointment_offer_slot_a_iso,
          appointment_offer_slot_a_human,
          appointment_offer_slot_b_iso,
          appointment_offer_slot_b_human,
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

      let availableSlots: string[] = []
      let slotChoices: SlotChoice[] = []

      try {
        if (lead?.org_id) {
          const slots = await getTwoSlots({
            org_id: lead.org_id,
            lead_id: leadId,
          })

          slotChoices = buildSlotChoices(slots)
          availableSlots = slotChoices.map((s) => s.slot_human)
        }
      } catch (error) {
        console.error('❌ sms calendar slot load error', error)
      }

      const storedSlotChoices: SlotChoice[] = [
        lead?.appointment_offer_slot_a_iso && lead?.appointment_offer_slot_a_human
          ? {
              slot_iso: lead.appointment_offer_slot_a_iso,
              slot_human: lead.appointment_offer_slot_a_human,
            }
          : null,
        lead?.appointment_offer_slot_b_iso && lead?.appointment_offer_slot_b_human
          ? {
              slot_iso: lead.appointment_offer_slot_b_iso,
              slot_human: lead.appointment_offer_slot_b_human,
            }
          : null,
      ].filter(Boolean) as SlotChoice[]

      const chosenSlot =
        lead?.sms_state === 'OFFER_AGENT_CALL'
          ? detectChosenSlot(body, storedSlotChoices.length ? storedSlotChoices : slotChoices)
          : null

      if (chosenSlot) {
        const expiresAt = addHours(now, 0.0833).toISOString()

const { data: approvalRow, error: approvalInsertError } = await supabaseAdmin
  .from('appointment_approvals')
  .insert({
    lead_id: leadId,
    org_id: lead.org_id,
    requested_by_agent_id: lead.agent_id,
    current_agent_id: lead.agent_id,
    slot_iso: chosenSlot.slot_iso,
    slot_human: chosenSlot.slot_human,
    status: 'pending',
    expires_at: expiresAt,
    rotation_attempt: lead.appointment_rotation_attempt || 0,
  })
  .select('id, slot_human, expires_at')
  .single()

        if (approvalInsertError) {
          console.error('❌ appointment approval insert error', approvalInsertError)
        } else {
const { data: pendingLeadRow, error: pendingLeadUpdateError } = await supabaseAdmin
  .from('leads')
  .update({
    appointment_requested: true,
    appointment_status: 'Pending Agent Approval',
    appointment_requested_slot_iso: chosenSlot.slot_iso,
    appointment_requested_slot_human: chosenSlot.slot_human,
    appointment_pending_agent_id: lead.agent_id,
    appointment_pending_expires_at: expiresAt,
    appointment_decline_reason: null,
    appointment_offer_slot_a_iso: null,
    appointment_offer_slot_a_human: null,
    appointment_offer_slot_b_iso: null,
    appointment_offer_slot_b_human: null,
    appointment_rotation_attempt: lead.appointment_rotation_attempt || 0,
    sms_state: 'CALLBACK_LATER',
    sms_current_objective: 'appointment',
    sms_last_question: 'agent_approval_pending',
    sms_lpmama_current_step: 'appointment',
    sms_lpmama_next_step: 'appointment',
    sms_resume_step: 'appointment',
    sms_detour_reason: 'pending_agent_approval',
    preferred_next_step: 'appointment',
    last_replied_text_at: nowIso,
    last_meaningful_engagement_at: nowIso,
    last_contact_attempt_at: nowIso,
    last_text_attempt_at: nowIso,
    updated_at: nowIso,
  })
  .eq('id', leadId)
  .select(`
    id,
    appointment_status,
    appointment_requested_slot_iso,
    appointment_requested_slot_human,
    appointment_pending_agent_id,
    appointment_pending_expires_at
  `)
  .single()

if (pendingLeadUpdateError || !pendingLeadRow) {
  console.error('❌ pending approval lead update error', pendingLeadUpdateError)

  const twiml = new twilio.twiml.MessagingResponse()
  twiml.message(
    `I’m sorry — I hit a snag saving that appointment request. Please try that one more time.`
  )

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

const { data: agentUser, error: agentUserError } = await supabaseAdmin
  .from('users')
  .select('id, name, email, phone')
  .eq('user_id', lead.agent_id)
  .eq('org_id', lead.org_id)
  .maybeSingle()

if (agentUserError) {
  console.error('❌ agent lookup for appointment approval text error', agentUserError)
}

if (agentUser?.phone && approvalRow?.id) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (accountSid && authToken && fromNumber) {
      const twilioClient = twilio(accountSid, authToken)

      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://www.easyrealtor.homes'

      const acceptUrl = `${appBaseUrl}/api/appointments/agent-accept?id=${encodeURIComponent(approvalRow.id)}`
      const declineUrl = `${appBaseUrl}/api/appointments/agent-decline?id=${encodeURIComponent(approvalRow.id)}`

      const leadName =
        clean(lead?.first_name) ||
        clean(lead?.name) ||
        'Lead'

      const agentText =
        `New appointment request from ${leadName}.\n` +
        `Requested time: ${chosenSlot.slot_human}\n` +
        `Accept: ${acceptUrl}\n` +
        `Decline: ${declineUrl}`

      await twilioClient.messages.create({
        from: fromNumber,
        to: normalizePhone(agentUser.phone),
        body: agentText,
      })
    }
  } catch (agentSmsError) {
    console.error('❌ agent appointment approval text send error', agentSmsError)
  }
}

          replyText = `Perfect, ${clean(lead?.first_name) || 'there'} — I’ve sent that time over for confirmation with the agent now. I’ll text you as soon as it’s locked in.`

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
            console.error('❌ outbound sms message insert error', outgoingMessageInsertError)
          }

          const twiml = new twilio.twiml.MessagingResponse()
          twiml.message(replyText)

          return new NextResponse(twiml.toString(), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          })
        }
      }

      const brain = await runRelocationSmsBrain({
        lead,
        inboundText: body,
        recentMessages: (recentMessages || []) as Array<{
          direction: 'incoming' | 'outgoing'
          body: string
          created_at?: string | null
        }>,
        availableSlots,
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
        motivation: brain.extractedFields.motivation || lead.motivation || null,
        preferred_areas:
          brain.extractedFields.preferred_areas || lead.preferred_areas || null,
        agent_status:
          brain.extractedFields.agent_status || lead.agent_status || null,
        mortgage_or_cash:
          brain.extractedFields.mortgage_or_cash ||
          lead.mortgage_or_cash ||
          null,
        spoken_to_local_lender:
          brain.extractedFields.spoken_to_local_lender ||
          lead.spoken_to_local_lender ||
          null,
        lender_intro_permission:
          brain.extractedFields.lender_intro_permission ??
          lead.lender_intro_permission ??
          false,
        lender_need_type:
          brain.extractedFields.lender_need_type || lead.lender_need_type || null,
        wants_lender_connection:
          brain.extractedFields.wants_lender_connection ??
          lead.wants_lender_connection ??
          false,
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
                appointment_offer_slot_a_iso: slotChoices[0]?.slot_iso || null,
        appointment_offer_slot_a_human: slotChoices[0]?.slot_human || null,
        appointment_offer_slot_b_iso: slotChoices[1]?.slot_iso || null,
        appointment_offer_slot_b_human: slotChoices[1]?.slot_human || null,
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

      const lenderApprovedThisTurn =
        brain.extractedFields.lender_intro_permission === true &&
        lead?.lender_intro_permission !== true

      if (lenderApprovedThisTurn) {
        const lenderIntroSent = await handlePreferredLenderIntro({
          leadId,
          agentId: lead?.agent_id,
          orgId: lead?.org_id,
          phone: from,
        })

        if (lenderIntroSent) {
          replyText = `Perfect, ${clean(lead?.first_name) || 'there'} — I’ll make that introduction for you. The next best step would probably be a quick strategy call with our team here at MPRE Boise so we can help you put a real game plan together. Want me to give you two good time options?`

          const appointmentPatch = {
            sms_state: 'OFFER_AGENT_CALL',
            sms_current_objective: 'appointment',
            sms_last_question: 'appointment_offer',
            sms_lpmama_current_step: 'appointment',
            sms_lpmama_next_step: 'appointment',
            sms_resume_step: 'appointment',
            sms_detour_reason: null,
            preferred_next_step: 'appointment',
            updated_at: nowIso,
          }

          const { error: appointmentPatchError } = await supabaseAdmin
            .from('leads')
            .update(appointmentPatch)
            .eq('id', leadId)

          if (appointmentPatchError) {
            console.error(
              '❌ relocation sms appointment patch after lender intro error',
              appointmentPatchError
            )
          }
        }
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