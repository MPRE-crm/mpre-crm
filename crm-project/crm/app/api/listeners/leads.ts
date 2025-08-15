import { supabaseServer } from "../../../lib/supabaseServer";

async function startLeadListener() {
  console.log("📡 Starting Supabase Realtime listener for new leads...");

  supabaseServer
    .channel("public:leads")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leads" },
      async (payload) => {
        const lead = payload.new;
        console.log("🎯 New lead detected:", lead);

        // Call your Twilio webhook handler directly
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/new-lead`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Webhook-Token": process.env.WEBHOOK_SHARED_SECRET!,
              },
              body: JSON.stringify(lead),
            }
          );

          if (!res.ok) {
            console.error("❌ Webhook failed", await res.text());
          } else {
            console.log("✅ Webhook sent successfully");
          }
        } catch (err) {
          console.error("🚨 Error sending webhook:", err);
        }
      }
    )
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
    });
}

// Ensure it starts only once in dev
if (!globalThis._leadListenerStarted) {
  startLeadListener();
  globalThis._leadListenerStarted = true;
}
