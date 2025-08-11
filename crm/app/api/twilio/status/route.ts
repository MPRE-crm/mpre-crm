// app/api/twilio/status/route.ts

import { supabase } from '../../../../lib/supabase'; // ✅ correct relative path

export async function POST(req: Request) {
  try {
    const ct = req.headers.get('content-type') || '';
    let messageSid: string | undefined;
    let status: string | undefined;

    if (ct.includes('application/x-www-form-urlencoded')) {
      const raw = await req.text();
      const params = new URLSearchParams(raw);
      messageSid = params.get('MessageSid') ?? params.get('SmsSid') ?? undefined;
      // Twilio may send MessageStatus or SmsStatus depending on resource
      status = params.get('MessageStatus') ?? params.get('SmsStatus') ?? undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      messageSid = body.MessageSid || body.SmsSid;
      status = body.MessageStatus || body.SmsStatus;
    }

    if (!messageSid || !status) {
      return new Response('Missing data', { status: 400 });
    }

    const { error } = await supabase
      .from('messages')
      .update({ status, twilio_sid: messageSid })
      .eq('twilio_sid', messageSid);

    if (error) {
      console.error('Failed to update status:', error.message);
      return new Response('Supabase error', { status: 500 });
    }

    return new Response('Status updated', { status: 200 });
  } catch (error: any) {
    console.error('Error handling status callback:', error);
    return new Response('Error processing request', { status: 500 });
  }
}

