'use client'

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export default function EditLeadPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('new');
  const [source, setSource] = useState('referral');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentHour, setAppointmentHour] = useState(1);
  const [appointmentMinute, setAppointmentMinute] = useState('00');
  const [appointmentAMPM, setAppointmentAMPM] = useState('AM');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Invalid ID parameter');
      return;
    }

    const fetchLead = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        setError('Error fetching lead: ' + error.message);
      } else if (data) {
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setStatus(data.status || 'new');
        setSource(data.source || 'referral');
        setAppointmentDate(data.appointment_date || '');
        setAppointmentHour(data.appointment_hour || 1);
        setAppointmentMinute(data.appointment_minute || '00');
        setAppointmentAMPM(data.appointment_ampm || 'AM');
      }

      setLoading(false);
    };

    fetchLead();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('leads')
      .update({
        name,
        email,
        phone,
        status,
        source,
        appointment_date: appointmentDate || null,
        appointment_hour: appointmentHour,
        appointment_minute: appointmentMinute,
        appointment_ampm: appointmentAMPM,
      })
      .eq('id', id);

    setLoading(false);

    if (error) {
      alert('Error updating lead: ' + error.message);
    } else {
      await fetch('/api/zapier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, name, email, phone, status }),
      });

      generateICSFile(appointmentDate, appointmentHour, appointmentMinute, appointmentAMPM);
      router.push('/leads');
    }
  };

  const generateICSFile = (
    appointmentDate: string,
    appointmentHour: number,
    appointmentMinute: string,
    appointmentAMPM: string
  ) => {
    let hour24 = appointmentHour;

    if (appointmentAMPM === 'PM' && appointmentHour !== 12) {
      hour24 += 12;
    } else if (appointmentAMPM === 'AM' && appointmentHour === 12) {
      hour24 = 0;
    }

    const dateString = `${appointmentDate}T${String(hour24).padStart(2, '0')}:${appointmentMinute}:00`;
    const startDate = new Date(dateString);

    if (isNaN(startDate.getTime())) {
      alert('Invalid date selected. Please check the date and time.');
      return;
    }

    const endDate = new Date(startDate);
    endDate.setMinutes(startDate.getMinutes() + 30);

    const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Your CRM//NONSGML v1.0//EN
BEGIN:VEVENT
UID:${startDate.toISOString()}
DTSTAMP:${startDate.toISOString().replace(/-|:|\.\d+/g, '')}
DTSTART:${startDate.toISOString().replace(/-|:|\.\d+/g, '')}
DTEND:${endDate.toISOString().replace(/-|:|\.\d+/g, '')}
SUMMARY:Appointment Scheduled
DESCRIPTION:Appointment for real estate follow-up.
LOCATION:Your Office
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
    `;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointment-${startDate.toISOString()}.ics`;
    link.click();
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Edit Lead</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />

        <select value={status} onChange={e => setStatus(e.target.value)} required>
          <option value="new">New</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
          <option value="closed">Closed</option>
        </select>

        <select value={source} onChange={e => setSource(e.target.value)} required>
          <option value="referral">Referral</option>
          <option value="website">Website</option>
          <option value="social">Social Media</option>
          <option value="ad">Advertisement</option>
          <option value="other">Other</option>
        </select>

        <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} required />

        <div style={{ display: 'flex', gap: '10px' }}>
          <select value={appointmentHour} onChange={e => setAppointmentHour(Number(e.target.value))} required>
            {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>

          <select value={appointmentMinute} onChange={e => setAppointmentMinute(e.target.value)} required>
            <option value="00">00</option>
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="45">45</option>
          </select>

          <select value={appointmentAMPM} onChange={e => setAppointmentAMPM(e.target.value)} required>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>

        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Update Lead'}</button>
      </form>
    </div>
  );
}
