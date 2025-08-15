import { supabase } from '../../../lib/supabase';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { validate as uuidValidate } from 'uuid';  // Import uuid validate

// Helper to build display name
function displayName(first, last, fallback) {
  const full = `${first || ''} ${last || ''}`.trim();
  return full || fallback || '';
}

// Trigger Twilio Appointment Flow
async function triggerAppointmentFlow(id) {
  try {
    // Fetch lead details from Supabase
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone, first_name, last_name, name') // include new fields + generated column
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      console.error('Error fetching lead details:', leadError);
      return;
    }

    const restApiUrl = 'https://studio.twilio.com/v2/Flows/FW88d76c8c4a90aa1159ae34f135179c91/Executions';
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phone_number = lead.phone;
    const lead_name = displayName(lead.first_name, lead.last_name, lead.name);

    // Define time options (either static or dynamic)
    const timeOption1 = 'Monday at 2 PM';
    const timeOption2 = 'Tuesday at 10 AM';

    // Make a POST request to trigger the Twilio flow
    const response = await axios.post(
      restApiUrl,
      {
        to: phone_number,
        from: process.env.TWILIO_PHONE_NUMBER,
        parameters: {
          lead_name: lead_name,
          time_option_1: timeOption1,
          time_option_2: timeOption2,
        },
      },
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: authToken,
        },
      }
    );

    console.log('Twilio flow triggered:', response.data);
  } catch (error) {
    console.error('Error triggering Twilio flow:', error);
  }
}

// Main function to handle POST request for updating the appointment
export async function POST(req) {
  try {
    const { id, appointmentStatus } = await req.json();

    if (!uuidValidate(id)) {
      return NextResponse.json({ message: 'Invalid id format' }, { status: 400 });
    }

    // Update the lead's appointment status in Supabase
    const { error } = await supabase
      .from('leads')
      .update({
        appointment_attended: appointmentStatus === 'missed' ? false : true,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating appointment:', error.message);
      return NextResponse.json(
        { message: 'Error updating appointment', error: error.message },
        { status: 500 }
      );
    }

    // Trigger flow for missed appointment
    if (appointmentStatus === 'missed') {
      await triggerAppointmentFlow(id);
    }

    return NextResponse.json({ message: 'Appointment status updated and flow triggered' });
  } catch (error) {
    console.error('Error handling request:', error);
    return NextResponse.json(
      { message: 'Error processing request', error: error.message },
      { status: 500 }
    );
  }
}
