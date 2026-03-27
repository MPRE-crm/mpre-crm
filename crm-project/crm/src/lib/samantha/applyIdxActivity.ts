import { markMeaningfulEngagement } from "./markMeaningfulEngagement";
import type { IdxTriggerDecision } from "./evaluateIdxTrigger";

type DbClient = any;

type ApplyIdxActivityArgs = {
  db: DbClient;
  leadId: string;
  decision: IdxTriggerDecision;
  idxViews30d: number;
  idxSearchRequests30d: number;
  now?: Date;
};

export async function applyIdxActivity({
  db,
  leadId,
  decision,
  idxViews30d,
  idxSearchRequests30d,
  now = new Date(),
}: ApplyIdxActivityArgs) {
  const nowIso = now.toISOString();

  const basePatch: Record<string, any> = {
    last_idx_activity_at: decision.last_idx_activity_at ?? nowIso,
    idx_views_30d: idxViews30d,
    idx_search_requests_30d: idxSearchRequests30d,
    updated_at: nowIso,
  };

  if (decision.triggered) {
    basePatch.idx_followup_trigger_type = decision.trigger_type;
    basePatch.idx_followup_trigger_count = decision.trigger_count;
    basePatch.last_idx_triggered_at = nowIso;
  }

  const { error: updateError } = await db
    .from("leads")
    .update(basePatch)
    .eq("id", leadId);

  if (updateError) {
    throw new Error(`Failed to apply IDX activity: ${updateError.message}`);
  }

  if (decision.triggered) {
    await markMeaningfulEngagement({
      db,
      leadId,
      channel: "idx",
      now,
      extraLeadUpdates: {
        idx_followup_trigger_type: decision.trigger_type,
        idx_followup_trigger_count: decision.trigger_count,
        last_idx_triggered_at: nowIso,
        idx_views_30d: idxViews30d,
        idx_search_requests_30d: idxSearchRequests30d,
      },
    });
  }

  return {
    success: true,
    lead_id: leadId,
    triggered: decision.triggered,
    trigger_type: decision.trigger_type,
    trigger_count: decision.trigger_count,
    idx_views_30d: idxViews30d,
    idx_search_requests_30d: idxSearchRequests30d,
    last_idx_activity_at: decision.last_idx_activity_at ?? nowIso,
  };
}