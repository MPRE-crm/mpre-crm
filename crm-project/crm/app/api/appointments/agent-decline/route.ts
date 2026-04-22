export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function html(message: string) {
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Appointment Declined</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      .card { max-width: 720px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 24px; }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Appointment Declined</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const reason = searchParams.get("reason") || "Agent declined";

    if (!id) {
      return html("Missing approval id.");
    }

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("appointment_approvals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (approvalError || !approval) {
      return html("Appointment approval request not found.");
    }

    if (approval.status === "accepted") {
      return html("This appointment request was already accepted.");
    }

    if (approval.status === "declined") {
      return html("This appointment request was already declined.");
    }

    if (approval.status === "expired") {
      return html("This appointment request has already expired.");
    }

    if (approval.status !== "pending") {
      return html(`This appointment request is no longer actionable. Current status: ${approval.status}.`);
    }

    const nowIso = new Date().toISOString();

    await supabaseAdmin
      .from("appointment_approvals")
      .update({
        status: "declined",
        declined_at: nowIso,
        decline_reason: reason,
        updated_at: nowIso,
      })
      .eq("id", approval.id);

    await supabaseAdmin
      .from("leads")
      .update({
        appointment_status: "Declined",
        appointment_decline_reason: reason,
        appointment_pending_agent_id: null,
        appointment_pending_expires_at: null,
        updated_at: nowIso,
      })
      .eq("id", approval.lead_id);

    return html("Appointment request declined. Rotation/fallback logic can proceed next.");
  } catch (error: any) {
    console.error("❌ agent-decline route error", error);
    return html(`Failed to decline appointment: ${error.message}`);
  }
}