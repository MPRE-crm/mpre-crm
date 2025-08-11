// app/controllers/availabilityController.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create availability
exports.createAvailability = async (req, res) => {
  const { agent_id, available_from, available_to } = req.body;
  try {
    const { data, error } = await supabase
      .from('availability')
      .insert([{ agent_id, available_from, available_to }])
      .single();

    if (error) {
      console.error(error);
      return res.status(500).send('Error creating availability');
    }
    res.status(201).json(data);
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
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching availability');
  }
};
