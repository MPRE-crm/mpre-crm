// crm-project/crm/app/api/twilio/inbound/opening-intake/route.ts
// Handles Samantha’s initial greeting before routing to buyer/seller/investor flows.

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

// ✅ Import Samantha’s opening prompt
import SAMANTHA_OPENING_TRIAGE from "../../../../lib/prompts/opening.js";

/**
 * ENV
 * NEXT_PUBLIC_URL – your public HTTPS base (e.g. https://charismatic-liberation-production.up.railway.app)
 */

export async function POST(req: NextRequest) {
  try {
    const baseUrl =
      process.env.PUBLIC_URL ||
      "https://charismatic-liberation-production.up.railway.app";

    // 👇 TwiML tells Twilio to start streaming the call audio to your bridge server
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${baseUrl.replace(/\/$/, "")}/bridge" />
  </Start>
  <Say voice="Polly.Joanna">Connecting you to Samantha now.</Say>
</Response>`;

    // ✅ Include the encoded opening prompt as metadata for the bridge
    const meta = Buffer.from(
      JSON.stringify({
        opening: SAMANTHA_OPENING_TRIAGE,
        stage: "opening",
      })
    ).toString("base64");

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
        "x-twilio-meta": meta,
      },
    });
  } catch (err) {
    console.error("opening-intake TwiML error:", err);
    return NextResponse.json(
      { error: "TwiML generation failed" },
      { status: 500 }
    );
  }
}

// ✅ Required so Next.js recognizes this as a valid route module
export const GET = POST;
