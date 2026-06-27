import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

function getBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_URL ||
    process.env.CRM_BASE_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) return envUrl.replace(/\/$/, '');

  const url = new URL(req.url);
  return url.origin;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('Password recovery error: missing RESEND_API_KEY');
      return NextResponse.json(
        { ok: false, error: 'Password recovery email is not configured.' },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl(req);
    const redirectTo = `${baseUrl}/reset-password`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error('Password recovery generateLink error:', error);

      return NextResponse.json(
        { ok: false, error: error.message || 'Could not create recovery link.' },
        { status: 500 }
      );
    }

    const actionLink = data?.properties?.action_link;

    if (!actionLink) {
      console.error('Password recovery error: missing action_link', data);

      return NextResponse.json(
        { ok: false, error: 'Could not create recovery link.' },
        { status: 500 }
      );
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'EasyRealtor CRM <noreply@mpre.homes>',
        reply_to: process.env.RESEND_REPLY_TO || 'Mike Petras <mpetras@mpre.homes>',
        to: email,
        subject: 'Reset your CRM password',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 560px; margin: 0 auto;">
            <h2 style="margin-bottom: 12px;">Reset your CRM password</h2>

            <p>We received a request to reset your EasyRealtor CRM password.</p>

            <p>
              <a href="${actionLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
                Reset password
              </a>
            </p>

            <p>If the button does not work, copy and paste this link into your browser:</p>

            <p style="word-break: break-all;">
              <a href="${actionLink}">${actionLink}</a>
            </p>

            <p style="font-size: 13px; color: #6b7280;">
              If you did not request this reset, you can ignore this email.
            </p>
          </div>
        `,
        text: `Reset your CRM password:

${actionLink}

If you did not request this reset, you can ignore this email.`,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Password recovery Resend error:', resendError);

      return NextResponse.json(
        { ok: false, error: 'Could not send password recovery email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  } catch (error: any) {
    console.error('Password recovery route error:', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Password recovery failed.' },
      { status: 500 }
    );
  }
}


