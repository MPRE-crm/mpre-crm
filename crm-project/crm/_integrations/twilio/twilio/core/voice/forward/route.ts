// crm-project/crm/app/api/twilio/core/voice/forward/route.ts
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs"; // ✅ force Node runtime

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to");

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' number" }, { status: 400 });
    }

    const twiml = new twilio.twiml.VoiceResponse();
    // ✅ Forward the call safely
    twiml.dial({ callerId: process.env.TWILIO_CALLER_ID || undefined }, to);

    return new Response(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err: any) {
    console.error("[voice/forward] Error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// ✅ Fallback GET handler
export const GET = POST;
