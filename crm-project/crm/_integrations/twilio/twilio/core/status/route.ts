// crm-project/crm/app/api/twilio/core/status/route.ts
import { createClient } from "@supabase/supabase-js";

// ✅ Force Node runtime
export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    let messageSid: string | undefined;
    let status: string | undefined;

    if (ct.includes("application/x-www-form-urlencoded")) {
      const raw = await req.text();
      const params = new URLSearchParams(raw);
      messageSid = params.get("MessageSid") ?? params.get("SmsSid") ?? undefined;
      status =
        params.get("MessageStatus") ??
        params.get("SmsStatus") ??
        undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      messageSid = body.MessageSid || body.SmsSid;
      status = body.MessageStatus || body.SmsStatus;
    }

    if (!messageSid || !status) {
      return new Response("Missing data", { status: 400 });
    }

    const { error } = await supabase
      .from("messages")
      .update({ status, twilio_sid: messageSid })
      .eq("twilio_sid", messageSid);

    if (error) {
      console.error("Failed to update status:", error.message);
      return new Response("Supabase error", { status: 500 });
    }

    return new Response("Status updated", { status: 200 });
  } catch (error: any) {
    console.error("Error handling status callback:", error);
    return new Response("Error processing request", { status: 500 });
  }
}

// ✅ Ensure module exports at least one handler
export const GET = POST;
