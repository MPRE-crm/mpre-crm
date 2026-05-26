export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type AssignBody = {
  approval_id?: string;
  agent_id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssignBody;
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

    if ((approval.status || "").toLowerCase() !== "pending") {
      return NextResponse.json(
        {
          error: `Only pending approvals can be assigned. Current status: ${approval.status}`,
        },
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

    if (approval.org_id && agentProfile.org_id !== approval.org_id) {
      return NextResponse.json(
        { error: "Agent does not belong to the same organization as this approval" },
        { status: 400 }
      );
    }

    const { error: approvalUpdateError } = await supabaseAdmin
      .from("appointment_approvals")
      .update({
        current_agent_id: agentId,
        updated_at: nowIso,
      })
      .eq("id", approvalId);

    if (approvalUpdateError) {
      return NextResponse.json(
        { error: approvalUpdateError.message || "Failed to assign approval" },
        { status: 500 }
      );
    }

    const { data: lead, error: leadFetchError } = await supabaseAdmin
      .from("leads")
      .select(`
        id,
        notes,
        appointment_rotation_attempt
      `)
      .eq("id", approval.lead_id)
      .maybeSingle();

    if (leadFetchError || !lead) {
      return NextResponse.json(
        {
          error:
            leadFetchError?.message ||
            "Approval assigned, but lead could not be loaded for update",
        },
        { status: 500 }
      );
    }

    const existingNotes = typeof lead.notes === "string" ? lead.notes.trim() : "";
    const assignLogLine = `[${nowIso}] Floating appointment manually assigned to agent ${agentId}.`;
    const nextNotes = existingNotes ? `${existingNotes}\n\n${assignLogLine}` : assignLogLine;

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
            "Approval assigned, but lead could not be updated",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      approval_id: approvalId,
      lead_id: approval.lead_id,
      assigned_agent_id: agentId,
    });
  } catch (error: any) {
    console.error("❌ admin-assign route error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to assign appointment approval" },
      { status: 500 }
    );
  }
}