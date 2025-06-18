'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [listings, setListings] = useState<any[]>([])  // Adjust type if needed
  const [error, setError] = useState<string | null>(null)

  // Fetch IMLS listings data
  useEffect(() => {
    const fetchListings = async () => {
      const { data, error } = await supabase.from('listings').select('*')  // Adjust query for your data
      if (error) {
        setError(error.message)
      } else {
        setListings(data ?? [])
      }
    }

    fetchListings()
  }, [])

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-2xl font-bold mb-4">Welcome to MPRE CRM</h1>

        <p className="text-center sm:text-left">
          This is your custom page where IMLS can view your data.
        </p>

        {/* Error Message */}
        {error && <p className="text-red-500">{error}</p>}

        {/* Listings */}
        <div className="flex flex-col gap-4">
          {listings.length > 0 ? (
            listings.map((listing, index) => (
              <div key={index} className="border p-4 rounded-md shadow-sm hover:shadow-md">
                <h3 className="text-lg font-semibold">{listing.name || 'Unnamed Listing'}</h3>
                <p>{listing.description}</p>
                <p><strong>Price:</strong> ${listing.price}</p>
                <p><strong>Status:</strong> {listing.status}</p>
                <p><strong>Location:</strong> {listing.location}</p>
              </div>
            ))
          ) : (
            <p>No listings available at this time.</p>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Examples
        </a>
      </footer>
    </div>
  )
}

