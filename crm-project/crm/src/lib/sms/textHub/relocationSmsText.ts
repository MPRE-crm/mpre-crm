function cleanName(name?: string | null) {
  const cleaned = (name || '').trim()
  if (!cleaned) return ''
  if (['there', 'unknown', 'customer', 'lead'].includes(cleaned.toLowerCase())) return ''
  return cleaned
}

export type RelocationSmsContext = {
  brandName?: string | null
  teamLabel?: string | null
  guideLabel?: string | null
  areaQuestion?: string | null
}

function ctxValue(value: string | null | undefined, fallback: string) {
  const cleaned = String(value || '').trim()
  return cleaned || fallback
}

function ctxBrand(ctx?: RelocationSmsContext | null) {
  return ctxValue(ctx?.brandName, 'our real estate team')
}

function ctxTeam(ctx?: RelocationSmsContext | null) {
  return ctxValue(ctx?.teamLabel, `the ${ctxBrand(ctx)} team`)
}

function ctxGuide(ctx?: RelocationSmsContext | null) {
  return ctxValue(ctx?.guideLabel, 'relocation guide')
}

function ctxAreaQuestion(ctx?: RelocationSmsContext | null) {
  return ctxValue(
    ctx?.areaQuestion,
    'Are you mostly focused on one area, or are you also considering nearby communities?'
  )
}

function withName(name?: string | null) {
  const cleaned = cleanName(name)
  return cleaned ? `, ${cleaned}` : ''
}

function hiName(name?: string | null) {
  const cleaned = cleanName(name)
  return cleaned ? `Hi ${cleaned},` : 'Hi there,'
}

function perfectName(name?: string | null) {
  const cleaned = cleanName(name)
  return cleaned ? `Perfect, ${cleaned}.` : 'Perfect.'
}

export const relocationSmsText = {
  slotOptions(a: string, b: string) {
    return `I have two good options: ${a} or ${b}. Which one works better for you?`
  },

  localLenderAlreadyMoving(teamLabel: string) {
    return `Great - that helps. Since you already have the lending side moving, the next best step would be a quick strategy call with ${teamLabel}. Would you like me to send you two good time options?`
  },

  lenderIntroOffer(brandName: string) {
    return `No problem at all. We can connect you with one of our trusted local lenders here at ${brandName}. It would be a simple, no-pressure introduction so you can get clear on options before you make any big decisions. Would you like me to set that up?`
  },

  loanPathLenderIntro(brandName: string) {
    return `Absolutely - we can help with that. I can connect you with one of our trusted local lenders here at ${brandName}. It would be a simple, no-pressure introduction so you can explore financing options and get a clearer game plan. Would you like me to set that up?`
  },

  lenderIntroApproved(teamLabel: string) {
    return `Perfect. I will have one of our trusted local lenders reach out. After that, we can also help line up a quick strategy call with ${teamLabel} so you have a clear plan for the move.`
  },

  lenderIntroDeclined(teamLabel: string) {
    return `No worries at all. We can leave the lender piece alone for now. The next best step would be a quick strategy call with ${teamLabel} so you can get real answers and a simple game plan. Want me to send you two good time options?`
  },

  hardStop(name: string) {
    return `No problem${withName(name)}. I will stop messages here. If anything changes later, you can always text me back.`
  },

  humanHandoff(name: string, teamLabel: string) {
    return `Absolutely${withName(name)}. I can have someone from ${teamLabel} reach out. Would you like me to send two good time options, or is there a certain time of day that usually works best for you?`
  },

  guideReceivedAskTimeline(name: string) {
    return `${perfectName(name)} Glad you got the guide. To point you in the right direction, when are you thinking about making the move - in the next few months, later this year, or are you still just exploring?`
  },

  guideNotReceivedAskResend(name: string) {
    return `No problem${withName(name)}. I can resend the guide for you. Is this still the best email address to send it to?`
  },

  unclearTimelineFirst(name: string) {
    return `Sorry${withName(name)}, I want to make sure I understood you correctly. Are you thinking about moving in the next few months, around 6 months, or are you still just exploring?`
  },

  unclearTimelineSecond() {
    return `No worries. To keep it simple, would you say you are moving soon, moving later, or mostly just browsing right now?`
  },

  unclearTimelineThird() {
    return `No problem. Whenever you are ready, just text me something simple like "moving soon," "later," or "just browsing," and I will take it from there.`
  },

  alreadyWorkingWithLocalAgent(name: string, teamLabel: string) {
    return `Got it${withName(name)}. If you are already working with an agent, you are in good shape. If anything changes and you need help from ${teamLabel}, just text me back.`
  },

  askTimeline(name: string) {
    return `That helps${withName(name)}. To make this useful for you, when are you thinking about making your move - in the next few months, later this year, or are you still just exploring?`
  },

  askPrice() {
    return `Great. To keep the next steps realistic and useful, what price range are you hoping to stay around?`
  },

  askMotivation() {
    return `Makes sense. What is the main reason behind the move - work, family, lifestyle, retirement, or something else?`
  },

  askAgentStatus(teamLabel: string) {
    return `Just so I know how best to help, are you already working with an agent, or would you like help from ${teamLabel}?`
  },

  askMortgageOrCash() {
    return `Perfect. One other planning question - are you thinking this will be a cash purchase, or will you probably want financing?`
  },

  askMortgageOrCashWithName(name: string) {
    return `Perfect${withName(name)}. One other planning question - are you thinking this will be a cash purchase, or will you probably want financing?`
  },

  askMortgageOrCashThatMakesSense(name: string) {
    return `That makes sense${withName(name)}. One other planning question - are you thinking this will be a cash purchase, or will you probably want financing?`
  },

  askLocalLenderStatus() {
    return `Got it. Have you already spoken with a local loan officer, or is that something you would like help getting lined up?`
  },

  offerAppointment(teamLabel: string) {
    return `That helps. The next best step would be a quick strategy call with ${teamLabel} so we can answer questions and help you map out the move. Want me to send you two good time options?`
  },

  cashPathAppointment(teamLabel: string) {
    return `Got it - cash gives you a lot of flexibility. The next best step would be a quick strategy call with ${teamLabel} so we can help you compare options and map out a smart plan. Want me to send two good time options?`
  },

  appointmentSlots(name: string, slotOptionsText: string | null) {
    return slotOptionsText
      ? `${perfectName(name)} ${slotOptionsText}`
      : `${perfectName(name)} I can help get a quick strategy call started. What time of day usually works best for you?`
  },

  noLiveSlots(name: string) {
    return `${perfectName(name)} I am not seeing live time slots right this second, but I can still help get this moving. Is there a better time for a quick call - mornings, afternoons, or evenings?`
  },

  appointmentNotReady() {
    return `No problem at all. We can circle back when the timing is better. When you are ready, is there usually a better day or time of day for a quick call?`
  },

  genericReply(name: string, ctx?: RelocationSmsContext | null) {
    return `${hiName(name)} this is Samantha with ${ctxBrand(ctx)}. I got your message and will follow up shortly. To help point you in the right direction, you can text me your timeline, price range, and the area you are considering.`
  },

  appointmentChoiceClarify(optionA?: string | null, optionB?: string | null) {
    return optionA && optionB
      ? `Almost there - please reply A for ${optionA}, or B for ${optionB}, and I will send the request to the agent for confirmation.`
      : `Almost there - please reply A or B for the appointment option you prefer, and I will send the request to the agent for confirmation.`
  },

  appointmentCheckError() {
    return `I am sorry - I hit a snag checking that appointment request. Please try that one more time.`
  },

  appointmentAlreadyPending() {
    return `I already have that appointment request pending with the agent. I will keep watching it and follow up as soon as they respond.`
  },

  noAgentAvailable() {
    return `I have your requested time, but no agent is available to confirm it right this second. I will keep working on it and follow up with the next best option.`
  },

  appointmentSaveErrorHyphen() {
    return `I am sorry - I hit a snag saving that appointment request. Please try that one more time.`
  },

  appointmentSaveError() {
    return `I am sorry - I hit a snag saving that appointment request. Please try that one more time.`
  },

  appointmentSentForConfirmation(name: string) {
    return `${perfectName(name)} I sent that time over for confirmation with the agent. I will text you as soon as it is locked in.`
  },

  lenderIntroSentAppointment(name: string, ctx?: RelocationSmsContext | null) {
    return `${perfectName(name)} I will make that lender introduction for you. The next best step would be a quick strategy call with ${ctxTeam(ctx)} so we can help you build a clear game plan. Want me to send two good time options?`
  },

  guideConfirmedAreaQuestion(name: string, ctx?: RelocationSmsContext | null) {
    return `${perfectName(name)} Glad you got it. ${ctxAreaQuestion(ctx)}`
  },

  guideVerificationCheck(name: string, _email?: string | null, ctx?: RelocationSmsContext | null) {
    const cleaned = cleanName(name) || 'there'
    return `Hi ${cleaned}, this is Samantha with ${ctxBrand(ctx)}. Just checking — did you receive the ${ctxGuide(ctx)} okay?`
  },

  guideEmailConfirmAsk(_name: string, email?: string | null, ctx?: RelocationSmsContext | null) {
    const targetEmail = (email || '').trim() || 'your email address'
    return `No problem - we can fix that here! Is ${targetEmail} still the best email address for your ${ctxGuide(ctx)}?`
  },

  guideEmailPermissionAsk(_name: string, email?: string | null, ctx?: RelocationSmsContext | null) {
    const targetEmail = (email || '').trim() || 'your email address'
    return `Perfect, thank you. With your permission, I'll resend the ${ctxGuide(ctx)} to ${targetEmail}. You can reply STOP at any time to opt out of texts. Is that okay?`
  },

  guideEmailPermissionApproved() {
    return `Great - I'm sending it now. If it still does not show up, I can also send the guide link here by text. Just let me know!`
  },

  guideSmsLink(guideLink: string, ctx?: RelocationSmsContext | null) {
    return `Absolutely - here is the ${ctxGuide(ctx)} link: ${guideLink}\n\nIf it still gives you trouble, just reply here and I can help.`
  },

  guideEmailPermissionDeclined() {
    return `No problem at all. I will not resend it right now. If you want it later, just text me back and I can help.`
  },

  guideVerificationReceivedNextStep(ctx?: RelocationSmsContext | null) {
    return `Perfect - please tap the email verification link when you have a chance, and I'll send the ${ctxGuide(ctx)} right over.`
  },

  guideResentAreaQuestion(name: string, ctx?: RelocationSmsContext | null) {
    return `No problem${withName(name)} - I just resent it to your email. Please check your inbox, spam, junk, or promotions folder. Once you have it, ${ctxAreaQuestion(ctx).charAt(0).toLowerCase()}${ctxAreaQuestion(ctx).slice(1)}`
  },

  forcedAppointmentOptions(name: string, slotA: string, slotB: string) {
    return (
      `${perfectName(name)} I have two good options:\n` +
      `A) ${slotA}\n` +
      `B) ${slotB}\n` +
      `Which one works better for you? Just reply A or B.`
    )
  },

  companyValueAnswer(brandName: string) {
    return `Great question. ${brandName} helps relocation buyers cut through the online noise and make smarter decisions faster. We help you understand how different areas actually feel, which neighborhoods fit your lifestyle, where the value is, and what to avoid. Then we help with the strategy and execution too - search setup, pricing, offer strategy, inspections, negotiation, and keeping the move clear through closing. When you are ready, you can still reply A or B for a quick strategy call.`
  },

  areaPreferenceCaptured(area: string) {
    const lowerArea = area.toLowerCase()

    const leadIn =
      /open to boise area|not sure|unsure|anywhere|open/i.test(lowerArea)
        ? 'Totally fair - we can narrow that down.'
        : /safe|school|land|acreage|new construction/i.test(lowerArea)
          ? 'Got it - that helps narrow the search.'
          : `Great - ${area} is a solid area to focus on.`

    return `${leadIn} Are you thinking of moving soon, 3-6 months out, or more like next year?`
  },

  outOfMarketAreaClarification(area: string) {
    return `Got it - are you still considering the Boise area too, or are you mainly focused on ${area}?`
  },

  outOfMarketReferralReview(area: string) {
    return `Got it - I'll flag this for our team so they can help point you in the right direction for ${area}.`
  },

  outOfMarketKeepBoise() {
    return `Perfect - we can keep Boise in the mix. Are you thinking of moving soon, 3-6 months out, or more like next year?`
  },
  catchAllError() {
    return `Thanks for your message. We received it and will follow up as soon as possible.`
  },
} as const

