require('dotenv').config();  // Load environment variables from .env.local

// Log the environment variables to check if they are loaded
console.log('Supabase URL:', process.env.SUPABASE_URL);  // Should log your Supabase URL
console.log('Supabase Anon Key:', process.env.SUPABASE_ANON_KEY);  // Should log your Supabase anon key

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client using environment variables
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Define createUser function and export it
exports.createUser = async (req, res) => {
  const { name, email, password_hash } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password_hash }])
      .single();  // Insert one row

    if (error) {
      console.error(error);
      return res.status(500).send('Error creating user');
    }

    res.status(201).json(data);  // Return the newly created user
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating user');
  }
};

// Define getUsers function and export it
exports.getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error(error);
      return res.status(500).send('Error fetching users');
    }

    res.status(200).json(data);  // Return the list of users
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching users');
  }
};





















