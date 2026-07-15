function cleanIntent(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
}

export function isGuideNo(text?: string | null) {
  const t = cleanIntent(text)

  return (
    /\b(no|nope|nah)\b/i.test(t) ||
    /\b(didnt|didn't|did not|dont|don't|do not)\b/i.test(t) ||
    /\b(not yet|never got|haven't|have not|nothing came through)\b/i.test(t) ||
    /\b(did not receive|didn't receive|didnt receive)\b/i.test(t) ||
    /\b(did not get|didn't get|didnt get)\b/i.test(t) ||
    /\b(i do not have it|i don't have it|i dont have it)\b/i.test(t)
  )
}

export function isGuideYes(text?: string | null) {
  const t = cleanIntent(text)

  if (isGuideNo(t)) return false

  return (
    /\b(yes|yep|yeah|correct|ok|okay|sure)\b/i.test(t) ||
    /\b(got it|received it|i got it|i received it)\b/i.test(t) ||
    /\b(yes it is|that is correct|that's correct|that works)\b/i.test(t) ||
    /\b(email is right|email is correct|that email is right|that email is correct)\b/i.test(t)
  )
}

export function detectGuideReceived(text?: string | null): 'yes' | 'no' | null {
  if (isGuideNo(text)) return 'no'
  if (isGuideYes(text)) return 'yes'
  return null
}

function titleCaseArea(area: string) {
  return area
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function normalizeOutOfMarketArea(area: string) {
  const lower = cleanIntent(area)
  if (lower === 'cda' || lower.includes('coeur')) return "Coeur d'Alene"
  return titleCaseArea(area)
}

export function detectBoiseAreaPreference(text?: string | null) {
  const raw = String(text || '').trim()
  const t = cleanIntent(raw)

  const boiseAreaTargets = [
    'boise area',
    'treasure valley',
    'garden city',
    'boise',
    'meridian',
    'eagle',
    'nampa',
    'kuna',
    'star',
    'caldwell',
    'middleton',
    'emmett',
  ]

  const matchedAreas = boiseAreaTargets
    .filter((area) => {
      const pattern = new RegExp(`\\b${area.replace(/\s+/g, '\\s+')}\\b`, 'i')
      return pattern.test(t)
    })
    .map(titleCaseArea)

  if (matchedAreas.length > 0) {
    return matchedAreas.join(', ')
  }

  if (/all areas|any area|anywhere|open|no preference|not sure|unsure/i.test(t)) {
    return 'Open to Boise area'
  }

  if (/safe|schools|school district|land|acreage|new construction|new build/i.test(t)) {
    return raw
  }

  return null
}

export function detectOutOfMarketArea(text?: string | null) {
  const t = cleanIntent(text)

  const outOfMarketAreas = [
    'twin falls',
    'idaho falls',
    'coeur d alene',
    "coeur d'alene",
    'cda',
    'mccall',
    'mountain home',
    'pocatello',
    'sandpoint',
    'lewiston',
    'moscow',
    'rexburg',
    'sun valley',
    'hailey',
    'ketchum',
    'burley',
    'jerome',
    'blackfoot',
    'post falls',
    'rathdrum',
  ]

  for (const area of outOfMarketAreas) {
    const pattern = new RegExp(`\\b${area.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (pattern.test(t)) return normalizeOutOfMarketArea(area)
  }

  return null
}

export function isStillConsideringBoise(text?: string | null) {
  const t = cleanIntent(text)
  return /yes|yeah|yep|both|also boise|boise too|still boise|treasure valley|either|open to boise/i.test(t)
}

export function isMainlyOutOfMarket(text?: string | null) {
  const t = cleanIntent(text)
  return /no|mainly|mostly|only|just|focused on|not boise|outside boise|twin falls|idaho falls|coeur|cda|mccall|pocatello|sandpoint|lewiston|moscow|rexburg|sun valley|post falls|rathdrum/i.test(t)
}

export type AgentStatusIntent =
  | 'wants_mpre_help'
  | 'under_buyer_agreement'
  | 'has_agent_needs_agreement_clarification'
  | 'out_of_area_agent'
  | 'not_committed_agent'
  | null

export function detectAgentStatusIntent(text?: string | null): AgentStatusIntent {
  const t = cleanIntent(text)

  if (!t) return null

  if (
    /\b(signed buyer agreement|buyer agreement|representation agreement|exclusive buyer agreement|under contract with an agent|under agreement with an agent|signed with an agent|signed with a realtor|contract with my agent|contract with our agent)\b/i.test(t)
  ) {
    return 'under_buyer_agreement'
  }

  if (
    /\b(out of state agent|out-of-state agent|agent from california|agent from out of state|agent back home|agent is not local|agent isn't local|agent is not in boise|agent isn't in boise|agent does not know boise|agent doesn't know boise|realtor is not local|realtor isn't local|realtor back home)\b/i.test(t)
  ) {
    return 'out_of_area_agent'
  }

  if (
    /\b(no agent|no realtor|not working with anyone|not working with anybody|not working with an agent|not working with a realtor|dont have an agent|don't have an agent|do not have an agent|dont have a realtor|don't have a realtor|do not have a realtor|need an agent|need a realtor|need someone|need help|need assistance|want help|would like help|help from you|help from your team|need help from mpre|need someone from mpre|assign me someone|you can assign me someone|someone from mpre|mpre please|mpre boise team|your team|you guys|want help from your team|would like assistance from your team|assistance from your team|your team please|work with you|work with your team)\b/i.test(t)
  ) {
    return 'wants_mpre_help'
  }

  if (
    /\b(not committed|not signed|nothing signed|havent signed|haven't signed|have not signed|just talked|only talked|only spoken|just spoken|talked to someone|spoke with someone|talked with someone|i know a realtor|know a realtor|friend is an agent|friend is a realtor|cousin is a realtor|cousin is an agent|family member is an agent|family member is a realtor)\b/i.test(t)
  ) {
    return 'not_committed_agent'
  }

  if (
    /\b(have an agent|have a realtor|already have an agent|already have a realtor|working with an agent|working with a realtor|working with someone|we have someone|we have an agent|we have a realtor|i am represented|i'm represented|represented already|buyer agent|my agent|my realtor|our agent|our realtor|realtor already|agent already)\b/i.test(t)
  ) {
    return 'has_agent_needs_agreement_clarification'
  }

  return null
}

export type AgentAgreementIntent = 'under_agreement' | 'not_under_agreement' | null

export function detectAgentAgreementIntent(text?: string | null): AgentAgreementIntent {
  const t = cleanIntent(text)

  if (!t) return null

  if (
    /\b(yes|yeah|yep|correct|that's correct|that is correct|i am|we are)\b.*\b(signed|agreement|buyer agreement|under agreement|under contract|exclusive|represented)\b/i.test(t) ||
    /\b(signed|signed already|under buyer agreement|under an agreement|under agreement|under contract with them|exclusive buyer agreement|representation agreement)\b/i.test(t)
  ) {
    return 'under_agreement'
  }

  if (
    /\b(no|nope|nah|not yet|not signed|nothing signed|not committed|no agreement|havent signed|haven't signed|have not signed|just talked|only talked|only spoken|just spoken|just browsing with them|just asked questions)\b/i.test(t)
  ) {
    return 'not_under_agreement'
  }

  return null
}

export type SpouseOrDelayIntent = 'needs_spouse' | 'delay_or_circle_back' | null

export function detectSpouseOrDelayIntent(text?: string | null): SpouseOrDelayIntent {
  const t = cleanIntent(text)

  if (!t) return null

  if (
    /\b(talk to my wife|talk with my wife|ask my wife|check with my wife|talk to my husband|talk with my husband|ask my husband|check with my husband|talk to my spouse|check with my spouse|talk to my partner|check with my partner|need to discuss with my wife|need to discuss with my husband|need to discuss with my spouse|need to discuss with my partner|run it by my wife|run it by my husband|run it by my spouse|run it by my partner)\b/i.test(t)
  ) {
    return 'needs_spouse'
  }

  if (
    /\b(not right now|maybe later|later|not yet|busy|another time|circle back|follow up later|reach out later|check back|check back later|few days|next week|not ready|too early|too soon|down the road)\b/i.test(t)
  ) {
    return 'delay_or_circle_back'
  }

  return null
}