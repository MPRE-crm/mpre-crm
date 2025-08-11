// app/controllers/userController.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create user
exports.createUser = async (req, res) => {
  const { name, email, password_hash } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password_hash }])
      .single();

    if (error) {
      console.error(error);
      return res.status(500).send('Error creating user');
    }
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating user');
  }
};

// Get users
exports.getUsers = async (_req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error(error);
      return res.status(500).send('Error fetching users');
    }
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching users');
  }
};
