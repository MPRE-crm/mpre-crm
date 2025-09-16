export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { persistInvestorIntake } from "../../../../lib/persistence/investor-intake";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const nowIso = new Date(Date.now() + 36e5).toISOString(); // +1h

  const res = await persistInvestorIntake({
    org_id: body.org_id || "2486c9e9-d0bc-4a3d-be91-9406c52d178c",
    lead_id: body.lead_id || "<PUT_REAL_LEAD_UUID>",
    call_sid: body.call_sid || "CA_TEST_123",
    price_cap: 750000,
    min_cap_rate: 6,
    cash_or_finance: "cash",
    units: 4,
    property_type: "2-4 MF",
    markets: "Boise; Meridian",
    wants_1031: true,
    timeline: "30-60 days",
    notes: "test seed",
    appointment_set: true,
    appointment_iso: nowIso,
    attendee_name: "Test Investor",
    attendee_phone: "+12085550123",
    attendee_email: "investor@test.com",
  });

  return NextResponse.json(res);
}
