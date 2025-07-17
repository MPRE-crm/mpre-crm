// availabilityController.js
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect();

// Create availability for an agent
exports.createAvailability = async (req, res) => {
  const { agent_id, available_from, available_to, date } = req.body;

  try {
    const result = await client.query(
      'INSERT INTO availability(agent_id, available_from, available_to, date) VALUES($1, $2, $3, $4) RETURNING *',
      [agent_id, available_from, available_to, date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating availability');
  }
};

// Get availability for a specific agent
exports.getAvailability = async (req, res) => {
  const { agent_id } = req.params;

  try {
    const result = await client.query(
      'SELECT * FROM availability WHERE agent_id = $1',
      [agent_id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching availability');
  }
};



