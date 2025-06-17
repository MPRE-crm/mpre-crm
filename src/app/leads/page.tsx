'use client'

import { Suspense } from 'react'
import LeadsContent from './LeadsContent'

export const dynamic = 'force-dynamic'

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <LeadsContent />
    </Suspense>
  )
}
