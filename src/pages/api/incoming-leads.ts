import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { sendWelcomeText } from '../../lib/sendText';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, priceRange, moveTimeline, lead_source } = req.body;

  try {
    // Store lead in Supabase
    const { error } = await supabase.from('leads').insert([
      {
        name,
        phone,
        email,
        price_range: priceRange,
        move_timeline: moveTimeline,
        lead_source: lead_source,
      },
    ]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save lead.' });
    }

    // Attempt to send SMS, but don't let failure stop the response
    try {
      await sendWelcomeText(phone, name, moveTimeline, priceRange);
    } catch (textError) {
      console.warn('Text sending failed:', textError);
    }

    return res.status(200).json({ message: 'Lead stored and SMS attempted.' });
  } catch (err) {
    console.error('Error processing incoming lead:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}



