// crm-project/crm/app/api/twilio/utils/triggerAppointmentFlow/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import qs from "qs";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLOW_EXEC_URL =
  process.env.TWILIO_FLOW_EXECUTIONS_URL ||
  "https://studio.twilio.com/v2/Flows/FW88d76c8c4a90aa1159ae34f135179c91/Executions";

const toE164 = (p) => {
  const digits = String(p ?? "").replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+1${digits}`;
};

// TODO: replace with your real availability logic
async function getAvailableTimes() {
  return ["Today 3 PM", "Tomorrow 9 AM"];
}

async function runTriggerAppointmentFlow(id, env) {
  if (!id) return { ok: false, error: "Missing lead id" };

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select(
      "id, name, phone, appointment_date, new_appointment_date, new_appointment_time"
    )
    .eq("id", id)
    .single();

  if (leadError || !lead) {
    console.error("Lead fetch error:", leadError);
    return { ok: false, error: "Lead not found" };
  }

  if (!lead.phone) return { ok: false, error: "Lead missing phone" };

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { ok: false, error: "Missing Twilio configuration" };
  }

  const to = toE164(lead.phone);
  const firstName = (lead.name || "there").split(" ")[0];
  const [timeOption1, timeOption2] = await getAvailableTimes();

  try {
    const resp = await axios.post(
      FLOW_EXEC_URL,
      qs.stringify({
        To: to,
        From: TWILIO_PHONE_NUMBER,
        Parameters: JSON.stringify({
          lead_id: id,
          lead_name: firstName,
          prior_appointment_date: lead.appointment_date || null,
          new_appointment_date: lead.new_appointment_date || null,
          new_appointment_time: lead.new_appointment_time || null,
          time_option_1: timeOption1,
          time_option_2: timeOption2,
        }),
      }),
      {
        auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const selectedTime = resp?.data?.selected_time || null;
    const selectedDate = resp?.data?.selected_date || null;

    if (selectedTime || selectedDate) {
      await supabaseAdmin
        .from("leads")
        .update({
          new_appointment_date: selectedDate,
          new_appointment_time: selectedTime,
        })
        .eq("id", id);
    }

    return { ok: true, executionSid: resp?.data?.sid || null };
  } catch (err) {
    console.error(
      "Twilio request failed:",
      err?.response?.status,
      err?.response?.data || err
    );
    return { ok: false, error: "Twilio request failed" };
  }
}

// ✅ Explicit handlers
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    const result = await runTriggerAppointmentFlow(String(id || ""), process.env);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("triggerAppointmentFlow error:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export const GET = POST;
