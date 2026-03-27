import twilio from 'twilio';
import { supabase } from './supabase';
import { evaluateLeadContactState } from '../src/lib/samantha/contactGovernor';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

type SendTextArgs = {
  to: string;
  message: string;
  leadId?: string;
  bypassGovernor?: boolean;
};

export async function sendText({
  to,
  message,
  leadId,
  bypassGovernor = false,
}: SendTextArgs) {
  try {
    let lead: any = null;
    let governorDecision: ReturnType<typeof evaluateLeadContactState> | null = null;

    if (leadId) {
      const { data: leadRow, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) {
        console.error('❌ Failed to load lead before SMS:', leadError.message);
        return { success: false, error: leadError.message };
      }

      lead = leadRow;

      if (!bypassGovernor) {
        governorDecision = evaluateLeadContactState(lead, { now: new Date() });

        if (governorDecision.action !== 'text_now') {
          console.log('⚠️ Text blocked by governor for lead', leadId, governorDecision.reason_codes);
          return {
            success: false,
            error: 'Text blocked by governor',
            action: governorDecision.action,
            heat_status: governorDecision.heat_status,
            next_contact_at: governorDecision.next_contact_at,
            reason_codes: governorDecision.reason_codes,
            escalate_to_agent: governorDecision.escalate_to_agent,
          };
        }
      }
    }

    const result = await client.messages.create({
      body: message,
      from: twilioPhone,
      to,
    });

    console.log('✅ Text message sent to', to);

    if (leadId && lead) {
      const now = new Date();
      const nowIso = now.toISOString();
      const today = nowIso.slice(0, 10);
      const currentCount =
        lead?.texts_today_date === today ? Number(lead?.texts_today_count || 0) : 0;

      const bestHour = now.getHours();
      const bestDaypart =
        bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : 'evening';

      const effectiveDecision =
        governorDecision ?? evaluateLeadContactState(lead, { now });

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          last_contact_attempt_at: nowIso,
          last_text_attempt_at: nowIso,
          texts_today_count: currentCount + 1,
          texts_today_date: today,
          best_contact_channel: 'text',
          best_contact_hour: bestHour,
          best_contact_daypart: bestDaypart,
          next_contact_at: effectiveDecision.next_contact_at,
          lead_heat: effectiveDecision.heat_status,
          updated_at: nowIso,
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('⚠️ Failed to update lead after SMS:', updateError.message);
      }

      const { error: messageInsertError } = await supabase
        .from('messages')
        .insert({
          lead_id: leadId,
          lead_phone: to,
          direction: 'outgoing',
          body: message,
          status: result.status || 'sent',
          twilio_sid: result.sid,
          created_at: nowIso,
        });

      if (messageInsertError) {
        console.error('⚠️ Failed to log outgoing SMS:', messageInsertError.message);
      }
    }

    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error('❌ Failed to send SMS:', error);
    return { success: false, error: error?.message || 'Failed to send SMS' };
  }
}