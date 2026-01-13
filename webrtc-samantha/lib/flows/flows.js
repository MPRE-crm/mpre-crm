export function createFlowControllers({
  ST,
  playBuffer,
  buyerPcms,
  sellerPcms,
  investorPcms,
  insertBuyerIntake,
  insertSellerIntake,
  insertInvestorIntake,
  unlockMic,
}) {
  const refs = {
    buyerIdx: 0,
    sellerIdx: 0,
    investorIdx: 0,
  };

  function startBuyerFlow(setState) {
    refs.buyerIdx = 0;
    setState(ST.PLAY_BUYER_STEP);
    playNextBuyerStep(setState);
  }

  function playNextBuyerStep(setState) {
    if (refs.buyerIdx >= buyerPcms.length) {
      setState(ST.DONE);
      insertBuyerIntake();
      unlockMic();
      return;
    }

    const step = buyerPcms[refs.buyerIdx];
    playBuffer(step.buf, `Buyer:${step.key}`, ST.WAIT_BUYER_ANSWER);
  }

  // ✅ replay current step (used for contact4-questions loop)
  function replayBuyerStep(setState) {
    if (refs.buyerIdx >= buyerPcms.length) return;

    const step = buyerPcms[refs.buyerIdx];
    playBuffer(step.buf, `Buyer:${step.key}`, ST.WAIT_BUYER_ANSWER);
  }

  // ✅ NEW: advance buyer step explicitly (used after 5 questions)
  function advanceBuyerStep(setState) {
    refs.buyerIdx++;
    playNextBuyerStep(setState);
  }

  function startSellerFlow(setState) {
    refs.sellerIdx = 0;
    setState(ST.PLAY_SELLER_STEP);
    playNextSellerStep(setState);
  }

  function playNextSellerStep(setState) {
    if (refs.sellerIdx >= sellerPcms.length) {
      setState(ST.DONE);
      insertSellerIntake();
      unlockMic();
      return;
    }

    const step = sellerPcms[refs.sellerIdx];
    playBuffer(step.buf, `Seller:${step.key}`, ST.WAIT_SELLER_ANSWER);
  }

  function startInvestorFlow(setState) {
    refs.investorIdx = 0;
    setState(ST.PLAY_INVESTOR_STEP);
    playNextInvestorStep(setState);
  }

  function playNextInvestorStep(setState) {
    if (refs.investorIdx >= investorPcms.length) {
      setState(ST.DONE);
      insertInvestorIntake();
      unlockMic();
      return;
    }

    const step = investorPcms[refs.investorIdx];
    playBuffer(step.buf, `Investor:${step.key}`, ST.WAIT_INVESTOR_ANSWER);
  }

  return {
    refs,
    startBuyerFlow,
    playNextBuyerStep,
    replayBuyerStep,
    advanceBuyerStep, // ✅ EXPORT THIS
    startSellerFlow,
    playNextSellerStep,
    startInvestorFlow,
    playNextInvestorStep,
  };
}
