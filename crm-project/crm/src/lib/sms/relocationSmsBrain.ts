type SmsDirection = 'incoming' | 'outgoing'

type SmsMessage = {
  direction: SmsDirection
  body: string
  created_at?: string | null
}

type RelocationLead = {
  id: string
  first_name?: string | null
  name?: string | null
  sms_state?: string | null
  sms_campaign?: string | null
  lead_source_detail?: string | null
  move_timeline?: string | null
  price_range?: string | null
  preferred_areas?: string | null
  agent_status?: string | null
  primary_objection?: string | null
  secondary_objection?: string | null
  biggest_concern?: string | null
  biggest_unknown?: string | null
  preferred_next_step?: string | null
  wants_home_search?: boolean | null
  wants_agent_call?: boolean | null
  wants_lender_connection?: boolean | null
  monthly_payment_comfort?: string | null
  lead_heat?: string | null
  notes?: string | null
  sms_confidence?: string | null
  sms_current_objective?: string | null
  sms_timeline_answered?: boolean | null
  sms_budget_answered?: boolean | null
  sms_area_answered?: boolean | null
  sms_agent_status_answered?: boolean | null
  sms_appointment_readiness?: number | null
  sms_conversation_tone?: string | null
  sms_sentiment?: string | null
  sms_should_escalate?: boolean | null
  sms_debug_reason?: string | null
  sms_last_question?: string | null
  desired_home_type?: string | null
  desired_bedrooms?: string | null
  desired_bathrooms?: string | null
  desired_must_haves?: string | null
  desired_deal_breakers?: string | null
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
    | 'timeline'
    | 'budget'
    | 'area'
    | 'agent_status'
    | 'next_step'
    | 'clarify'
    | 'handoff'
    | 'stop'
    | 'search_criteria'
  appointmentReadiness: number
  conversationTone: 'direct' | 'warm' | 'cautious'
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'skeptical'
  shouldEscalate: boolean
  debugReason: string
  lastQuestion: string | null
  extractedFields: {
    move_timeline?: string | null
    price_range?: string | null
    preferred_areas?: string | null
    agent_status?: string | null
    primary_objection?: string | null
    secondary_objection?: string | null
    biggest_concern?: string | null
    biggest_unknown?: string | null
    preferred_next_step?: string | null
    wants_home_search?: boolean | null
    wants_agent_call?: boolean | null
    wants_lender_connection?: boolean | null
    monthly_payment_comfort?: string | null
    notes_append?: string | null
    timeline_answered?: boolean | null
    budget_answered?: boolean | null
    area_answered?: boolean | null
    agent_status_answered?: boolean | null
    desired_home_type?: string | null
    desired_bedrooms?: string | null
    desired_bathrooms?: string | null
    desired_must_haves?: string | null
    desired_deal_breakers?: string | null
  }
  aiSummary: string
}

const VALID_STATES = new Set([
  'NEW_HOT',
  'WAITING_FOR_TIMELINE',
  'WAITING_FOR_BUDGET',
  'WAITING_FOR_AREA',
  'WAITING_FOR_AGENT_STATUS',
  'WAITING_FOR_LENDER_NEED',
  'OFFER_HOME_SEARCH',
  'OFFER_AGENT_CALL',
  'OFFER_LENDER',
  'CALLBACK_LATER',
  'NURTURE_WARM',
  'NURTURE_COLD',
  'EXIT_ALREADY_HAS_LOCAL_AGENT',
  'EXIT_NOT_INTERESTED',
  'STOP',
])

const MAX_REPLY_CHARS = 320

const RESET_LINES = [
  'That said,',
  'So I can point you the right way,',
  'With that in mind,',
  'So I can help the most,',
]

const BUDGET_QUESTION_VARIANTS = [
  'What price range are you hoping to stay around?',
  'Roughly what budget are you hoping to stay within?',
  'About what price range would you like to stay near?',
]

const AREA_QUESTION_VARIANTS = [
  'Are you mostly focused on Boise, Meridian, Eagle, Kuna, or still narrowing that down?',
  'Do you already have a specific area in mind, or are you still narrowing it down?',
  'Which areas are you most interested in right now?',
]

const AGENT_QUESTION_VARIANTS = [
  'Are you already working with a Boise-area agent?',
  'Do you already have a local Boise-area agent helping you?',
  'Are you currently working with an agent here in the Boise area?',
]

const SEARCH_OFFER_VARIANTS = [
  'I can set up a custom search around that. Want me to do that?',
  'I can set you up with a custom search that matches that. Want me to?',
  'Would it help if I set up a custom search around that for you?',
]

const APPOINTMENT_OFFER_VARIANTS = [
  'I think a quick local strategy call would help here. Want me to give you two time options?',
  'A quick call with a local agent would probably clear this up fast. Want me to give you two time options?',
  'I think a short local strategy call would help. Want me to give you two time options?',
]

const SEARCH_CRITERIA_QUESTION_VARIANTS = [
  'Great. Are you looking more for a single-family home, townhouse, or something else?',
  'Got it. What type of home are you picturing most — single-family, townhouse, or condo?',
  'Before I set that up, what kind of home are you hoping for most?',
]

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

function sanitizeBestNextStep(
  value: unknown
): BrainResult['bestNextStep'] {
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

function sanitizeObjective(
  value: unknown
): BrainResult['currentObjective'] {
  const s = String(value || '').trim()
  if (
    s === 'timeline' ||
    s === 'budget' ||
    s === 'area' ||
    s === 'agent_status' ||
    s === 'next_step' ||
    s === 'clarify' ||
    s === 'handoff' ||
    s === 'stop' ||
    s === 'search_criteria'
  ) {
    return s
  }
  return 'timeline'
}

function sanitizeTone(value: unknown): BrainResult['conversationTone'] {
  const s = String(value || '').trim().toLowerCase()
  if (s === 'direct') return 'direct'
  if (s === 'cautious') return 'cautious'
  return 'warm'
}

function sanitizeSentiment(
  value: unknown
): BrainResult['sentiment'] {
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

function capReply(text: string) {
  const trimmed = String(text || '').trim()
  if (trimmed.length <= MAX_REPLY_CHARS) return trimmed
  return trimmed.slice(0, MAX_REPLY_CHARS - 1).trimEnd() + '…'
}

function recentOutgoingTexts(recentMessages: SmsMessage[]) {
  return recentMessages
    .filter((m) => m.direction === 'outgoing')
    .map((m) => String(m.body || '').trim().toLowerCase())
}

function recentIncomingTexts(recentMessages: SmsMessage[]) {
  return recentMessages
    .filter((m) => m.direction === 'incoming')
    .map((m) => String(m.body || '').trim().toLowerCase())
}

function rotateVariant(options: string[], recentMessages: SmsMessage[]) {
  const recent = recentOutgoingTexts(recentMessages).slice(-6)
  for (const option of options) {
    if (!recent.includes(option.toLowerCase())) return option
  }
  return options[0]
}

function maybePrefixReset(text: string, recentMessages: SmsMessage[]) {
  const recent = recentOutgoingTexts(recentMessages).slice(-3).join(' ')
  if (/that said|so i can point you the right way|with that in mind|so i can help the most/i.test(text.toLowerCase())) {
    return text
  }
  if (/market|area|cost|question|clarify|compare|help/i.test(recent)) {
    const idx = recent.length % RESET_LINES.length
    return `${RESET_LINES[idx]} ${text}`
  }
  return text
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

function wasRecentlyAskedBudget(recentMessages: SmsMessage[]) {
  const texts = recentOutgoingTexts(recentMessages).slice(-4)
  return texts.some(
    (t) =>
      t.includes('price range') ||
      t.includes('budget') ||
      t.includes('stay around')
  )
}

function wasRecentlyAskedArea(recentMessages: SmsMessage[]) {
  const texts = recentOutgoingTexts(recentMessages).slice(-4)
  return texts.some(
    (t) =>
      t.includes('specific area') ||
      t.includes('which areas') ||
      t.includes('narrowing it down') ||
      t.includes('focused on boise')
  )
}

function wasRecentlyAskedAgent(recentMessages: SmsMessage[]) {
  const texts = recentOutgoingTexts(recentMessages).slice(-4)
  return texts.some(
    (t) =>
      t.includes('boise-area agent') ||
      t.includes('local boise-area agent') ||
      t.includes('agent here in the boise area')
  )
}

function wasRecentlyAskedSearchCriteria(recentMessages: SmsMessage[]) {
  const texts = recentOutgoingTexts(recentMessages).slice(-4)
  return texts.some(
    (t) =>
      t.includes('single-family') ||
      t.includes('townhouse') ||
      t.includes('what type of home') ||
      t.includes('kind of home')
  )
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

function detectSentiment(text: string): BrainResult['sentiment'] {
  const t = text.toLowerCase()
  if (/frustrated|annoyed|confused|overwhelmed|upset|irritated|this is too much/i.test(t)) {
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

function classifySideQuestion(text: string) {
  const t = text.toLowerCase()

  if (hasHardStop(t)) return 'hard_stop'
  if (wantsHuman(t)) return 'human_handoff'
  if (/what do you do|why use you|what makes you different|how are you different|what does mpre|what can you help with/i.test(t)) {
    return 'value_question'
  }
  if (
    /school|commute|traffic|airport|weather|smoke|winter|summer|tax|property tax|resale|appreciation|market|prices|rates|meridian|eagle|boise|kuna/i.test(
      t
    )
  ) {
    return 'local_info_question'
  }
  if (/why|what|how|when|where|which|can you|could you|would you/i.test(t)) {
    return 'info_question'
  }
  if (
    /busy|researching|already have an agent|spouse|wife|husband|clarity|afford|budget|lender|compare|overwhelmed|rent first|waiting/i.test(
      t
    )
  ) {
    return 'objection'
  }
  return 'none'
}

function extractTimeline(text: string) {
  const t = text.toLowerCase()
  const monthMatch = t.match(/(\d+)\s*(month|months)/)
  if (monthMatch) return `${monthMatch[1]} months`
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
    t.match(/\$?\s?(\d{3,4})\s?k\b/) ||
    t.match(/\$?\s?(\d(?:\.\d+)?)\s?m\b/) ||
    t.match(/\$?\s?(\d{5,7})\b/)
  if (!moneyMatch) return null
  if (t.includes('m') && moneyMatch[1]) return `$${moneyMatch[1]}M`
  if (t.includes('k') && moneyMatch[1]) return `${moneyMatch[1]}k`
  return moneyMatch[1] || null
}

function extractArea(text: string, marketName: string) {
  const t = text.toLowerCase()
  const areaTerms = [
    'boise',
    'meridian',
    'eagle',
    'kuna',
    'nampa',
    'star',
    'caldwell',
    'middleton',
    'twin falls',
    'jerome',
    'kimberly',
    'post falls',
    'hayden',
    'coeur d’alene',
    'coeur dalene',
    'cda',
  ]
  const found = areaTerms.filter((a) => t.includes(a))
  if (found.length) return found.join(', ')
  if (/still narrowing that down|not sure yet|open/i.test(t)) return 'still narrowing down'
  if (marketName.toLowerCase() === 'boise' && /north end|bench|southeast boise/.test(t)) {
    return text
  }
  return null
}

function extractAgentStatus(text: string) {
  const t = text.toLowerCase()
  if (/signed buyer agreement|under contract with an agent|signed with an agent/.test(t)) {
    return 'signed_agent'
  }
  if (/local agent|boise agent|agent in boise|working with a boise-area agent/.test(t)) {
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

function extractSearchCriteria(text: string) {
  const t = text.toLowerCase()

  let homeType: string | null = null
  if (/single-family|single family/.test(t)) homeType = 'single-family'
  else if (/townhouse|town home/.test(t)) homeType = 'townhouse'
  else if (/condo|condominium/.test(t)) homeType = 'condo'

  const bedsMatch = t.match(/(\d+)\s*(bed|beds|bedroom|bedrooms)/)
  const bathsMatch = t.match(/(\d+(\.\d+)?)\s*(bath|baths|bathroom|bathrooms)/)

  const mustHaves =
    /must have|need .*garage|yard|office|school|views|single level|one story|shop/i.test(t)
      ? text
      : null

  const dealBreakers =
    /deal breaker|dont want|don't want|no hoa|busy road|fixer|stairs/i.test(t)
      ? text
      : null

  return {
    desired_home_type: homeType,
    desired_bedrooms: bedsMatch ? bedsMatch[1] : null,
    desired_bathrooms: bathsMatch ? bathsMatch[1] : null,
    desired_must_haves: mustHaves,
    desired_deal_breakers: dealBreakers,
  }
}

function detectMultiAnswer(text: string, lead: RelocationLead, marketName: string) {
  const timeline = !lead.sms_timeline_answered ? extractTimeline(text) : null
  const budget = !lead.sms_budget_answered ? extractBudget(text) : null
  const area = !lead.sms_area_answered ? extractArea(text, marketName) : null
  const agentStatus = !lead.sms_agent_status_answered ? extractAgentStatus(text) : null
  const searchCriteria = extractSearchCriteria(text)

  return {
    timeline,
    budget,
    area,
    agentStatus,
    ...searchCriteria,
  }
}

function getNextObjectiveFromLead(
  lead: RelocationLead,
  extracted: ReturnType<typeof detectMultiAnswer>
) {
  const timelineAnswered = lead.sms_timeline_answered || !!lead.move_timeline || !!extracted.timeline
  const budgetAnswered = lead.sms_budget_answered || !!lead.price_range || !!extracted.budget
  const areaAnswered = lead.sms_area_answered || !!lead.preferred_areas || !!extracted.area
  const agentAnswered =
    lead.sms_agent_status_answered || !!lead.agent_status || !!extracted.agentStatus

  if (!timelineAnswered) return 'timeline'
  if (!budgetAnswered) return 'budget'
  if (!areaAnswered) return 'area'
  if (!agentAnswered) return 'agent_status'
  return 'next_step'
}

function detectBurst(recentMessages: SmsMessage[]) {
  const incoming = recentMessages
    .filter((m) => m.direction === 'incoming' && m.created_at)
    .slice(-5)

  if (incoming.length < 4) return false

  const first = new Date(incoming[0].created_at as string).getTime()
  const last = new Date(incoming[incoming.length - 1].created_at as string).getTime()

  return last - first <= 2 * 60 * 1000
}

function buildManualProgressionReply(
  lead: RelocationLead,
  inboundText: string,
  recentMessages: SmsMessage[]
): BrainResult | null {
  const market = marketContextFromLead(lead)
  const extracted = detectMultiAnswer(inboundText, lead, market.marketName)
  const nextObjective = getNextObjectiveFromLead(lead, extracted)
  const burst = detectBurst(recentMessages)
  const sentiment = detectSentiment(inboundText)
  const notesAppend = trimOrNull(inboundText)

  const common = {
    temperature: 'hot' as const,
    confidence: 'high' as const,
    conversationTone: sentiment === 'frustrated' ? ('cautious' as const) : ('warm' as const),
    sentiment,
    shouldEscalate:
      sentiment === 'frustrated' ||
      classifySideQuestion(inboundText) === 'human_handoff',
    extractedFields: {
      move_timeline: extracted.timeline,
      price_range: extracted.budget,
      preferred_areas: extracted.area,
      agent_status: extracted.agentStatus,
      timeline_answered: extracted.timeline ? true : null,
      budget_answered: extracted.budget ? true : null,
      area_answered: extracted.area ? true : null,
      agent_status_answered: extracted.agentStatus ? true : null,
      desired_home_type: extracted.desired_home_type,
      desired_bedrooms: extracted.desired_bedrooms,
      desired_bathrooms: extracted.desired_bathrooms,
      desired_must_haves: extracted.desired_must_haves,
      desired_deal_breakers: extracted.desired_deal_breakers,
      notes_append: notesAppend,
    },
  }

  if (extracted.agentStatus === 'local_agent' || extracted.agentStatus === 'signed_agent') {
    return {
      replyText: capReply(
        `Got it. If you’re already working with a local ${market.marketName}-area agent, you’re probably in good hands. If anything changes, feel free to reach back out.`
      ),
      nextState: 'EXIT_ALREADY_HAS_LOCAL_AGENT',
      nextPriority: 'stop',
      bestNextStep: 'stop',
      currentObjective: 'stop',
      appointmentReadiness: 0,
      debugReason: 'local_agent_detected_exit',
      lastQuestion: null,
      aiSummary: 'Detected local/signed local agent and exited',
      ...common,
    }
  }

  if (
    (lead.sms_timeline_answered || extracted.timeline || lead.move_timeline) &&
    (lead.sms_budget_answered || extracted.budget || lead.price_range) &&
    (lead.sms_area_answered || extracted.area || lead.preferred_areas) &&
    !(lead.sms_agent_status_answered || extracted.agentStatus || lead.agent_status)
  ) {
    if (!wasRecentlyAskedAgent(recentMessages)) {
      return {
        replyText: capReply(rotateVariant(AGENT_QUESTION_VARIANTS, recentMessages)),
        nextState: 'WAITING_FOR_AGENT_STATUS',
        nextPriority: 'agent_status',
        bestNextStep: 'none',
        currentObjective: 'agent_status',
        appointmentReadiness: 4,
        debugReason: 'asked_agent_status_after_timeline_budget_area_known',
        lastQuestion: 'agent_status',
        aiSummary: 'Captured timeline/budget/area and asked agent status',
        ...common,
      }
    }
  }

  if (
    (lead.sms_timeline_answered || extracted.timeline || lead.move_timeline) &&
    !(lead.sms_budget_answered || extracted.budget || lead.price_range)
  ) {
    if (!wasRecentlyAskedBudget(recentMessages)) {
      return {
        replyText: capReply(rotateVariant(BUDGET_QUESTION_VARIANTS, recentMessages)),
        nextState: 'WAITING_FOR_BUDGET',
        nextPriority: 'budget',
        bestNextStep: 'none',
        currentObjective: 'budget',
        appointmentReadiness: 2,
        debugReason: 'asked_budget_because_timeline_known',
        lastQuestion: 'budget',
        aiSummary: 'Captured timeline and asked budget',
        ...common,
      }
    }
  }

  if (
    (lead.sms_timeline_answered || extracted.timeline || lead.move_timeline) &&
    (lead.sms_budget_answered || extracted.budget || lead.price_range) &&
    !(lead.sms_area_answered || extracted.area || lead.preferred_areas)
  ) {
    if (!wasRecentlyAskedArea(recentMessages)) {
      return {
        replyText: capReply(rotateVariant(AREA_QUESTION_VARIANTS, recentMessages)),
        nextState: 'WAITING_FOR_AREA',
        nextPriority: 'area',
        bestNextStep: 'none',
        currentObjective: 'area',
        appointmentReadiness: 3,
        debugReason: 'asked_area_because_timeline_budget_known',
        lastQuestion: 'area',
        aiSummary: 'Captured timeline/budget and asked area',
        ...common,
      }
    }
  }

  if (
    (lead.sms_timeline_answered || extracted.timeline || lead.move_timeline) &&
    (lead.sms_budget_answered || extracted.budget || lead.price_range) &&
    (lead.sms_area_answered || extracted.area || lead.preferred_areas)
  ) {
    const readiness = lead.agent_status || extracted.agentStatus ? 5 : 4

    if (readiness >= 4 && !burst) {
      return {
        replyText: capReply(rotateVariant(APPOINTMENT_OFFER_VARIANTS, recentMessages)),
        nextState: 'OFFER_AGENT_CALL',
        nextPriority: 'next_step',
        bestNextStep: 'agent_call',
        currentObjective: 'next_step',
        appointmentReadiness: readiness,
        debugReason: 'offered_appointment_because_readiness_high',
        lastQuestion: 'appointment_offer',
        aiSummary: 'Offered appointment because readiness is high',
        ...common,
        extractedFields: {
          ...common.extractedFields,
          wants_agent_call: true,
          preferred_next_step: 'appointment',
        },
      }
    }

    if (
      !lead.desired_home_type &&
      !lead.desired_bedrooms &&
      !lead.desired_bathrooms &&
      !wasRecentlyAskedSearchCriteria(recentMessages)
    ) {
      return {
        replyText: capReply(rotateVariant(SEARCH_CRITERIA_QUESTION_VARIANTS, recentMessages)),
        nextState: 'OFFER_HOME_SEARCH',
        nextPriority: 'search_criteria',
        bestNextStep: 'home_search',
        currentObjective: 'search_criteria',
        appointmentReadiness: readiness,
        debugReason: 'asked_search_criteria_after_lpmama_basics',
        lastQuestion: 'search_criteria',
        aiSummary: 'Asked search criteria after core basics were known',
        ...common,
        extractedFields: {
          ...common.extractedFields,
          wants_home_search: true,
          preferred_next_step: 'home_search',
        },
      }
    }

    return {
      replyText: capReply(rotateVariant(SEARCH_OFFER_VARIANTS, recentMessages)),
      nextState: 'OFFER_HOME_SEARCH',
      nextPriority: 'next_step',
      bestNextStep: 'home_search',
      currentObjective: 'next_step',
      appointmentReadiness: readiness,
      debugReason: 'offered_search_because_timeline_budget_area_known',
      lastQuestion: 'search_offer',
      aiSummary: 'Offered custom search because core basics were known',
      ...common,
      extractedFields: {
        ...common.extractedFields,
        wants_home_search: true,
        preferred_next_step: 'home_search',
      },
    }
  }

  if (nextObjective === 'timeline') {
    return {
      replyText: `Are you planning to move in the next 3 months, 6 months, or just exploring for now?`,
      nextState: 'WAITING_FOR_TIMELINE',
      nextPriority: 'timeline',
      bestNextStep: 'none',
      currentObjective: 'timeline',
      appointmentReadiness: 0,
      debugReason: 'asked_timeline_because_unknown',
      lastQuestion: 'timeline',
      aiSummary: 'Asked timeline because it is still unknown',
      ...common,
    }
  }

  return null
}

function fallbackReply(
  lead: RelocationLead,
  inboundText: string,
  recentMessages: SmsMessage[]
): BrainResult {
  const name = firstNameOf(lead)
  const lower = inboundText.toLowerCase()
  const unclearCount = getUnclearCount(recentMessages)
  const market = marketContextFromLead(lead)
  const sentiment = detectSentiment(inboundText)

  if (hasHardStop(lower)) {
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
      extractedFields: {
        primary_objection: 'not_interested',
        preferred_next_step: 'stop',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback hard stop',
    }
  }

  if (wantsHuman(lower)) {
    return {
      replyText: capReply(rotateVariant(APPOINTMENT_OFFER_VARIANTS, recentMessages)),
      nextState: 'OFFER_AGENT_CALL',
      nextPriority: 'agent_call',
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
      extractedFields: {
        wants_agent_call: true,
        preferred_next_step: 'appointment',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback human handoff',
    }
  }

  const manual = buildManualProgressionReply(lead, inboundText, recentMessages)
  if (manual) return manual

  if (
    lower.includes('???') ||
    lower.includes('asdf') ||
    lower.includes('lollllkkk') ||
    (lower.replace(/[^a-z0-9]/gi, '').length > 0 &&
      lower.replace(/[^a-z0-9]/gi, '').length < 4)
  ) {
    if (unclearCount === 0) {
      return {
        replyText: `Sorry ${name}, I want to make sure I understood you correctly. Are you planning to move in the next 3 months, 6 months, or just exploring for now?`,
        nextState: lead.sms_state || 'WAITING_FOR_TIMELINE',
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
        extractedFields: { notes_append: inboundText },
        aiSummary: 'Fallback unclear reply asked for clarification',
      }
    }

    if (unclearCount === 1) {
      return {
        replyText: `No worries. Let’s keep it simple — are you moving soon, later, or just browsing?`,
        nextState: lead.sms_state || 'WAITING_FOR_TIMELINE',
        nextPriority: 'clarify_simple',
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
        extractedFields: { notes_append: inboundText },
        aiSummary: 'Fallback second unclear reply simplified question',
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
      extractedFields: {
        preferred_next_step: 'nurture',
        notes_append: inboundText,
      },
      aiSummary: 'Fallback repeated unclear replies moved to warm nurture',
    }
  }

  if (!lead.sms_state || lead.sms_state === 'NEW_HOT') {
    return {
      replyText: `Hey ${name}, this is Samantha with ${market.brandName}. I saw you checked out our ${market.marketName} relocation guide. Are you planning to move in the next 3 months, 6 months, or just exploring for now?`,
      nextState: 'WAITING_FOR_TIMELINE',
      nextPriority: 'timeline',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'timeline',
      appointmentReadiness: 1,
      conversationTone: 'warm',
      sentiment,
      shouldEscalate: false,
      debugReason: 'fallback_relocation_opener',
      lastQuestion: 'timeline',
      extractedFields: { notes_append: inboundText },
      aiSummary: 'Fallback relocation opener',
    }
  }

  return {
    replyText: `Got it. Are you planning to move in the next 3 months, 6 months, or just exploring for now?`,
    nextState: 'WAITING_FOR_TIMELINE',
    nextPriority: 'timeline',
    temperature: 'hot',
    bestNextStep: 'none',
    confidence: 'low',
    currentObjective: 'timeline',
    appointmentReadiness: 0,
    conversationTone: 'warm',
    sentiment,
    shouldEscalate: false,
    debugReason: 'fallback_default_timeline',
    lastQuestion: 'timeline',
    extractedFields: { notes_append: inboundText },
    aiSummary: 'Fallback asked timeline',
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

  const transcript = recentMessages
    .slice(-10)
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

CORE RULES:
- SMS only. Short, natural, useful, low-pressure.
- Hard cap replies to about 320 characters.
- One main question at a time.
- If the lead answers multiple things in one message, capture all of them, then ask only the next unanswered step.
- Avoid repeating the same question if Samantha just asked it.
- Stay on the LPMAMA-style path unless an objection or side question forces a detour.

SEQUENCE:
1. timeline
2. budget / payment comfort
3. area / lifestyle fit
4. agent status
5. next best step

NEXT STEP LOGIC:
- If timeline + budget + area are known, it is okay to offer search.
- If readiness >= 4 and no blocking objection, it is okay to offer appointment.
- If affordability is the clear blocker, push harder toward lender intro.
- After basics are known, you may collect search criteria like home type, beds, baths, must-haves, and deal-breakers.

CLASSIFY the newest message as one of:
- objection
- info_question
- local_info_question
- value_question
- human_handoff
- hard_stop
- unclear
- none

LOCAL AGENT RULE:
If the lead already has a LOCAL ${market.marketName}-area agent or signed local agent, politely stop.
If they have an out-of-area agent, you may offer local boots-on-the-ground support.

UNCLEAR RULE:
- Do your best with bad spelling.
- Real other-language texts are allowed.
- If too unclear, do not guess.
- Clarify once, simplify once, then back off into nurture.

VALUE RULE:
If asked what ${market.brandName} does, give a short value answer:
- local guidance
- neighborhood/lifestyle fit
- pricing strategy clarity
- search and execution support
Then return to the flow.

TONE:
Return one of:
- direct
- warm
- cautious

SENTIMENT:
Return one of:
- positive
- neutral
- frustrated
- skeptical

DEBUG:
Return a short debugReason explaining why you chose the reply.

LAST QUESTION:
Return the main question category you just asked, or null.

OUTPUT ONLY VALID JSON:
{
  "replyText": "string",
  "nextState": "string",
  "nextPriority": "string",
  "temperature": "hot|warm|cold",
  "bestNextStep": "agent_call|home_search|lender_intro|nurture|stop|none",
  "confidence": "high|medium|low",
  "currentObjective": "timeline|budget|area|agent_status|next_step|clarify|handoff|stop|search_criteria",
  "appointmentReadiness": 0,
  "conversationTone": "direct|warm|cautious",
  "sentiment": "positive|neutral|frustrated|skeptical",
  "shouldEscalate": false,
  "debugReason": "string",
  "lastQuestion": "string or null",
  "extractedFields": {
    "move_timeline": "string or null",
    "price_range": "string or null",
    "preferred_areas": "string or null",
    "agent_status": "string or null",
    "primary_objection": "string or null",
    "secondary_objection": "string or null",
    "biggest_concern": "string or null",
    "biggest_unknown": "string or null",
    "preferred_next_step": "string or null",
    "wants_home_search": true,
    "wants_agent_call": false,
    "wants_lender_connection": false,
    "monthly_payment_comfort": "string or null",
    "notes_append": "string or null",
    "timeline_answered": true,
    "budget_answered": false,
    "area_answered": false,
    "agent_status_answered": false,
    "desired_home_type": "string or null",
    "desired_bedrooms": "string or null",
    "desired_bathrooms": "string or null",
    "desired_must_haves": "string or null",
    "desired_deal_breakers": "string or null"
  },
  "aiSummary": "short summary"
}
`.trim()

  const userPrompt = `
Lead first name: ${firstNameOf(lead)}
Current sms_state: ${lead.sms_state || 'NEW_HOT'}
Current sms_campaign: ${lead.sms_campaign || 'relocation'}
Lead source detail: ${lead.lead_source_detail || 'Relocation Guide'}

Known fields:
- move_timeline: ${lead.move_timeline || 'unknown'}
- price_range: ${lead.price_range || 'unknown'}
- preferred_areas: ${lead.preferred_areas || 'unknown'}
- agent_status: ${lead.agent_status || 'unknown'}
- primary_objection: ${lead.primary_objection || 'unknown'}
- biggest_concern: ${lead.biggest_concern || 'unknown'}
- biggest_unknown: ${lead.biggest_unknown || 'unknown'}
- monthly_payment_comfort: ${lead.monthly_payment_comfort || 'unknown'}
- desired_home_type: ${lead.desired_home_type || 'unknown'}
- desired_bedrooms: ${lead.desired_bedrooms || 'unknown'}
- desired_bathrooms: ${lead.desired_bathrooms || 'unknown'}
- desired_must_haves: ${lead.desired_must_haves || 'unknown'}
- desired_deal_breakers: ${lead.desired_deal_breakers || 'unknown'}
- lead_heat: ${lead.lead_heat || 'unknown'}
- sms_confidence: ${lead.sms_confidence || 'unknown'}
- sms_current_objective: ${lead.sms_current_objective || 'unknown'}
- sms_timeline_answered: ${String(lead.sms_timeline_answered ?? false)}
- sms_budget_answered: ${String(lead.sms_budget_answered ?? false)}
- sms_area_answered: ${String(lead.sms_area_answered ?? false)}
- sms_agent_status_answered: ${String(lead.sms_agent_status_answered ?? false)}
- sms_appointment_readiness: ${String(lead.sms_appointment_readiness ?? 0)}
- sms_conversation_tone: ${lead.sms_conversation_tone || 'unknown'}
- sms_sentiment: ${lead.sms_sentiment || 'unknown'}

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

    let replyText = trimOrNull(parsed.replyText) || fallbackReply(lead, inboundText, recentMessages).replyText
    replyText = maybePrefixReset(replyText, recentMessages)
    replyText = capReply(replyText)

    return {
      replyText,
      nextState: sanitizeState(parsed.nextState, lead.sms_state || 'WAITING_FOR_TIMELINE'),
      nextPriority: trimOrNull(parsed.nextPriority) || 'timeline',
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
      extractedFields: {
        move_timeline: trimOrNull(parsed?.extractedFields?.move_timeline),
        price_range: trimOrNull(parsed?.extractedFields?.price_range),
        preferred_areas: trimOrNull(parsed?.extractedFields?.preferred_areas),
        agent_status: trimOrNull(parsed?.extractedFields?.agent_status),
        primary_objection: trimOrNull(parsed?.extractedFields?.primary_objection),
        secondary_objection: trimOrNull(parsed?.extractedFields?.secondary_objection),
        biggest_concern: trimOrNull(parsed?.extractedFields?.biggest_concern),
        biggest_unknown: trimOrNull(parsed?.extractedFields?.biggest_unknown),
        preferred_next_step: trimOrNull(parsed?.extractedFields?.preferred_next_step),
        wants_home_search: asBoolOrNull(parsed?.extractedFields?.wants_home_search),
        wants_agent_call: asBoolOrNull(parsed?.extractedFields?.wants_agent_call),
        wants_lender_connection: asBoolOrNull(parsed?.extractedFields?.wants_lender_connection),
        monthly_payment_comfort: trimOrNull(parsed?.extractedFields?.monthly_payment_comfort),
        notes_append: trimOrNull(parsed?.extractedFields?.notes_append),
        timeline_answered: asBoolOrNull(parsed?.extractedFields?.timeline_answered),
        budget_answered: asBoolOrNull(parsed?.extractedFields?.budget_answered),
        area_answered: asBoolOrNull(parsed?.extractedFields?.area_answered),
        agent_status_answered: asBoolOrNull(parsed?.extractedFields?.agent_status_answered),
        desired_home_type: trimOrNull(parsed?.extractedFields?.desired_home_type),
        desired_bedrooms: trimOrNull(parsed?.extractedFields?.desired_bedrooms),
        desired_bathrooms: trimOrNull(parsed?.extractedFields?.desired_bathrooms),
        desired_must_haves: trimOrNull(parsed?.extractedFields?.desired_must_haves),
        desired_deal_breakers: trimOrNull(parsed?.extractedFields?.desired_deal_breakers),
      },
      aiSummary: trimOrNull(parsed.aiSummary) || 'Relocation SMS brain response',
    }
  } catch {
    return fallbackReply(lead, inboundText, recentMessages)
  }
}