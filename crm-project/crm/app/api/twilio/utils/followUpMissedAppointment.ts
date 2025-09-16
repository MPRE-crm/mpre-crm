// crm/app/api/twilio/followUpMissedAppointments.ts

import { supabase } from '../../../../lib/supabase';
import twilio from 'twilio';

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

// Helper to build display name
function displayName(first?: string, last?: string, fallback?: string) {
  const full = `${first || ''} ${last || ''}`.trim();
  return full || fallback || '';
}

export async function followUpMissedAppointment(leadId: string): Promise<void> {
  try {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, phone, phone_number, first_name, last_name, name')
      .eq('id', leadId)
      .single();

    if (leadError) {
      console.error('Error fetching lead:', leadError.message);
      return;
    }
    if (!lead) {
      console.error('Lead not found for id:', leadId);
      return;
    }

    const phone: string | undefined = lead.phone_number || lead.phone;
    const leadName: string = displayName(lead.first_name, lead.last_name, lead.name);

    if (!phone) {
      console.error('Lead has no phone number:', leadId);
      return;
    }

    const option1 = process.env.FOLLOWUP_OPTION_1 || 'Tomorrow 10:00 AM';
    const option2 = process.env.FOLLOWUP_OPTION_2 || 'Tomorrow 2:00 PM';
    const messageBody = `Hi ${leadName}, this is Samantha, your Boise real estate assistant. I noticed you missed your appointment today. Would you like to reschedule? Here are two options: 1) ${option1}  2) ${option2}. Reply with your choice!`;

    // Send SMS via Twilio
    await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    });

    // Optional AI call follow-up
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
    const callUrl =
      process.env.TWILIO_CALL_URL ||
      (base ? `${base}/api/voice?lead_id=${encodeURIComponent(leadId)}` : undefined);

    if (callUrl) {
      await client.calls.create({
        url: callUrl,
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER!,
      });
    } else {
      console.warn('Skipped AI call: set TWILIO_CALL_URL or NEXT_PUBLIC_APP_URL to enable.');
    }

    console.log(`Follow-up sent to ${leadName} via SMS${callUrl ? ' and AI call' : ''}.`);
  } catch (error) {
    console.error('Error following up on missed appointment:', error);
  }
}
