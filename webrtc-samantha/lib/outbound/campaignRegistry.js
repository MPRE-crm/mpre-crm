// webrtc-samantha/lib/outbound/campaignRegistry.js

// Cancelled Listing
import { loadOutboundCancelledPcms } from "../audio/pcmsOutboundCancelled.js";
import { createCancelledListingFlow } from "../flows/outboundCancelledFlow.js";

// FSBO (stub for now – you’ll add these when ready)
// import { loadOutboundFsboPcms } from "../audio/pcmsOutboundFsbo.js";
// import { createFsboFlow } from "../flows/outboundFsboFlow.js";

export function getOutboundCampaign(campaign) {
  switch (campaign) {
    case "cancelled":
      return {
        pcms: loadOutboundCancelledPcms(),
        createFlow: createCancelledListingFlow,
      };

    // case "fsbo":
    //   return {
    //     pcms: loadOutboundFsboPcms(),
    //     createFlow: createFsboFlow,
    //   };

    default:
      throw new Error(`❌ Unknown outbound campaign: ${campaign}`);
  }
}
