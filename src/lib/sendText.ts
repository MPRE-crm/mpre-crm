import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const sendWelcomeText = async (
  to: string,
  name: string,
  timeline: string,
  price: string
) => {
  const message = generateCustomMessage(name, timeline, price);

  return await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  });
};

function generateCustomMessage(name: string, timeline: string, price: string) {
  return `Hi ${name}, this is Mike with MPRE Boise. I saw you're planning to move in ${timeline} with a budget around ${price}. I can set up a personalized home search for you right away. Want me to get that started?`;
}
