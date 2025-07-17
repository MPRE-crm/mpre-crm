require('dotenv').config();  // Ensure dotenv is loaded

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client using environment variables
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Define createAvailability function and export it
exports.createAvailability = async (req, res) => {
  const { agent_id, available_from, available_to } = req.body;
  try {
    const { data, error } = await supabase
      .from('availability')
      .insert([{ agent_id, available_from, available_to }])
      .single();  // Insert one row

    if (error) {
      console.error(error);
      return res.status(500).send('Error creating availability');
    }

    res.status(201).json(data);  // Return the newly created availability
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating availability');
  }
};

// Get all availability for an agent
exports.getAvailability = async (req, res) => {
  const { agent_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('agent_id', agent_id);

    if (error) {
      console.error(error);
      return res.status(500).send('Error fetching availability');
    }

    res.status(200).json(data);  // Return the availability data
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching availability');
  }
};




