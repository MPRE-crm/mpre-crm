'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import dayjs from 'dayjs';
import BookingForm from '@/components/BookingForm';  // Import BookingForm component

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  price_range?: string;
  move_timeline?: string;
  status?: string;
  lead_source?: string;
  created_at?: string;
  delivery_status?: string;
  appointment_date?: string; // To track the appointment date in Supabase
  appointment_requested?: boolean; // New flag to track appointment request status
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'New':
      return 'bg-gray-200 text-gray-800';
    case 'Contacted':
      return 'bg-blue-100 text-blue-800';
    case 'Appointment Set':
      return 'bg-green-200 text-green-800';
    case 'Archived':
      return 'bg-yellow-100 text-yellow-800';
    case 'Failed':
      return 'bg-red-100 text-red-800';
    case 'Sent':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function downloadCSV(data: Lead[]) {
  const headers = ['Name', 'Email', 'Phone', 'Price Range', 'Move Timeline', 'Status', 'Lead Source', 'Created At'];
  const rows = data.map((lead) => [
    lead.name,
    lead.email,
    lead.phone,
    lead.price_range ?? '',
    lead.move_timeline ?? '',
    lead.status ?? '',
    lead.lead_source ?? '',
    lead.created_at ?? '',
  ]);

  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'leads_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [daysFilter, setDaysFilter] = useState<number | null>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching leads:', error);
      } else {
        setLeads(data as Lead[]);
      }

      setLoading(false);
    };

    fetchLeads();

    const channel = supabase
      .channel('realtime leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) {
      console.error('Error deleting lead:', error);
    } else {
      setLeads((prev) => prev.filter((lead) => lead.id !== id));
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id);
    if (error) {
      console.error('Error updating status:', error);
    } else {
      setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
    }
  };

  const handleFieldEdit = async (id: string, field: keyof Lead, value: string) => {
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', id);
    if (error) {
      console.error(`Error updating ${field}:`, error);
    } else {
      setLeads((prev) =>
        prev.map((lead) => (lead.id === id ? { ...lead, [field]: value } : lead))
      );
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesStatus = filter === 'All' || lead.status?.toLowerCase() === filter.toLowerCase();
    const matchesSearch =
      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(search.toLowerCase());
    const matchesDate = !daysFilter || dayjs(lead.created_at).isAfter(dayjs().subtract(daysFilter, 'day'));
    return matchesStatus && matchesSearch && matchesDate;
  });

  const summary = {
    total: filteredLeads.length,
    today: filteredLeads.filter((l) => dayjs(l.created_at).isAfter(dayjs().startOf('day'))).length,
    appointments: filteredLeads.filter((l) => l.status === 'Appointment Set').length,
    sources: filteredLeads.reduce((acc, l) => {
      if (l.lead_source) {
        acc[l.lead_source] = (acc[l.lead_source] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Leads Dashboard</h1>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-100 p-3 rounded">Total Leads: {summary.total}</div>
        <div className="bg-green-100 p-3 rounded">New Today: {summary.today}</div>
        <div className="bg-blue-100 p-3 rounded">Appointments Set: {summary.appointments}</div>
        <div className="bg-yellow-100 p-3 rounded">
          Top Source: {Object.entries(summary.sources).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded-md w-full sm:w-1/2"
        />

        <div className="flex gap-2 flex-wrap">
          {[0, 7, 30, null].map((days) => (
            <button
              key={days ?? 'all'}
              onClick={() => setDaysFilter(days)}
              className={`px-3 py-1 rounded-full border text-sm ${
                daysFilter === days ? 'bg-black text-white' : 'bg-white text-black'
              }`}
            >
              {days ? `Last ${days} Days` : 'All Time'}
            </button>
          ))}

          <button
            onClick={() => downloadCSV(filteredLeads)}
            className="px-3 py-1 rounded-full border text-sm bg-blue-600 text-white"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {['All', 'New', 'Contacted', 'Appointment Set', 'Archived'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 rounded-full border text-sm ${
              filter === status ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading leads...</p>
      ) : filteredLeads.length === 0 ? (
        <p>No leads found.</p>
      ) : (
        <div className="space-y-4">
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="p-4 border rounded-lg shadow-sm hover:shadow-md transition"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="w-full">
                  <div className="flex gap-2 flex-wrap">
                    <input
                      className="text-lg font-semibold border-b px-1 w-48"
                      value={lead.name}
                      onChange={(e) => handleFieldEdit(lead.id, 'name', e.target.value)}
                    />
                    <input
                      className="text-sm text-gray-600 border-b px-1 w-64"
                      value={lead.email}
                      onChange={(e) => handleFieldEdit(lead.id, 'email', e.target.value)}
                    />
                    <input
                      className="text-sm text-gray-600 border-b px-1 w-40"
                      value={lead.phone}
                      onChange={(e) => handleFieldEdit(lead.id, 'phone', e.target.value)}
                    />
                  </div>

                  <p className="text-sm text-gray-600 mt-1">
                    Price: {lead.price_range || '—'} • Timeline: {lead.move_timeline || '—'}
                  </p>

                  <p className="text-xs text-gray-400">
                    Created: {dayjs(lead.created_at).format('MMM D, YYYY h:mm A')}
                  </p>

                  <div className="mt-2 flex gap-2 flex-wrap text-sm">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      Source: {lead.lead_source?.slice(0, 50) || 'Unknown'}
                    </span>
                    {lead.status && (
                      <span
                        className={`px-2 py-1 rounded-full ${getStatusBadgeColor(
                          lead.status
                        )}`}
                      >
                        {lead.status}
                      </span>
                    )}
                    {lead.delivery_status && (
                      <span
                        className={`px-2 py-1 rounded-full ${getStatusBadgeColor(
                          lead.delivery_status
                        )}`}
                      >
                        {lead.delivery_status}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <BookingForm leadId={lead.id} leadName={lead.name} leadEmail={lead.email} />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
                  </Link>

                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={lead.status || ''}
                    onChange={(e) => handleStatusUpdate(lead.id, e.target.value)}
                  >
                    <option value="">— Change Status —</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Appointment Set">Appointment Set</option>
                    <option value="Archived">Archived</option>
                  </select>

                  <button
                    onClick={() => handleDelete(lead.id)}
                    className="text-red-500 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
