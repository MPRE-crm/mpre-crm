import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  getActiveGuideUrl,
  MPRE_BOISE_ORG_ID,
} from "../../../../src/lib/guideAssets/getActiveGuideUrl";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadId = String(body.lead_id || "").trim();
    const forceResend = Boolean(body.force_resend);

    if (!leadId) {
      return NextResponse.json({ error: "Missing lead_id." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const readyStatuses = forceResend
      ? ["sent_by_email", "resent_by_email", "verified_ready_to_send"]
      : ["verified_ready_to_send"];

    const { data: claimedLead, error: claimError } = await supabaseAdmin
      .from("leads")
      .update({
        guide_delivery_status: forceResend ? "resending_guide" : "sending_guide",
        updated_at: nowIso,
      })
      .eq("id", leadId)
      .eq("phone_verified", true)
      .eq("email_verified", true)
      .in("guide_delivery_status", readyStatuses)
      .select(
        "id, org_id, first_name, last_name, email, phone_verified, email_verified, guide_delivery_status, guide_send_count"
      )
      .single();

    if (claimError || !claimedLead) {
      const { data: existingLead } = await supabaseAdmin
        .from("leads")
        .select("id, guide_delivery_status, guide_send_count")
        .eq("id", leadId)
        .single();

      return NextResponse.json({
        success: true,
        already_handled: true,
        message:
          existingLead?.guide_delivery_status === "sent_by_email" ||
          existingLead?.guide_delivery_status === "resent_by_email"
            ? "Guide was already sent."
            : "Guide is not ready to send or is already being sent.",
        guide_delivery_status: existingLead?.guide_delivery_status || null,
        guide_send_count: existingLead?.guide_send_count || 0,
      });
    }

    const guideUrl = await getActiveGuideUrl({
      orgId: claimedLead.org_id || MPRE_BOISE_ORG_ID,
      guideType: "relocation",
      fallbackUrl: process.env.RELOCATION_GUIDE_URL || null,
    });

    if (!guideUrl) {
      await supabaseAdmin
        .from("leads")
        .update({
          guide_delivery_status: forceResend ? "resend_failed" : "send_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      return NextResponse.json(
        { error: "No active relocation guide is configured for this organization." },
        { status: 500 }
      );
    }

    const firstName = claimedLead.first_name || "there";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "MPRE Boise <noreply@easyrealtor.homes>",
        reply_to: process.env.RESEND_REPLY_TO || "Mike Petras <mpetras@mpre.homes>",
        to: claimedLead.email,
        subject: "Your Boise relocation guide",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 560px; margin: 0 auto;">
            <p>Hi ${firstName},</p>

            <p>${
              forceResend
                ? "Here is the Boise relocation guide again."
                : "Here is the Boise relocation guide you requested."
            }</p>

            <p>
              <a href="${guideUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;">
                Download Guide
              </a>
            </p>

            <p>You can reply to this email if you have questions about the guide or your move.</p>

            <p style="margin-top:24px;">
              Thanks,<br />
              MPRE Boise<br />
              Homes of Idaho
            </p>

            <p style="font-size:12px;color:#6b7280;">
              You received this because you requested the Boise relocation guide from MPRE Boise.
              Equal Housing Opportunity.
            </p>
          </div>
        `,
        text: `Hi ${firstName},

${
  forceResend
    ? "Here is the Boise relocation guide again."
    : "Here is the Boise relocation guide you requested."
}

Download guide:
${guideUrl}

You can reply to this email if you have questions about the guide or your move.

Thanks,
MPRE Boise
Homes of Idaho
Equal Housing Opportunity
`,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Send guide Resend error:", resendError);

      await supabaseAdmin
        .from("leads")
        .update({
          guide_delivery_status: forceResend ? "resend_failed" : "send_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      return NextResponse.json(
        { error: "Guide email failed to send." },
        { status: 500 }
      );
    }

    const sentAtIso = new Date().toISOString();
    const sixMinutesFromNow = new Date(Date.now() + 6 * 60 * 1000).toISOString();
    const currentCount = Number(claimedLead.guide_send_count || 0);

    const leadUpdate: Record<string, any> = {
      guide_delivery_status: forceResend ? "resent_by_email" : "sent_by_email",
      guide_last_sent_at: sentAtIso,
      guide_send_count: currentCount + 1,
      call_status: forceResend ? "guide_resent" : "guide_sent",
      status: forceResend ? "Guide Resent" : "Guide Sent",
      updated_at: sentAtIso,
    };

    if (forceResend) {
      leadUpdate.next_contact_at = null;
    } else {
      leadUpdate.guide_sent_at = sentAtIso;
      leadUpdate.next_contact_at = sixMinutesFromNow;
    }

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update(leadUpdate)
      .eq("id", leadId);

    if (updateError) {
      console.error("Guide sent update error:", updateError);

      return NextResponse.json(
        { error: "Guide sent, but lead update failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      resent: forceResend,
      guide_url_source: "guide_assets",
      message: forceResend
        ? "Guide resent successfully."
        : "Guide sent successfully.",
    });
  } catch (error: any) {
    console.error("Send guide error:", error);

    return NextResponse.json(
      { error: error.message || "Server error." },
      { status: 500 }
    );
  }
}
