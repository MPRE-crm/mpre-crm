import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase'; // ✅ fixed path
import { sendWelcomeText } from '../../lib/sendText'; // ✅ fixed path

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, priceRange, moveTimeline, source } = req.body;

  try {
    // Store lead in Supabase
    const { error } = await supabase.from('leads').insert([
      {
        name,
        phone,
        email,
        price_range: priceRange,
        move_timeline: moveTimeline,
        source,
      },
    ]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save lead.' });
    }

    // Send AI-powered welcome text
    await sendWelcomeText(phone, name, moveTimeline, priceRange);

    return res.status(200).json({ message: 'Lead stored and SMS sent.' });
  } catch (err) {
    console.error('Error processing incoming lead:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
