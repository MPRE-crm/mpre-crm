// app/controllers/appointmentController.js

// Optional for local dev; Vercel ignores this.
// require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Prefer public vars for browser, fallback to server vars for backend
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
}
if (!supabaseAnonKey) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create an appointment
exports.createAppointment = async (req, res) => {
  const { agent_id, lead_id, appointment_date } = req.body;
  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ agent_id, lead_id, appointment_date }])
      .single();

    if (error) {
      console.error(error);
      return res.status(500).send('Error creating appointment');
    }

    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating appointment');
  }
};

// Get all appointments
exports.getAppointments = async (_req, res) => {
  try {
    const { data, error } = await supabase.from('appointments').select('*');

    if (error) {
      console.error(error);
      return res.status(500).send('Error fetching appointments');
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching appointments');
  }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .single();

    if (error) {
      console.error(error);
      return res.status(500).send('Error updating appointment status');
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating appointment status');
  }
};
