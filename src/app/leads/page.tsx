// This must be before "use client" to work
export const dynamic = 'force-dynamic'

'use client'

import { Suspense } from 'react'
import LeadsContent from './LeadsContent'

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading leads...</div>}>
      <LeadsContent />
    </Suspense>
  )
}


