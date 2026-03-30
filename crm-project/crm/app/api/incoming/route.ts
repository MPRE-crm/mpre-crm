// app/api/incoming/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { sendText } from "../../../lib/sendText";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getOpenAI() {
  const { default: OpenAI } = await import("openai");
  const apiKey = requireEnv("OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function getDaypart(hour: number) {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let from: string | undefined;
  let to: string | undefined;
  let incomingMessage: string | undefined;
  let twilioSid: string | undefined;

  try {
    if (ct.includes("application/x-www-form-urlencoded")) {
      const raw = await req.text();
      const params = new URLSearchParams(raw);
      from = params.get("From") ?? undefined;
      to = params.get("To") ?? undefined;
      incomingMessage = params.get("Body") ?? undefined;
      twilioSid = params.get("MessageSid") ?? undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      from = body.From || body.from;
      to = body.To || body.to;
      incomingMessage = body.Body || body.body;
      twilioSid = body.MessageSid || body.messageSid || body.sid;
    }

    if (!from || !incomingMessage) {
      return NextResponse.json(
        { error: "Missing parameters from Twilio" },
        { status: 400 }
      );
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", from)
      .maybeSingle();

    const now = new Date();
    const nowIso = now.toISOString();
    const bestHour = now.getHours();
    const bestDaypart = getDaypart(bestHour);

    await supabase.from("messages").insert({
      lead_phone: from,
      lead_id: lead?.id ?? null,
      direction: "incoming",
      body: incomingMessage,
      status: "received",
      twilio_sid: twilioSid ?? null,
      created_at: nowIso,
    });

    if (lead?.id) {
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          last_replied_text_at: nowIso,
          last_meaningful_engagement_at: nowIso,
          lead_heat: "hot",
          hot_until: addHours(now, 48).toISOString(),
          next_contact_at: null,
          best_contact_channel: "text",
          best_contact_hour: bestHour,
          best_contact_daypart: bestDaypart,
          updated_at: nowIso,
        })
        .eq("id", lead.id);

      if (leadUpdateError) {
        console.error("Failed to update lead after inbound SMS:", leadUpdateError.message);
      }
    }

    const openai = await getOpenAI();
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful and friendly real estate assistant for Boise, Idaho. Respond in a natural, engaging tone.",
        },
        { role: "user", content: incomingMessage },
      ],
    });

    const replyText = aiResponse.choices[0]?.message?.content?.trim();
    if (!replyText) throw new Error("AI failed to generate a response");

    const executionMode = process.env.SAMANTHA_EXECUTION_MODE || "mock";

    if (executionMode === "mock") {
      await supabase.from("messages").insert({
        lead_phone: from,
        lead_id: lead?.id ?? null,
        direction: "outgoing",
        body: replyText,
        status: "mock_queued",
        twilio_sid: `mock-${Date.now()}`,
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        lead_id: lead?.id ?? null,
        mode: "mock",
      });
    }

    const smsResult = await sendText({
      to: from,
      message: replyText,
      leadId: lead?.id,
      bypassGovernor: true,
    });

    if (!smsResult.success) {
      throw new Error(smsResult.error || "Failed to send AI reply");
    }

    await supabase.from("messages").insert({
      lead_phone: from,
      lead_id: lead?.id ?? null,
      direction: "outgoing",
      body: replyText,
      status: "sent",
      twilio_sid: smsResult.sid ?? null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, lead_id: lead?.id ?? null, mode: "live" });
  } catch (err: any) {
    console.error("Error in incoming handler:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}