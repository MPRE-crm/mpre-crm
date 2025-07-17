import type { NextApiRequest, NextApiResponse } from 'next';
import { initiateAICall } from '@/lib/aiCall'; // 👈 Ensure this path is correct
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, name, email, phone, status, move_timeline, price_range } = req.body;

  const webhookUrl = 'https://hooks.zapier.com/hooks/catch/23300472/uykdpd8/';

  try {
    // 1. Send webhook to Zapier
    const zapierResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: id,
        lead_name: name,
        lead_email: email,
        lead_phone: phone,
        new_status: status,
      }),
    });

    if (!zapierResponse.ok) {
      const errorText = await zapierResponse.text();
      console.error('Zapier webhook failed:', errorText);
      return res.status(500).json({ error: 'Failed to send to Zapier' });
    }

    // 2. Build lead object or enrich from Supabase if missing data
    let lead = { id, name, phone, move_timeline, price_range };

    if (!move_timeline || !price_range) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.warn('Could not enrich lead from Supabase:', error);
      } else {
        lead = {
          ...lead,
          move_timeline: data.move_timeline ?? move_timeline,
          price_range: data.price_range ?? price_range,
        };
      }
    }

    // 3. Trigger AI Call with appointment scheduling prompt
    await initiateAICall(lead);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Zapier + AI call error:', err);
    return res.status(500).json({ error: 'Webhook request failed' });
  }
}

