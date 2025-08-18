import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // avoid static optimization

// POST /api/email/send
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // { to, subject, html?, template?, variables? }
    console.log('Email stub:', body);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Optional: GET /api/email/send (helps Next treat file as a module and for quick checks)
export async function GET() {
  return NextResponse.json({ status: 'email send endpoint ready' });
}

