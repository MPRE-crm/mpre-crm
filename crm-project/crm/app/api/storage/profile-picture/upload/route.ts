import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase'; // fixed relative path

export async function POST(req: Request) {
  try {
    const formData: any = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json({ error: 'File or userId missing' }, { status: 400 });
    }

    // Upload the file to Supabase storage
    const fileName = `${userId}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);

    // Update user record with new picture URL
    const { error: updateError } = await supabase
      .from('users')
      .update({ picture_url: publicUrlData.publicUrl })
      .eq('id', userId);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

