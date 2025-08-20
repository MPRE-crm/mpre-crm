import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to");

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' number" }, { status: 400 });
    }

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial(to);

    return new Response(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err: any) {
    console.error("Error in /voice/forward:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
