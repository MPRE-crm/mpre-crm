'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Force client-side only rendering
const LeadsContent = dynamic(() => import('./LeadsContent'), { ssr: false })

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <LeadsContent />
    </Suspense>
  )
}


