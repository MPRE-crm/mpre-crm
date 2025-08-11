// app/api/twilio/send/route.ts

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabase } from '../../../../lib/supabase'; // ✅ fixed path

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

export async function GET() {
  try {
    // Query for leads with appointments in the next 48 hours and not marked attended
    const { data: leads, error: dbError } = await supabase
      .from('leads')
      .select('*')
      .gte('appointment_date', new Date().toISOString())
      .lte(
        'appointment_date',
        new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      )
      .is('appointment_attended', null);

    if (dbError) {
      console.error('Database query error:', dbError.message);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No upcoming appointments found' },
        { status: 404 }
      );
    }

    // Prefer env for callback; fall back to your placeholder if not set
    const statusCallbackUrl =
      process.env.TWILIO_STATUS_CALLBACK_URL ||
      'https://24346ffb3096.ngrok-free.app/api/twilio/status';

    for (const lead of leads) {
      const first_name: string = lead.first_name || lead.name || 'there';
      const phone_number: string | undefined = lead.phone_number || lead.phone;

      // Log phone number to check for missing/invalid numbers
      console.log('Phone number:', phone_number);

      // Simple validation; ideally ensure E.164 (+1...) in your DB
      if (!phone_number || !/^(\+\d{1,3}[- ]?)?\d{10}$/.test(phone_number)) {
        console.error(`Invalid or missing phone number for lead ${first_name}`);
        continue;
      }

      const messageBody = `Hi ${first_name}, this is a reminder about your appointment scheduled for ${lead.appointment_date} at ${lead.appointment_time}. Please confirm if you can still make it!`;

      try {
        // Send SMS via Twilio
        const message = await client.messages.create({
          body: messageBody,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: phone_number,
          statusCallback: statusCallbackUrl,
        });

        // Log the outgoing message
        const { error: dbInsertError } = await supabase.from('messages').insert({
          lead_phone: phone_number,
          direction: 'outgoing',
          body: messageBody,
          status: 'queued',
          twilio_sid: message.sid,
        });

        if (dbInsertError) {
          console.error('Error inserting into Supabase:', dbInsertError.message);
        }
      } catch (twilioError: unknown) {
        if (twilioError instanceof Error) {
          console.error('Error sending SMS via Twilio:', twilioError.message);
        } else {
          console.error('Unknown Twilio error occurred:', twilioError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Reminders sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
