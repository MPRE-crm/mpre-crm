import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Needed for insert
);

export async function POST(req: Request) {
  try {
    const {
      name,
      phone,
      email,
      facebook_url,
      instagram_url,
      youtube_url,
      linkedin_url,
      bio,
      profile_picture_url,
      relocation_guide_url
    } = await req.json();

    const { data, error } = await supabase
      .from('users')
      .insert([{
        name,
        phone,
        email,
        facebook_url,
        instagram_url,
        youtube_url,
        linkedin_url,
        bio,
        profile_picture_url,
        relocation_guide_url
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, user: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
