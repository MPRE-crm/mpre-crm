// src/app/api/twilio/send/route.ts

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabase } from '@/lib/supabase';

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

export async function GET() {
  try {
    // Query for leads with appointments scheduled in the next 24-48 hours and not marked as attended
    const { data: leads, error: dbError } = await supabase
      .from('leads')  // Querying the 'leads' table
      .select('*')  // Select all columns from the leads table
      .gte('appointment_date', new Date().toISOString())  // Filter for future appointments
      .lte('appointment_date', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())  // Appointments within the next 48 hours
      .is('appointment_attended', null);  // Only select leads who have not yet attended the appointment

    if (dbError) {
      console.error("Database query error:", dbError.message);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ success: false, message: 'No upcoming appointments found' }, { status: 404 });
    }

    // Loop through leads and send SMS reminders
    for (const lead of leads) {
      const { first_name, appointment_date, appointment_time, phone_number } = lead;

      // Log phone number to check for missing or invalid phone numbers
      console.log('Phone number:', phone_number);

      // Skip leads with missing or invalid phone numbers
      if (!phone_number || !/^(\+\d{1,3}[- ]?)?\d{10}$/.test(phone_number)) {
        console.error(`Invalid or missing phone number for lead ${first_name}`);
        continue;  // Skip this lead if the phone number is invalid
      }

      // Create SMS message content
      const messageBody = `Hi ${first_name}, this is a reminder about your appointment scheduled for ${appointment_date} at ${appointment_time}. Please confirm if you can still make it!`;

      // Define the status callback URL for Twilio status updates
      const statusCallbackUrl = `https://24346ffb3096.ngrok-free.app/api/twilio/status`;  // Replace with your actual ngrok URL

      try {
        // Send SMS through Twilio
        const message = await client.messages.create({
          body: messageBody,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: phone_number,  // The phone number to which the SMS will be sent
          statusCallback: statusCallbackUrl,  // The URL where Twilio will send status updates
        });

        // Insert the message details into Supabase
        const { error: dbInsertError } = await supabase.from('messages').insert({
          lead_phone: phone_number,
          direction: 'outgoing',
          body: messageBody,
          status: 'queued',
          twilio_sid: message.sid,  // Store the Twilio SID
        });

        if (dbInsertError) {
          console.error("Error inserting into Supabase:", dbInsertError.message);
        }

      } catch (twilioError: unknown) {
        // Here we assert that twilioError is of type Error
        if (twilioError instanceof Error) {
          console.error("Error sending SMS via Twilio:", twilioError.message);
        } else {
          console.error("Unknown Twilio error occurred:", twilioError);
        }
      }
    }

    // Return success response
    return NextResponse.json({ success: true, message: 'Reminders sent successfully' });

  } catch (error: any) {
    console.error("Error sending reminders:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
