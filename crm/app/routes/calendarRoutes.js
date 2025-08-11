// src/app/routes/calendarRoutes.js
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const oauth2Client = require('../api/googleAuth').oauth2Client;

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Route to create a new event
router.post('/create-event', async (req, res) => {
  const event = req.body;  // Assuming you're sending event data in the request body

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    res.status(200).send({ message: 'Event created successfully', link: response.data.htmlLink });
  } catch (error) {
    res.status(500).send({ error: 'Error creating event' });
  }
});

module.exports = router;
