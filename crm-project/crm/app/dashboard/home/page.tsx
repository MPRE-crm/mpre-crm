'use client'

import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { createClient } from '@supabase/supabase-js'

dayjs.extend(relativeTime)

// Supabase client (browser-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseAnonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

type Lead = {
  id: string
  name: string | null
  email: string | null
}

type ViewRow = {
  id: string
  lead_id: string
  mls_id: string | null
  address: string | null
  city: string | null
  price: number | null
  beds: number | null
  baths: number | null
  thumbnail_url: string | null
  property_url: string | null
  viewed_at: string
  leads: Lead | null
}

type TimeRange = '24h' | '7d' | '30d'

export default function HomeIDXActivity() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ViewRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const sinceISO = useMemo(() => {
    const now = dayjs()
    if (timeRange === '24h') return now.subtract(24, 'hour').toISOString()
    if (timeRange === '30d') return now.subtract(30, 'day').toISOString()
    return now.subtract(7, 'day').toISOString()
  }, [timeRange])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('idx_views')
        .select(`
          id,
          lead_id,
          mls_id,
          address,
          city,
          price,
          beds,
          baths,
          thumbnail_url,
          property_url,
          viewed_at,
          leads:lead_id ( id, name, email )
        `)
        .gte('viewed_at', sinceISO)
        .order('viewed_at', { ascending: false })
        .limit(500)

      if (!mounted) return
      if (error) {
        setError(error.message)
        setRows([])
      } else {
        setRows((data as unknown as ViewRow[]) || [])
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [sinceISO])

  // Hot leads
  const hotLeads = useMemo(() => {
    const map = new Map<string, { lead: Lead; count: number }>()
    for (const r of rows) {
      if (!r.leads) continue
      const key = r.leads.id
      if (!map.has(key)) map.set(key, { lead: r.leads, count: 0 })
      map.get(key)!.count += 1
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [rows])

  // Top properties
  const topProperties = useMemo(() => {
    type PropKey = string
    const map = new Map<
      PropKey,
      {
        mls_id: string | null
        address: string | null
        city: string | null
        price: number | null
        beds: number | null
        baths: number | null
        thumbnail_url: string | null
        property_url: string | null
        count: number
        lastViewed: string
      }
    >()

    for (const r of rows) {
      const key = r.mls_id || r.address || r.id
      if (!map.has(key)) {
        map.set(key, {
          mls_id: r.mls_id,
          address: r.address,
          city: r.city,
          price: r.price,
          beds: r.beds,
          baths: r.baths,
          thumbnail_url: r.thumbnail_url,
          property_url: r.property_url,
          count: 0,
          lastViewed: r.viewed_at,
        })
      }
      const item = map.get(key)!
      item.count += 1
      if (dayjs(r.viewed_at).isAfter(item.lastViewed)) item.lastViewed = r.viewed_at
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || dayjs(b.lastViewed).valueOf() - dayjs(a.lastViewed).valueOf())
      .slice(0, 9)
  }, [rows])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">IDX Activity</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Range</label>
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Hot Leads */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Hot Leads</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hotLeads.map(({ lead, count }) => (
            <div key={lead.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">Lead</div>
              <div className="truncate font-medium">{lead.name || lead.email || '(no name)'}</div>
              <div className="mt-1 text-xl font-bold">{count} views</div>
            </div>
          ))}
          {hotLeads.length === 0 && !loading && (
            <div className="col-span-full text-sm text-gray-500">No activity in this range.</div>
          )}
        </div>
      </section>

      {/* Most Viewed Properties */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Most Viewed Properties</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topProperties.map((p, idx) => (
            <a
              key={idx}
              href={p.property_url || '#'}
              target={p.property_url ? '_blank' : undefined}
              rel={p.property_url ? 'noopener noreferrer' : undefined}
              className="flex gap-3 rounded-lg border bg-white p-4 shadow-sm hover:shadow"
            >
              <div className="h-20 w-28 overflow-hidden rounded bg-gray-100">
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt={p.address || 'Property'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.address || p.mls_id || 'Property'}</div>
                <div className="text-xs text-gray-500">
                  {p.city || ''} {p.price ? `• $${Number(p.price).toLocaleString()}` : ''}
                </div>
                <div className="text-xs text-gray-500">
                  {p.beds ?? '-'} bd • {p.baths ?? '-'} ba
                </div>
                <div className="mt-1 text-xs font-semibold">{p.count} views</div>
                <div className="text-xs text-gray-500">last {dayjs(p.lastViewed).fromNow()}</div>
              </div>
            </a>
          ))}
          {topProperties.length === 0 && !loading && (
            <div className="col-span-full text-sm text-gray-500">No property views in this range.</div>
          )}
        </div>
      </section>

      {/* Recent Views */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Recent Views</h2>
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Lead</th>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2">City</th>
                <th className="px-4 py-2">Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{dayjs(r.viewed_at).fromNow()}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.leads?.name || r.leads?.email || r.lead_id}</td>
                  <td className="px-4 py-2">
                    {r.property_url ? (
                      <a href={r.property_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {r.address || r.mls_id || 'View'}
                      </a>
                    ) : (
                      r.address || r.mls_id || '-'
                    )}
                  </td>
                  <td className="px-4 py-2">{r.city || '-'}</td>
                  <td className="px-4 py-2">${r.price ? Number(r.price).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    No recent activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="mt-2 text-xs text-gray-500">Loading…</div>}
      </section>
    </div>
  )
}
