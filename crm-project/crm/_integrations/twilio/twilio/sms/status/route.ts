export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";

function asParams(text: string) {
  return new URLSearchParams(text);
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    const params = ct.includes("application/x-www-form-urlencoded")
      ? asParams(await req.text())
      : new URLSearchParams();

    const payload = {
      MessageSid: params.get("MessageSid"),
      MessageStatus: params.get("MessageStatus"), // queued|sent|delivered|undelivered|failed
      To: params.get("To"),
      From: params.get("From"),
      ErrorCode: params.get("ErrorCode"),
    };

    console.log("[twilio/sms/status]", payload);
    // TODO: persist if you track delivery receipts

    return new NextResponse("", { status: 204 });
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
}
