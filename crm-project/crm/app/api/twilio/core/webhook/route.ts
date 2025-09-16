// crm-project/crm/app/api/twilio/core/webhook/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio may send urlencoded or JSON
async function readBody(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function triggerViaFetch(req: NextRequest, id: string) {
  const origin = req.nextUrl.origin; // e.g. https://easyrealtor.homes
  await fetch(`${origin}/api/twilio/triggerAppointmentFlow`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function POST(req: NextRequest) {
  const body: any = await readBody(req);
  const id = body?.lead_id ?? body?.id;
  if (id) {
    await triggerViaFetch(req, String(id));
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("lead_id") ?? sp.get("id");
  if (id) {
    await triggerViaFetch(req, String(id));
  }
  return NextResponse.json({ ok: true });
}
