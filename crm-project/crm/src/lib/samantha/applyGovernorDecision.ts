import type { SamanthaGovernorDecision } from "./contactGovernor";

type DbClient = any;

type ApplyGovernorDecisionArgs = {
  db: DbClient;
  leadId: string;
  decision: SamanthaGovernorDecision;
  now?: Date;
  orgId?: string | null;
  statusAtEscalation?: string | null;
  escalatedBy?: string | null;
  extraLeadUpdates?: Record<string, any>;
};

export async function applyGovernorDecision({
  db,
  leadId,
  decision,
  now = new Date(),
  orgId = null,
  statusAtEscalation = null,
  escalatedBy = "samantha_governor",
  extraLeadUpdates = {},
}: ApplyGovernorDecisionArgs) {
  const nowIso = now.toISOString();

  const leadPatch: Record<string, any> = {
    lead_heat: decision.heat_status,
    next_contact_at: decision.next_contact_at,
    updated_at: nowIso,
    ...extraLeadUpdates,
  };

  if (decision.heat_status === "hot") {
    leadPatch.hot_until = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  }

  const { error: leadError } = await db
    .from("leads")
    .update(leadPatch)
    .eq("id", leadId);

  if (leadError) {
    throw new Error(`Failed to apply governor decision to lead: ${leadError.message}`);
  }

  if (decision.escalate_to_agent) {
    const { error: escalationError } = await db.from("escalation_logs").insert({
      lead_id: leadId,
      escalation_reason: decision.reason_codes.join(", "),
      created_at: nowIso,
      status_at_escalation: statusAtEscalation,
      escalated_by: escalatedBy,
      org_id: orgId,
    });

    if (escalationError) {
      throw new Error(`Failed to log escalation: ${escalationError.message}`);
    }
  }

  return {
    success: true,
    lead_id: leadId,
    applied_at: nowIso,
    lead_patch: leadPatch,
    escalated: decision.escalate_to_agent,
  };
}