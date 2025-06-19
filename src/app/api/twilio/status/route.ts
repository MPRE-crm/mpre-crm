// src/app/api/twilio/status/route.ts

import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const messageSid = formData.get('MessageSid') as string;
    const status = formData.get('MessageStatus') as string;

    // Validate incoming data
    if (!messageSid || !status) {
      return new Response('Missing data', { status: 400 });
    }

    // Update the status of the message in the database
    const { error } = await supabase
      .from('messages')
      .update({ status })
      .eq('twilio_sid', messageSid);

    if (error) {
      console.error('Failed to update status:', error.message);
      return new Response('Supabase error', { status: 500 });
    }

    // Successfully updated status
    return new Response('Status updated', { status: 200 });

  } catch (error: any) {
    console.error('Error handling status callback:', error);
    return new Response('Error processing request', { status: 500 });
  }
}
