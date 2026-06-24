import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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
    const { data: members, error: membersError } = await supabaseAdmin
      .from("rotation_members")
      .select("id, user_id, last_assigned_at, created_at")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("last_assigned_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error(
        "Relocation rotation members lookup failed, using fallback agent:",
        membersError
      );

      return fallbackAgentId;
    }

    const memberUserIds = (members || [])
      .map((member) => member.user_id)
      .filter(Boolean);

    if (!memberUserIds.length) {
      console.error(
        "No active relocation rotation members found, using fallback agent."
      );

      return fallbackAgentId;
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, user_id, name, email, phone, role, is_active")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .in("id", memberUserIds);

    if (usersError) {
      console.error(
        "Relocation rotation users lookup failed, using fallback agent:",
        usersError
      );

      return fallbackAgentId;
    }

    const activeUsersById = new Map(
      (users || []).map((user) => [user.id, user])
    );

    const selectedMember = (members || []).find((member) =>
      activeUsersById.has(member.user_id)
    );

    if (!selectedMember) {
      console.error(
        "No usable relocation rotation user found, using fallback agent."
      );

      return fallbackAgentId;
    }

    const selectedUser = activeUsersById.get(selectedMember.user_id);

    if (!selectedUser?.user_id) {
      console.error(
        "Selected rotation member has no profile user_id, using fallback agent."
      );

      return fallbackAgentId;
    }

    const { error: rotationTouchError } = await supabaseAdmin
      .from("rotation_members")
      .update({
        last_assigned_at: new Date().toISOString(),
      })
      .eq("id", selectedMember.id);

    if (rotationTouchError) {
      console.error("Relocation rotation touch failed:", rotationTouchError);
    }

    return selectedUser.user_id;
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
      "Assignment method: direct rotation_members lookup with environment fallback.",
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

    const phoneVerifyUrl = `${siteUrl}/v/p/${phoneToken}`;
    const emailVerifyUrl = `${siteUrl}/v/e/${emailToken}`;

    await twilioClient.messages.create({
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: `MPRE Boise: verify your phone for the Boise relocation guide. ${phoneVerifyUrl} Reply STOP to opt out.`,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "MPRE Boise <noreply@easyrealtor.homes>",
        reply_to: process.env.RESEND_REPLY_TO || "Mike Petras <mpetras@mpre.homes>",
        to: email,
        subject: "Verify your email for your Boise relocation guide",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2>Verify your email</h2>
            <p>Thanks for requesting the 2026 Boise Idaho Area Relocation Guide. Please confirm your email so we can send it over.</p>
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
        text: `Thanks for requesting the 2026 Boise Idaho Area Relocation Guide. Confirm your email here: ${emailVerifyUrl}`,
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