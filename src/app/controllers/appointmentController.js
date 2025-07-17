// appointmentController.js
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect();

// Create an appointment
exports.createAppointment = async (req, res) => {
  const { agent_id, lead_id, appointment_date } = req.body;
  try {
    const result = await client.query(
      'INSERT INTO appointments(agent_id, lead_id, appointment_date) VALUES($1, $2, $3) RETURNING *',
      [agent_id, lead_id, appointment_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating appointment');
  }
};

// Get all appointments
exports.getAppointments = async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM appointments');
    res.status(200).json(result.rows);
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
    const result = await client.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating appointment status');
  }
};

