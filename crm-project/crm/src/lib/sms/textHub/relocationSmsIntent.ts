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
