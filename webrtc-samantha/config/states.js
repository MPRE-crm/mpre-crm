// webrtc-samantha/config/states.js
/* ------------------------------------------------------------------ */
/* STATE ENUM (INBOUND ONLY) */
/* ------------------------------------------------------------------ */
const ST = {
  PLAY_OPENING1: "PLAY_OPENING1",
  WAIT_AREA: "WAIT_AREA",
  PLAY_OPENING2: "PLAY_OPENING2",
  WAIT_INTENT: "WAIT_INTENT",

  PLAY_BUYER_STEP: "PLAY_BUYER_STEP",
  WAIT_BUYER_ANSWER: "WAIT_BUYER_ANSWER",

  PLAY_SELLER_STEP: "PLAY_SELLER_STEP",
  WAIT_SELLER_ANSWER: "WAIT_SELLER_ANSWER",

  PLAY_INVESTOR_STEP: "PLAY_INVESTOR_STEP",
  WAIT_INVESTOR_ANSWER: "WAIT_INVESTOR_ANSWER",

  // 🔒 Off-topic / confirmation
  OFFTOPIC_WAIT_FOLLOWUP: "OFFTOPIC_WAIT_FOLLOWUP",
  WAIT_CONFIRM: "WAIT_CONFIRM",

  DONE: "DONE",
};

export default ST;
