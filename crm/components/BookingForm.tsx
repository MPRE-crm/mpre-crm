'use client';

import React, { useState } from 'react';  // React import
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'; // Import UTC plugin

dayjs.extend(utc); // Extend dayjs with the UTC plugin

// Initialize the Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface BookingFormProps {
  leadId: string;
  leadName: string;
  leadEmail: string;
}

export default function BookingForm({ leadId, leadName, leadEmail }: BookingFormProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Submit handler for booking the appointment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Combine date and time, and convert it to a valid ISO string with UTC
    const datetime = dayjs(`${date}T${time}`).utc().toISOString(); // Convert to UTC and save in ISO format
    const appointmentTime = dayjs(`${date}T${time}`).format('hh:mm A'); // 12-hour format with AM/PM

    // Update the lead with the appointment information
    const { error } = await supabase
      .from('leads')
      .update({
        appointment_date: datetime,          // Store full datetime in ISO format (UTC)
        appointment_time: appointmentTime,    // Store time in 12-hour format with AM/PM
        appointment_requested: true          // Flag appointment as requested
      })
      .eq('id', leadId);  // Matching lead by ID

    setLoading(false);

    if (error) {
      console.error('Error saving appointment:', error);
      setError('Failed to book appointment.');
    } else {
      setSuccess(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded shadow-md w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Schedule an Appointment</h2>
      <p className="text-sm mb-2">Booking for: {leadName} ({leadEmail})</p>
      
      {/* Date Input */}
      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>
      
      {/* Time Input */}
      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium">Time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      {/* Error and Success Messages */}
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-2">Appointment booked!</p>}
      
      {/* Submit Button */}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Booking...' : 'Book Appointment'}
      </button>
    </form>
  );
}
