import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

export async function sendWelcomeText(
  phone: string,
  name: string,
  moveTimeline: string,
  priceRange: string
) {
  const message = `Hi ${name}, this is Mike with MPRE Boise. Based on your timeline (${moveTimeline}) and price range (${priceRange}), I’ve got some homes that could be a great fit. Want me to text you a few listings?`;

  try {
    await client.messages.create({
      body: message,
      from: twilioPhone,
      to: phone,
    });
    console.log('✅ Text message sent to', phone);
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
  }
}

