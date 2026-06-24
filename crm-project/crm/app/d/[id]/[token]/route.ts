import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; token: string }> }
) {
  const { id, token } = await context.params
  const url = new URL('/api/appointments/agent-decline', req.nextUrl.origin)
  url.searchParams.set('id', id)
  url.searchParams.set('token', token)
  return NextResponse.redirect(url)
}
