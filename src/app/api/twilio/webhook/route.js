import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(req) {
  // Ensure JSON body
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

  const { error } = await supabase
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

  return NextResponse.json({ message: 'Appointment updated successfully' });
}



