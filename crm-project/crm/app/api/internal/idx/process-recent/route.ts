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

type LeadRow = {
  id: string;
  last_idx_activity_at?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit ?? 100), 500);

    const now = new Date();
    const last24hIso = subtractHours(now, 24).toISOString();
    const last7dIso = subtractDays(now, 7).toISOString();
    const last30dIso = subtractDays(now, 30).toISOString();

    const { data: recentViews, error: recentViewsError } = await supabase
      .from("idx_views")
      .select("lead_id")
      .not("lead_id", "is", null)
      .gte("viewed_at", last24hIso)
      .limit(limit * 5);

    if (recentViewsError) {
      return NextResponse.json(
        { error: "Failed loading recent idx_views", details: recentViewsError.message },
        { status: 500 }
      );
    }

    const { data: recentSearches, error: recentSearchesError } = await supabase
      .from("idx_search_requests")
      .select("lead_id")
      .not("lead_id", "is", null)
      .gte("created_at", last7dIso)
      .limit(limit * 5);

    if (recentSearchesError) {
      return NextResponse.json(
        { error: "Failed loading recent idx_search_requests", details: recentSearchesError.message },
        { status: 500 }
      );
    }

    const leadIds = Array.from(
      new Set(
        [...(recentViews || []), ...(recentSearches || [])]
          .map((r: any) => r.lead_id)
          .filter(Boolean)
      )
    ).slice(0, limit);

    if (leadIds.length === 0) {
      return NextResponse.json({
        success: true,
        scanned: 0,
        triggered: 0,
        skipped: 0,
        results: [],
      });
    }

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, last_idx_activity_at")
      .in("id", leadIds);

    if (leadsError) {
      return NextResponse.json(
        { error: "Failed loading leads", details: leadsError.message },
        { status: 500 }
      );
    }

    const leadMap = new Map<string, LeadRow>(
      ((leads || []) as LeadRow[]).map((lead) => [lead.id, lead])
    );

    const results: Array<Record<string, any>> = [];
    let triggeredCount = 0;
    let skippedCount = 0;

    for (const leadId of leadIds) {
      const lead = leadMap.get(leadId);

      if (!lead) {
        skippedCount += 1;
        results.push({
          lead_id: leadId,
          success: false,
          skipped: true,
          reason: "LEAD_NOT_FOUND",
        });
        continue;
      }

      const { data: idxViews24h, error: idxViews24hError } = await supabase
        .from("idx_views")
        .select("viewed_at")
        .eq("lead_id", leadId)
        .gte("viewed_at", last24hIso);

      if (idxViews24hError) {
        skippedCount += 1;
        results.push({
          lead_id: leadId,
          success: false,
          skipped: true,
          reason: "IDX_VIEWS_24H_LOAD_FAILED",
          details: idxViews24hError.message,
        });
        continue;
      }

      const { data: idxViews30d, error: idxViews30dError } = await supabase
        .from("idx_views")
        .select("viewed_at")
        .eq("lead_id", leadId)
        .gte("viewed_at", last30dIso);

      if (idxViews30dError) {
        skippedCount += 1;
        results.push({
          lead_id: leadId,
          success: false,
          skipped: true,
          reason: "IDX_VIEWS_30D_LOAD_FAILED",
          details: idxViews30dError.message,
        });
        continue;
      }

      const { data: idxSearch7d, error: idxSearch7dError } = await supabase
        .from("idx_search_requests")
        .select("created_at")
        .eq("lead_id", leadId)
        .gte("created_at", last7dIso);

      if (idxSearch7dError) {
        skippedCount += 1;
        results.push({
          lead_id: leadId,
          success: false,
          skipped: true,
          reason: "IDX_SEARCH_7D_LOAD_FAILED",
          details: idxSearch7dError.message,
        });
        continue;
      }

      const { data: idxSearch30d, error: idxSearch30dError } = await supabase
        .from("idx_search_requests")
        .select("created_at")
        .eq("lead_id", leadId)
        .gte("created_at", last30dIso);

      if (idxSearch30dError) {
        skippedCount += 1;
        results.push({
          lead_id: leadId,
          success: false,
          skipped: true,
          reason: "IDX_SEARCH_30D_LOAD_FAILED",
          details: idxSearch30dError.message,
        });
        continue;
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

      try {
        const applied = await applyIdxActivity({
          db: supabase,
          leadId,
          decision,
          idxViews30d: idxViews30d?.length ?? 0,
          idxSearchRequests30d: idxSearch30d?.length ?? 0,
          now,
        });

        if (decision.triggered) triggeredCount += 1;

        results.push({
          lead_id: leadId,
          success: true,
          decision,
          result: applied,
        });
      } catch (applyError: any) {
        skippedCount += 1;
        results.push({
          lead_id: leadId,
          success: false,
          skipped: true,
          reason: "IDX_APPLY_FAILED",
          details: applyError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: leadIds.length,
      triggered: triggeredCount,
      skipped: skippedCount,
      results,
    });
  } catch (error: any) {
    console.error("❌ IDX process-recent route error:", error);
    return NextResponse.json(
      { error: error.message || "IDX recent processing failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;