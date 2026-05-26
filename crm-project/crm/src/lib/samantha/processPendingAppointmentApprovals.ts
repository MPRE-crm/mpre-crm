import twilio from "twilio";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getNextAssignee } from "../../../lib/rotation/getNextAssignee";

type ApprovalRow = {
  id: string;
  lead_id: string;
  org_id: string;
  requested_by_agent_id: string | null;
  current_agent_id: string | null;
  slot_iso: string;
  slot_human: string;
  status: string;
  expires_at: string;
  rotation_attempt: number | null;
  created_at: string;
  updated_at?: string | null;
};

type LeadRow = {
  id: string;
  org_id: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  phone: string | null;
  notes: string | null;
  agent_id: string | null;
  appointment_status: string | null;
  appointment_requested: boolean | null;
  appointment_requested_slot_iso: string | null;
  appointment_requested_slot_human: string | null;
  appointment_pending_agent_id: string | null;
  appointment_pending_expires_at: string | null;
  appointment_decline_reason: string | null;
  appointment_rotation_attempt: number | null;
  sms_state: string | null;
  sms_current_objective: string | null;
  sms_last_question: string | null;
  sms_lpmama_current_step: string | null;
  sms_lpmama_next_step: string | null;
  sms_resume_step: string | null;
  sms_detour_reason: string | null;
  preferred_next_step: string | null;
};

function normalizePhone(raw?: string | null) {
  const value = String(raw || "").trim();
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (value.startsWith("+")) return value;

  return `+${digits}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function resolveProfileIdForRotationUser(userId: number, orgId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("❌ resolve profile id for rotation user error", error);
    return null;
  }

  return data?.user_id || null;
}

async function sendAgentApprovalText(args: {
  approvalId: string;
  leadName: string;
  slotHuman: string;
  agentPhone: string;
}) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error("❌ missing Twilio env vars for pending approval reroute");
      return false;
    }

    const twilioClient = twilio(accountSid, authToken);
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://www.easyrealtor.homes";

    const acceptUrl = `${appBaseUrl}/api/appointments/agent-accept?id=${encodeURIComponent(
      args.approvalId
    )}`;
    const declineUrl = `${appBaseUrl}/api/appointments/agent-decline?id=${encodeURIComponent(
      args.approvalId
    )}`;

    const agentText =
      `New appointment request from ${args.leadName}.\n` +
      `Requested time: ${args.slotHuman}\n` +
      `Accept: ${acceptUrl}\n` +
      `Decline: ${declineUrl}`;

    await twilioClient.messages.create({
      from: fromNumber,
      to: normalizePhone(args.agentPhone),
      body: agentText,
    });

    return true;
  } catch (error) {
    console.error("❌ sendAgentApprovalText error", error);
    return false;
  }
}

export async function processPendingAppointmentApprovals() {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: expiredRows, error: expiredError } = await supabaseAdmin
    .from("appointment_approvals")
    .select(`
      id,
      lead_id,
      org_id,
      requested_by_agent_id,
      current_agent_id,
      slot_iso,
      slot_human,
      status,
      expires_at,
      rotation_attempt,
      created_at,
      updated_at
    `)
    .eq("status", "pending")
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(50);

  if (expiredError) throw expiredError;

  const results: any[] = [];

  for (const approval of (expiredRows || []) as ApprovalRow[]) {
    const { data: claimRows, error: claimError } = await supabaseAdmin
      .from("appointment_approvals")
      .update({
        status: "expired",
        expired_at: nowIso,
        decline_reason: "Agent did not respond before expiration",
        updated_at: nowIso,
      })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("id");

    if (claimError || !claimRows?.length) {
      results.push({
        approval_id: approval.id,
        ok: false,
        error: claimError?.message || "Already claimed or no longer pending",
      });
      continue;
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(`
        id,
        org_id,
        first_name,
        last_name,
        name,
        phone,
        notes,
        agent_id,
        appointment_status,
        appointment_requested,
        appointment_requested_slot_iso,
        appointment_requested_slot_human,
        appointment_pending_agent_id,
        appointment_pending_expires_at,
        appointment_decline_reason,
        appointment_rotation_attempt,
        sms_state,
        sms_current_objective,
        sms_last_question,
        sms_lpmama_current_step,
        sms_lpmama_next_step,
        sms_resume_step,
        sms_detour_reason,
        preferred_next_step
      `)
      .eq("id", approval.lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      results.push({
        approval_id: approval.id,
        ok: false,
        error: leadError?.message || "Lead not found",
      });
      continue;
    }

    const leadRow = lead as LeadRow;

    const existingNotes =
      typeof leadRow.notes === "string" ? leadRow.notes.trim() : "";
    const expireLogLine = `[${nowIso}] Pending appointment approval expired with no agent response.`;
    const nextNotes = existingNotes
      ? `${existingNotes}\n\n${expireLogLine}`
      : expireLogLine;

    const nextRotationAttempt =
      typeof leadRow.appointment_rotation_attempt === "number"
        ? leadRow.appointment_rotation_attempt + 1
        : (approval.rotation_attempt ?? 0) + 1;

    const requestedSlotIso =
      leadRow.appointment_requested_slot_iso || approval.slot_iso || null;
    const requestedSlotHuman =
      leadRow.appointment_requested_slot_human || approval.slot_human || null;

    if (!leadRow.org_id || !requestedSlotIso || !requestedSlotHuman) {
      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "No Agent Available",
          appointment_requested: true,
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          appointment_decline_reason: "Expired with missing slot or org data",
          appointment_rotation_attempt: nextRotationAttempt,
          notes: nextNotes,
          updated_at: nowIso,
        })
        .eq("id", leadRow.id);

      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: !leadUpdateError,
        outcome: "no_agent_available_missing_data",
        error: leadUpdateError?.message || null,
      });

      continue;
    }

    const nextAssignee = await getNextAssignee(leadRow.org_id).catch(() => null);

    if (!nextAssignee?.user_id) {
      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "No Agent Available",
          appointment_requested: true,
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          appointment_decline_reason: "Expired with no next available agent",
          appointment_rotation_attempt: nextRotationAttempt,
          notes: `${nextNotes}\n\n[${nowIso}] No next available agent found after expiration.`,
          updated_at: nowIso,
        })
        .eq("id", leadRow.id);

      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: !leadUpdateError,
        outcome: "no_agent_available",
        error: leadUpdateError?.message || null,
      });

      continue;
    }

    const rotatedAgentProfileId = await resolveProfileIdForRotationUser(
      nextAssignee.user_id,
      leadRow.org_id
    );

    if (!rotatedAgentProfileId) {
      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: false,
        outcome: "failed_profile_resolution",
        error: "Could not resolve rotated agent profile id",
      });
      continue;
    }

    if (rotatedAgentProfileId === approval.current_agent_id) {
      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "No Agent Available",
          appointment_requested: true,
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          appointment_decline_reason: "Expired with no different available agent",
          appointment_rotation_attempt: nextRotationAttempt,
          notes: `${nextNotes}\n\n[${nowIso}] No different agent was available after pending approval expired.`,
          updated_at: nowIso,
        })
        .eq("id", leadRow.id);

      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: !leadUpdateError,
        outcome: "no_different_agent_available",
        error: leadUpdateError?.message || null,
      });

      continue;
    }

    const nextExpiresAt = addMinutes(now, 5).toISOString();

    const { data: existingPendingApproval, error: existingPendingApprovalError } =
      await supabaseAdmin
        .from("appointment_approvals")
        .select("id, current_agent_id, expires_at")
        .eq("lead_id", leadRow.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

    if (existingPendingApprovalError) {
      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: false,
        outcome: "failed_existing_pending_approval_lookup",
        error: existingPendingApprovalError.message,
      });
      continue;
    }

    if (existingPendingApproval?.id) {
      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: true,
        outcome: "skipped_existing_pending_approval",
        next_approval_id: existingPendingApproval.id,
      });
      continue;
    }

    const { data: nextApproval, error: nextApprovalError } = await supabaseAdmin
      .from("appointment_approvals")
      .insert({
        lead_id: leadRow.id,
        org_id: leadRow.org_id,
        requested_by_agent_id: rotatedAgentProfileId,
        current_agent_id: rotatedAgentProfileId,
        slot_iso: requestedSlotIso,
        slot_human: requestedSlotHuman,
        status: "pending",
        expires_at: nextExpiresAt,
        rotation_attempt: nextRotationAttempt,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, current_agent_id, slot_human, expires_at, rotation_attempt")
      .single();

    if (nextApprovalError || !nextApproval) {
      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: false,
        outcome: "failed_next_approval_insert",
        error: nextApprovalError?.message || "Unknown insert error",
      });
      continue;
    }

    const rerouteLogLine = `[${nowIso}] Appointment rerouted after expiration.`;
    const finalNotes = `${nextNotes}\n\n${rerouteLogLine}`;

    const { error: leadUpdateError } = await supabaseAdmin
      .from("leads")
      .update({
        agent_id: rotatedAgentProfileId,
        appointment_status: "Pending",
        appointment_requested: true,
        appointment_requested_slot_iso: requestedSlotIso,
        appointment_requested_slot_human: requestedSlotHuman,
        appointment_pending_agent_id: rotatedAgentProfileId,
        appointment_pending_expires_at: nextExpiresAt,
        appointment_decline_reason: "Expired - rerouted",
        appointment_rotation_attempt: nextRotationAttempt,
        sms_state: "CALLBACK_LATER",
        sms_current_objective: "appointment",
        sms_last_question: "agent_approval_pending",
        sms_lpmama_current_step: "appointment",
        sms_lpmama_next_step: "appointment",
        sms_resume_step: "appointment",
        sms_detour_reason: "pending_agent_approval",
        preferred_next_step: "appointment",
        notes: finalNotes,
        updated_at: nowIso,
      })
      .eq("id", leadRow.id);

    if (leadUpdateError) {
      results.push({
        approval_id: approval.id,
        lead_id: leadRow.id,
        ok: false,
        outcome: "failed_lead_update",
        error: leadUpdateError.message,
      });
      continue;
    }

    const { data: agentUser, error: agentUserError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, phone")
      .eq("user_id", rotatedAgentProfileId)
      .eq("org_id", leadRow.org_id)
      .maybeSingle();

    if (agentUserError) {
      console.error("❌ agent lookup for expired approval reroute text error", agentUserError);
    }

    let agentTextSent = false;

    if (agentUser?.phone && nextApproval?.id) {
      const leadName =
        String(leadRow.first_name || "").trim() ||
        String(leadRow.name || "").trim() ||
        "Lead";

      agentTextSent = await sendAgentApprovalText({
        approvalId: nextApproval.id,
        leadName,
        slotHuman: requestedSlotHuman,
        agentPhone: agentUser.phone,
      });
    }

    results.push({
      approval_id: approval.id,
      lead_id: leadRow.id,
      ok: true,
      outcome: "rerouted",
      next_approval_id: nextApproval.id,
      next_agent_id: rotatedAgentProfileId,
      next_rotation_attempt: nextRotationAttempt,
      agent_text_sent: agentTextSent,
    });
  }

  return {
    ok: true,
    processed: results.length,
    results,
  };
}