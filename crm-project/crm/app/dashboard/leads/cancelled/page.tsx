'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useRouter } from 'next/navigation';
dayjs.extend(relativeTime);

// ----- Supabase (browser) -----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type CancelledListing = {
  id: string;
  created_at: string | null;
  seller_name: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  mls_number: string | null;
  previous_list_price: number | null;
  cancelled_date: string | null;
  notes: string | null;
};

export default function CancelledListingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<CancelledListing[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    const fetchRows = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('cancelled_listings')
        .select(
          'id, created_at, seller_name, property_address, city, state, zip, phone, email, mls_number, previous_list_price, cancelled_date, notes'
        )
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data || []) as CancelledListing[]);
      setLoading(false);
    };

    fetchRows();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    const norm = (v?: string | null) => (v || '').toLowerCase();

    return rows.filter((r) => {
      return (
        norm(r.seller_name).includes(term) ||
        norm(r.property_address).includes(term) ||
        norm(r.city).includes(term) ||
        norm(r.state).includes(term) ||
        norm(r.zip).includes(term) ||
        norm(r.phone).includes(term) ||
        norm(r.email).includes(term) ||
        norm(r.mls_number).includes(term)
      );
    });
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Cancelled Listings</h1>

          <button
            onClick={() => router.push('/dashboard/leads/cancelled/new')}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Add Cancelled Listing
          </button>

          <button
            onClick={() => router.push('/dashboard/leads')}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100"
          >
            Back to Leads
          </button>
        </div>

        <div className="text-xs text-gray-500">
          Showing {filtered.length} of {rows.length}
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search seller, address, phone, email, MLS…"
          className="w-full sm:w-1/2 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Seller</th>
              <th className="px-4 py-2">Address</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">MLS</th>
              <th className="px-4 py-2">Prev Price</th>
              <th className="px-4 py-2">Cancelled</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap">{r.seller_name || '-'}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{r.property_address || '-'}</div>
                  <div className="text-xs text-gray-500">
                    {[r.city, r.state, r.zip].filter(Boolean).join(', ') || ''}
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{r.phone || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.mls_number || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {typeof r.previous_list_price === 'number'
                    ? r.previous_list_price.toLocaleString()
                    : '-'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.cancelled_date ? dayjs(r.cancelled_date).format('YYYY-MM-DD') : '-'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.created_at ? dayjs(r.created_at).fromNow() : '-'}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  No cancelled listings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && <div className="text-xs text-gray-500">Loading…</div>}
    </div>
  );
}
