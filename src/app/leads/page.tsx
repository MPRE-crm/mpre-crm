import dynamic from 'next/dynamic'

// Force client-side only
const LeadsContent = dynamic(() => import('./LeadsContent'), { ssr: false })

export default function LeadsPage() {
  return <LeadsContent />
}



