// src/app/api/dashboard/metrics/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Query for reminders sent (last 24 hours)
    const { data: remindersSentData, error: remindersError } = await supabase
      .from('messages')
      .select('id')
      .eq('direction', 'outgoing')  // Only count sent messages
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());  // Sent in the last 24 hours

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError.message);
      return NextResponse.json({ success: false, error: remindersError.message }, { status: 500 });
    }

    // Query for appointments attended vs. missed
    const { data: attendedData, error: attendedError } = await supabase
      .from('leads')
      .select('id')
      .eq('appointment_attended', true); // Filter for appointments attended

    const { data: missedData, error: missedError } = await supabase
      .from('leads')
      .select('id')
      .eq('appointment_attended', false); // Filter for missed appointments

    if (attendedError || missedError) {
      console.error("Error fetching attendance data:", attendedError?.message || missedError?.message);
      return NextResponse.json({ success: false, error: attendedError?.message || missedError?.message }, { status: 500 });
    }

    // Return metrics (reminders sent, appointments attended, appointments missed)
    return NextResponse.json({
      success: true,
      metrics: {
        remindersSent: remindersSentData?.length ?? 0, // Safely access length
        appointmentsAttended: attendedData?.length ?? 0, // Safely access length
        appointmentsMissed: missedData?.length ?? 0, // Safely access length
      }
    });
  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
