export const relocationSmsText = {
  slotOptions(a: string, b: string) {
    return `I can give you two good options: ${a} or ${b}. Which one works better for you?`
  },

  localLenderAlreadyMoving(teamLabel: string) {
    return `Perfect — that helps. Since you already have that piece moving, the next best step would probably be a quick strategy call with ${teamLabel}. Want me to give you two good time options?`
  },

  lenderIntroOffer(brandName: string) {
    return `No problem at all. We can connect you with one of our trusted local lenders here at ${brandName}. It would just be a simple, no-pressure intro to help you get the financing side squared away. Want me to set that up for you?`
  },

  loanPathLenderIntro(brandName: string) {
    return `Absolutely — we can help with that. I can connect you with one of our trusted local lenders here at ${brandName}. It would just be a simple, no-pressure introduction so you can explore your financing options. Want me to set that up for you?`
  },

  lenderIntroApproved(teamLabel: string) {
    return `Perfect. I’ll have one of our trusted local lenders reach out. After that, if you want, I can also help line up a quick strategy call with ${teamLabel}.`
  },

  lenderIntroDeclined(teamLabel: string) {
    return `No worries at all. We can leave that piece alone for now. The next best step would probably be a quick strategy call with ${teamLabel} so you can get real answers and a game plan. Want me to give you two good time options?`
  },

  hardStop(name: string) {
    return `No problem, ${name}. I’ll stop here. If anything changes later on, you can always text me back.`
  },

  humanHandoff(name: string, teamLabel: string) {
    return `Absolutely, ${name}. I can have someone from ${teamLabel} reach out. Would you like me to give you two good time options, or is there usually a time that works best for you?`
  },

  guideReceivedAskTimeline(name: string) {
    return `Perfect, ${name} — glad you got it. So I can get a feel for your timing, when are you thinking about making your move? Are you thinking in the next few months, later this year, or are you still just exploring for now?`
  },

  guideNotReceivedAskResend(name: string) {
    return `No problem, ${name}. I can resend the guide for you. Is this still the best email to send it to?`
  },

  unclearTimelineFirst(name: string) {
    return `Sorry ${name}, I want to make sure I understood you correctly. Are you thinking about moving in the next 3 months, around 6 months, or are you still just exploring for now?`
  },

  unclearTimelineSecond() {
    return `No worries. Let’s keep it simple — are you moving soon, later, or just browsing right now?`
  },

  unclearTimelineThird() {
    return `No problem. Whenever you're ready, just text me something simple like "moving soon," "later," or "just browsing," and I’ll take it from there.`
  },

  alreadyWorkingWithLocalAgent(name: string, teamLabel: string) {
    return `Got it, ${name}. If you’re already working with ${teamLabel}, you’re in good hands. If anything changes and you need something else from us, just text me back.`
  },

  askTimeline(name: string) {
    return `That helps, ${name}. So I can be useful here, when are you thinking about making your move? Are you thinking in the next few months, later this year, or are you still just exploring for now?`
  },

  askPrice() {
    return `That helps. And so I can keep this realistic and useful for you, what kind of price range are you hoping to stay around?`
  },

  askMotivation() {
    return `Makes sense. What’s really driving the move for you? Is this more about work, family, lifestyle, retirement, or something else going on right now?`
  },

  askAgentStatus(teamLabel: string) {
    return `Just so I know how best to help, are you already working with an agent, or would you want help from ${teamLabel}?`
  },

  askMortgageOrCash() {
    return `Perfect. One other thing I like to clarify so we know the best path forward — are you thinking this will be a cash purchase, or will you probably want financing?`
  },

  askMortgageOrCashWithName(name: string) {
    return `Perfect, ${name}. One other thing I like to clarify so we know the best path forward — are you thinking this will be a cash purchase, or will you probably want financing?`
  },

  askMortgageOrCashThatMakesSense(name: string) {
    return `That makes sense, ${name}. One other piece I like to clarify so we know the best path forward — are you thinking this will be a cash purchase, or will you probably want financing?`
  },

  askLocalLenderStatus() {
    return `Got it. Have you already spoken with a local loan officer yet, or is that still something you’d want help getting lined up?`
  },

  offerAppointment(teamLabel: string) {
    return `That helps. The next best step would probably be a quick strategy call with ${teamLabel}. Want me to give you two good time options?`
  },

  cashPathAppointment(teamLabel: string) {
    return `Got it — cash gives you a lot of flexibility. The next best step would probably be a quick strategy call with ${teamLabel} so we can help you line things up and talk through the best options. Want me to give you two good time options?`
  },

  appointmentSlots(name: string, slotOptionsText: string | null) {
    return `Perfect, ${name}. ${slotOptionsText}`
  },

  noLiveSlots(name: string) {
    return `Perfect, ${name}. I don’t have live time slots showing right this second, but I can still help get this moving. Is there usually a better time for a quick call — mornings, afternoons, or evenings?`
  },

  appointmentNotReady() {
    return `No problem at all. We can circle back when the timing is better for you. Is there a day or part of the day that usually works best when you do want us to reach out?`
  },

  genericReply(name: string) {
    return `Hi ${name}, this is Samantha with MPRE Boise. I got your message and will follow up shortly. If you'd like, text me your timeline, price range, and the area you're thinking about.`
  },

  appointmentChoiceClarify(optionA?: string | null, optionB?: string | null) {
    return optionA && optionB
      ? `Almost there — please reply A for ${optionA}, or B for ${optionB}, and I’ll send the request to the agent for confirmation.`
      : `Almost there — please reply A or B for the appointment option you prefer, and I’ll send the request to the agent for confirmation.`
  },

  appointmentCheckError() {
    return `I’m sorry — I hit a snag checking that appointment request. Please try that one more time.`
  },

  appointmentAlreadyPending() {
    return `I already have that appointment request pending with the agent. I’ll keep watching it and follow up as soon as they respond.`
  },

  noAgentAvailable() {
    return `I’ve got your requested time, but no agent is currently available to confirm it right this second. I’ll keep working on it and follow up with you as soon as I have the next best option.`
  },

  appointmentSaveErrorHyphen() {
    return `I’m sorry - I hit a snag saving that appointment request. Please try that one more time.`
  },

  appointmentSaveError() {
    return `I’m sorry — I hit a snag saving that appointment request. Please try that one more time.`
  },

  appointmentSentForConfirmation(name: string) {
    return `Perfect, ${name} — I’ve sent that time over for confirmation with the agent now. I’ll text you as soon as it’s locked in.`
  },

  lenderIntroSentAppointment(name: string) {
    return `Perfect, ${name} — I’ll make that introduction for you. The next best step would probably be a quick strategy call with our team here at MPRE Boise so we can help you put a real game plan together. Want me to give you two good time options?`
  },

  guideConfirmedAreaQuestion(name: string) {
    return `Perfect, ${name} — glad you got it. Are you mostly looking at Boise itself, or are you also considering Meridian, Eagle, Nampa, Kuna, Star, or Caldwell?`
  },

  guideResentAreaQuestion(name: string) {
    return `No problem, ${name} — I just resent it to your email. Please check your inbox, spam, junk, or promotions folder. Once you have it, are you mostly looking at Boise itself, or also considering Meridian, Eagle, Nampa, Kuna, Star, or Caldwell?`
  },

  forcedAppointmentOptions(name: string, slotA: string, slotB: string) {
    return (
      `Perfect, ${name} — I can give you two good options:\n` +
      `A) ${slotA}\n` +
      `B) ${slotB}\n` +
      `Which one works better for you? Just reply A or B.`
    )
  },

  catchAllError() {
    return `Thanks for your message. We received it and will follow up as soon as possible.`
  },
} as const