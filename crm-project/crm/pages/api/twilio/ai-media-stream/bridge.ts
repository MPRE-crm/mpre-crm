// crm/pages/api/twilio/ai-media-stream/bridge.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';

// Reuse a single WebSocketServer across hot-reloads in dev
const g = globalThis as any;
let wss: WebSocketServer | undefined = g.__TWILIO_BRIDGE_WSS__;

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

// Connect to OpenAI Realtime with headers (Node ws supports headers)
function connectOpenAI(): WebSocket {
  return new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });
}

function handleTwilioConnection(
  client: WebSocket,
  leadIdFromUrl?: string,
  systemPromptB64FromUrl?: string
) {
  let leadId = leadIdFromUrl || '';
  const openaiWS = connectOpenAI();

  openaiWS.on('open', () => {
    if (systemPromptB64FromUrl) {
      const prompt = Buffer.from(systemPromptB64FromUrl, 'base64').toString('utf-8');
      openaiWS.send(JSON.stringify({ type: 'system', content: prompt }));
    }
  });

  openaiWS.on('message', async (buf: Buffer) => {
    try {
      const data = JSON.parse(buf.toString());

      if (data?.type === 'update_email' && data?.content) {
        await supabase.from('leads').update({ email: data.content }).eq('id', leadId);
      }

      if (data?.type === 'update_structured' && typeof data?.content === 'object') {
        const allowed = [
          'city', 'county', 'motivation', 'agent_status', 'purchase_type', 'appointment_date', 'appointment_time',
        ] as const;
        const payload: Record<string, any> = {};
        for (const k of allowed) {
          if (k in data.content && (data.content as any)[k] !== '') {
            payload[k] = (data.content as any)[k];
          }
        }
        if (Object.keys(payload).length) {
          await supabase.from('leads').update(payload).eq('id', leadId);
        }
      }

      if (data?.type === 'send_guide') {
        console.log(`📧📱 Send relocation guide (lead ${leadId})`);
        // TODO: email/SMS the guide
      }

      if (data?.type === 'conversation_summary' && typeof data?.content === 'string') {
        await supabase.from('leads').update({ notes: data.content }).eq('id', leadId);
      }

      if (data?.type === 'transfer_call' && data?.content) {
        console.log(`📞 Transfer requested to ${data.content}`);
        // TODO: trigger transfer via Twilio
      }

      if (data?.type === 'audio' && data?.data) {
        client.send(JSON.stringify({ event: 'media', media: { payload: data.data } }));
      }
    } catch {
      // ignore non-JSON frames
    }
  });

  openaiWS.on('close', () => {
    try { client.close(); } catch {}
  });

  client.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.event === 'start') {
        console.log('▶️ Twilio stream started');
        const params = msg.start?.customParameters || {};
        if (!leadId && params.leadId) leadId = params.leadId;
        const systemPromptB64 = params.systemPrompt;
        if (systemPromptB64 && openaiWS?.readyState === WebSocket.OPEN) {
          const prompt = Buffer.from(systemPromptB64, 'base64').toString('utf-8');
          openaiWS.send(JSON.stringify({ type: 'system', content: prompt }));
        }
      }

      if (msg.event === 'media' && msg.media?.payload && openaiWS?.readyState === WebSocket.OPEN) {
        openaiWS.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: msg.media.payload }));
        openaiWS.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        openaiWS.send(JSON.stringify({ type: 'response.create' }));
      }

      if (msg.event === 'stop') {
        console.log('⏹ Twilio stream stopped');
        try { openaiWS?.close(); } catch {}
        try { client.close(); } catch {}
      }
    } catch {
      // ignore parse errors
    }
  });

  client.on('close', () => {
    try { openaiWS?.close(); } catch {}
  });
}

// Pages API route
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket) {
    res.status(500).send('No socket');
    return;
  }

  if (!wss) {
    const server = (res.socket as any).server; // cast to access 'server'
    wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: any, socket: any, head: any) => {
      const { url } = request;
      if (!url || !url.startsWith('/api/twilio/ai-media-stream/bridge')) return;

      const parsed = new URL(request.url, `http://${request.headers.host}`);
      const leadId = parsed.searchParams.get('lead_id') || undefined;
      const systemPromptB64 = parsed.searchParams.get('systemPrompt') || undefined;

      wss!.handleUpgrade(request, socket, head, (wsClient) => {
        handleTwilioConnection(wsClient, leadId, systemPromptB64);
      });
    });

    g.__TWILIO_BRIDGE_WSS__ = wss;
    console.log('✅ Twilio bridge WebSocket server ready');
  }

  res.status(200).json({ ok: true });
}
