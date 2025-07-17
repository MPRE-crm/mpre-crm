import axios from 'axios';
import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';  // Import Supabase

// Your Twilio API URL
const restApiUrl = 'https://studio.twilio.com/v2/Flows/FW88d76c8c4a90aa1159ae34f135179c91/Executions';
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Set up OAuth2 client for Google Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set the credentials (you need to get these after OAuth2 authorization)
oauth2Client.setCredentials({
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Google Calendar API initialization
const calendar = google.calendar('v3');

// Function to get available times from Google Calendar
async function getAvailableTimes() {
  try {
    // Fetch events from Google Calendar
    const res = await calendar.events.list({
      auth: oauth2Client,
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items;
    let availableTimes = processAvailableTimes(events);
    return availableTimes;
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return [];
  }
}

// Helper function to process the available times
function processAvailableTimes(events) {
  let availableTimes = [];
  // Simplified logic: Generate available slots based on your events
  if (events.length > 0) {
    availableTimes.push("Monday at 2 PM");
    availableTimes.push("Tuesday at 10 AM");
  } else {
    availableTimes.push("Next available time is 3 PM today");
  }
  return availableTimes;
}

// Fetch available time slots dynamically and trigger Twilio Flow
async function triggerAppointmentFlow(id) {
  try {
    // Fetch lead details from Supabase using 'id'
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone, name, prior_appointment_date, new_appointment_date, new_appointment_time')  // Fetch both new date and time
      .eq('id', id)  // Use 'id' as per Supabase
      .single();

    if (leadError || !lead) {
      console.error('Error fetching lead details:', leadError);
      return;
    }

    const phone_number = lead.phone;  // Use the phone number from Supabase
    const lead_name = lead.name;  // Use the lead's name
    const prior_appointment_date = lead.prior_appointment_date;  // Fetch prior appointment date
    const new_appointment_date = lead.new_appointment_date;  // Fetch new appointment date
    const new_appointment_time = lead.new_appointment_time;  // Fetch new appointment time

    // Fetch available times from Google Calendar
    const availableTimes = await getAvailableTimes();

    if (availableTimes.length < 2) {
      console.log('Not enough available time slots.');
      return;
    }

    // Use the available time slots
    const timeOption1 = availableTimes[0];
    const timeOption2 = availableTimes[1];

    // Make a POST request to trigger the Twilio flow
    const response = await axios.post(restApiUrl, {
      to: phone_number,
      from: process.env.TWILIO_PHONE_NUMBER,  // Your Twilio phone number
      parameters: {
        lead_name: lead_name,
        prior_appointment_date: prior_appointment_date,  // Pass the prior appointment date
        new_appointment_date: new_appointment_date,  // Pass the new appointment date
        new_appointment_time: new_appointment_time,  // Pass the new appointment time
        time_option_1: timeOption1,
        time_option_2: timeOption2,
      },
    }, {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,  // Your Twilio Account SID
        password: authToken,
      },
    });

    console.log('Twilio flow triggered:', response.data);

    // Handle lead's time selection and update Supabase
    const selectedTime = response.data.selected_time; // Assuming response contains selected time
    const selectedDate = response.data.selected_date; // Assuming response contains selected date

    // Update Supabase with the new appointment details
    await supabase
      .from('leads')
      .update({
        new_appointment_date: selectedDate,
        new_appointment_time: selectedTime,
      })
      .eq('id', id);  // Make sure to update the correct lead by ID

    console.log('Appointment updated in Supabase');
    
  } catch (error) {
    console.error('Error triggering Twilio flow:', error);
  }
}

// Example usage: Call the function with an actual lead 'id'
triggerAppointmentFlow('your_lead_id');  // Use actual 'id' here when calling this function
