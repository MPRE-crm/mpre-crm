import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Build a server-side Supabase client (uses server vars if present, else NEXT_PUBLIC)
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET /api/public/users/:id
export async function GET(_req: Request, ctx: any) {
  const id = ctx?.params?.id as string;

  const { data, error } = await supabase
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

