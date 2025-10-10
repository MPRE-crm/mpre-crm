// crm-project/crm/app/api/twilio/inbound/opening-intake/route.ts
// Handles Samantha’s initial greeting before routing to buyer/seller/investor flows.

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import SAMANTHA_OPENING_TRIAGE from "../../../../lib/prompts/opening.js";

/**
 * ENV
 * PUBLIC_URL – your public HTTPS base (e.g. https://charismatic-liberation-production.up.railway.app)
 */

export async function POST(req: NextRequest) {
  try {
    const baseUrl =
      process.env.PUBLIC_URL ||
      "https://charismatic-liberation-production.up.railway.app";

    // ✅ Encode Samantha's opening prompt and stage metadata
    const meta_b64 = Buffer.from(
      JSON.stringify({
        opening: SAMANTHA_OPENING_TRIAGE,
        stage: "opening",
      })
    ).toString("base64");

    // ✅ Proper TwiML: metadata embedded directly inside <Parameter>
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${baseUrl.replace(/\/$/, "")}/bridge">
      <Parameter name="meta_b64" value="${meta_b64}" />
    </Stream>
  </Start>
  <Say voice="Polly.Joanna">Connecting you to Samantha now.</Say>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("opening-intake TwiML error:", err);
    return NextResponse.json(
      { error: "TwiML generation failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;
