export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { sendText } from "../../../../../lib/sendText";
import { resolvePostIdxAction } from "../../../../../src/lib/samantha/resolvePostIdxAction";
import { logSamanthaAction } from "../../../../../src/lib/samantha/logSamanthaAction";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;
const BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")) ||
  (process.env.PUBLIC_URL && process.env.PUBLIC_URL.replace(/\/$/, "")) ||
  "http://localhost:3000";

const EXECUTION_MODE: "mock" | "live" =
  (process.env.SAMANTHA_EXECUTION_MODE || "mock").toLowerCase() === "live"
    ? "live"
    : "mock";

function buildIdxFollowUpText(lead: any) {
  const firstName =
    String(lead?.first_name || lead?.name || "")
      .trim()
      .split(" ")[0] || "there";

  return `Hi ${firstName}, this is Samantha with MPRE Boise. I saw you were looking at homes and wanted to see if you’d like help narrowing down the best options or setting up a quick home search.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit ?? 25), 100);

    const now = new Date();
    const nowIso = now.toISOString();

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .not("next_contact_at", "is", null)
      .lte("next_contact_at", nowIso)
      .order("next_contact_at", { ascending: true })
      .limit(limit);

    if (leadsError) {
      return NextResponse.json(
        { error: "Failed to load due leads", details: leadsError.message },
        { status: 500 }
      );
    }

    const results: Array<Record<string, any>> = [];

    for (const lead of leads || []) {
      const leadForDecision = {
        ...lead,
        last_meaningful_engagement_at: null,
      };

      const action = resolvePostIdxAction({
        lead: leadForDecision,
        now,
      });

      if (action.action === "text_now") {
        const message = buildIdxFollowUpText(lead);

        if (EXECUTION_MODE === "mock") {
          await logSamanthaAction({
            db: supabase,
            leadId: lead.id,
            orgId: lead.org_id ?? null,
            source: "follow_up_due",
            triggerType: "idx_due",
            plannedAction: action.action,
            executedAction: "text_now",
            executionMode: "mock",
            status: "executed",
            reasonCodes: action.reason_codes,
            details: {
              mock: true,
              to: lead.phone ?? null,
              message,
            },
          });

          await supabase
            .from("leads")
            .update({
              next_contact_at: null,
              updated_at: nowIso,
            })
            .eq("id", lead.id);

          results.push({
            lead_id: lead.id,
            action,
            executed: "text_now",
            success: true,
            details: {
              mock: true,
              to: lead.phone ?? null,
              message,
            },
          });

          continue;
        }

        const smsResult = await sendText({
          to: lead.phone,
          message,
          leadId: lead.id,
          bypassGovernor: true,
        });

        await logSamanthaAction({
          db: supabase,
          leadId: lead.id,
          orgId: lead.org_id ?? null,
          source: "follow_up_due",
          triggerType: "idx_due",
          plannedAction: action.action,
          executedAction: "text_now",
          executionMode: "live",
          status: smsResult.success ? "executed" : "failed",
          reasonCodes: action.reason_codes,
          details: smsResult,
        });

        results.push({
          lead_id: lead.id,
          action,
          executed: "text_now",
          success: smsResult.success,
          details: smsResult,
        });

        continue;
      }

      if (action.action === "call_now") {
        if (EXECUTION_MODE === "mock") {
          await logSamanthaAction({
            db: supabase,
            leadId: lead.id,
            orgId: lead.org_id ?? null,
            source: "follow_up_due",
            triggerType: "idx_due",
            plannedAction: action.action,
            executedAction: "call_now",
            executionMode: "mock",
            status: "executed",
            reasonCodes: action.reason_codes,
            details: {
              mock: true,
              to: lead.phone ?? null,
              from: TWILIO_PHONE_NUMBER,
            },
          });

          await supabase
            .from("leads")
            .update({
              next_contact_at: null,
              updated_at: nowIso,
            })
            .eq("id", lead.id);

          results.push({
            lead_id: lead.id,
            action,
            executed: "call_now",
            success: true,
            details: {
              mock: true,
              to: lead.phone ?? null,
              from: TWILIO_PHONE_NUMBER,
            },
          });

          continue;
        }

        try {
          const voiceUrl = `${BASE_URL}/api/voice?lead_id=${lead.id}`;

          const call = await twilioClient.calls.create({
            url: voiceUrl,
            to: lead.phone,
            from: TWILIO_PHONE_NUMBER,
            machineDetection: "Enable",
          });

          await supabase.from("follow_ups").insert({
            lead_id: lead.id,
            lead_number: lead.phone ?? null,
            call_sid: call.sid,
            method: "call",
            created_at: nowIso,
            sent_at: nowIso,
          });

          await supabase
            .from("leads")
            .update({
              last_call_attempt_at: nowIso,
              last_contact_attempt_at: nowIso,
              next_contact_at: null,
              updated_at: nowIso,
            })
            .eq("id", lead.id);

          await logSamanthaAction({
            db: supabase,
            leadId: lead.id,
            orgId: lead.org_id ?? null,
            source: "follow_up_due",
            triggerType: "idx_due",
            plannedAction: action.action,
            executedAction: "call_now",
            executionMode: "live",
            status: "executed",
            reasonCodes: action.reason_codes,
            details: {
              call_sid: call.sid,
              to: lead.phone ?? null,
              from: TWILIO_PHONE_NUMBER,
            },
          });

          results.push({
            lead_id: lead.id,
            action,
            executed: "call_now",
            success: true,
            call_sid: call.sid,
          });
        } catch (callError: any) {
          await logSamanthaAction({
            db: supabase,
            leadId: lead.id,
            orgId: lead.org_id ?? null,
            source: "follow_up_due",
            triggerType: "idx_due",
            plannedAction: action.action,
            executedAction: "call_now",
            executionMode: "live",
            status: "failed",
            reasonCodes: action.reason_codes,
            details: {
              error: callError.message,
            },
          });

          results.push({
            lead_id: lead.id,
            action,
            executed: "call_now",
            success: false,
            error: callError.message,
          });
        }

        continue;
      }

      if (action.action === "notify_agent") {
        await supabase.from("escalation_logs").insert({
          lead_id: lead.id,
          escalation_reason: "IDX_FOLLOW_UP_DUE",
          status_at_escalation: lead.status ?? null,
          escalated_by: "samantha_followup_due",
          org_id: lead.org_id ?? null,
          created_at: nowIso,
        });

        await logSamanthaAction({
          db: supabase,
          leadId: lead.id,
          orgId: lead.org_id ?? null,
          source: "follow_up_due",
          triggerType: "idx_due",
          plannedAction: action.action,
          executedAction: "notify_agent",
          executionMode: EXECUTION_MODE,
          status: "executed",
          reasonCodes: action.reason_codes,
          details: {
            escalation_reason: "IDX_FOLLOW_UP_DUE",
          },
        });

        await supabase
          .from("leads")
          .update({
            next_contact_at: null,
            updated_at: nowIso,
          })
          .eq("id", lead.id);

        results.push({
          lead_id: lead.id,
          action,
          executed: "notify_agent",
          success: true,
        });

        continue;
      }

      await logSamanthaAction({
        db: supabase,
        leadId: lead.id,
        orgId: lead.org_id ?? null,
        source: "follow_up_due",
        triggerType: "idx_due",
        plannedAction: action.action,
        executedAction: "wait",
        executionMode: EXECUTION_MODE,
        status: "skipped",
        reasonCodes: action.reason_codes,
        details: {
          next_contact_at: lead.next_contact_at ?? null,
        },
      });

      await supabase
        .from("leads")
        .update({
          next_contact_at: action.governor_action === "wait" ? lead.next_contact_at : null,
          updated_at: nowIso,
        })
        .eq("id", lead.id);

      results.push({
        lead_id: lead.id,
        action,
        executed: "wait",
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      execution_mode: EXECUTION_MODE,
      scanned: leads?.length ?? 0,
      results,
    });
  } catch (error: any) {
    console.error("❌ process-due route error:", error);
    return NextResponse.json(
      { error: error.message || "Follow-up due processing failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;