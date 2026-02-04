// webrtc-samantha/lib/audio/pcms.js
import { loadPcm } from "./pcmLoader.js";

export function loadAllPcms(__dirname) {
  const opening1Pcm = loadPcm(__dirname, "greetings/opening1-mpre-residential.pcm");
  const opening2Pcm = loadPcm(__dirname, "greetings/mpre-boise-greeting.pcm");

  const buyerPcms = [
    { key: "contact1-name", buf: loadPcm(__dirname, "greetings/buyer-intake/contact1-name.pcm") },
    { key: "contact2-email", buf: loadPcm(__dirname, "greetings/buyer-intake/contact2-email.pcm") },
    { key: "contact3-phone", buf: loadPcm(__dirname, "greetings/buyer-intake/contact3-phone.pcm") },

    { key: "contact4-questions", buf: loadPcm(__dirname, "greetings/buyer-intake/contact4-questions.pcm") },

    { key: "lp-1-location", buf: loadPcm(__dirname, "greetings/buyer-intake/lp-1-location.pcm") },
    { key: "lp-2-price", buf: loadPcm(__dirname, "greetings/buyer-intake/lp-2-price.pcm") },
    { key: "lp-3-motivation", buf: loadPcm(__dirname, "greetings/buyer-intake/lp-3-motivation.pcm") },
    { key: "lp-4-agent", buf: loadPcm(__dirname, "greetings/buyer-intake/lp-4-agent.pcm") },
    { key: "lp-5-mortgage", buf: loadPcm(__dirname, "greetings/buyer-intake/lp-5-mortgage.pcm") },
    { key: "appointment", buf: loadPcm(__dirname, "greetings/buyer-intake/appointment.pcm") },
    { key: "close", buf: loadPcm(__dirname, "greetings/buyer-intake/close.pcm") },
  ];

  const sellerPcms = [
    { key: "s01-contact-name", buf: loadPcm(__dirname, "greetings/seller-intake/s01-contact-name.pcm") },
    { key: "s02-contact-phone", buf: loadPcm(__dirname, "greetings/seller-intake/s02-contact-phone.pcm") },
    { key: "s03-contact-email", buf: loadPcm(__dirname, "greetings/seller-intake/s03-contact-email.pcm") },
    { key: "s04-property", buf: loadPcm(__dirname, "greetings/seller-intake/s04-property.pcm") },
    { key: "s05-property", buf: loadPcm(__dirname, "greetings/seller-intake/s05-property.pcm") },
    { key: "s06-timeline", buf: loadPcm(__dirname, "greetings/seller-intake/s06-timeline.pcm") },
    { key: "s07-motivation", buf: loadPcm(__dirname, "greetings/seller-intake/s07-motivation.pcm") },
    { key: "s08-agent-status", buf: loadPcm(__dirname, "greetings/seller-intake/s08-agent-status.pcm") },
    { key: "s09-appointment", buf: loadPcm(__dirname, "greetings/seller-intake/s09-appointment.pcm") },
    { key: "s10-close", buf: loadPcm(__dirname, "greetings/seller-intake/s10-close.pcm") },
  ];

  const investorPcms = [
    { key: "i01-contact-name", buf: loadPcm(__dirname, "greetings/investor-intake/i01-contact-name.pcm") },
    { key: "i02-contact-phone", buf: loadPcm(__dirname, "greetings/investor-intake/i02-contact-phone.pcm") },
    { key: "i03-contact-email", buf: loadPcm(__dirname, "greetings/investor-intake/i03-contact-email.pcm") },
    { key: "i04-market-focus", buf: loadPcm(__dirname, "greetings/investor-intake/i04-market-focus.pcm") },
    { key: "i05-property-type", buf: loadPcm(__dirname, "greetings/investor-intake/i05-property-type.pcm") },
    { key: "i06-units-budget", buf: loadPcm(__dirname, "greetings/investor-intake/i06-units-budget.pcm") },
    { key: "i07-capital-structure", buf: loadPcm(__dirname, "greetings/investor-intake/i07-capital-structure.pcm") },
    { key: "i08-goals-returns", buf: loadPcm(__dirname, "greetings/investor-intake/i08-goals-returns.pcm") },
    { key: "i09-timeline-experience", buf: loadPcm(__dirname, "greetings/investor-intake/i09-timeline-experience.pcm") },
    { key: "i10-appointment", buf: loadPcm(__dirname, "greetings/investor-intake/i10-appointment.pcm") },
    { key: "i11-close", buf: loadPcm(__dirname, "greetings/investor-intake/i11-close.pcm") },
  ];

  // ✅ INBOUND ONLY. Outbound loaders live in their own files.
  return {
    opening1Pcm,
    opening2Pcm,
    buyerPcms,
    sellerPcms,
    investorPcms,
  };
}
