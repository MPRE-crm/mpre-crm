// app/api/twilio/webhook/route.ts

import { supabase } from '../../../../lib/supabase'; // ✅ fixed relative path
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const { id, selected_date, selected_time } = await req.json();

    if (!id || !selected_date || !selected_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('leads')
      .update({
        new_appointment_date: selected_date,
        new_appointment_time: selected_time,
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Appointment updated successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}







