// src/app/api/getCalendarEvents.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    try {
      // Fetch calendar events from Microsoft Graph API
      const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const events = await response.json();

      if (response.ok) {
        res.status(200).json(events);
      } else {
        res.status(500).json({ error: 'Error fetching calendar events', details: events });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error during API request', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
