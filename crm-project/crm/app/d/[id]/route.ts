import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const url = new URL('/api/appointments/agent-decline', req.nextUrl.origin)
  url.searchParams.set('id', id)
  return NextResponse.redirect(url)
}
