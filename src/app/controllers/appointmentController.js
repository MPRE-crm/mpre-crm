require('dotenv').config();  // Ensure dotenv is loaded

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client using environment variables
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Create an appointment
exports.createAppointment = async (req, res) => {
  const { agent_id, lead_id, appointment_date } = req.body;
  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ agent_id, lead_id, appointment_date }])
      .single();  // Insert one row

    if (error) {
      console.error(error);
      return res.status(500).send('Error creating appointment');
    }

    res.status(201).json(data);  // Return the newly created appointment
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating appointment');
  }
};

// Get all appointments
exports.getAppointments = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*');

    if (error) {
      console.error(error);
      return res.status(500).send('Error fetching appointments');
    }

    res.status(200).json(data);  // Return the list of appointments
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
      .single();  // Update one row

    if (error) {
      console.error(error);
      return res.status(500).send('Error updating appointment status');
    }

    res.status(200).json(data);  // Return the updated appointment
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating appointment status');
  }
};


