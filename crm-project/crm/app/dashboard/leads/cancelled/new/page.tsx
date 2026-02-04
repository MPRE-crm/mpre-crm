'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// ----- Supabase (browser) -----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function NewCancelledListingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    seller_name: '',
    property_address: '',
    city: '',
    state: 'ID',
    zip: '',
    phone: '',
    email: '',
    mls_number: '',
    previous_list_price: '',
    cancelled_date: '',
    notes: '',
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.from('cancelled_listings').insert([
      {
        seller_name: form.seller_name || null,
        property_address: form.property_address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        email: form.email || null,
        mls_number: form.mls_number || null,
        previous_list_price: form.previous_list_price ? Number(form.previous_list_price) : null,
        cancelled_date: form.cancelled_date || null,
        notes: form.notes || null,
      },
    ]);

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // ✅ CHANGED: go to cancelled listings list so you can actually see what you added
    router.push('/dashboard/leads/cancelled');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Add Cancelled Listing</h1>
        <p className="text-sm text-gray-500">Manual intake for cancelled / withdrawn listings.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            placeholder="Seller Name"
            value={form.seller_name}
            onChange={(e) => update('seller_name', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="Property Address"
            value={form.property_address}
            onChange={(e) => update('property_address', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm sm:col-span-2"
          />

          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="State"
            value={form.state}
            onChange={(e) => update('state', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="Zip"
            value={form.zip}
            onChange={(e) => update('zip', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="MLS Number"
            value={form.mls_number}
            onChange={(e) => update('mls_number', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="Previous List Price"
            value={form.previous_list_price}
            onChange={(e) => update('previous_list_price', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            type="date"
            value={form.cancelled_date}
            onChange={(e) => update('cancelled_date', e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={4}
        />

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-gray-900 px-5 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Cancelled Listing'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/dashboard/leads/cancelled')}
            className="rounded-md border px-5 py-2 text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
