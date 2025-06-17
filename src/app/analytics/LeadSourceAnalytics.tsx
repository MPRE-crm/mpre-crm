'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const LeadSourceAnalytics = () => {
  const [sourceCounts, setSourceCounts] = useState([]) // To store the counts of leads per source
  const [error, setError] = useState(null)

  // Fetch lead counts by source when the component mounts
  useEffect(() => {
    const fetchLeadCounts = async () => {
      // Call the custom SQL function to get the lead counts by source
      const { data, error } = await supabase.rpc('get_lead_counts_by_source')

      if (error) {
        setError('Error fetching lead counts: ' + error.message)
      } else {
        setSourceCounts(data) // Set the data (lead counts per source)
      }
    }

    fetchLeadCounts() // Fetch the data
  }, []) // Empty dependency array ensures this effect runs once on component mount

  // Log the source counts for debugging
  useEffect(() => {
    console.log('Source Counts Data:', sourceCounts)
  }, [sourceCounts])

  return (
    <div>
      <h2>Lead Source Analytics</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Number of Leads</th>
          </tr>
        </thead>
        <tbody>
          {sourceCounts.map((item, index) => {
            // Make sure both item.source and item.lead_count are defined
            const key = item.source ? item.source + index : 'unknown-' + index // fallback if source is undefined

            return (
              <tr key={key}> {/* Ensure unique key by using fallback */}
                <td>{item.source}</td>
                <td>{item.lead_count}</td> {/* Display the count of leads per source */}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default LeadSourceAnalytics
