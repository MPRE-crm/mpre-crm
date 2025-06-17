import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, name, email, phone, status } = req.body;

  const webhookUrl = 'https://hooks.zapier.com/hooks/catch/23300472/uykdpd8/';

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lead_id: id,
        lead_name: name,
        lead_email: email,
        lead_phone: phone,
        new_status: status,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zapier webhook failed:', errorText);
      return res.status(500).json({ error: 'Failed to send to Zapier' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Zapier webhook error:', err);
    return res.status(500).json({ error: 'Webhook request failed' });
  }
}