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
    'coeur d’alene',
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
