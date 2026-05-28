import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const leadId = url.searchParams.get("lead_id");
  const type = url.searchParams.get("type");
  const token = url.searchParams.get("token");

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  if (!leadId || !type || !token) {
    return NextResponse.redirect(
      `${siteUrl}/relocation/verify?status=error&message=missing`
    );
  }

  if (type !== "phone" && type !== "email") {
    return NextResponse.redirect(
      `${siteUrl}/relocation/verify?status=error&message=bad_type`
    );
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select(
      "id, phone_verified, email_verified, phone_verification_code, email_verification_code, verification_code_expires_at, guide_delivery_status"
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return NextResponse.redirect(
      `${siteUrl}/relocation/verify?status=error&message=not_found`
    );
  }

  const expiresAt = lead.verification_code_expires_at
    ? new Date(lead.verification_code_expires_at).getTime()
    : 0;

  if (!expiresAt || Date.now() > expiresAt) {
    return NextResponse.redirect(
      `${siteUrl}/relocation/verify?status=error&message=expired`
    );
  }

  const expectedToken =
    type === "phone"
      ? lead.phone_verification_code
      : lead.email_verification_code;

  if (token !== expectedToken) {
    return NextResponse.redirect(
      `${siteUrl}/relocation/verify?status=error&message=invalid`
    );
  }

  const nowIso = new Date().toISOString();

  const phoneWillBeVerified = type === "phone" ? true : lead.phone_verified;
  const emailWillBeVerified = type === "email" ? true : lead.email_verified;
  const bothVerified = phoneWillBeVerified && emailWillBeVerified;

  const alreadySent = lead.guide_delivery_status === "sent_by_email";
  const alreadySending = lead.guide_delivery_status === "sending_guide";

  const updateData: any = {
    updated_at: nowIso,
  };

  if (type === "phone" && !lead.phone_verified) {
    updateData.phone_verified = true;
    updateData.phone_verified_at = nowIso;
  }

  if (type === "email" && !lead.email_verified) {
    updateData.email_verified = true;
    updateData.email_verified_at = nowIso;
  }

  if (bothVerified && !alreadySent && !alreadySending) {
    updateData.status = "Verified Lead";
    updateData.call_status = "verified_pending_guide";
    updateData.guide_delivery_status = "verified_ready_to_send";
  }

  const { error: updateError } = await supabaseAdmin
    .from("leads")
    .update(updateData)
    .eq("id", leadId);

  if (updateError) {
    console.error("Verification update error:", updateError);
    return NextResponse.redirect(
      `${siteUrl}/relocation/verify?status=error&message=update_failed`
    );
  }

  if (bothVerified && !alreadySent && !alreadySending) {
    try {
      const sendGuideResponse = await fetch(
        `${siteUrl}/api/relocation/send-guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lead_id: leadId,
          }),
        }
      );

      if (!sendGuideResponse.ok) {
        const sendGuideError = await sendGuideResponse.text();
        console.error("Send guide failed:", sendGuideError);

        return NextResponse.redirect(
          `${siteUrl}/relocation/verify?status=success&type=${type}&complete=true&guide=failed`
        );
      }
    } catch (error) {
      console.error("Send guide request error:", error);

      return NextResponse.redirect(
        `${siteUrl}/relocation/verify?status=success&type=${type}&complete=true&guide=failed`
      );
    }
  }

  return NextResponse.redirect(
    `${siteUrl}/relocation/verify?status=success&type=${type}&complete=${
      bothVerified ? "true" : "false"
    }`
  );
}