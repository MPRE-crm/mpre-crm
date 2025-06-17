'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LeadsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') || '')

  useEffect(() => {
    const fetchLeads = async () => {
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) setError(error.message)
      else setLeads(data ?? [])
    }

    fetchLeads()
  }, [statusFilter])

  const handleDelete = async (id: string) => {
    await supabase.from('leads').delete().eq('id', id)
    setLeads(leads.filter((lead) => lead.id !== id))
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value)
    const params = new URLSearchParams(window.location.search)
    if (e.target.value) params.set('status', e.target.value)
    else params.delete('status')
    router.push('/leads?' + params.toString())
  }

  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Lead List</h1>

        <div className="mb-4">
          <label className="mr-2">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="border p-1 rounded"
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {error ? (
          <div>Error loading leads: {error}</div>
        ) : leads.length > 0 ? (
          <ul className="space-y-2">
            {leads.map((lead) => (
              <li key={lead.id} className="border p-4 rounded-md shadow-sm hover:shadow-md transition">
                <Link href={`/leads/${lead.id}`} className="text-lg font-semibold text-blue-600 hover:underline">
                  {lead.name || '(No Name)'}
                </Link>
                <div><strong>Email:</strong> {lead.email}</div>
                <div><strong>Phone:</strong> {lead.phone}</div>
                <div><strong>Status:</strong> {lead.status}</div>
                <div><strong>Source:</strong> {lead.source}</div>
                <div><strong>Appointment:</strong> {lead.appointment_date || 'N/A'}</div>
                <div className="mt-2 space-x-4">
                  <Link href={`/leads/${lead.id}/edit`} className="text-blue-500 hover:underline">[Edit]</Link>
                  <button
                    onClick={() => handleDelete(lead.id)}
                    className="text-red-500 hover:underline"
                  >
                    [Delete]
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No leads found.</p>
        )}
      </div>
    </Suspense>
  )
}
