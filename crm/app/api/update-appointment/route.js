import { supabase } from '../../../lib/supabase';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { validate as uuidValidate } from 'uuid';  // Import uuid validate

// Trigger Twilio Appointment Flow
async function triggerAppointmentFlow(id) {
  try {
    // Fetch lead details from Supabase using the correct 'id' column
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone, name')  // Fetch phone and name based on id
      .eq('id', id)  // Use 'id' instead of 'leadId'
      .single();

    if (leadError || !lead) {
      console.error('Error fetching lead details:', leadError);
      return;
    }

    const restApiUrl = 'https://studio.twilio.com/v2/Flows/FW88d76c8c4a90aa1159ae34f135179c91/Executions';
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phone_number = lead.phone;  // Use the phone number from Supabase
    const lead_name = lead.name;  // Use the lead's name

    // Define time options (either static or dynamic)
    const timeOption1 = "Monday at 2 PM";  // Static time option
    const timeOption2 = "Tuesday at 10 AM";  // Static time option

    // Make a POST request to trigger the Twilio flow
    const response = await axios.post(restApiUrl, {
      to: phone_number,
      from: process.env.TWILIO_PHONE_NUMBER,
      parameters: {
        lead_name: lead_name,
        time_option_1: timeOption1,  // Pass time option 1
        time_option_2: timeOption2,  // Pass time option 2
      },
    }, {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: authToken,
      }
    });

    console.log('Twilio flow triggered:', response.data); // Log the response for debugging

  } catch (error) {
    console.error('Error triggering Twilio flow:', error);
  }
}

// Main function to handle POST request for updating the appointment
export async function POST(req) {
  try {
    const { id, appointmentStatus } = await req.json();  // Parse incoming request body

    // Validate the id is a valid UUID
    if (!uuidValidate(id)) {
      return NextResponse.json({ message: 'Invalid id format' }, { status: 400 });
    }

    // Update the lead's appointment status in Supabase
    const { data, error } = await supabase
      .from('leads')
      .update({ 
        appointment_attended: appointmentStatus === 'missed' ? false : true  // Handle status change
      })
      .eq('id', id);  // Use 'id' instead of 'leadId'

    if (error) {
      console.error("Error updating appointment:", error.message); // Log the error message
      return NextResponse.json({ message: 'Error updating appointment', error: error.message }, { status: 500 });
    }

    // Trigger flow for missed appointment
    if (appointmentStatus === 'missed') {
      await triggerAppointmentFlow(id);  // Call Twilio flow function for missed appointments
    }

    return NextResponse.json({ message: 'Appointment status updated and flow triggered' });

  } catch (error) {
    console.error("Error handling request:", error);
    return NextResponse.json({ message: 'Error processing request', error: error.message }, { status: 500 });
  }
}

