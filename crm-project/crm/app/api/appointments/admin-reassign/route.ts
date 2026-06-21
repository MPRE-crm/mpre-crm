export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type ReassignBody = {
  approval_id?: string;
  agent_id?: string;
};

type RequesterProfile = {
  id: string;
  email: string | null;
  role: "agent" | "admin" | "platform_admin" | string;
  org_id: string | null;
};

async function getRequesterProfile(req: NextRequest): Promise<RequesterProfile> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const { data: userRes, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userRes?.user) {
    throw new Error("UNAUTHORIZED");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, org_id")
    .eq("id", userRes.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return profile as RequesterProfile;
}

function canAdminManageApproval(args: {
  requester: RequesterProfile;
  approvalOrgId: string | null;
}) {
  const { requester, approvalOrgId } = args;

  if (requester.role === "platform_admin") return true;

  if (requester.role === "admin") {
    return (
      !!requester.org_id &&
      !!approvalOrgId &&
      requester.org_id === approvalOrgId
    );
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const requester = await getRequesterProfile(req);

    if (requester.role !== "admin" && requester.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Only admins can reassign appointment approvals" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as ReassignBody;
    const approvalId = String(body.approval_id || "").trim();
    const agentId = String(body.agent_id || "").trim();

    if (!approvalId || !agentId) {
      return NextResponse.json(
        { error: "Missing approval_id or agent_id" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("appointment_approvals")
      .select("*")
      .eq("id", approvalId)
      .maybeSingle();

    if (approvalError || !approval) {
      return NextResponse.json(
        { error: approvalError?.message || "Appointment approval not found" },
        { status: 404 }
      );
    }

    if (
      !canAdminManageApproval({
        requester,
        approvalOrgId: approval.org_id || null,
      })
    ) {
      return NextResponse.json(
        { error: "You do not have permission to reassign this approval" },
        { status: 403 }
      );
    }

    if ((approval.status || "").toLowerCase() !== "pending") {
      return NextResponse.json(
        {
          error: `Only pending approvals can be reassigned. Current status: ${approval.status}`,
        },
        { status: 400 }
      );
    }

    if (!approval.current_agent_id) {
      return NextResponse.json(
        {
          error:
            "This approval is not currently assigned. Use admin-assign for floating items.",
        },
        { status: 400 }
      );
    }

    if (approval.current_agent_id === agentId) {
      return NextResponse.json(
        { error: "Approval is already assigned to that agent" },
        { status: 400 }
      );
    }

    const { data: agentProfile, error: agentError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, org_id, email")
      .eq("id", agentId)
      .maybeSingle();

    if (agentError || !agentProfile) {
      return NextResponse.json(
        { error: agentError?.message || "Agent profile not found" },
        { status: 404 }
      );
    }

    if (agentProfile.role !== "agent") {
      return NextResponse.json(
        { error: "Selected user is not an agent" },
        { status: 400 }
      );
    }

    if (requester.role === "admin" && agentProfile.org_id !== requester.org_id) {
      return NextResponse.json(
        { error: "Admins can only reassign agents from their own organization" },
        { status: 403 }
      );
    }

    if (approval.org_id && agentProfile.org_id !== approval.org_id) {
      return NextResponse.json(
        {
          error:
            "Agent does not belong to the same organization as this approval",
        },
        { status: 400 }
      );
    }

    const previousAgentId = approval.current_agent_id;

    const { error: approvalUpdateError } = await supabaseAdmin
      .from("appointment_approvals")
      .update({
        current_agent_id: agentId,
        updated_at: nowIso,
      })
      .eq("id", approvalId);

    if (approvalUpdateError) {
      return NextResponse.json(
        { error: approvalUpdateError.message || "Failed to reassign approval" },
        { status: 500 }
      );
    }

    const { data: lead, error: leadFetchError } = await supabaseAdmin
      .from("leads")
      .select(`
        id,
        org_id,
        notes
      `)
      .eq("id", approval.lead_id)
      .maybeSingle();

    if (leadFetchError || !lead) {
      return NextResponse.json(
        {
          error:
            leadFetchError?.message ||
            "Approval reassigned, but lead could not be loaded for update",
        },
        { status: 500 }
      );
    }

    if (requester.role === "admin" && lead.org_id !== requester.org_id) {
      return NextResponse.json(
        { error: "Admins can only update leads in their own organization" },
        { status: 403 }
      );
    }

    const existingNotes =
      typeof lead.notes === "string" ? lead.notes.trim() : "";

    const reassignLogLine = `[${nowIso}] Appointment reassigned from agent ${previousAgentId} to agent ${agentId} by ${
      requester.email || requester.id
    }.`;

    const nextNotes = existingNotes
      ? `${existingNotes}\n\n${reassignLogLine}`
      : reassignLogLine;

    const { error: leadUpdateError } = await supabaseAdmin
      .from("leads")
      .update({
        appointment_status: "Pending",
        appointment_requested: true,
        appointment_pending_agent_id: agentId,
        appointment_pending_expires_at: approval.expires_at || null,
        notes: nextNotes,
        updated_at: nowIso,
      })
      .eq("id", approval.lead_id);

    if (leadUpdateError) {
      return NextResponse.json(
        {
          error:
            leadUpdateError.message ||
            "Approval reassigned, but lead could not be updated",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      approval_id: approvalId,
      lead_id: approval.lead_id,
      previous_agent_id: previousAgentId,
      reassigned_agent_id: agentId,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    console.error("❌ admin-reassign route error", error);

    return NextResponse.json(
      { error: error?.message || "Failed to reassign appointment approval" },
      { status: 500 }
    );
  }
}