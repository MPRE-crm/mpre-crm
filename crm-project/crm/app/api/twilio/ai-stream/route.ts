import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // MUST be nodejs, not edge

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id"); // Using id passed as query parameter

    if (!id) {
      return new Response("Missing id", { status: 400 });
    }

    // Grab the lead source to decide where to send audio
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, lead_source")
      .eq("id", id) // Match by id
      .single();

    if (error || !lead) {
      console.error("ai-stream error:", error);
      return new Response("Lead not found", { status: 404 });
    }

    // Decide which sub-endpoint to use
    let subPath = "buyer-intake"; // default fallback

    if (lead.lead_source?.toLowerCase().includes("relocation")) {
      subPath = "buyer-intake/relocation-guide";
    }

    const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, "");
    if (!publicUrl) {
      return new Response("PUBLIC_URL not configured", { status: 500 });
    }

    // TwiML: tells Twilio to start a <Stream> to your media handler
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${publicUrl}/api/twilio/ai-media-stream/${subPath}?lead_id=${id}" />
  </Start>
  <Say>Connecting you now. Please hold for your AI assistant.</Say>
</Response>`;

    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err: any) {
    console.error("ai-stream unexpected error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
