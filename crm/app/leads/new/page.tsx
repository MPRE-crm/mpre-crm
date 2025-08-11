'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewLeadPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('new')
  const [source, setSource] = useState('referral')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('leads').insert([
      { name, email, phone, status, source, appointment_date: appointmentDate }
    ])

    setLoading(false)

    if (error) {
      alert('Error adding lead: ' + error.message)
    } else {
      router.push('/leads')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Add a New Lead</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}
      >
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} required>
          <option value="new">New</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
          <option value="closed">Closed</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} required>
          <option value="referral">Referral</option>
          <option value="website">Website</option>
          <option value="social">Social Media</option>
          <option value="ad">Advertisement</option>
          <option value="other">Other</option>
        </select>
        <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Add Lead'}</button>
      </form>
    </div>
  )
}
