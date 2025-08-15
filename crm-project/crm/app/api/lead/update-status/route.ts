import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Expect fields you POST from Twilio Studio: lead_id, flow_key, channel, to_number, status, payload
    const { lead_id, flow_key, channel, to_number, status, payload } = body;

    const { error } = await supabase.from("lead_interactions").insert({
      lead_id, flow_key, channel, to_number, status, payload, lead_source: payload?.lead_source
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
