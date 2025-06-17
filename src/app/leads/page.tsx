'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Dynamically import the LeadsContent component without SSR
const LeadsContent = dynamic(() => import('./LeadsContent'), {
  ssr: false,
})

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <LeadsContent />
    </Suspense>
  )
}

