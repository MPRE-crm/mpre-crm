import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const formData = await req.formData();

  const messageSid = formData.get('MessageSid') as string;
  const status = formData.get('MessageStatus') as string;

  if (!messageSid || !status) {
    return new Response('Missing data', { status: 400 });
  }

  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('twilio_sid', messageSid);

  if (error) {
    console.error('Failed to update status:', error.message);
    return new Response('Supabase error', { status: 500 });
  }

  return new Response('Status updated', { status: 200 });
}
