type LogSamanthaActionArgs = {
  db: any;
  leadId?: string | null;
  orgId?: string | null;
  source: string;
  triggerType?: string | null;
  plannedAction: string;
  executedAction?: string | null;
  executionMode: "mock" | "live";
  status: "planned" | "executed" | "skipped" | "failed";
  reasonCodes?: string[];
  details?: Record<string, any>;
};

export async function logSamanthaAction({
  db,
  leadId = null,
  orgId = null,
  source,
  triggerType = null,
  plannedAction,
  executedAction = null,
  executionMode,
  status,
  reasonCodes = [],
  details = {},
}: LogSamanthaActionArgs) {
  const payload = {
    lead_id: leadId,
    org_id: orgId,
    source,
    trigger_type: triggerType,
    planned_action: plannedAction,
    executed_action: executedAction,
    execution_mode: executionMode,
    status,
    reason_codes: reasonCodes,
    details,
  };

  const { error } = await db.from("samantha_action_logs").insert(payload);

  if (error) {
    throw new Error(`Failed to log Samantha action: ${error.message}`);
  }

  return payload;
}