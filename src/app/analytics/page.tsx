'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AnalyticsPage() {
  const [data, setData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('analytics').select('*')
      if (error) setError(error.message)
      else setData(data ?? [])
    }

    fetchData()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Analytics Page</h1>
      {error ? (
        <div>Error loading analytics: {error}</div>
      ) : (
        <ul className="space-y-2">
          {data.map((item, index) => (
            <li key={index} className="border p-2 rounded">
              {JSON.stringify(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

