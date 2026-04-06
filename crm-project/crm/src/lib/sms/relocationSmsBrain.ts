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

function extractJson(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response')
  }
  return text.slice(start, end + 1)
}

function fallbackReply(lead: RelocationLead, inboundText: string): BrainResult {
  const name = firstNameOf(lead)
  const lower = inboundText.toLowerCase()

  if (!lead.sms_state || lead.sms_state === 'NEW_HOT') {
    return {
      replyText: `Hey ${name}, this is Samantha with MPRE Boise. I saw you checked out our Boise relocation guide. Are you planning to move in the next 3 months, 6 months, or just exploring for now?`,
      nextState: 'WAITING_FOR_TIMELINE',
      nextPriority: 'timeline',
      temperature: 'hot',
      bestNextStep: 'none',
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
      replyText: `Got it. What price range are you hoping to stay around?`,
      nextState: 'WAITING_FOR_BUDGET',
      nextPriority: 'budget',
      temperature: 'hot',
      bestNextStep: 'none',
      extractedFields: {
        move_timeline: inboundText,
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
    return fallbackReply(lead, inboundText)
  }

  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const transcript = recentMessages
    .slice(-8)
    .map(
      (m) =>
        `${m.direction === 'incoming' ? 'Lead' : 'Samantha'}: ${String(
          m.body || ''
        ).trim()}`
    )
    .join('\n')

  const systemPrompt = `
You are Samantha, the SMS real estate assistant for MPRE Boise.

You are handling a RELOCATION lead by SMS.

Rules:
- This is SMS, not a phone call.
- Keep messages short, natural, helpful, and low-pressure.
- Ask only ONE main question at a time.
- If the lead asks a side question or objection, answer it naturally, then return to the next best question.
- Do not sound like a cold script.
- Do not dump multiple questions at once.
- Move toward one of these outcomes:
  1. agent appointment
  2. home search setup
  3. lender introduction
  4. warm/cold nurture
  5. respectful exit

Priority order:
1. timeline
2. budget / price comfort
3. area
4. agent status
5. best next step

State options:
NEW_HOT
WAITING_FOR_TIMELINE
WAITING_FOR_BUDGET
WAITING_FOR_AREA
WAITING_FOR_AGENT_STATUS
WAITING_FOR_LENDER_NEED
OFFER_HOME_SEARCH
OFFER_AGENT_CALL
OFFER_LENDER
CALLBACK_LATER
NURTURE_WARM
NURTURE_COLD
EXIT_ALREADY_HAS_LOCAL_AGENT
EXIT_NOT_INTERESTED
STOP

Best next step options:
agent_call
home_search
lender_intro
nurture
stop
none

Temperature options:
hot
warm
cold

Return ONLY valid JSON in this exact shape:
{
  "replyText": "string",
  "nextState": "string",
  "nextPriority": "string",
  "temperature": "hot|warm|cold",
  "bestNextStep": "agent_call|home_search|lender_intro|nurture|stop|none",
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
    "notes_append": "string or null"
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

Recent transcript:
${transcript || '(none)'}

Newest inbound text:
${inboundText}
`.trim()

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(extractJson(raw))

    const nextState = sanitizeState(
      parsed.nextState,
      lead.sms_state || 'WAITING_FOR_TIMELINE'
    )

    return {
      replyText:
        trimOrNull(parsed.replyText) ||
        fallbackReply(lead, inboundText).replyText,
      nextState,
      nextPriority: trimOrNull(parsed.nextPriority) || 'timeline',
      temperature: sanitizeTemperature(parsed.temperature),
      bestNextStep: sanitizeBestNextStep(parsed.bestNextStep),
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
      },
      aiSummary: trimOrNull(parsed.aiSummary) || 'Relocation SMS brain response',
    }
  } catch {
    return fallbackReply(lead, inboundText)
  }
}