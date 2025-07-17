// src/app/api/twilio/followUpMissedAppointment.ts

import { supabase } from '@/lib/supabase';
import twilio from 'twilio';

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

export async function followUpMissedAppointment(leadId: string) {
  try {
    // Query for the missed appointment
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) {
      console.error("Error fetching lead:", leadError.message);
      return;
    }

    // Get lead's phone number and status
    const { phone_number, first_name } = lead;

    // Send the first SMS and AI call
    const messageBody = `Hi ${first_name}, this is Samantha, your Boise real estate assistant. I noticed you missed your appointment today. Would you like to reschedule? Here are two options: 1) [Option 1] 2) [Option 2]. Reply with your choice!`;

    // Send SMS via Twilio
    await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone_number,
    });

    // Trigger AI call through Twilio (you can use Twilio Studio or Autopilot for AI calls)
    await client.calls.create({
      url: `https://your-ngrok-url/call-script`, // Use your call script URL here
      to: phone_number,
      from: process.env.TWILIO_PHONE_NUMBER!,
    });

    console.log(`Follow-up sent to ${first_name} via SMS and AI call.`);
    
  } catch (error) {
    console.error("Error following up on missed appointment:", error);
  }
}
