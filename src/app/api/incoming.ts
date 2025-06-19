import type { NextApiRequest, NextApiResponse } from 'next'
import { OpenAI } from 'openai'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const from = req.body.From
  const to = req.body.To
  const incomingMessage = req.body.Body

  if (!from || !incomingMessage) {
    return res.status(400).json({ error: 'Missing parameters from Twilio' })
  }

  try {
    // Log incoming message
    await supabase.from('messages').insert({
      lead_phone: from,
      direction: 'incoming',
      body: incomingMessage,
    })

    // Generate AI reply
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful and friendly real estate assistant for Boise, Idaho. Respond in a natural, engaging tone.',
        },
        {
          role: 'user',
          content: incomingMessage,
        },
      ],
    })

    const replyText = aiResponse.choices[0]?.message?.content?.trim()

    if (!replyText) throw new Error('AI failed to generate a response')

    // Send reply via Twilio
    await twilioClient.messages.create({
      from: to,
      to: from,
      body: replyText,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`
    })

    // Log outgoing message
    await supabase.from('messages').insert({
      lead_phone: from,
      direction: 'outgoing',
      body: replyText,
      status: 'pending',
    })

    return res.status(200).send('OK')
  } catch (error) {
    const err = error as Error
    console.error('Error in incoming handler:', err.message)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}

