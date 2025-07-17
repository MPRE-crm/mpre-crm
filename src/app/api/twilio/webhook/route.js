import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(req) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Check content type
  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, selected_date, selected_time } = body;

  if (!id || !selected_date || !selected_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('leads')
    .update({
      new_appointment_date: selected_date,
      new_appointment_time: selected_time,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating Supabase:', error);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Appointment updated successfully' }, { status: 200 });
}


