'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import LeadsContent from './LeadsContent'

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <LeadsContent />
    </Suspense>
  )
}
