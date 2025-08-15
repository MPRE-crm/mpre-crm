require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch').default;

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/twilio/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+1208XXXXXXX',
        lead_source: 'relocation_form',
        variables: {
          lead_id: 'demo-123',
          first_name: 'Alex',
          email: 'alex@example.com',
          move_timeline: '3-6 months',
          price_range: '$500k-$650k'
        },
        channels: { phone: true, sms: true, email: true }
      })
    });

    const data = await res.json();
    console.log('Flow triggered:', data);
  } catch (err) {
    console.error('Error triggering flow:', err);
  }
})();
