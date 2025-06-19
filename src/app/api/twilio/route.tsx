// src/app/api/twilio/route.ts

import { NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER!

const client = twilio(accountSid, authToken)

export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json()

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 })
    }

    const result = await client.messages.create({
      to: phone,
      from: fromNumber,
      body: message
    })

    return NextResponse.json({ success: true, sid: result.sid }, { status: 200 })
  } catch (err) {
    console.error('Twilio error:', err)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
