import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadId = String(body.lead_id || "").trim();

    const guideUrl = process.env.RELOCATION_GUIDE_URL;

    if (!guideUrl) {
      return NextResponse.json(
        { error: "Missing RELOCATION_GUIDE_URL environment variable." },
        { status: 500 }
      );
    }

    if (!leadId) {
      return NextResponse.json(
        { error: "Missing lead_id." },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(
        "id, first_name, last_name, email, phone_verified, email_verified, guide_delivery_status, guide_send_count"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    if (!lead.phone_verified || !lead.email_verified) {
      return NextResponse.json(
        { error: "Phone and email must both be verified before sending guide." },
        { status: 400 }
      );
    }

    if (lead.guide_delivery_status === "sent_by_email") {
      return NextResponse.json({
        success: true,
        already_sent: true,
        message: "Guide was already sent.",
      });
    }

    const firstName = lead.first_name || "there";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyRealtor <noreply@easyrealtor.homes>",
        to: lead.email,
        subject: "Your 2026 Boise Idaho Area Relocation Guide",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0 auto;">
            <h2>Your 2026 Boise Idaho Area Relocation Guide</h2>

            <p>Hi ${firstName},</p>

            <p>Thanks for verifying your phone and email. You can download your 2026 Boise Idaho Area Relocation Guide using the button below.</p>

            <p>
              <a href="${guideUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;">
                Download The Relocation Guide
              </a>
            </p>

            <p>If the button does not work, copy and paste this link into your browser:</p>

            <p>
              <a href="${guideUrl}">${guideUrl}</a>
            </p>

            <p>If this email landed in spam or junk, please move it to your inbox so you do not miss follow-up information.</p>

            <p>Samantha may follow up to make sure you received the guide and help narrow down areas, timing, home search options, and next steps.</p>

            <p>
              MPRE Boise with Homes of Idaho<br />
              Boise, Idaho Real Estate
            </p>

            <p style="font-size:12px;color:#6b7280;">
              You received this because you requested the Boise Idaho Area Relocation Guide.
              Real estate services provided by MPRE Boise with Homes of Idaho.
              Equal Housing Opportunity.
            </p>
          </div>
        `,
        text: `
Hi ${firstName},

Thanks for verifying your phone and email.

Download your 2026 Boise Idaho Area Relocation Guide here:
${guideUrl}

If this email landed in spam or junk, please move it to your inbox so you do not miss follow-up information.

Samantha may follow up to make sure you received the guide and help narrow down areas, timing, home search options, and next steps.

MPRE Boise with Homes of Idaho
Boise, Idaho Real Estate
Equal Housing Opportunity
        `.trim(),
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Send guide Resend error:", resendError);

      await supabaseAdmin
        .from("leads")
        .update({
          guide_delivery_status: "send_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      return NextResponse.json(
        { error: "Guide email failed to send." },
        { status: 500 }
      );
    }

    const nowIso = new Date().toISOString();
    const currentCount = Number(lead.guide_send_count || 0);

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        guide_delivery_status: "sent_by_email",
        guide_sent_at: nowIso,
        guide_last_sent_at: nowIso,
        guide_send_count: currentCount + 1,
        call_status: "guide_sent",
        status: "Guide Sent",
        updated_at: nowIso,
      })
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
      message: "Guide sent successfully.",
    });
  } catch (error: any) {
    console.error("Send guide error:", error);

    return NextResponse.json(
      { error: error.message || "Server error." },
      { status: 500 }
    );
  }
}