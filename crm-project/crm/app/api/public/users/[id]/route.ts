import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase'; // fixed path

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, bio, picture_url, facebook, instagram, linkedin, relocation_guide_url')
    .eq('id', id)
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
