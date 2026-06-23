export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import twilio from "twilio";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthorizedGoogleOAuthClient } from "../../../../lib/calendar/getAuthorizedGoogleOAuthClient";

async function getAgentGoogleConnection(args: {
  org_id: string;
  agent_id?: string | null;
}) {
  const { org_id, agent_id } = args;

  if (agent_id) {
    const preferredAgent = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("organization_id", org_id)
      .eq("agent_id", agent_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (preferredAgent.data) return preferredAgent.data;

    const fallbackAgent = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("organization_id", org_id)
      .eq("agent_id", agent_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (fallbackAgent.data) return fallbackAgent.data;
  }

  const preferredOrg = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", org_id)
    .eq("provider", "google")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (preferredOrg.data) return preferredOrg.data;

  const fallbackOrg = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", org_id)
    .eq("provider", "google")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (fallbackOrg.data) return fallbackOrg.data;

  throw new Error(
    `No active Google calendar connection found for org ${org_id} agent ${agent_id || "unknown"}`
  );
}

async function resolveCalendarId(connection: any): Promise<string> {
  const { data: selectedCalendar, error } = await supabaseAdmin
    .from("calendar_calendars")
    .select("provider_calendar_id")
    .eq("calendar_connection_id", connection.id)
    .eq("is_selected", true)
    .maybeSingle();

  if (error) {
    console.error("❌ agent-accept selected calendar lookup error", error);
  }

  if (selectedCalendar?.provider_calendar_id) {
    return selectedCalendar.provider_calendar_id;
  }

  const { data: primaryCalendar } = await supabaseAdmin
    .from("calendar_calendars")
    .select("provider_calendar_id")
    .eq("calendar_connection_id", connection.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryCalendar?.provider_calendar_id) {
    return primaryCalendar.provider_calendar_id;
  }

  if (connection.default_calendar_id) {
    return connection.default_calendar_id;
  }

  if (connection.account_email) {
    return connection.account_email;
  }

  throw new Error("No default Google calendar id found on connection");
}


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

function normalizePhone(raw?: string | null) {
  const value = String(raw || "").trim();
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (value.startsWith("+")) return value;

  return `+${digits}`;
}

function html(message: string) {
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Appointment Approval</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      .card { max-width: 720px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 24px; }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Appointment Approval</h1>
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const token = String(searchParams.get("token") || "").trim();

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
      return html("This appointment approval link is invalid or expired. Please use the latest approval text or approve it from the dashboard.");
    }

    if (approval.status === "accepted") {
      return html("This appointment request was already accepted.");
    }

    if (approval.status === "declined") {
      return html("This appointment request was already declined.");
    }

    if (approval.status === "expired") {
      return html("This appointment request has expired.");
    }

    if (approval.status !== "pending") {
      return html(`This appointment request is no longer actionable. Current status: ${approval.status}.`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = approval.expires_at ? new Date(approval.expires_at) : null;

    if (expiresAt && expiresAt.getTime() < now.getTime()) {
      await supabaseAdmin
        .from("appointment_approvals")
        .update({
          status: "expired",
          expired_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", approval.id);

      await supabaseAdmin
        .from("leads")
        .update({
          appointment_status: "Pending",
          appointment_pending_agent_id: null,
          appointment_pending_expires_at: null,
          updated_at: nowIso,
        })
        .eq("id", approval.lead_id);

      return html("This appointment request has expired.");
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(`
        id,
        first_name,
        name,
        email,
        phone,
        org_id,
        agent_id,
        notes,
        appointment_rotation_attempt
      `)
      .eq("id", approval.lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      return html("The lead for this appointment request could not be found.");
    }

    const connection = await getAgentGoogleConnection({
      org_id: approval.org_id,
      agent_id: approval.current_agent_id,
    });

    const oauth2Client = await getAuthorizedGoogleOAuthClient(connection);

    const calendarId = await resolveCalendarId(connection);

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    const start = new Date(approval.slot_iso);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const event = {
      summary: `MPRE Boise Appointment - ${lead.first_name || lead.name || "Lead"}`,
      description:
        `Lead: ${lead.first_name || lead.name || "Lead"}\n` +
        `Phone: ${lead.phone || "N/A"}\n` +
        `Email: ${lead.email || "N/A"}\n` +
        `Approval ID: ${approval.id}`,
      start: {
        dateTime: start.toISOString(),
        timeZone: "America/Boise",
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: "America/Boise",
      },
    };

    const createdEvent = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    const eventId = createdEvent.data.id || null;
    const eventLink = createdEvent.data.htmlLink || null;

    const { error: approvalUpdateError } = await supabaseAdmin
      .from("appointment_approvals")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", approval.id);

    if (approvalUpdateError) {
      return html(`Failed to update approval row: ${approvalUpdateError.message}`);
    }

    const existingNotes = typeof lead.notes === "string" ? lead.notes.trim() : "";
    const acceptedLogLine = `[${nowIso}] Appointment accepted by agent for ${approval.slot_human || approval.slot_iso || "scheduled slot"}.`;
    const notesParts = [
      existingNotes,
      acceptedLogLine,
      `Google Calendar Event ID: ${eventId || "N/A"}`,
      `Google Calendar Link: ${eventLink || "N/A"}`,
    ].filter(Boolean);

    const updatedNotes = notesParts.join("\n\n");

    const { error: leadUpdateError } = await supabaseAdmin
      .from("leads")
      .update({
        appointment_requested: true,
        appointment_status: "Confirmed",
        appointment_requested_slot_iso: approval.slot_iso,
        appointment_requested_slot_human: approval.slot_human,
        appointment_pending_agent_id: null,
        appointment_pending_expires_at: null,
        appointment_decline_reason: null,
        appointment_offer_slot_a_iso: null,
        appointment_offer_slot_a_human: null,
        appointment_offer_slot_b_iso: null,
        appointment_offer_slot_b_human: null,
        appointment_rotation_attempt: lead.appointment_rotation_attempt ?? approval.rotation_attempt ?? 0,
        preferred_next_step: "appointment",
        notes: updatedNotes,
        updated_at: nowIso,
      })
      .eq("id", approval.lead_id);

    if (leadUpdateError) {
      return html(`Approval was accepted, but the lead could not be updated: ${leadUpdateError.message}`);
    }

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (accountSid && authToken && fromNumber && lead.phone) {
        const twilioClient = twilio(accountSid, authToken);

        const leadName = lead.first_name || lead.name || "there";
        const confirmationText =
          `Perfect, ${leadName} — your strategy call with MPRE Boise is confirmed for ${approval.slot_human}. ` +
          `If anything changes, just text us here.`;

        await twilioClient.messages.create({
          from: fromNumber,
          to: normalizePhone(lead.phone),
          body: confirmationText,
        });

        await supabaseAdmin.from("messages").insert({
          lead_id: lead.id,
          lead_phone: normalizePhone(lead.phone),
          direction: "outgoing",
          body: confirmationText,
          status: "sent",
          twilio_sid: null,
          created_at: nowIso,
        });
      }
    } catch (smsError) {
      console.error("❌ agent-accept confirmation sms send error", smsError);
    }

    return html(`Appointment accepted and booked for ${approval.slot_human}.`);
  } catch (error: any) {
    console.error("❌ agent-accept route error", error);
    return html(`Failed to accept appointment: ${error.message}`);
  }
}