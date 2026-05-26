export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  role: "agent" | "admin" | "platform_admin";
  org_id: string | null;
};

type ApprovalRow = {
  id: string;
  org_id: string | null;
  current_agent_id: string | null;
  status: string | null;
  created_at: string | null;
  rotation_attempt: number | null;
};

type UserRow = {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string | null;
  org_id: string | null;
};

function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function formatAgentLabel(agentId: string, userMap: Map<string, UserRow>) {
  const user = userMap.get(agentId);
  if (!user) return `Agent ${agentId.slice(0, 8)}`;
  return user.name || user.email || `Agent ${agentId.slice(0, 8)}`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();

    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let userId: string | null = null;

    if (bearer) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(bearer);

      if (userError || !user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      userId = user.id;
    } else {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, org_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { ok: false, error: profileError?.message || "Profile not found" },
        { status: 403 }
      );
    }

    const typedProfile = profile as ProfileRow;

    const range = req.nextUrl.searchParams.get("range") || "7d";
    const now = new Date();
    const since = new Date(now);

    if (range === "24h") {
      since.setHours(since.getHours() - 24);
    } else if (range === "30d") {
      since.setDate(since.getDate() - 30);
    } else {
      since.setDate(since.getDate() - 7);
    }

    let approvalsQuery = supabaseAdmin
      .from("appointment_approvals")
      .select(`
        id,
        org_id,
        current_agent_id,
        status,
        created_at,
        rotation_attempt
      `)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (typedProfile.role === "agent") {
      approvalsQuery = approvalsQuery.eq("current_agent_id", typedProfile.id);
    } else if (typedProfile.role === "admin" && typedProfile.org_id) {
      approvalsQuery = approvalsQuery.eq("org_id", typedProfile.org_id);
    }

    const { data: approvalsData, error: approvalsError } = await approvalsQuery;

    if (approvalsError) {
      return NextResponse.json(
        { ok: false, error: approvalsError.message },
        { status: 500 }
      );
    }

    const approvals = (approvalsData || []) as ApprovalRow[];
    const agentIds = Array.from(
      new Set(approvals.map((a) => a.current_agent_id).filter(Boolean))
    ) as string[];

    let userMap = new Map<string, UserRow>();

    if (agentIds.length > 0) {
      let usersQuery = supabaseAdmin
        .from("users")
        .select("id, user_id, name, email, org_id")
        .in("user_id", agentIds);

      if (typedProfile.role === "admin" && typedProfile.org_id) {
        usersQuery = usersQuery.eq("org_id", typedProfile.org_id);
      }

      const { data: usersData, error: usersError } = await usersQuery;

      if (usersError) {
        return NextResponse.json(
          { ok: false, error: usersError.message },
          { status: 500 }
        );
      }

      userMap = new Map(
        ((usersData || []) as UserRow[])
          .filter((user) => user.user_id)
          .map((user) => [user.user_id as string, user])
      );
    }

    const grouped = new Map<
      string,
      {
        agentId: string;
        label: string;
        total: number;
        pending: number;
        accepted: number;
        declined: number;
        expired: number;
        avgRotationAttempt: number;
        lastAssignedAt: string | null;
      }
    >();

    for (const row of approvals) {
      if (!row.current_agent_id) continue;

      if (!grouped.has(row.current_agent_id)) {
        grouped.set(row.current_agent_id, {
          agentId: row.current_agent_id,
          label: formatAgentLabel(row.current_agent_id, userMap),
          total: 0,
          pending: 0,
          accepted: 0,
          declined: 0,
          expired: 0,
          avgRotationAttempt: 0,
          lastAssignedAt: null,
        });
      }

      const item = grouped.get(row.current_agent_id)!;
      item.total += 1;

      const status = String(row.status || "").toLowerCase();
      if (status === "pending") item.pending += 1;
      if (status === "accepted") item.accepted += 1;
      if (status === "declined") item.declined += 1;
      if (status === "expired") item.expired += 1;

      const rotationAttempt =
        typeof row.rotation_attempt === "number" ? row.rotation_attempt : 0;
      item.avgRotationAttempt += rotationAttempt;

      if (
        !item.lastAssignedAt ||
        (row.created_at && new Date(row.created_at) > new Date(item.lastAssignedAt))
      ) {
        item.lastAssignedAt = row.created_at;
      }
    }

    const rows = Array.from(grouped.values())
      .map((row) => ({
        ...row,
        avgRotationAttempt:
          row.total > 0 ? Number((row.avgRotationAttempt / row.total).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      ok: true,
      range,
      rows,
    });
  } catch (error: any) {
    console.error("fairness dashboard route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}