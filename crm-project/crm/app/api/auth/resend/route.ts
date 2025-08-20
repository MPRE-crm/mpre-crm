import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST() {
  // Uses service role (admin) client under the hood
  const { error } = await supabaseAdmin.auth.resend({
    type: 'signup',
    email: 'mpetras@mpre.homes',
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
