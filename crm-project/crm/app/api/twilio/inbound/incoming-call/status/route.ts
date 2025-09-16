// crm-project/crm/app/api/twilio/inbound/incoming-call/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const data = new URLSearchParams(bodyText);

  const callSid = String(data.get("CallSid") || "");
  const status = String(data.get("CallStatus") || "");
  const from = String(data.get("From") || "");
  const to = String(data.get("To") || "");

  if (!callSid) return NextResponse.json({ ok: true });

  try {
    await supabase.from("call_logs").insert({
      call_sid: callSid,
      status,
      from_number: from,
      to_number: to,
      direction: "inbound",
      timestamp: new Date().toISOString(),
      raw_payload: Object.fromEntries(data.entries()),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("❌ inbound-call status error", e);
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}

export const GET = POST;
