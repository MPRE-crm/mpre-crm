// src/app/api/flows/list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET() {
  const { data, error } = await supabase.from("twilio_flows").select("key, env_var, active").order("key");
  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data ?? []);
}
