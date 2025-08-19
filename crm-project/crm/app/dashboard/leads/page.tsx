'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { createClient } from '@supabase/supabase-js';
import BookingForm from '../../../components/BookingForm';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function splitName(full?: string) {
  if (!full) return { first_name: null as string | null, last_name: null as string | null };
  const [first, ...rest] = full.trim().split(/\s+/);
  return { first_name: first || null, last_name: rest.length ? rest.join(' ') : null };
}

interface Lead {
  id: string;
  created_at?: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  status?: string | null;
  lead_source?: string | null;
  appointment_date?: string | null;
  price_range?: string | null;
  move_timeline?: string | null;
  appointment_requested?: boolean | null;
}

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
    lead.name ?? '',
    lead.email ?? '',
    lead.phone ?? '',
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

  const updateLocalLead = (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('leads')
          .select(
            `
            id,
            created_at,
            name,
            first_name,
            last_name,
            email,
            phone,
            status,
            lead_source,
            appointment_date,
            price_range,
            move_timeline,
            appointment_requested
          `
          )
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error fetching leads:', error.message);
        } else {
          setLeads((data as Lead[]) ?? []);
        }
      } catch (error: any) {
        console.error('Error in fetching leads:', error.message || error);
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
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) console.error('Error deleting lead:', error.message);
      else setLeads((prev) => prev.filter((lead) => lead.id !== id));
    } catch (error: any) {
      console.error('Error deleting lead:', error.message || error);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) console.error('Error updating status:', error.message);
      else updateLocalLead(id, { status });
    } catch (error: any) {
      console.error('Error updating status:', error.message || error);
    }
  };

  const handleFieldEdit = async (id: string, field: keyof Lead, value: string) => {
    try {
      if (field === 'name') {
        const { first_name, last_name } = splitName(value);
        const { error } = await supabase
          .from('leads')
          .update({ name: value, first_name, last_name })
          .eq('id', id);
        if (!error) updateLocalLead(id, { first_name, last_name, name: value });
        return;
      }

      const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', id);
      if (!error) updateLocalLead(id, { [field]: value } as Partial<Lead>);
    } catch (error: any) {
      console.error(`Error updating ${String(field)}:`, error.message || error);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesStatus = filter === 'All' || (lead.status ?? '').toLowerCase() === filter.toLowerCase();
    const searchLower = search.toLowerCase();
    const matchesSearch =
      (lead.name ?? '').toLowerCase().includes(searchLower) ||
      `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase().includes(searchLower) ||
      (lead.email || '').toLowerCase().includes(searchLower) ||
      (lead.phone || '').toLowerCase().includes(searchLower);
    const matchesDate = !daysFilter || dayjs(lead.created_at).isAfter(dayjs().subtract(daysFilter, 'day'));
    return matchesStatus && matchesSearch && matchesDate;
  });

  const summary = {
    total: filteredLeads.length,
    today: filteredLeads.filter((l) => dayjs(l.created_at).isAfter(dayjs().startOf('day'))).length,
    appointments: filteredLeads.filter((l) => l.status === 'Appointment Set').length,
    sources: filteredLeads.reduce((acc, l) => {
      if (l.lead_source) acc[l.lead_source] = (acc[l.lead_source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Leads Dashboard</h1>

        {/* summary cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <p className="text-sm text-gray-500">Total Leads</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <p className="text-sm text-gray-500">New Today</p>
            <p className="text-2xl font-bold text-green-600">{summary.today}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <p className="text-sm text-gray-500">Appointments</p>
            <p className="text-2xl font-bold text-blue-600">{summary.appointments}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <p className="text-sm text-gray-500">Top Source</p>
            <p className="text-lg font-semibold">
              {Object.entries(summary.sources).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
            </p>
          </div>
        </div>

        {/* search + filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-2 rounded-md w-full md:w-1/2 shadow-sm"
          />
          <div className="flex gap-2 flex-wrap">
            {[0, 7, 30, null].map((days) => (
              <button
                key={days ?? 'all'}
                onClick={() => setDaysFilter(days)}
                className={`px-3 py-1 rounded-full border text-sm ${
                  daysFilter === days ? 'bg-black text-white' : 'bg-white'
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

        {/* status filter buttons */}
        <div className="flex gap-2 flex-wrap mb-6">
          {['All', 'New', 'Contacted', 'Appointment Set', 'Archived'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full border text-sm ${
                filter === status ? 'bg-black text-white' : 'bg-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* leads grid */}
        {loading ? (
          <p>Loading leads...</p>
        ) : filteredLeads.length === 0 ? (
          <p>No leads found.</p>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white rounded-xl shadow hover:shadow-md transition p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-col gap-1 mb-2">
                    <input
                      className="text-lg font-semibold border-b px-1"
                      value={lead.name ?? ''}
                      onChange={(e) => handleFieldEdit(lead.id, 'name', e.target.value)}
                    />
                    <input
                      className="text-sm text-gray-600 border-b px-1"
                      value={lead.email ?? ''}
                      onChange={(e) => handleFieldEdit(lead.id, 'email', e.target.value)}
                    />
                    <input
                      className="text-sm text-gray-600 border-b px-1"
                      value={lead.phone ?? ''}
                      onChange={(e) => handleFieldEdit(lead.id, 'phone', e.target.value)}
                    />
                  </div>

                  <p className="text-sm text-gray-600">
                    Price: {lead.price_range || '—'} • Timeline: {lead.move_timeline || '—'}
                  </p>
                  <p className="text-xs text-gray-400 mb-2">
                    Created: {lead.created_at ? dayjs(lead.created_at).format('MMM D, YYYY h:mm A') : '—'}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                      {lead.lead_source || 'Unknown'}
                    </span>
                    {lead.status && (
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    )}
                  </div>

                  <BookingForm leadId={lead.id} leadName={lead.name ?? ''} leadEmail={lead.email ?? ''} />
                </div>

                <div className="mt-4 flex justify-between items-center text-sm">
                  <Link href={`/leads/${lead.id}`} className="text-blue-600 hover:underline">
                    Edit
                  </Link>
                  <div className="flex items-center gap-2">
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
                    <button onClick={() => handleDelete(lead.id)} className="text-red-500 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
