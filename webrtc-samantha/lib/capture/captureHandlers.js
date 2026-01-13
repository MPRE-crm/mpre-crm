import {
  cleanText,
  parseEmail,
  parsePhone,
  parseName,
  parseYesNo,
  parsePriceRangeNumbers,
  parseBedsBathsSqft,
} from "../parsers/parsers.js";

export function createCaptureContext() {
  return {
    captureByItemId: new Map(),
    transcriptsByItemId: new Map(),
    confirmCtx: null,
    callArea: null,
  };
}

// ---------------------------------------------------------------------------
// Handle completed transcription (STRICT STATE-DRIVEN)
// ---------------------------------------------------------------------------
export async function handleCompletedTranscription({
  data,
  state,
  ST,
  ctx,
  setState,

  buyerData,
  sellerData,
  investorData,

  buyerPcms,
  sellerPcms,
  investorPcms,

  refs,

  classifyIntent,
  triggerOffTopicResponse,
  speakConfirmationPrompt,

  startBuyerFlow,
  startSellerFlow,
  startInvestorFlow,

  playNextBuyerStep,
  playNextSellerStep,
  playNextInvestorStep,
}) {
  const transcript = cleanText(data.transcript || "");
  if (!transcript) return;

  // ---------------------------------------------------------
  // OFF-TOPIC HANDLING (EXPLICIT ONLY)
  // ---------------------------------------------------------
  try {
    if ((await classifyIntent(transcript, state)) === "OFF_TOPIC") {
      triggerOffTopicResponse(transcript);
      return;
    }
  } catch {
    // ignore classifier failures
  }

  // ---------------------------------------------------------
  // CONFIRMATION STATE (YES / NO ONLY)
  // ---------------------------------------------------------
  if (state === ST.WAIT_CONFIRM && ctx.confirmCtx) {
    const yn = parseYesNo(transcript);

    if (yn === null) {
      speakConfirmationPrompt("Please say yes or no.");
      return;
    }

    const { flow, key, value } = ctx.confirmCtx;

    if (yn === true) {
      if (flow === "buyer") {
        if (key === "contact1-name") {
          const n = parseName(value);
          buyerData.first_name = n.first_name;
          buyerData.last_name = n.last_name;
        }
        if (key === "contact2-email") buyerData.email = parseEmail(value);
        if (key === "contact3-phone") buyerData.phone = parsePhone(value);

        refs.buyerIdx++;
        playNextBuyerStep();
      }

      if (flow === "seller") {
        if (key === "s01-contact-name") {
          const n = parseName(value);
          sellerData.first_name = n.first_name;
          sellerData.last_name = n.last_name;
        }
        if (key === "s02-contact-phone") sellerData.phone = parsePhone(value);
        if (key === "s03-contact-email") sellerData.email = parseEmail(value);

        refs.sellerIdx++;
        playNextSellerStep();
      }

      if (flow === "investor") {
        if (key === "i01-contact-name") {
          const n = parseName(value);
          investorData.first_name = n.first_name;
          investorData.last_name = n.last_name;
        }
        if (key === "i02-contact-phone") investorData.phone = parsePhone(value);
        if (key === "i03-contact-email") investorData.email = parseEmail(value);

        refs.investorIdx++;
        playNextInvestorStep();
      }

      ctx.confirmCtx = null;
      return;
    }

    ctx.confirmCtx = null;
    if (flow === "buyer") setState(ST.WAIT_BUYER_ANSWER);
    if (flow === "seller") setState(ST.WAIT_SELLER_ANSWER);
    if (flow === "investor") setState(ST.WAIT_INVESTOR_ANSWER);

    speakConfirmationPrompt("Okay, please say it again.");
    return;
  }

  // ---------------------------------------------------------
  // AREA
  // ---------------------------------------------------------
  if (state === ST.WAIT_AREA) {
    ctx.callArea = transcript;
    return;
  }

  // ---------------------------------------------------------
  // INTENT
  // ---------------------------------------------------------
  if (state === ST.WAIT_INTENT) {
    const s = transcript.toLowerCase();

    if (s.includes("sell") || s.includes("listing")) return startSellerFlow();
    if (s.includes("invest") || s.includes("rental")) return startInvestorFlow();

    return startBuyerFlow();
  }

  // ---------------------------------------------------------
  // BUYER FLOW
  // ---------------------------------------------------------
  if (state === ST.WAIT_BUYER_ANSWER) {
    const step = buyerPcms[refs.buyerIdx];
    if (!step) return;

    const { key } = step;

    // 🔒 OFF-TOPIC QUESTION WINDOW — DO NOT ADVANCE FLOW
    if (key === "contact4-questions") {
      // Off-topic questions are handled by the classifier above.
      // Stay in this state until flow explicitly advances to lp-1-location.
      return;
    }

    if (key === "contact1-name" || key === "contact2-email" || key === "contact3-phone") {
      ctx.confirmCtx = { flow: "buyer", key, value: transcript };
      setState(ST.WAIT_CONFIRM);
      speakConfirmationPrompt(`I heard "${transcript}". Is that correct?`);
      return;
    }

    if (key === "lp-2-price") {
      const pr = parsePriceRangeNumbers(transcript);
      buyerData.price_min = pr.min;
      buyerData.price_max = pr.max;
    }
    if (key === "lp-3-motivation") buyerData.motivation = transcript;
    if (key === "lp-4-agent") buyerData.has_agent = parseYesNo(transcript);
    if (key === "lp-5-mortgage") buyerData.financing = transcript;

    refs.buyerIdx++;
    playNextBuyerStep();
    return;
  }

  // ---------------------------------------------------------
  // SELLER FLOW
  // ---------------------------------------------------------
  if (state === ST.WAIT_SELLER_ANSWER) {
    const step = sellerPcms[refs.sellerIdx];
    if (!step) return;

    const { key } = step;

    if (key === "s05-property") {
      const d = parseBedsBathsSqft(transcript);
      sellerData.beds = d.beds;
      sellerData.baths = d.baths;
      sellerData.sqft = d.sqft;
    }

    if (key === "s06-timeline") sellerData.timeline = transcript;
    if (key === "s07-motivation") sellerData.motivation = transcript;
    if (key === "s08-agent-status") sellerData.has_agent = parseYesNo(transcript);

    refs.sellerIdx++;
    playNextSellerStep();
    return;
  }

  // ---------------------------------------------------------
  // INVESTOR FLOW
  // ---------------------------------------------------------
  if (state === ST.WAIT_INVESTOR_ANSWER) {
    const step = investorPcms[refs.investorIdx];
    if (!step) return;

    const { key } = step;

    if (key === "i04-market-focus") investorData.markets = transcript;
    if (key === "i05-property-type") investorData.property_type = transcript;
    if (key === "i06-units-budget") investorData.units_budget = parsePriceRangeNumbers(transcript);
    if (key === "i07-capital-structure") investorData.capital_structure = transcript;

    refs.investorIdx++;
    playNextInvestorStep();
  }
}
