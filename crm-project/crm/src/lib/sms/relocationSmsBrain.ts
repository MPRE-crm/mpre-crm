type SmsDirection = 'incoming' | 'outgoing'

type SmsMessage = {
  direction: SmsDirection
  body: string
  created_at?: string | null
}

type LpmamaStep =
  | 'location_timeline'
  | 'price'
  | 'motivation'
  | 'agent_status'
  | 'mortgage_or_cash'
  | 'appointment'

type RelocationLead = {
  id: string
  first_name?: string | null
  name?: string | null
  sms_state?: string | null
  sms_campaign?: string | null
  lead_source_detail?: string | null
  move_timeline?: string | null
  price_range?: string | null
  motivation?: string | null
  preferred_areas?: string | null
  agent_status?: string | null
  mortgage_or_cash?: string | null
  spoken_to_local_lender?: string | null
  lender_intro_permission?: boolean | null
  lender_need_type?: string | null
  wants_lender_connection?: boolean | null
  preferred_next_step?: string | null
  primary_objection?: string | null
  secondary_objection?: string | null
  biggest_concern?: string | null
  biggest_unknown?: string | null
  lead_heat?: string | null
  notes?: string | null
  sms_timeline_answered?: boolean | null
  sms_budget_answered?: boolean | null
  sms_area_answered?: boolean | null
  sms_agent_status_answered?: boolean | null
  sms_lpmama_current_step?: string | null
  sms_lpmama_next_step?: string | null
  sms_resume_step?: string | null
  sms_detour_reason?: string | null
  sms_current_objective?: string | null
  sms_last_question?: string | null
}

type BrainResult = {
  replyText: string
  nextState: string
  nextPriority: string
  temperature: 'hot' | 'warm' | 'cold'
  bestNextStep:
    | 'agent_call'
    | 'home_search'
    | 'lender_intro'
    | 'nurture'
    | 'stop'
    | 'none'
  confidence: 'high' | 'medium' | 'low'
  currentObjective:
    | 'location_timeline'
    | 'price'
    | 'motivation'
    | 'agent_status'
    | 'mortgage_or_cash'
    | 'appointment'
    | 'clarify'
    | 'handoff'
    | 'stop'
  appointmentReadiness: number
  conversationTone: 'direct' | 'warm' | 'cautious'
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'skeptical'
  shouldEscalate: boolean
  debugReason: string
  lastQuestion: string | null
  lpmamaCurrentStep: LpmamaStep
  lpmamaNextStep: LpmamaStep
  resumeStep: LpmamaStep
  detourReason: string | null
  extractedFields: {
    move_timeline?: string | null
    price_range?: string | null
    motivation?: string | null
    preferred_areas?: string | null
    agent_status?: string | null
    mortgage_or_cash?: string | null
    spoken_to_local_lender?: string | null
    lender_intro_permission?: boolean | null
    lender_need_type?: string | null
    wants_lender_connection?: boolean | null
    preferred_next_step?: string | null
    primary_objection?: string | null
    secondary_objection?: string | null
    biggest_concern?: string | null
    biggest_unknown?: string | null
    notes_append?: string | null
    timeline_answered?: boolean | null
    budget_answered?: boolean | null
    area_answered?: boolean | null
    agent_status_answered?: boolean | null
    wants_agent_call?: boolean | null
  }
  aiSummary: string
}

const VALID_STATES = new Set([
  'NEW_HOT',
  'WAITING_FOR_TIMELINE',
  'WAITING_FOR_BUDGET',
  'WAITING_FOR_MOTIVATION',
  'WAITING_FOR_AGENT_STATUS',
  'WAITING_FOR_MORTGAGE_OR_CASH',
  'WAITING_FOR_LOCAL_LENDER_STATUS',
  'WAITING_FOR_LENDER_PERMISSION',
  'OFFER_AGENT_CALL',
  'CALLBACK_LATER',
  'NURTURE_WARM',
  'NURTURE_COLD',
  'EXIT_ALREADY_HAS_LOCAL_AGENT',
  'EXIT_NOT_INTERESTED',
  'STOP',
])

function firstNameOf(lead: RelocationLead) {
  const raw = String(lead.first_name || lead.name || '').trim()
  return raw ? raw.split(' ')[0] : 'there'
}

function trimOrNull(value: unknown) {
  const s = String(value ?? '').trim()
  return s ? s : null
}

function asBoolOrNull(value: unknown) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function sanitizeState(value: unknown, fallback = 'WAITING_FOR_TIMELINE') {
  const s = String(value || '').trim()
  return VALID_STATES.has(s) ? s : fallback
}

function sanitizeTemperature(value: unknown): 'hot' | 'warm' | 'cold' {
  const s = String(value || '').trim().toLowerCase()
  if (s === 'warm') return 'warm'
  if (s === 'cold') return 'cold'
  return 'hot'
}

function sanitizeBestNextStep(value: unknown): BrainResult['bestNextStep'] {
  const s = String(value || '').trim()
  if (
    s === 'agent_call' ||
    s === 'home_search' ||
    s === 'lender_intro' ||
    s === 'nurture' ||
    s === 'stop'
  ) {
    return s
  }
  return 'none'
}

function sanitizeConfidence(value: unknown): BrainResult['confidence'] {
  const s = String(value || '').trim().toLowerCase()
  if (s === 'low') return 'low'
  if (s === 'medium') return 'medium'
  return 'high'
}

function sanitizeObjective(value: unknown): BrainResult['currentObjective'] {
  const s = String(value || '').trim()
  if (
    s === 'location_timeline' ||
    s === 'price' ||
    s === 'motivation' ||
    s === 'agent_status' ||
    s === 'mortgage_or_cash' ||
    s === 'appointment' ||
    s === 'clarify' ||
    s === 'handoff' ||
    s === 'stop'
  ) {
    return s
  }
  return 'location_timeline'
}

function sanitizeTone(value: unknown): BrainResult['conversationTone'] {
  const s = String(value || '').trim().toLowerCase()
  if (s === 'direct') return 'direct'
  if (s === 'cautious') return 'cautious'
  return 'warm'
}

function sanitizeSentiment(value: unknown): BrainResult['sentiment'] {
  const s = String(value || '').trim().toLowerCase()
  if (s === 'positive') return 'positive'
  if (s === 'frustrated') return 'frustrated'
  if (s === 'skeptical') return 'skeptical'
  return 'neutral'
}

function sanitizeReadiness(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, Math.round(n)))
}

function sanitizeStep(value: unknown, fallback: LpmamaStep): LpmamaStep {
  const s = String(value || '').trim()
  if (
    s === 'location_timeline' ||
    s === 'price' ||
    s === 'motivation' ||
    s === 'agent_status' ||
    s === 'mortgage_or_cash' ||
    s === 'appointment'
  ) {
    return s
  }
  return fallback
}

function extractJson(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response')
  }
  return text.slice(start, end + 1)
}

function marketContextFromLead(lead: RelocationLead) {
  const source = String(lead.lead_source_detail || '').toLowerCase()

  if (source.includes('twin falls')) {
    return {
      marketName: 'Twin Falls',
      brandName: 'MPRE Twin Falls',
      areaExamples: 'Twin Falls, Jerome, Kimberly, and nearby areas',
    }
  }

  if (source.includes('cda') || source.includes('coeur')) {
    return {
      marketName: 'Coeur d’Alene',
      brandName: 'MPRE CDA',
      areaExamples: 'Coeur d’Alene, Post Falls, Hayden, and nearby areas',
    }
  }

  return {
    marketName: 'Boise',
    brandName: 'MPRE Boise',
    areaExamples: 'Boise, Meridian, Eagle, Kuna, and nearby areas',
  }
}

function detectSentiment(text: string): BrainResult['sentiment'] {
  const t = text.toLowerCase()
  if (/frustrated|annoyed|confused|overwhelmed|upset|irritated|too much/i.test(t)) {
    return 'frustrated'
  }
  if (/not sure|skeptical|hesitant|maybe|i guess|not convinced/i.test(t)) {
    return 'skeptical'
  }
  if (/great|awesome|sounds good|perfect|yes|yeah|definitely/i.test(t)) {
    return 'positive'
  }
  return 'neutral'
}

function hasHardStop(text: string) {
  return /stop|leave me alone|do not contact|don't contact|remove me|not interested|quit texting/i.test(
    text.toLowerCase()
  )
}

function wantsHuman(text: string) {
  return /real person|real agent|human|call me|talk to an agent|speak to an agent|connect me|have someone call/i.test(
    text.toLowerCase()
  )
}

function getUnclearCount(recentMessages: SmsMessage[]) {
  return recentMessages.filter(
    (m) =>
      m.direction === 'outgoing' &&
      /want to make sure i understood|let's keep it simple|lets keep it simple|didn’t quite catch that|didn't quite catch that/i.test(
        String(m.body || '')
      )
  ).length
}

function detectGuideReceived(text: string): 'yes' | 'no' | null {
  const t = text.toLowerCase()
  if (/yes|yeah|yep|i did|got it|received it|thanks/i.test(t)) return 'yes'
  if (/no|not yet|didn't|did not|never got it|haven't|have not/i.test(t)) return 'no'
  return null
}

function extractTimeline(text: string) {
  const t = text.toLowerCase()
  const monthMatch = t.match(/(\d+)\s*(month|months)/)
  if (monthMatch) return `${monthMatch[1]} months`
  if (/3\s*[-–]\s*6\s*months|3 to 6 months/.test(t)) return '3-6 months'
  if (/6\s*[-–]\s*12\s*months|6 to 12 months/.test(t)) return '6-12 months'
  if (/asap|right away|immediately|right now/.test(t)) return 'ASAP'
  if (/next month/.test(t)) return 'next month'
  if (/this year/.test(t)) return 'this year'
  if (/next year/.test(t)) return 'next year'
  if (/exploring|just browsing|just looking/.test(t)) return 'exploring'
  if (/soon/.test(t)) return 'soon'
  return null
}

function extractBudget(text: string) {
  const t = text.toLowerCase()
  const moneyMatch =
    t.match(/\$?\s?(\d{3,4})\s*k\b/) ||
    t.match(/\$?\s?(\d(?:\.\d+)?)\s*m\b/) ||
    t.match(/\$?\s?(\d{5,7})\b/)
  if (!moneyMatch) return null
  if (t.includes('m') && moneyMatch[1]) return `$${moneyMatch[1]}M`
  if (t.includes('k') && moneyMatch[1]) return `${moneyMatch[1]}k`
  return moneyMatch[1] || null
}

function extractMotivation(text: string) {
  const t = text.toLowerCase()
  if (/job|work|career|transfer|relocat/i.test(t)) return 'work'
  if (/family|kids|grandkids|parents/i.test(t)) return 'family'
  if (/lifestyle|pace|quality of life|outdoors|mountains|space/i.test(t)) return 'lifestyle'
  if (/retire|retirement/i.test(t)) return 'retirement'
  if (/afford|cost of living|cheaper|save money/i.test(t)) return 'affordability'
  return null
}

function extractAgentStatus(text: string) {
  const t = text.toLowerCase()
  if (/signed buyer agreement|under contract with an agent|signed with an agent/.test(t)) {
    return 'signed_agent'
  }
  if (/local agent|boise agent|agent in boise|working with a boise-area agent|local realtor/i.test(t)) {
    return 'local_agent'
  }
  if (/out of state agent|agent from california|agent from out of state|not local|not in boise/.test(t)) {
    return 'out_of_area_agent'
  }
  if (/have an agent|working with an agent|already have a realtor|already have an agent/.test(t)) {
    return 'has_agent_unspecified'
  }
  if (/no agent|not working with an agent|dont have an agent|don't have an agent/.test(t)) {
    return 'no_agent'
  }
  return null
}

function extractMortgageOrCash(text: string) {
  const t = text.toLowerCase()
  if (/cash|paying cash|buying cash/.test(t)) return 'cash'
  if (/loan|mortgage|financing|finance|pre-approval|preapproval/.test(t)) return 'loan'
  return null
}

function extractLocalLenderStatus(text: string) {
  const t = text.toLowerCase()
  if (/yes|yeah|yep|already have|already spoke|already talked/i.test(t)) return 'yes'
  if (/no|not yet|haven't|have not|never/i.test(t)) return 'no'
  return null
}

function extractLenderPermission(text: string) {
  const t = text.toLowerCase()
  if (/yes|yeah|yep|that works|go ahead|ok|okay|sure/.test(t)) return true
  if (/no|not right now|dont|don't|no thanks/.test(t)) return false
  return null
}

function nextMissingStep(
  lead: RelocationLead,
  extracted?: {
    timeline?: string | null
    price?: string | null
    motivation?: string | null
    agentStatus?: string | null
    mortgageOrCash?: string | null
  }
): LpmamaStep {
  const timelineDone = Boolean(lead.move_timeline) || Boolean(extracted?.timeline)
  const priceDone = Boolean(lead.price_range) || Boolean(extracted?.price)
  const motivationDone = Boolean(lead.motivation) || Boolean(extracted?.motivation)
  const agentDone = Boolean(lead.agent_status) || Boolean(extracted?.agentStatus)
  const mortgageDone = Boolean(lead.mortgage_or_cash) || Boolean(extracted?.mortgageOrCash)

  if (!timelineDone) return 'location_timeline'
  if (!priceDone) return 'price'
  if (!motivationDone) return 'motivation'
  if (!agentDone) return 'agent_status'
  if (!mortgageDone) return 'mortgage_or_cash'
  return 'appointment'
}

function fallbackReply(
  lead: RelocationLead,
  inboundText: string,
  recentMessages: SmsMessage[]
): BrainResult {
  const name = firstNameOf(lead)
  const sentiment = detectSentiment(inboundText)
  const unclearCount = getUnclearCount(recentMessages)
  const market = marketContextFromLead(lead)

  const timeline = extractTimeline(inboundText)
  const price = extractBudget(inboundText)
  const motivation = extractMotivation(inboundText)
  const agentStatus = extractAgentStatus(inboundText)
  const mortgageOrCash = extractMortgageOrCash(inboundText)
  const localLenderStatus = extractLocalLenderStatus(inboundText)
  const lenderPermission = extractLenderPermission(inboundText)
  const guideReceived = detectGuideReceived(inboundText)

  const nextStep = nextMissingStep(lead, {
    timeline,
    price,
    motivation,
    agentStatus,
    mortgageOrCash,
  })

  const waitingForGuideConfirmation =
    lead.sms_current_objective === 'confirm_received_guide' ||
    lead.sms_lpmama_current_step === 'guide_confirmation' ||
    String(lead.sms_last_question || '').toLowerCase().includes('receive it yet')

  if (hasHardStop(inboundText)) {
    return {
      replyText: `No problem ${name}. I’ll stop here. If things change later, you can always text back.`,
      nextState: 'EXIT_NOT_INTERESTED',
      nextPriority: 'stop',
      temperature: 'warm',
      bestNextStep: 'stop',
      confidence: 'high',
      currentObjective: 'stop',
      appointmentReadiness: 0,
      conversationTone: 'cautious',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_hard_stop',
      lastQuestion: null,
      lpmamaCurrentStep: nextStep,
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: 'hard_stop',
      extractedFields: {
        primary_objection: 'not_interested',
        preferred_next_step: 'stop',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback hard stop',
    }
  }

  if (wantsHuman(inboundText)) {
    return {
      replyText: `Absolutely. I can have a local ${market.marketName}-area agent reach out. Would you prefer I give you two time options, or is there a time that usually works better for you?`,
      nextState: 'OFFER_AGENT_CALL',
      nextPriority: 'appointment',
      temperature: 'hot',
      bestNextStep: 'agent_call',
      confidence: 'high',
      currentObjective: 'handoff',
      appointmentReadiness: 5,
      conversationTone: 'direct',
      sentiment,
      shouldEscalate: true,
      debugReason: 'fallback_human_handoff',
      lastQuestion: 'appointment_offer',
      lpmamaCurrentStep: nextStep,
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: 'human_handoff',
      extractedFields: {
        wants_agent_call: true,
        preferred_next_step: 'appointment',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback human handoff',
    }
  }

  if (waitingForGuideConfirmation && guideReceived === 'yes') {
    return {
      replyText: `Perfect, ${name}. When are you thinking about making your move — in the next few months, later this year, or are you still just exploring right now?`,
      nextState: 'WAITING_FOR_TIMELINE',
      nextPriority: 'timeline',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'high',
      currentObjective: 'location_timeline',
      appointmentReadiness: 1,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_guide_received_yes_ask_timeline',
      lastQuestion: 'timeline',
      lpmamaCurrentStep: 'location_timeline',
      lpmamaNextStep: 'price',
      resumeStep: 'location_timeline',
      detourReason: null,
      extractedFields: {
        notes_append: inboundText,
      },
      aiSummary: 'Guide received, asked timeline',
    }
  }

  if (waitingForGuideConfirmation && guideReceived === 'no') {
    return {
      replyText: `No problem, ${name}. I can resend the guide. Is this still the best email for you?`,
      nextState: 'WAITING_FOR_TIMELINE',
      nextPriority: 'guide_resend',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'high',
      currentObjective: 'clarify',
      appointmentReadiness: 0,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_guide_received_no_resend',
      lastQuestion: 'guide_resend',
      lpmamaCurrentStep: 'location_timeline',
      lpmamaNextStep: 'location_timeline',
      resumeStep: 'location_timeline',
      detourReason: 'guide_resend',
      extractedFields: {
        notes_append: inboundText,
      },
      aiSummary: 'Guide not received, offered resend',
    }
  }

  if (
    inboundText.includes('???') ||
    inboundText.toLowerCase().includes('asdf') ||
    (inboundText.replace(/[^a-z0-9]/gi, '').length > 0 &&
      inboundText.replace(/[^a-z0-9]/gi, '').length < 4)
  ) {
    if (unclearCount === 0) {
      return {
        replyText: `Sorry ${name}, I want to make sure I understood you correctly. Are you planning to move in the next 3 months, 6 months, or just exploring for now?`,
        nextState: 'WAITING_FOR_TIMELINE',
        nextPriority: 'clarify',
        temperature: 'hot',
        bestNextStep: 'none',
        confidence: 'low',
        currentObjective: 'clarify',
        appointmentReadiness: 0,
        conversationTone: 'warm',
        sentiment,
        shouldEscalate: false,
        debugReason: 'fallback_unclear_first',
        lastQuestion: 'clarify',
        lpmamaCurrentStep: nextStep,
        lpmamaNextStep: nextStep,
        resumeStep: nextStep,
        detourReason: 'unclear',
        extractedFields: { notes_append: inboundText },
        aiSummary: 'Fallback unclear first',
      }
    }

    if (unclearCount === 1) {
      return {
        replyText: `No worries. Let’s keep it simple — are you moving soon, later, or just browsing?`,
        nextState: 'WAITING_FOR_TIMELINE',
        nextPriority: 'clarify',
        temperature: 'hot',
        bestNextStep: 'none',
        confidence: 'low',
        currentObjective: 'clarify',
        appointmentReadiness: 0,
        conversationTone: 'warm',
        sentiment,
        shouldEscalate: false,
        debugReason: 'fallback_unclear_second',
        lastQuestion: 'clarify',
        lpmamaCurrentStep: nextStep,
        lpmamaNextStep: nextStep,
        resumeStep: nextStep,
        detourReason: 'unclear',
        extractedFields: { notes_append: inboundText },
        aiSummary: 'Fallback unclear second',
      }
    }

    return {
      replyText: `No problem. When you're ready, just text me something simple like "moving soon," "later," or "just browsing," and I’ll take it from there.`,
      nextState: 'NURTURE_WARM',
      nextPriority: 'nurture',
      temperature: 'warm',
      bestNextStep: 'nurture',
      confidence: 'low',
      currentObjective: 'clarify',
      appointmentReadiness: 0,
      conversationTone: 'cautious',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_unclear_third',
      lastQuestion: null,
      lpmamaCurrentStep: nextStep,
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: 'unclear',
      extractedFields: {
        preferred_next_step: 'nurture',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback unclear third',
    }
  }

  if (agentStatus === 'local_agent' || agentStatus === 'signed_agent') {
    return {
      replyText: `Got it. If you’re already working with a local ${market.marketName}-area agent, you’re probably in good hands. If anything changes, feel free to reach back out.`,
      nextState: 'EXIT_ALREADY_HAS_LOCAL_AGENT',
      nextPriority: 'stop',
      temperature: 'warm',
      bestNextStep: 'stop',
      confidence: 'high',
      currentObjective: 'stop',
      appointmentReadiness: 0,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_local_agent_exit',
      lastQuestion: null,
      lpmamaCurrentStep: nextStep,
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: 'agent_status',
      extractedFields: {
        agent_status: agentStatus,
        agent_status_answered: true,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback local agent exit',
    }
  }

  if (nextStep === 'location_timeline') {
    return {
      replyText: `When are you thinking about making your move — in the next few months, later this year, or are you still just exploring right now?`,
      nextState: 'WAITING_FOR_TIMELINE',
      nextPriority: 'timeline',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'location_timeline',
      appointmentReadiness: 1,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_ask_timeline',
      lastQuestion: 'timeline',
      lpmamaCurrentStep: 'location_timeline',
      lpmamaNextStep: 'price',
      resumeStep: 'location_timeline',
      detourReason: null,
      extractedFields: {
        move_timeline: timeline,
        timeline_answered: timeline ? true : null,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback asked timeline',
    }
  }

  if (nextStep === 'price') {
    return {
      replyText: `Got it. What price range are you hoping to stay around?`,
      nextState: 'WAITING_FOR_BUDGET',
      nextPriority: 'price',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'price',
      appointmentReadiness: 2,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_ask_price',
      lastQuestion: 'price',
      lpmamaCurrentStep: 'price',
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: null,
      extractedFields: {
        move_timeline: timeline,
        timeline_answered: timeline ? true : null,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback asked price',
    }
  }

  if (nextStep === 'motivation') {
    return {
      replyText: `What’s the main motivation for the move — work, family, lifestyle, retirement, or something else?`,
      nextState: 'WAITING_FOR_MOTIVATION',
      nextPriority: 'motivation',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'motivation',
      appointmentReadiness: 3,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_ask_motivation',
      lastQuestion: 'motivation',
      lpmamaCurrentStep: 'motivation',
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: null,
      extractedFields: {
        move_timeline: timeline,
        timeline_answered: timeline ? true : null,
        price_range: price,
        budget_answered: price ? true : null,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback asked motivation',
    }
  }

  if (nextStep === 'agent_status') {
    return {
      replyText: `Are you already working with an agent there in the ${market.marketName} area?`,
      nextState: 'WAITING_FOR_AGENT_STATUS',
      nextPriority: 'agent_status',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'agent_status',
      appointmentReadiness: 3,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_ask_agent_status',
      lastQuestion: 'agent_status',
      lpmamaCurrentStep: 'agent_status',
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: null,
      extractedFields: {
        move_timeline: timeline,
        timeline_answered: timeline ? true : null,
        price_range: price,
        budget_answered: price ? true : null,
        motivation: motivation,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback asked agent status',
    }
  }

  if (nextStep === 'mortgage_or_cash') {
    return {
      replyText: `Will this move likely be cash, or will you probably need financing?`,
      nextState: 'WAITING_FOR_MORTGAGE_OR_CASH',
      nextPriority: 'mortgage_or_cash',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'mortgage_or_cash',
      appointmentReadiness: 4,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_ask_mortgage_or_cash',
      lastQuestion: 'mortgage_or_cash',
      lpmamaCurrentStep: 'mortgage_or_cash',
      lpmamaNextStep: nextStep,
      resumeStep: nextStep,
      detourReason: null,
      extractedFields: {
        move_timeline: timeline,
        timeline_answered: timeline ? true : null,
        price_range: price,
        budget_answered: price ? true : null,
        motivation: motivation,
        agent_status: agentStatus,
        agent_status_answered: agentStatus ? true : null,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback asked mortgage or cash',
    }
  }

  if (
    (lead.mortgage_or_cash === 'loan' || mortgageOrCash === 'loan') &&
    !lead.spoken_to_local_lender &&
    !localLenderStatus
  ) {
    return {
      replyText: `Have you already spoken with a local loan officer there in the area?`,
      nextState: 'WAITING_FOR_LOCAL_LENDER_STATUS',
      nextPriority: 'local_lender_status',
      temperature: 'hot',
      bestNextStep: 'lender_intro',
      confidence: 'medium',
      currentObjective: 'mortgage_or_cash',
      appointmentReadiness: 4,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_ask_local_lender_status',
      lastQuestion: 'local_lender_status',
      lpmamaCurrentStep: 'mortgage_or_cash',
      lpmamaNextStep: 'appointment',
      resumeStep: 'appointment',
      detourReason: 'lender_flow',
      extractedFields: {
        mortgage_or_cash: 'loan',
        lender_need_type: 'loan',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback asked local lender status',
    }
  }

  if (
    (lead.mortgage_or_cash === 'loan' || mortgageOrCash === 'loan') &&
    (localLenderStatus === 'no' || lead.spoken_to_local_lender === 'no') &&
    lenderPermission !== true
  ) {
    return {
      replyText: `No problem. I can refer you to a local loan officer with no pressure, no obligation, and no credit pull just to help set the foundation for the move. Would it be okay to have one reach out?`,
      nextState: 'WAITING_FOR_LENDER_PERMISSION',
      nextPriority: 'lender_permission',
      temperature: 'hot',
      bestNextStep: 'lender_intro',
      confidence: 'high',
      currentObjective: 'mortgage_or_cash',
      appointmentReadiness: 4,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_offer_local_lender_intro',
      lastQuestion: 'lender_permission',
      lpmamaCurrentStep: 'mortgage_or_cash',
      lpmamaNextStep: 'appointment',
      resumeStep: 'appointment',
      detourReason: 'lender_flow',
      extractedFields: {
        mortgage_or_cash: 'loan',
        spoken_to_local_lender: 'no',
        lender_need_type: 'loan',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback offered local lender intro',
    }
  }

  if ((lead.mortgage_or_cash === 'loan' || mortgageOrCash === 'loan') && lenderPermission === true) {
    return {
      replyText: `Perfect. I’ll have a local lender reach out with no pressure. From there, I can also give you two good times for a quick strategy call if you’d like.`,
      nextState: 'OFFER_AGENT_CALL',
      nextPriority: 'appointment',
      temperature: 'hot',
      bestNextStep: 'lender_intro',
      confidence: 'high',
      currentObjective: 'appointment',
      appointmentReadiness: 5,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: true,
      debugReason: 'fallback_lender_intro_approved',
      lastQuestion: 'appointment_offer',
      lpmamaCurrentStep: 'appointment',
      lpmamaNextStep: 'appointment',
      resumeStep: 'appointment',
      detourReason: 'lender_flow',
      extractedFields: {
        mortgage_or_cash: 'loan',
        spoken_to_local_lender: 'no',
        lender_intro_permission: true,
        lender_need_type: 'loan',
        wants_lender_connection: true,
        preferred_next_step: 'lender_connection',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback lender intro approved',
    }
  }

  return {
    replyText: `That helps. I think a quick local strategy call would help here. Want me to give you two time options?`,
    nextState: 'OFFER_AGENT_CALL',
    nextPriority: 'appointment',
    temperature: 'hot',
    bestNextStep: 'agent_call',
    confidence: 'medium',
    currentObjective: 'appointment',
    appointmentReadiness: 4,
    conversationTone: 'warm',
    sentiment,
    shouldEscalate: false,
    debugReason: 'fallback_offer_appointment',
    lastQuestion: 'appointment_offer',
    lpmamaCurrentStep: 'appointment',
    lpmamaNextStep: 'appointment',
    resumeStep: 'appointment',
    detourReason: null,
    extractedFields: {
      move_timeline: timeline,
      timeline_answered: timeline ? true : null,
      price_range: price,
      budget_answered: price ? true : null,
      motivation: motivation,
      agent_status: agentStatus,
      agent_status_answered: agentStatus ? true : null,
      mortgage_or_cash: mortgageOrCash,
      wants_lender_connection: mortgageOrCash === 'loan' ? true : null,
      notes_append: inboundText,
    },
    aiSummary: 'Fallback offered appointment',
  }
}

export async function runRelocationSmsBrain(args: {
  lead: RelocationLead
  inboundText: string
  recentMessages: SmsMessage[]
  availableSlots?: string[]
}): Promise<BrainResult> {
  const { lead, inboundText, recentMessages, availableSlots = [] } = args

  if (!process.env.OPENAI_API_KEY) {
    return fallbackReply(lead, inboundText, recentMessages)
  }

  const market = marketContextFromLead(lead)
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const timeline = extractTimeline(inboundText)
  const price = extractBudget(inboundText)
  const motivation = extractMotivation(inboundText)
  const agentStatus = extractAgentStatus(inboundText)
  const mortgageOrCash = extractMortgageOrCash(inboundText)
  const nextStep = nextMissingStep(lead, {
    timeline,
    price,
    motivation,
    agentStatus,
    mortgageOrCash,
  })
  const currentStep = sanitizeStep(lead.sms_lpmama_current_step, nextStep)

  const guidePromptIndex = recentMessages
    .map((m) => String(m.body || '').toLowerCase())
    .lastIndexOf(
      'hi john, this is samantha with mpre boise. i just tried giving you a quick call because you requested our boise relocation guide. did you happen to receive it yet?'.toLowerCase()
    )

  const transcriptWindow =
    guidePromptIndex >= 0 ? recentMessages.slice(guidePromptIndex) : recentMessages.slice(-10)

  const transcript = transcriptWindow
    .map(
      (m) =>
        `${m.direction === 'incoming' ? 'Lead' : 'Samantha'}: ${String(
          m.body || ''
        ).trim()}`
    )
    .join('\n')

  const systemPrompt = `
You are Samantha, the SMS real estate assistant for ${market.brandName}.
You are handling a RELOCATION lead by SMS for the ${market.marketName} market.

Use TRUE TPMAMA for relocation:
1. Timeline
2. Price
3. Motivation
4. Agent status
5. Mortgage or Cash
6. Appointment

Important:
- Start by confirming whether they received the relocation guide.
- After they confirm they received it, ask for TIMELINE first.
- Do not assume facts the lead has not explicitly given in the current active thread or saved lead fields.
- Do not repeat the same question twice in a row.
- Answer off-topic questions, objections, value questions, and local area questions as fully as needed.
- Then return exactly to the NEXT MISSING TPMAMA STEP.
- If the lead answers multiple steps in one message, capture them all.
- If they already have a LOCAL ${market.marketName}-area agent, politely exit.
- If they say they need a loan, ask whether they have already spoken with a LOCAL loan officer there.
- If they have not, offer a no-pressure, no-obligation local lender introduction.
- Ask permission before lender handoff.
- If they approve lender handoff, mark lender intro requested and then continue toward appointment.

Return only JSON:
{
  "replyText": "string",
  "nextState": "string",
  "nextPriority": "string",
  "temperature": "hot|warm|cold",
  "bestNextStep": "agent_call|home_search|lender_intro|nurture|stop|none",
  "confidence": "high|medium|low",
  "currentObjective": "location_timeline|price|motivation|agent_status|mortgage_or_cash|appointment|clarify|handoff|stop",
  "appointmentReadiness": 0,
  "conversationTone": "direct|warm|cautious",
  "sentiment": "positive|neutral|frustrated|skeptical",
  "shouldEscalate": false,
  "debugReason": "string",
  "lastQuestion": "string or null",
  "lpmamaCurrentStep": "location_timeline|price|motivation|agent_status|mortgage_or_cash|appointment",
  "lpmamaNextStep": "location_timeline|price|motivation|agent_status|mortgage_or_cash|appointment",
  "resumeStep": "location_timeline|price|motivation|agent_status|mortgage_or_cash|appointment",
  "detourReason": "string or null",
  "extractedFields": {
    "move_timeline": "string or null",
    "price_range": "string or null",
    "motivation": "string or null",
    "preferred_areas": "string or null",
    "agent_status": "string or null",
    "mortgage_or_cash": "string or null",
    "spoken_to_local_lender": "string or null",
    "lender_intro_permission": true,
    "lender_need_type": "string or null",
    "wants_lender_connection": true,
    "preferred_next_step": "string or null",
    "primary_objection": "string or null",
    "secondary_objection": "string or null",
    "biggest_concern": "string or null",
    "biggest_unknown": "string or null",
    "notes_append": "string or null",
    "timeline_answered": true,
    "budget_answered": false,
    "area_answered": false,
    "agent_status_answered": false
  },
  "aiSummary": "short summary"
}
`.trim()

  const userPrompt = `
Lead first name: ${firstNameOf(lead)}
Market / brand: ${market.marketName} / ${market.brandName}
Current sms_state: ${lead.sms_state || 'NEW_HOT'}
Current core step: ${currentStep}
Current next missing step: ${nextStep}

Known fields:
- move_timeline: ${lead.move_timeline || 'unknown'}
- price_range: ${lead.price_range || 'unknown'}
- motivation: ${lead.motivation || 'unknown'}
- agent_status: ${lead.agent_status || 'unknown'}
- mortgage_or_cash: ${lead.mortgage_or_cash || 'unknown'}
- spoken_to_local_lender: ${lead.spoken_to_local_lender || 'unknown'}
- lender_intro_permission: ${String(lead.lender_intro_permission ?? false)}
- lead_heat: ${lead.lead_heat || 'unknown'}

Available appointment slots:
${availableSlots.length ? availableSlots.join(' | ') : 'none'}

Recent transcript:
${transcript || '(none)'}

Newest inbound text:
${inboundText}
`.trim()

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(extractJson(raw))

    return {
      replyText:
        trimOrNull(parsed.replyText) ||
        fallbackReply(lead, inboundText, recentMessages).replyText,
      nextState: sanitizeState(parsed.nextState, lead.sms_state || 'WAITING_FOR_TIMELINE'),
      nextPriority: trimOrNull(parsed.nextPriority) || nextStep,
      temperature: sanitizeTemperature(parsed.temperature),
      bestNextStep: sanitizeBestNextStep(parsed.bestNextStep),
      confidence: sanitizeConfidence(parsed.confidence),
      currentObjective: sanitizeObjective(parsed.currentObjective),
      appointmentReadiness: sanitizeReadiness(parsed.appointmentReadiness),
      conversationTone: sanitizeTone(parsed.conversationTone),
      sentiment: sanitizeSentiment(parsed.sentiment),
      shouldEscalate: Boolean(parsed.shouldEscalate),
      debugReason: trimOrNull(parsed.debugReason) || 'model_response',
      lastQuestion: trimOrNull(parsed.lastQuestion),
      lpmamaCurrentStep: sanitizeStep(parsed.lpmamaCurrentStep, currentStep),
      lpmamaNextStep: sanitizeStep(parsed.lpmamaNextStep, nextStep),
      resumeStep: sanitizeStep(parsed.resumeStep, nextStep),
      detourReason: trimOrNull(parsed.detourReason),
      extractedFields: {
        move_timeline: trimOrNull(parsed?.extractedFields?.move_timeline),
        price_range: trimOrNull(parsed?.extractedFields?.price_range),
        motivation: trimOrNull(parsed?.extractedFields?.motivation),
        preferred_areas: trimOrNull(parsed?.extractedFields?.preferred_areas),
        agent_status: trimOrNull(parsed?.extractedFields?.agent_status),
        mortgage_or_cash: trimOrNull(parsed?.extractedFields?.mortgage_or_cash),
        spoken_to_local_lender: trimOrNull(parsed?.extractedFields?.spoken_to_local_lender),
        lender_intro_permission: asBoolOrNull(parsed?.extractedFields?.lender_intro_permission),
        lender_need_type: trimOrNull(parsed?.extractedFields?.lender_need_type),
        wants_lender_connection: asBoolOrNull(parsed?.extractedFields?.wants_lender_connection),
        preferred_next_step: trimOrNull(parsed?.extractedFields?.preferred_next_step),
        primary_objection: trimOrNull(parsed?.extractedFields?.primary_objection),
        secondary_objection: trimOrNull(parsed?.extractedFields?.secondary_objection),
        biggest_concern: trimOrNull(parsed?.extractedFields?.biggest_concern),
        biggest_unknown: trimOrNull(parsed?.extractedFields?.biggest_unknown),
        notes_append: trimOrNull(parsed?.extractedFields?.notes_append),
        timeline_answered: asBoolOrNull(parsed?.extractedFields?.timeline_answered),
        budget_answered: asBoolOrNull(parsed?.extractedFields?.budget_answered),
        area_answered: asBoolOrNull(parsed?.extractedFields?.area_answered),
        agent_status_answered: asBoolOrNull(parsed?.extractedFields?.agent_status_answered),
        wants_agent_call: asBoolOrNull(parsed?.extractedFields?.wants_agent_call),
      },
      aiSummary: trimOrNull(parsed.aiSummary) || 'Relocation SMS brain response',
    }
  } catch {
    return fallbackReply(lead, inboundText, recentMessages)
  }
}