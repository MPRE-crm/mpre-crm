'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns'

type Message = {
  id: string
  lead_phone: string
  direction: 'incoming' | 'outgoing'
  body: string
  created_at: string
}

export default function ConversationsPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const groupedPhones = Array.from(new Set(messages.map(msg => msg.lead_phone)))

  // Fetch all messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
      } else {
        setMessages(data as Message[])
      }
    }

    fetchMessages()
  }, [])

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        payload => {
          const newMessage = payload.new as Message
          setMessages(prev => [...prev, newMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Auto-scroll when messages or lead change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, selectedPhone])

  const selectedMessages = messages.filter(msg => msg.lead_phone === selectedPhone)

  return (
    <div className="flex h-screen">
      <div className="w-1/4 border-r overflow-y-auto">
        <h2 className="text-lg font-bold p-4">Leads</h2>
        {groupedPhones.map(phone => (
          <div
            key={phone}
            onClick={() => setSelectedPhone(phone)}
            className={`p-3 cursor-pointer border-b ${
              selectedPhone === phone ? 'bg-blue-100 font-semibold' : ''
            }`}
          >
            {phone}
          </div>
        ))}
      </div>

      <div className="w-3/4 flex flex-col justify-between p-4">
        <div className="overflow-y-auto flex-grow space-y-2" id="chat-box">
          {selectedMessages.map(msg => (
            <div
              key={msg.id}
              className={`max-w-md p-3 rounded-lg ${
                msg.direction === 'incoming' ? 'bg-gray-200 self-start' : 'bg-green-200 self-end'
              }`}
            >
              <div className="text-sm">{msg.body}</div>
              <div className="text-xs text-gray-600 mt-1">
                {format(new Date(msg.created_at), 'PPpp')}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {selectedPhone && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const input = (e.target as HTMLFormElement).elements.namedItem('message') as HTMLInputElement
              const text = input.value.trim()
              if (!text) return

              const { error } = await supabase.from('messages').insert({
                lead_phone: selectedPhone,
                direction: 'outgoing',
                body: text
              })

              if (!error) {
                input.value = ''

                // 🔥 Trigger direct SMS via Twilio
                await fetch('/api/twilio', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    phone: selectedPhone,
                    message: text
                  })
                })
              } else {
                console.error('Error sending message:', error)
              }
            }}
            className="mt-4 flex space-x-2"
          >
            <input
              name="message"
              type="text"
              placeholder="Type a message..."
              className="flex-grow border rounded px-4 py-2"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
