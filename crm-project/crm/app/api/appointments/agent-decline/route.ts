export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getNextAssignee } from "../../../../lib/rotation/getNextAssignee";


type RequesterProfile = {
  id: string;
  email: string | null;
  role: "agent" | "admin" | "platform_admin" | string;
  org_id: string | null;
};

async function getRequesterProfile(req: NextRequest): Promise<RequesterProfile | null> {
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!bearerToken) return null;

  const { data: userRes, error: userError } =
    await supabaseAdmin.auth.getUser(bearerToken);

  if (userError || !userRes?.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, org_id")
    .eq("id", userRes.user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return profile as RequesterProfile;
}

function canRequesterActOnApproval(args: {
  requester: RequesterProfile | null;
  approval: any;
}) {
  const { requester, approval } = args;

  if (!requester) return false;
  if (requester.role === "platform_admin") return true;

  if (requester.role === "admin") {
    return !!requester.org_id && requester.org_id === approval.org_id;
  }

  if (requester.role === "agent") {
    return requester.id === approval.current_agent_id;
  }

  return false;
}

function html(message: string) {
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Appointment Declined</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      .card { max-width: 720px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 24px; }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Appointment Declined</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const token = String(searchParams.get("token") || "").trim();
    const reason = searchParams.get("reason") || "Agent declined";

    if (!id) {
      return html("Missing approval id.");
    }

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("appointment_approvals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (approvalError || !approval) {
      return html("Appointment approval request not found.");
    }

    const requester = await getRequesterProfile(req);
    const tokenMatches =
      !!token &&
      typeof approval.action_token === "string" &&
      token === approval.action_token;

    const requesterAllowed = canRequesterActOnApproval({
      requester,
      approval,
    });

    if (!tokenMatches && !requesterAllowed) {
      return html("This appointment decline link is invalid or expired. Please use the latest approval text or decline it from the dashboard.");
    }

    if (approval.status === "accepted") {
      return html("This appointment request was already accepted.");
    }

    if (approval.status === "declined") {
      return html("This appointment request was already declined.");
    }

    if (approval.status === "expired") {
      return html("This appointment request has already expired.");
    }

    if (approval.status !== "pending") {
      return html(
        `This appointment request is no longer actionable. Current status: ${approval.status}.`
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const { error: approvalUpdateError } = await supabaseAdmin
      .from("appointment_approvals")
      .update({
        status: "declined",
        declined_at: nowIso,
        decline_reason: reason,
        updated_at: nowIso,
      })
      .eq("id", approval.id);

    if (approvalUpdateError) {
      return html(`Failed to update approval row: ${approvalUpdateError.message}`);
    }

    const { data: lead, error: leadFetchError } = await supabaseAdmin
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

    if (leadFetchError || !lead) {
      return html(
        `Approval was declined, but the lead could not be loaded: ${leadFetchError?.message || "Lead not found."}`
      );
    }

    const existingNotes = typeof lead.notes === "string" ? lead.notes.trim() : "";
    const declineLogLine = `[${nowIso}] Appointment declined by agent. Reason: ${reason}`;
    const nextNotes = existingNotes ? `${existingNotes}\n\n${declineLogLine}` : declineLogLine;

    const nextRotationAttempt =
      typeof lead.appointment_rotation_attempt === "number"
        ? lead.appointment_rotation_attempt + 1
        : (approval.rotation_attempt ?? 0) + 1;

    const requestedSlotIso =
      lead.appointment_requested_slot_iso || approval.slot_iso || null;
    const requestedSlotHuman =
      lead.appointment_requested_slot_human || approval.slot_human || null;

    if (!lead.org_id || !requestedSlotIso || !requestedSlotHuman) {
      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "No Agent Available",
          appointment_requested: true,
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          appointment_decline_reason: reason,
          appointment_rotation_attempt: nextRotationAttempt,
          notes: nextNotes,
          updated_at: nowIso,
        })
        .eq("id", approval.lead_id);

      if (leadUpdateError) {
        return html(
          `Approval was declined, but the lead could not be updated: ${leadUpdateError.message}`
        );
      }

      return html(
        "Appointment was declined. No valid slot data was available for rerouting, so the lead was left active for manual follow-up."
      );
    }

    const nextAssignee = await getNextAssignee(lead.org_id).catch(() => null);

    if (!nextAssignee?.user_id) {
      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "No Agent Available",
          appointment_requested: true,
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          appointment_decline_reason: reason,
          appointment_rotation_attempt: nextRotationAttempt,
          notes: nextNotes,
          updated_at: nowIso,
        })
        .eq("id", approval.lead_id);

      if (leadUpdateError) {
        return html(
          `Approval was declined, but fallback lead update failed: ${leadUpdateError.message}`
        );
      }

      return html(
        "Appointment was declined. No other available agent was found, so the lead was moved to a no-agent-available state."
      );
    }

    const rotatedAgentProfileId = await resolveProfileIdForRotationUser(
      nextAssignee.user_id,
      lead.org_id
    );

    if (!rotatedAgentProfileId) {
      return html(
        "Appointment was declined, but the next rotation assignee could not be resolved to a profile."
      );
    }

    if (rotatedAgentProfileId === approval.current_agent_id) {
      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "No Agent Available",
          appointment_requested: true,
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          appointment_decline_reason: reason,
          appointment_rotation_attempt: nextRotationAttempt,
          notes: `${nextNotes}\n\n[${nowIso}] No different agent was available after decline.`,
          updated_at: nowIso,
        })
        .eq("id", approval.lead_id);

      if (leadUpdateError) {
        return html(
          `Approval was declined, but fallback lead update failed: ${leadUpdateError.message}`
        );
      }

      return html(
        "Appointment was declined. No different agent was available, so the lead was moved to a no-agent-available state."
      );
    }

    const nextExpiresAt = addMinutes(now, 5).toISOString();
    const nextActionToken = randomBytes(32).toString("hex");

    const { data: nextApproval, error: nextApprovalError } = await supabaseAdmin
      .from("appointment_approvals")
      .insert({
        lead_id: lead.id,
        org_id: lead.org_id,
        requested_by_agent_id: rotatedAgentProfileId,
        current_agent_id: rotatedAgentProfileId,
        slot_iso: requestedSlotIso,
        slot_human: requestedSlotHuman,
        status: "pending",
        expires_at: nextExpiresAt,
        rotation_attempt: nextRotationAttempt,
        action_token: nextActionToken,
        action_token_created_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, slot_human, expires_at, action_token")
      .single();

    if (nextApprovalError || !nextApproval) {
      return html(
        `Approval was declined, but creating the next approval failed: ${nextApprovalError?.message || "Unknown error"}`
      );
    }

    const rerouteLogLine = `[${nowIso}] Appointment rerouted to next agent in rotation.`;
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
        appointment_decline_reason: reason,
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
      .eq("id", approval.lead_id);

    if (leadUpdateError) {
      return html(
        `Next approval was created, but the lead could not be updated: ${leadUpdateError.message}`
      );
    }

    const { data: agentUser, error: agentUserError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, phone")
      .eq("user_id", rotatedAgentProfileId)
      .eq("org_id", lead.org_id)
      .maybeSingle();

    if (agentUserError) {
      console.error("❌ agent lookup for rerouted appointment text error", agentUserError);
    }

    if (agentUser?.phone && nextApproval?.id) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (accountSid && authToken && fromNumber) {
          const twilioClient = twilio(accountSid, authToken);

          const appBaseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "https://www.easyrealtor.homes";

          const nextApprovalToken = nextApproval.action_token || nextActionToken;

          const acceptUrl = `${appBaseUrl}/a/${encodeURIComponent(nextApproval.id)}/${encodeURIComponent(nextApprovalToken)}`;
          const declineUrl = `${appBaseUrl}/d/${encodeURIComponent(nextApproval.id)}/${encodeURIComponent(nextApprovalToken)}`;

          const leadName =
            String(lead.first_name || "").trim() ||
            String(lead.name || "").trim() ||
            "Lead";

          const agentText =
            `New appointment request from ${leadName}.\n` +
            `Requested time: ${requestedSlotHuman}\n` +
            `Accept: ${acceptUrl}\n` +
            `Decline: ${declineUrl}`;

          await twilioClient.messages.create({
            from: fromNumber,
            to: normalizePhone(agentUser.phone),
            body: agentText,
          });
        }
      } catch (agentSmsError) {
        console.error("❌ rerouted agent appointment approval text send error", agentSmsError);
      }
    }

    return html(
      "Appointment request declined. The lead was rerouted to the next available agent and a new approval request was created."
    );
  } catch (error: any) {
    console.error("❌ agent-decline route error", error);
    return html(`Failed to decline appointment: ${error.message}`);
  }
}