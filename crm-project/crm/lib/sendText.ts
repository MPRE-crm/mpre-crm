import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

export async function sendText({
  to,
  message,
}: {
  to: string;
  message: string;
}) {
  try {
    await client.messages.create({
      body: message,
      from: twilioPhone,
      to,
    });
    console.log('✅ Text message sent to', to);
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
  }
}
