'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
// crm-project/crm/app/leads/LeadsClient.tsx
import { supabase } from '../../lib/supabase-browser';

type LeadStatus =
  | 'new'
  | 'engaged'
  | 'hot'
  | 'warm'
  | 'cold'
  | 'no_answer'
  | 'follow_up_needed'
  | 'appointment_scheduled'
  | 'appointment_missed'
  | 'prospect'
  | 'client'
  | 'under_contract'
  | 'closed'
  | string;

type Lead = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: LeadStatus | null;
  lead_source?: string | null;
  appointment_date?: string | null;
  created_at?: string;
};

const PRESET_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'follow_up_needed', label: 'Follow-up Needed' },
  { value: 'appointment_scheduled', label: 'Appointment Scheduled' },
  { value: 'appointment_missed', label: 'Appointment Missed' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed', label: 'Closed' },
];

const PAGE_SIZE = 25;

/** Nicely format snake_case or mixed strings → Title Case for labels */
function toTitleLabel(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Format ISO date to a short local string */
function fmtDate(iso?: string | null): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function LeadsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<string>(searchParams?.get('status') || '');

  // Build dropdown options; include any unknown status from URL so the UI matches reality
  const statusOptions = useMemo(() => {
    if (!statusFilter) return PRESET_STATUSES;
    const exists = PRESET_STATUSES.some((s) => s.value === statusFilter);
    return exists
      ? PRESET_STATUSES
      : [{ value: statusFilter, label: toTitleLabel(statusFilter) }, ...PRESET_STATUSES];
  }, [statusFilter]);

  const fetchLeads = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);
      try {
        const from = 0;
        const to = PAGE_SIZE * (reset ? 1 : page) - 1;

        let query = supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (statusFilter) query = query.eq('status', statusFilter);

        const { data, error } = await query;
        if (error) throw error;

        const rows = data ?? [];
        setLeads(rows);
        setHasMore(rows.length >= PAGE_SIZE * (reset ? 1 : page));
      } catch (err: any) {
        setError(err?.message || 'Failed to load leads');
      } finally {
        setLoading(false);
      }
    },
    [page, statusFilter]
  );

  // Initial + on filter change
  useEffect(() => {
    setPage(1);
    fetchLeads(true);
  }, [statusFilter, fetchLeads]);

  // Realtime updates (insert/update/delete)
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        setLeads((prev) => {
          const newRow = payload.new as Lead;
          const oldRow = payload.old as Lead;

          switch (payload.eventType) {
            case 'INSERT': {
              // Respect current filter
              if (statusFilter && newRow.status !== statusFilter) return prev;
              // Only add if within current page slice (top of list)
              return [newRow, ...prev].slice(0, PAGE_SIZE * page);
            }
            case 'UPDATE': {
              const next = prev.map((l) => (l.id === newRow.id ? { ...l, ...newRow } : l));
              // If an item no longer matches the filter, drop it
              if (statusFilter && newRow.status !== statusFilter) {
                return next.filter((l) => l.id !== newRow.id);
              }
              return next;
            }
            case 'DELETE': {
              const deletedId = oldRow?.id;
              return prev.filter((l) => l.id !== deletedId);
            }
            default:
              return prev;
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, statusFilter]);

  const handleDelete = async (id: string) => {
    const ok = confirm('Delete this lead?');
    if (!ok) return;
    const prev = leads;
    setLeads((p) => p.filter((l) => l.id !== id)); // optimistic
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) {
      // rollback on error
      setLeads(prev);
      alert('Delete failed: ' + error.message);
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setStatusFilter(v);
    const params = new URLSearchParams(window.location.search);
    if (v) params.set('status', v);
    else params.delete('status');
    router.push('/leads?' + params.toString());
  };

  const loadMore = () => {
    setPage((p) => p + 1);
  };

  // When page changes (Load more), fetch again (append logic handled by range)
  useEffect(() => {
    if (page > 1) fetchLeads(false);
  }, [page, fetchLeads]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Lead List</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="mr-2">Filter by Status:</label>
        <select value={statusFilter} onChange={handleStatusChange} className="border p-1 rounded">
          <option value="">All</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => fetchLeads(true)}
          className="ml-auto border px-3 py-1 rounded hover:bg-gray-50"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-600">
          Error loading leads: {error}{' '}
          <button onClick={() => fetchLeads(true)} className="underline">
            Retry
          </button>
        </div>
      )}

      {loading && leads.length === 0 ? (
        <div>Loading leads...</div>
      ) : leads.length > 0 ? (
        <>
          <ul className="space-y-2">
            {leads.map((lead) => (
              <li key={lead.id} className="border p-4 rounded-md shadow-sm hover:shadow-md transition">
                <Link href={`/leads/${lead.id}`} className="text-lg font-semibold text-blue-600 hover:underline">
                  {lead.name || '(No Name)'}
                </Link>
                <div>
                  <strong>Email:</strong> {lead.email || '—'}
                </div>
                <div>
                  <strong>Phone:</strong> {lead.phone || '—'}
                </div>
                <div>
                  <strong>Status:</strong> {toTitleLabel(lead.status || '')}
                </div>
                <div>
                  <strong>Source:</strong> {lead.lead_source || '—'}
                </div>
                <div>
                  <strong>Appointment:</strong> {fmtDate(lead.appointment_date)}
                </div>
                <div className="mt-2 space-x-4">
                  <Link href={`/leads/${lead.id}/edit`} className="text-blue-500 hover:underline">
                    [Edit]
                  </Link>
                  <button onClick={() => handleDelete(lead.id)} className="text-red-500 hover:underline">
                    [Delete]
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-3">
            {hasMore && (
              <button onClick={loadMore} className="border px-3 py-1 rounded hover:bg-gray-50">
                Load more
              </button>
            )}
            {!hasMore && <span className="text-sm text-gray-500">No more results</span>}
          </div>
        </>
      ) : (
        <p>No leads found.</p>
      )}
    </div>
  );
}
