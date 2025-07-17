// src/app/api/twilio/webhook/route.js

import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const body = await request.json();
    const { id, selected_date, selected_time } = body;

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
      console.error('[Supabase Update Error]:', error);
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Appointment updated successfully' }, { status: 200 });
  } catch (err) {
    console.error('[Server Error]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}





