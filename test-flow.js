require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch').default;

(async () => {
  try {
    const res = await fetch('https://easyrealtor.homes/api/twilio/ai-media-stream/buyer-intake/relocation-guide/route.ts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+12087157827',
        lead_source: 'relocation_form',
        variables: {
          lead_id: '0025d671-995e-43f9-9b7d-0fdd14b7bb6e',
          first_name: 'John',
          last_name: 'Smith',
          email: 'testing@yahoo.com',
          phone: '2087157827',
          move_timeline: 'Next 3-6 months',
          price_range: '600k',
        },
        channels: { phone: true, sms: true, email: true }
      })
    });

    const text = await res.text();  // Read the raw response as text
    console.log('Response body:', text);  // Log the raw response

    if (res.ok) {
      const data = JSON.parse(text);  // Try to parse if it's JSON
      console.log('Flow triggered:', data);
    } else {
      console.error('Error response:', text);  // If not successful, log the error response
    }
  } catch (err) {
    console.error('Error triggering flow:', err);
  }
})();
