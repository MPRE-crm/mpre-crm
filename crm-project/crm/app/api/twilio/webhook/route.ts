// app/api/twilio/webhook/route.ts

import { supabase } from '../../../../lib/supabase';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { triggerAppointmentFlow } from '../triggerAppointmentFlow/route';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const { id, selected_date, selected_time, is_new_lead } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    // ✅ If Twilio sends back appointment details, update Supabase
    if (selected_date && selected_time) {
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
    }

    // ✅ Always trigger Twilio flow for a new lead (or if this is flagged as a new lead event)
    if (is_new_lead === true) {
      const leadExists = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (leadExists.error || !leadExists.data) {
        return NextResponse.json({ error: 'Lead not found for flow trigger' }, { status: 404 });
      }

      const result = await triggerAppointmentFlow(id);

      if (!result.ok) {
        return NextResponse.json({ error: 'Failed to trigger Twilio flow', details: result.error }, { status: 500 });
      }

      return NextResponse.json({ message: 'Flow triggered automatically', executionSid: result.executionSid });
    }

    return NextResponse.json({ message: 'Appointment updated successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
