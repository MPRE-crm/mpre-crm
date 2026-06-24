import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; token: string }> }
) {
  const { type, token } = await context.params

  const verifyType =
    type === 'p' ? 'phone' :
    type === 'e' ? 'email' :
    ''

  const codeColumn =
    verifyType === 'phone' ? 'phone_verification_code' :
    verifyType === 'email' ? 'email_verification_code' :
    ''

  if (!verifyType || !codeColumn || !token) {
    return NextResponse.redirect(new URL('/relocation/verify?status=error', req.nextUrl.origin))
  }

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq(codeColumn, token)
    .maybeSingle()

  if (!lead?.id) {
    return NextResponse.redirect(new URL('/relocation/verify?status=error', req.nextUrl.origin))
  }

  const url = new URL('/api/relocation/verify', req.nextUrl.origin)
  url.searchParams.set('lead_id', lead.id)
  url.searchParams.set('type', verifyType)
  url.searchParams.set('token', token)

  return NextResponse.redirect(url)
}
