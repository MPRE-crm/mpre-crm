export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateIdxTrigger } from "../../../../../src/lib/samantha/evaluateIdxTrigger";
import { applyIdxActivity } from "../../../../../src/lib/samantha/applyIdxActivity";
import { resolvePostIdxAction } from "../../../../../src/lib/samantha/resolvePostIdxAction";

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

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

async function resolveLead({
  lead_id,
  email,
  phone,
  org_id,
}: {
  lead_id?: string | null;
  email?: string | null;
  phone?: string | null;
  org_id?: string | null;
}) {
  if (lead_id) {
    let query = supabase.from("leads").select("*").eq("id", lead_id);
    if (org_id) query = query.eq("org_id", org_id);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Lead lookup by id failed: ${error.message}`);
    if (data) return data;
  }

  if (email) {
    let query = supabase.from("leads").select("*").eq("email", email);
    if (org_id) query = query.eq("org_id", org_id);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Lead lookup by email failed: ${error.message}`);
    if (data) return data;
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    let query = supabase.from("leads").select("*").eq("phone", normalizedPhone);
    if (org_id) query = query.eq("org_id", org_id);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Lead lookup by phone failed: ${error.message}`);
    if (data) return data;
  }

  return null;
}

async function recalcAndApplyIdx(leadId: string, now: Date) {
  const last24hIso = subtractHours(now, 24).toISOString();
  const last7dIso = subtractDays(now, 7).toISOString();
  const last30dIso = subtractDays(now, 30).toISOString();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, last_idx_activity_at")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(leadError?.message || "Lead not found during IDX recalc");
  }

  const { data: idxViews24h, error: idxViews24hError } = await supabase
    .from("idx_views")
    .select("viewed_at")
    .eq("lead_id", leadId)
    .gte("viewed_at", last24hIso);

  if (idxViews24hError) {
    throw new Error(`Failed loading idx_views 24h: ${idxViews24hError.message}`);
  }

  const { data: idxViews30d, error: idxViews30dError } = await supabase
    .from("idx_views")
    .select("viewed_at")
    .eq("lead_id", leadId)
    .gte("viewed_at", last30dIso);

  if (idxViews30dError) {
    throw new Error(`Failed loading idx_views 30d: ${idxViews30dError.message}`);
  }

  const { data: idxSearch7d, error: idxSearch7dError } = await supabase
    .from("idx_search_requests")
    .select("created_at")
    .eq("lead_id", leadId)
    .gte("created_at", last7dIso);

  if (idxSearch7dError) {
    throw new Error(`Failed loading idx_search_requests 7d: ${idxSearch7dError.message}`);
  }

  const { data: idxSearch30d, error: idxSearch30dError } = await supabase
    .from("idx_search_requests")
    .select("created_at")
    .eq("lead_id", leadId)
    .gte("created_at", last30dIso);

  if (idxSearch30dError) {
    throw new Error(`Failed loading idx_search_requests 30d: ${idxSearch30dError.message}`);
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

  const applied = await applyIdxActivity({
    db: supabase,
    leadId,
    decision,
    idxViews30d: idxViews30d?.length ?? 0,
    idxSearchRequests30d: idxSearch30d?.length ?? 0,
    now,
  });

  return { decision, applied };
}

export async function POST(req: NextRequest) {
  try {
    const tokenHeader = req.headers.get("x-webhook-token") ?? "";
    const expected = process.env.WEBHOOK_SHARED_SECRET ?? "";

    if (!expected || tokenHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const {
      org_id = null,
      lead_id = null,
      email = null,
      phone = null,
      event_type = null,
      viewed_at = null,
      created_at = null,
      mls_id = null,
      address = null,
      city = null,
      price = null,
      beds = null,
      baths = null,
      thumbnail_url = null,
      property_url = null,
      params = {},
      status = null,
    } = body || {};

    if (!event_type) {
      return NextResponse.json({ error: "Missing event_type" }, { status: 400 });
    }

    const lead = await resolveLead({
      lead_id,
      email,
      phone,
      org_id,
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found for supplied lead_id/email/phone" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (event_type === "property_view" || event_type === "saved_property") {
      const insertViewedAt = viewed_at || now.toISOString();

      const { error: insertError } = await supabase.from("idx_views").insert({
        lead_id: lead.id,
        mls_id,
        address,
        city,
        price,
        beds,
        baths,
        thumbnail_url,
        property_url,
        viewed_at: insertViewedAt,
        org_id: lead.org_id,
      });

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to insert idx_view", details: insertError.message },
          { status: 500 }
        );
      }
    } else if (event_type === "search_request" || event_type === "saved_search") {
      const insertCreatedAt = created_at || now.toISOString();

      const { error: insertError } = await supabase
        .from("idx_search_requests")
        .insert({
          lead_id: lead.id,
          org_id: lead.org_id,
          params: {
            ...params,
            source_event_type: event_type,
            mls_id,
            address,
            city,
            price,
            beds,
            baths,
            property_url,
          },
          status: status || "received",
          created_at: insertCreatedAt,
        });

      if (insertError) {
        return NextResponse.json(
          {
            error: "Failed to insert idx_search_request",
            details: insertError.message,
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported event_type. Use property_view, saved_property, search_request, or saved_search.",
        },
        { status: 400 }
      );
    }

    const processed = await recalcAndApplyIdx(lead.id, now);

    const { data: refreshedLead, error: refreshedLeadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead.id)
      .single();

    if (refreshedLeadError || !refreshedLead) {
      return NextResponse.json(
        {
          error: "IDX processed but failed to reload lead for post-IDX action",
          details: refreshedLeadError?.message,
          processed,
        },
        { status: 500 }
      );
    }

    const post_idx_action = resolvePostIdxAction({
      lead: refreshedLead,
      now,
    });

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      org_id: lead.org_id,
      event_type,
      processed,
      post_idx_action,
    });
  } catch (error: any) {
    console.error("❌ IDX activity webhook error:", error);
    return NextResponse.json(
      { error: error.message || "IDX activity webhook failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;