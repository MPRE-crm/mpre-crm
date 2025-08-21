import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(
      'id, name, email, phone, bio, picture_url, facebook, instagram, linkedin, relocation_guide_url'
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('users/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
