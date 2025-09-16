import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);

  const from = params.get("From");
  const to = params.get("To");
  const body = params.get("Body");

  console.log("📩 Incoming SMS:", { from, to, body });

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Thanks! We got your message.</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

export const GET = POST;
