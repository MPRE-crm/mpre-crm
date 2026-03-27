export type IdxTriggerType = "views_24h" | "search_requests_7d" | "none";

export type EvaluateIdxTriggerArgs = {
  idxViews24h: number;
  idxSearchRequests7d: number;
  lastIdxActivityAt?: string | null;
  viewThreshold?: number;
  searchRequestThreshold?: number;
};

export type IdxTriggerDecision = {
  triggered: boolean;
  trigger_type: IdxTriggerType;
  trigger_count: number;
  last_idx_activity_at: string | null;
  reason_codes: string[];
};

export function evaluateIdxTrigger({
  idxViews24h,
  idxSearchRequests7d,
  lastIdxActivityAt = null,
  viewThreshold = 3,
  searchRequestThreshold = 1,
}: EvaluateIdxTriggerArgs): IdxTriggerDecision {
  const reasons: string[] = [];

  if (idxViews24h >= viewThreshold) {
    reasons.push("IDX_VIEWS_THRESHOLD_MET");
    return {
      triggered: true,
      trigger_type: "views_24h",
      trigger_count: idxViews24h,
      last_idx_activity_at: lastIdxActivityAt,
      reason_codes: reasons,
    };
  }

  if (idxSearchRequests7d >= searchRequestThreshold) {
    reasons.push("IDX_SEARCH_REQUEST_THRESHOLD_MET");
    return {
      triggered: true,
      trigger_type: "search_requests_7d",
      trigger_count: idxSearchRequests7d,
      last_idx_activity_at: lastIdxActivityAt,
      reason_codes: reasons,
    };
  }

  reasons.push("IDX_TRIGGER_NOT_MET");
  return {
    triggered: false,
    trigger_type: "none",
    trigger_count: 0,
    last_idx_activity_at: lastIdxActivityAt,
    reason_codes: reasons,
  };
}