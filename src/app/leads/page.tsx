'use client'

import { Suspense } from 'react'
import LeadsClient from './LeadsClient'

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <LeadsClient />
    </Suspense>
  )
}


