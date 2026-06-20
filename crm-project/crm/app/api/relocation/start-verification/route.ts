import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getNextAssignee } from "../../../../lib/rotation/getNextAssignee";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function makeToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getRotationAgentProfileId(args: {
  orgId: string;
  fallbackAgentId: string;
}) {
  const { orgId, fallbackAgentId } = args;

  try {
    const assignee = await getNextAssignee(orgId);

    if (!assignee?.user_id) {
      return fallbackAgentId;
    }

        const { error: rotationTouchError } = await supabaseAdmin
      .from("rotation_members")
      .update({
        last_assigned_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("user_id", assignee.user_id);

    if (rotationTouchError) {
      console.error(
        "Relocation rotation touch failed:",
        rotationTouchError
      );
    }

    const { data: rotationUser, error: rotationUserError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("id", assignee.user_id)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (rotationUserError) {
      console.error(
        "Relocation rotation user lookup failed, using fallback agent:",
        rotationUserError
      );
      return fallbackAgentId;
    }

    return rotationUser?.user_id || fallbackAgentId;
  } catch (rotationError) {
    console.error(
      "Relocation rotation lookup failed, using fallback agent:",
      rotationError
    );
    return fallbackAgentId;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const first_name = String(body.first_name || "").trim();
    const last_name = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const move_timeline = String(body.move_timeline || "").trim();
    const price_range = String(body.price_range || "").trim();
    const consent = Boolean(body.consent);

    const orgId =
      process.env.MPRE_BOISE_ORG_ID ||
      process.env.DEFAULT_RELOCATION_ORG_ID;

    const fallbackAgentId =
      process.env.MPRE_BOISE_DEFAULT_AGENT_ID ||
      process.env.DEFAULT_RELOCATION_AGENT_ID;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    if (!fallbackAgentId || !orgId) {
      return NextResponse.json(
        { error: "Missing relocation agent/org environment variables." },
        { status: 500 }
      );
    }

    if (!first_name || !last_name || !phone || !email || !consent) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const agentId = await getRotationAgentProfileId({
      orgId,
      fallbackAgentId,
    });

    if (!agentId) {
      return NextResponse.json(
        { error: "No relocation agent available." },
        { status: 500 }
      );
    }

    const phoneToken = makeToken();
    const emailToken = makeToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const notes = [
      "Lead submitted from MPRE Boise relocation landing page.",
      "Source platform: EasyRealtor CRM",
      "Public brand: MPRE Boise with Homes of Idaho",
      "Guide delivery status: pending_verification",
      "Phone verified: false",
      "Email verified: false",
      `TCPA consent given: ${consent ? "Yes" : "No"}`,
      `TCPA consent timestamp: ${new Date().toISOString()}`,
      `Move timeline: ${move_timeline || "Not provided yet"}`,
      `Price range: ${price_range || "Not provided yet"}`,
      `Assigned agent profile ID: ${agentId}`,
      "Assignment method: rotation with environment fallback.",
      "Consent language shown: I agree to receive calls, texts, and emails from MPRE Boise with Homes of Idaho about my real estate inquiry, including automated follow-up. Consent is not required to buy or sell real estate. Message/data rates may apply. Reply STOP to opt out.",
      "Verification message shown: We verify your phone and email before sending the guide so fake submissions do not trigger delivery.",
    ].join("\n");

    const { data: lead, error: insertError } = await supabaseAdmin
      .from("leads")
      .insert({
        first_name,
        last_name,
        phone,
        email,
        agent_id: agentId,
        org_id: orgId,
        status: "Unverified Lead",
        lead_source: "MPRE Boise Relocation Landing Page",
        source: "relocation_landing_page",
        move_timeline,
        price_range,
        notes,
        call_status: "pending_verification",
        do_not_call: false,
        appointment_requested: false,
        appointment_attended: false,
        callback_requested: false,
        wants_home_search: true,
        wants_agent_call: false,
        wants_lender_connection: false,
        lead_heat: "warm",
        best_contact_channel: "sms",
        phone_verified: false,
        email_verified: false,
        guide_delivery_status: "pending_verification",
        guide_send_count: 0,
        verification_attempts: 0,
        phone_verification_code: phoneToken,
        email_verification_code: emailToken,
        verification_code_expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Lead insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    const phoneVerifyUrl = `${siteUrl}/api/relocation/verify?lead_id=${lead.id}&type=phone&token=${phoneToken}`;
    const emailVerifyUrl = `${siteUrl}/api/relocation/verify?lead_id=${lead.id}&type=email&token=${emailToken}`;

    await twilioClient.messages.create({
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: `Tap to verify your phone and unlock the MPRE Boise relocation guide: ${phoneVerifyUrl} Reply STOP to opt out.`,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyRealtor <noreply@easyrealtor.homes>",
        to: email,
        subject: "Verify your email for the Boise Idaho Relocation Guide",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2>Verify Your Email</h2>
            <p>Click the button below to verify your email and unlock your 2026 Boise Idaho Area Relocation Guide.</p>
            <p>
              <a href="${emailVerifyUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;">
                Verify My Email
              </a>
            </p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p>${emailVerifyUrl}</p>
            <p>MPRE Boise with Homes of Idaho</p>
            <p style="font-size:12px;color:#6b7280;">You received this because you requested the Boise Idaho Area Relocation Guide.</p>
          </div>
        `,
        text: `Verify your email for the 2026 Boise Idaho Area Relocation Guide: ${emailVerifyUrl}`,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Resend error:", resendError);

      return NextResponse.json(
        {
          error:
            "Lead saved, but email verification failed to send. Check Resend settings.",
          lead_id: lead.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      assigned_agent_id: agentId,
      message: "Verification links sent.",
    });
  } catch (error: any) {
    console.error("Start verification error:", error);

    return NextResponse.json(
      { error: error.message || "Server error." },
      { status: 500 }
    );
  }
}