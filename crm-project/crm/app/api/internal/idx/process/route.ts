export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateIdxTrigger } from "../../../../../src/lib/samantha/evaluateIdxTrigger";
import { applyIdxActivity } from "../../../../../src/lib/samantha/applyIdxActivity";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });
    }

    const now = new Date();
    const last24hIso = subtractHours(now, 24).toISOString();
    const last7dIso = subtractDays(now, 7).toISOString();
    const last30dIso = subtractDays(now, 30).toISOString();

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, last_idx_activity_at")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data: idxViews24h, error: idxViews24hError } = await supabase
      .from("idx_views")
      .select("viewed_at")
      .eq("lead_id", lead_id)
      .gte("viewed_at", last24hIso);

    if (idxViews24hError) {
      return NextResponse.json(
        { error: "Failed to load idx_views 24h", details: idxViews24hError.message },
        { status: 500 }
      );
    }

    const { data: idxViews30d, error: idxViews30dError } = await supabase
      .from("idx_views")
      .select("viewed_at")
      .eq("lead_id", lead_id)
      .gte("viewed_at", last30dIso);

    if (idxViews30dError) {
      return NextResponse.json(
        { error: "Failed to load idx_views 30d", details: idxViews30dError.message },
        { status: 500 }
      );
    }

    const { data: idxSearch7d, error: idxSearch7dError } = await supabase
      .from("idx_search_requests")
      .select("created_at")
      .eq("lead_id", lead_id)
      .gte("created_at", last7dIso);

    if (idxSearch7dError) {
      return NextResponse.json(
        { error: "Failed to load idx_search_requests 7d", details: idxSearch7dError.message },
        { status: 500 }
      );
    }

    const { data: idxSearch30d, error: idxSearch30dError } = await supabase
      .from("idx_search_requests")
      .select("created_at")
      .eq("lead_id", lead_id)
      .gte("created_at", last30dIso);

    if (idxSearch30dError) {
      return NextResponse.json(
        { error: "Failed to load idx_search_requests 30d", details: idxSearch30dError.message },
        { status: 500 }
      );
    }

    const latestIdxViewAt =
      idxViews24h && idxViews24h.length > 0
        ? idxViews24h
            .map((r: any) => r.viewed_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] ?? lead.last_idx_activity_at ?? null
        : lead.last_idx_activity_at ?? null;

    const decision = evaluateIdxTrigger({
      idxViews24h: idxViews24h?.length ?? 0,
      idxSearchRequests7d: idxSearch7d?.length ?? 0,
      lastIdxActivityAt: latestIdxViewAt,
    });

    const result = await applyIdxActivity({
      db: supabase,
      leadId: lead_id,
      decision,
      idxViews30d: idxViews30d?.length ?? 0,
      idxSearchRequests30d: idxSearch30d?.length ?? 0,
      now,
    });

    return NextResponse.json({
      success: true,
      lead_id,
      decision,
      result,
    });
  } catch (error: any) {
    console.error("❌ IDX process route error:", error);
    return NextResponse.json(
      { error: error.message || "IDX processing failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;