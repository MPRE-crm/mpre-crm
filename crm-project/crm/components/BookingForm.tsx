'use client';

import React, { useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { getSupabaseBrowser } from '../lib/supabase-browser';

dayjs.extend(utc);

// use the singleton client
const supabase = getSupabaseBrowser();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const datetime = dayjs(`${date}T${time}`).utc().toISOString();   // full UTC ISO datetime
    const appointmentTime = dayjs(`${date}T${time}`).format('hh:mm A'); // 12h time

    const { error } = await supabase
      .from('leads')
      .update({
        appointment_date: datetime,
        appointment_time: appointmentTime,
        appointment_requested: true,
      })
      .eq('id', leadId);

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

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-2">Appointment booked!</p>}

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
