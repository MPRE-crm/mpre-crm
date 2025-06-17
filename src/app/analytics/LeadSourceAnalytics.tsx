'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type LeadSourceData = {
  source: string;
  lead_count: number;
};

const LeadSourceAnalytics = () => {
  const [sourceCounts, setSourceCounts] = useState<LeadSourceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLeadCounts = async () => {
      const { data, error } = await supabase.rpc('get_lead_counts_by_source');

      if (error) {
        setError('Error fetching lead counts: ' + error.message);
      } else {
        setSourceCounts((data as LeadSourceData[]) ?? []);
      }
    };

    fetchLeadCounts();
  }, []);

  useEffect(() => {
    console.log('Source Counts Data:', sourceCounts);
  }, [sourceCounts]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Lead Source Analytics</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Source</th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Number of Leads</th>
          </tr>
        </thead>
        <tbody>
          {sourceCounts.map((item, index) => (
            <tr key={`${item.source}-${index}`}>
              <td>{item.source}</td>
              <td>{item.lead_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeadSourceAnalytics;
