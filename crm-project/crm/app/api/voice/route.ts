import twilio from 'twilio';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

function clean(v?: string | null) {
  return (v || '').toString().trim();
}
function fmtPrice(v?: string | null) {
  const s = clean(v).replace(/[^\d]/g, '');
  if (!s) return 'your budget';
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return 'your budget';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');

  let name = 'there';
  let timeline = 'the near future';
  let price = 'your budget';
  let area = '';
  let bedrooms = '';
  let homeType = '';

  if (leadId) {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('name, move_timeline, price_range, preferred_area, bedrooms, home_type')
      .eq('id', leadId)
      .maybeSingle();

    if (!error && data) {
      name = clean(data.name).split(' ')[0] || name;
      timeline = clean(data.move_timeline) || timeline;
      price = fmtPrice(data.price_range);
      area = clean(data.preferred_area);
      bedrooms = clean(String(data.bedrooms ?? ''));
      homeType = clean(data.home_type);
    }
  }

  const introParts: string[] = [
    `Hi ${name}, this is Samantha, your Boise, Idaho real estate assistant calling on behalf of MPRE Boise.`,
  ];
  const details: string[] = [];
  if (timeline) details.push(`you're planning to move in ${timeline}`);
  if (price !== 'your budget') details.push(`with a budget around ${price}`);
  if (area) details.push(`and looking in ${area}`);
  if (details.length) introParts.push(`I saw ${details.join(', ')}.`);
  introParts.push(`Is now a good time to chat for about 60 seconds?`);

  const questions = [
    bedrooms
      ? `Are you still thinking about ${bedrooms} bedrooms, or would you consider more or fewer?`
      : `How many bedrooms would you prefer in your new home?`,
    area
      ? `Is ${area} still your ideal area, or are you open to nearby neighborhoods as well?`
      : `Do you have a specific area or neighborhood in mind?`,
    homeType
      ? `Are you set on a ${homeType}, or open to other home types?`
      : `Are you looking for a single-family home, townhouse, or something else?`,
    `Can you confirm your ideal move timeline?`,
    `Have you already been pre-approved for a mortgage?`,
    `Are you currently working with a real estate agent?`,
  ];

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, introParts.join(' '));
  twiml.pause({ length: 2 });

  questions.forEach((q) => {
    twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, q);
    twiml.pause({ length: 3 });
  });

  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    `Awesome—thanks for sharing that! I’d love to get you scheduled with one of our agents. What day or time this week works best for a quick 15-minute call or Zoom?`
  );

  return new Response(twiml.toString(), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
