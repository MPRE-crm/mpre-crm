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
  appointmentReadiness: number
  conversationTone: 'direct' | 'warm' | 'cautious'
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
    s === 'stop'
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

function getUnclearCount(recentMessages: SmsMessage[]) {
  return recentMessages.filter(
    (m) =>
      m.direction === 'outgoing' &&
      /want to make sure i understood|let's keep it simple|lets keep it simple|didn’t quite catch that|didn't quite catch that/i.test(
        String(m.body || '')
      )
  ).length
}

function recentOutgoingTexts(recentMessages: SmsMessage[]) {
  return recentMessages
    .filter((m) => m.direction === 'outgoing')
    .map((m) => String(m.body || '').trim().toLowerCase())
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
      t.includes('narrowing that down') ||
      t.includes('focused on boise')
  )
}

function wasRecentlyAskedAgent(recentMessages: SmsMessage[]) {
  const texts = recentOutgoingTexts(recentMessages).slice(-4)
  return texts.some(
    (t) =>
      t.includes('working with a boise-area agent') ||
      t.includes('local boise-area agent') ||
      t.includes('working with an agent here')
  )
}

function rotateVariant(options: string[], recentMessages: SmsMessage[]) {
  const recent = recentOutgoingTexts(recentMessages).slice(-6)
  for (const option of options) {
    if (!recent.includes(option.toLowerCase())) return option
  }
  return options[0]
}

function capReply(text: string) {
  const trimmed = String(text || '').trim()
  if (trimmed.length <= MAX_REPLY_CHARS) return trimmed
  return trimmed.slice(0, MAX_REPLY_CHARS - 1).trimEnd() + '…'
}

function maybePrefixReset(text: string, recentMessages: SmsMessage[]) {
  const recent = recentOutgoingTexts(recentMessages).slice(-3).join(' ')
  if (
    /that said|so i can point you the right way|with that in mind|so i can help the most/i.test(
      text.toLowerCase()
    )
  ) {
    return text
  }

  if (
    /price|area|agent|timeline|budget|question|help/i.test(text.toLowerCase()) &&
    /market|area|cost|question|clarify|compare/i.test(recent)
  ) {
    const idx = Math.abs(recent.length) % RESET_LINES.length
    return `${RESET_LINES[idx]} ${text}`
  }

  return text
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

function classifySideQuestion(text: string) {
  const t = text.toLowerCase()

  if (hasHardStop(t)) return 'hard_stop'
  if (wantsHuman(t)) return 'human_handoff'
  if (
    /what do you do|why use you|what makes you different|how are you different|what does mpre|what can you help with/i.test(
      t
    )
  ) {
    return 'value_question'
  }
  if (
    /school|commute|traffic|airport|weather|smoke|winter|summer|tax|property tax|resale|appreciation|market|prices|rates|meridian|eagle|boise|kuna/i.test(
      t
    )
  ) {
    return 'local_info_question'
  }
  if (
    /why|what|how|when|where|which|can you|could you|would you/i.test(t)
  ) {
    return 'info_question'
  }
  if (
    /busy|researching|already have an agent|not interested|spouse|wife|husband|clarity|afford|budget|lender|compare|overwhelmed|rent first|waiting/i.test(
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

  if (t.includes('m') && moneyMatch[1]) {
    return `$${moneyMatch[1]}M`
  }

  if (t.includes('k') && moneyMatch[1]) {
    return `${moneyMatch[1]}k`
  }

  const digits = moneyMatch[1]
  if (!digits) return null
  return digits
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
  if (found.length) {
    return found.join(', ')
  }

  if (/still narrowing that down|not sure yet|open/i.test(t)) {
    return 'still narrowing down'
  }

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

function detectMultiAnswer(text: string, lead: RelocationLead, marketName: string) {
  const timeline = !lead.sms_timeline_answered ? extractTimeline(text) : null
  const budget = !lead.sms_budget_answered ? extractBudget(text) : null
  const area = !lead.sms_area_answered ? extractArea(text, marketName) : null
  const agentStatus = !lead.sms_agent_status_answered ? extractAgentStatus(text) : null

  return {
    timeline,
    budget,
    area,
    agentStatus,
  }
}

function getNextObjectiveFromLead(lead: RelocationLead, extracted: ReturnType<typeof detectMultiAnswer>) {
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

function buildManualProgressionReply(
  lead: RelocationLead,
  inboundText: string,
  recentMessages: SmsMessage[]
): BrainResult | null {
  const market = marketContextFromLead(lead)
  const extracted = detectMultiAnswer(inboundText, lead, market.marketName)
  const nextObjective = getNextObjectiveFromLead(lead, extracted)

  const notesAppend = trimOrNull(inboundText)

  const common: Omit<BrainResult, 'replyText' | 'nextState' | 'nextPriority' | 'currentObjective' | 'bestNextStep'> = {
    temperature: 'hot',
    confidence: 'high',
    appointmentReadiness:
      (extracted.timeline ? 1 : 0) +
      (extracted.budget ? 1 : 0) +
      (extracted.area ? 1 : 0) +
      (extracted.agentStatus ? 1 : 0),
    conversationTone: 'warm',
    extractedFields: {
      move_timeline: extracted.timeline,
      price_range: extracted.budget,
      preferred_areas: extracted.area,
      agent_status: extracted.agentStatus,
      timeline_answered: extracted.timeline ? true : null,
      budget_answered: extracted.budget ? true : null,
      area_answered: extracted.area ? true : null,
      agent_status_answered: extracted.agentStatus ? true : null,
      notes_append: notesAppend,
    },
    aiSummary: 'Manual extraction advanced relocation sequence',
  }

  if (extracted.agentStatus === 'local_agent' || extracted.agentStatus === 'signed_agent') {
    return {
      replyText: capReply(
        `Got it. If you’re already working with a local ${market.marketName}-area agent, you’re probably in good hands. If anything changes, feel free to reach back out.`
      ),
      nextState: 'EXIT_ALREADY_HAS_LOCAL_AGENT',
      nextPriority: 'stop',
      currentObjective: 'stop',
      bestNextStep: 'stop',
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
        currentObjective: 'agent_status',
        bestNextStep: 'none',
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
        currentObjective: 'budget',
        bestNextStep: 'none',
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
        currentObjective: 'area',
        bestNextStep: 'none',
        ...common,
      }
    }
  }

  if (
    (lead.sms_timeline_answered || extracted.timeline || lead.move_timeline) &&
    (lead.sms_budget_answered || extracted.budget || lead.price_range) &&
    (lead.sms_area_answered || extracted.area || lead.preferred_areas)
  ) {
    const readiness = 4
    const searchReply = rotateVariant(SEARCH_OFFER_VARIANTS, recentMessages)

    return {
      replyText: capReply(searchReply),
      nextState: 'OFFER_HOME_SEARCH',
      nextPriority: 'next_step',
      currentObjective: 'next_step',
      bestNextStep: 'home_search',
      ...common,
      appointmentReadiness: readiness,
      extractedFields: {
        ...common.extractedFields,
        wants_home_search: true,
        preferred_next_step: 'home_search',
      },
      aiSummary: 'Manual extraction reached search-ready trigger',
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
      extractedFields: { notes_append: inboundText },
      aiSummary: 'Fallback relocation opener',
    }
  }

  if (
    lower.includes('month') ||
    lower.includes('asap') ||
    lower.includes('soon') ||
    lower.includes('exploring') ||
    lower.includes('year')
  ) {
    return {
      replyText: capReply(rotateVariant(BUDGET_QUESTION_VARIANTS, recentMessages)),
      nextState: 'WAITING_FOR_BUDGET',
      nextPriority: 'budget',
      temperature: 'hot',
      bestNextStep: 'none',
      confidence: 'medium',
      currentObjective: 'budget',
      appointmentReadiness: 2,
      conversationTone: 'warm',
      extractedFields: {
        move_timeline: inboundText,
        timeline_answered: true,
        notes_append: inboundText,
      },
      aiSummary: 'Fallback captured timeline and asked budget',
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
    extractedFields: { notes_append: inboundText },
    aiSummary: 'Fallback asked timeline',
  }
}

export async function runRelocationSmsBrain(args: {
  lead: RelocationLead
  inboundText: string
  recentMessages: SmsMessage[]
}): Promise<BrainResult> {
  const { lead, inboundText, recentMessages } = args

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

CORE CHANNEL RULES:
- This is SMS, not a phone call.
- Keep messages short, natural, useful, and low-pressure.
- Hard cap your reply length to roughly 320 characters.
- Ask ONE main question at a time.
- If the lead goes off path, answer naturally, then return to the next best question.
- Do not ask a bundle of questions in one text.
- Do not sound like a cold script.
- Do not forget the conversion goal.

PRIMARY GOAL:
Move the lead toward the best next step:
1. appointment with a local agent
2. home search setup
3. lender introduction
4. nurture if too early
5. respectful exit if hard no or already working with a LOCAL ${market.marketName}-area agent

STRICT SEQUENCE RULE:
Unless there is an objection, side question, or clear special case, follow this order:
1. timeline
2. budget / payment comfort
3. area / lifestyle fit
4. agent status
5. next best step

IMPORTANT:
Stay on the LPMAMA-style path.
Do not randomly jump to home type, school details, commute details, or other subtopics unless:
- the lead asked for it
- the lead already answered the higher-priority step
- or the objection clearly requires it

MULTI-ANSWER EXTRACTION RULE:
If the lead answers multiple things in one message, capture ALL of them.
Example:
"3 months, around 650k, probably Meridian"
should capture timeline + budget + area.
Then ask only the next unanswered step.

DUPLICATE-QUESTION GUARD:
Do not re-ask the same budget, area, or agent-status question if Samantha asked it very recently.
Move to the next sensible step.

SIDE-QUESTION CLASSIFIER:
Classify the lead’s newest message as one of:
- objection
- info_question
- local_info_question
- value_question
- human_handoff
- hard_stop
- unclear
- none

UNCLEAR / GIBBERISH RULE:
- Bad spelling and shorthand are normal. Do your best to understand them.
- Real non-English messages are allowed. Respond in the lead’s language if clear.
- If the message is too unclear to confidently interpret, do NOT guess.
- First unclear reply: politely clarify and re-ask the current highest-priority question.
- Second unclear reply: simplify the question to a very easy version.
- Third unclear reply: gracefully stop pushing and move toward warm nurture.

HARD STOP RULE:
If the lead clearly says stop, leave me alone, not interested, do not contact, or equivalent, stop politely and do not keep selling.

HUMAN HANDOFF RULE:
If the lead clearly asks for a real person, a local agent, or asks to be called, prioritize handoff / agent call.

LOCAL AGENT DETECTION RULE:
Distinguish among:
- local_agent
- out_of_area_agent
- signed_agent
- has_agent_unspecified
- no_agent
If local_agent or signed_agent in the local market, politely stop.
If out_of_area_agent, you may offer local boots-on-the-ground support.

MEMORY RULE:
Track whether the following are answered:
- timeline
- budget
- area
- agent status

CURRENT OBJECTIVE RULE:
Always know the current objective:
- timeline
- budget
- area
- agent_status
- next_step
- clarify
- handoff
- stop

READINESS RULE:
Return appointment_readiness as an integer 0 to 5:
0 = almost no readiness
1 = very early
2 = mildly engaged
3 = serious but not ready for appointment
4 = strong appointment candidate
5 = explicitly wants call / human / agent help

APPOINTMENT-CLOSE TRIGGER:
If appointment_readiness >= 4 and there is no blocking objection, it is acceptable to offer appointment instead of dragging the conversation out.

SEARCH-READY TRIGGER:
If timeline, budget, and area are all known, and no blocking objection exists, it is acceptable to offer a custom home search.

TONE RULE:
Return conversation_tone as one of:
- direct
- warm
- cautious

OBJECTION / VALUE RULES:
You may freelance intelligently, answer objections, answer questions, and provide value statements.
But after doing that, you must return to the flow.

USE THESE THEMES WHEN RELEVANT:
- budget / cost concern -> explore monthly payment vs overall price
- spouse / family alignment
- need more clarity
- lifestyle / schools / commute
- Zillow / online search confusion
- comparing markets
- market conditions
- need lender
- too busy
- just researching
- already have agent
- not interested
- emotional overwhelm
- timing too far out
- worried about moving too fast
- worried about making wrong move
- weather / policy / resale / routine concerns

VALUE STATEMENT BEHAVIOR:
If the lead asks what ${market.brandName} actually does, answer with a short version of:
- local guidance
- neighborhood / lifestyle fit
- pricing and strategy clarity
- search + execution support
Then return to the next best question or offer an appointment.

LOCAL EXAMPLES:
Use local examples naturally when useful: ${market.areaExamples}

OUTPUT RULE:
Return ONLY valid JSON in this exact shape:
{
  "replyText": "string",
  "nextState": "string",
  "nextPriority": "string",
  "temperature": "hot|warm|cold",
  "bestNextStep": "agent_call|home_search|lender_intro|nurture|stop|none",
  "confidence": "high|medium|low",
  "currentObjective": "timeline|budget|area|agent_status|next_step|clarify|handoff|stop",
  "appointmentReadiness": 0,
  "conversationTone": "direct|warm|cautious",
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
    "agent_status_answered": false
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
- lead_heat: ${lead.lead_heat || 'unknown'}
- sms_confidence: ${lead.sms_confidence || 'unknown'}
- sms_current_objective: ${lead.sms_current_objective || 'unknown'}
- sms_timeline_answered: ${String(lead.sms_timeline_answered ?? false)}
- sms_budget_answered: ${String(lead.sms_budget_answered ?? false)}
- sms_area_answered: ${String(lead.sms_area_answered ?? false)}
- sms_agent_status_answered: ${String(lead.sms_agent_status_answered ?? false)}
- sms_appointment_readiness: ${String(lead.sms_appointment_readiness ?? 0)}
- sms_conversation_tone: ${lead.sms_conversation_tone || 'unknown'}

Desired sequence:
timeline -> budget -> area -> agent status -> best next step

Recent transcript:
${transcript || '(none)'}

Newest inbound text:
${inboundText}

Reminder:
If no objection or side question is forcing a detour, stay on the sequence above.
If the newest inbound text is too unclear to confidently interpret, do not guess.
Capture multiple answers from one text when present.
Avoid re-asking a question Samantha just asked recently.
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

    let replyText =
      trimOrNull(parsed.replyText) ||
      fallbackReply(lead, inboundText, recentMessages).replyText

    replyText = maybePrefixReset(replyText, recentMessages)
    replyText = capReply(replyText)

    return {
      replyText,
      nextState: sanitizeState(
        parsed.nextState,
        lead.sms_state || 'WAITING_FOR_TIMELINE'
      ),
      nextPriority: trimOrNull(parsed.nextPriority) || 'timeline',
      temperature: sanitizeTemperature(parsed.temperature),
      bestNextStep: sanitizeBestNextStep(parsed.bestNextStep),
      confidence: sanitizeConfidence(parsed.confidence),
      currentObjective: sanitizeObjective(parsed.currentObjective),
      appointmentReadiness: sanitizeReadiness(parsed.appointmentReadiness),
      conversationTone: sanitizeTone(parsed.conversationTone),
      extractedFields: {
        move_timeline: trimOrNull(parsed?.extractedFields?.move_timeline),
        price_range: trimOrNull(parsed?.extractedFields?.price_range),
        preferred_areas: trimOrNull(parsed?.extractedFields?.preferred_areas),
        agent_status: trimOrNull(parsed?.extractedFields?.agent_status),
        primary_objection: trimOrNull(parsed?.extractedFields?.primary_objection),
        secondary_objection: trimOrNull(
          parsed?.extractedFields?.secondary_objection
        ),
        biggest_concern: trimOrNull(parsed?.extractedFields?.biggest_concern),
        biggest_unknown: trimOrNull(parsed?.extractedFields?.biggest_unknown),
        preferred_next_step: trimOrNull(
          parsed?.extractedFields?.preferred_next_step
        ),
        wants_home_search: asBoolOrNull(
          parsed?.extractedFields?.wants_home_search
        ),
        wants_agent_call: asBoolOrNull(
          parsed?.extractedFields?.wants_agent_call
        ),
        wants_lender_connection: asBoolOrNull(
          parsed?.extractedFields?.wants_lender_connection
        ),
        monthly_payment_comfort: trimOrNull(
          parsed?.extractedFields?.monthly_payment_comfort
        ),
        notes_append: trimOrNull(parsed?.extractedFields?.notes_append),
        timeline_answered: asBoolOrNull(
          parsed?.extractedFields?.timeline_answered
        ),
        budget_answered: asBoolOrNull(
          parsed?.extractedFields?.budget_answered
        ),
        area_answered: asBoolOrNull(parsed?.extractedFields?.area_answered),
        agent_status_answered: asBoolOrNull(
          parsed?.extractedFields?.agent_status_answered
        ),
      },
      aiSummary: trimOrNull(parsed.aiSummary) || 'Relocation SMS brain response',
    }
  } catch {
    return fallbackReply(lead, inboundText, recentMessages)
  }
}