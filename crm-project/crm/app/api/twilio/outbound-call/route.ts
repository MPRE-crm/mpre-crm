import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const TWILIO_PHONE_NUMBER = "+12082856773"; // Your Twilio phone number

export async function POST(req: Request) {
  try {
    const { lead_id } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });
    }

    // Pull lead info from Supabase
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, name, phone")
      .eq("id", lead_id)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.phone) {
      return NextResponse.json({ error: "Lead missing phone number" }, { status: 400 });
    }

    // Outbound call via Twilio
    const call = await twilioClient.calls.create({
      to: lead.phone,
      from: TWILIO_PHONE_NUMBER,
      url: `https://easyrealtor.homes/api/twilio/ai-stream?lead_id=${lead_id}`,
    });

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      to: lead.phone,
      from: TWILIO_PHONE_NUMBER,
    });
  } catch (err: any) {
    console.error("Error creating outbound call:", err);
    return NextResponse.json(
      { error: "Failed to create outbound call", details: err.message },
      { status: 500 }
    );
  }
}
