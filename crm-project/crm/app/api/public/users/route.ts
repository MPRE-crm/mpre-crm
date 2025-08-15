import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase'; // fixed path

export async function GET() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, bio, picture_url, facebook, instagram, linkedin, relocation_guide_url');

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

