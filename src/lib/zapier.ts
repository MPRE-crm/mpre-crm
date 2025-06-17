export async function sendStatusWebhook(leadData: {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}) {
  const response = await fetch('/api/zapier', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    console.error('Error sending webhook via /api/zapier:', await response.text());
  }
}


