type DbClient = {
  from: (table: string) => {
    update: (values: Record<string, any>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

type MeaningfulEngagementChannel = "call" | "text" | "appointment" | "idx" | "manual";

type MarkMeaningfulEngagementArgs = {
  db: DbClient;
  leadId: string;
  channel: MeaningfulEngagementChannel;
  now?: Date;
  extraLeadUpdates?: Record<string, any>;
};

function getDaypart(hour: number) {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export async function markMeaningfulEngagement({
  db,
  leadId,
  channel,
  now = new Date(),
  extraLeadUpdates = {},
}: MarkMeaningfulEngagementArgs) {
  const nowIso = now.toISOString();
  const bestHour = now.getHours();
  const bestDaypart = getDaypart(bestHour);

  const leadPatch: Record<string, any> = {
    last_meaningful_engagement_at: nowIso,
    lead_heat: "hot",
    hot_until: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    next_contact_at: null,
    best_contact_channel: channel === "appointment" ? "call" : channel,
    best_contact_hour: bestHour,
    best_contact_daypart: bestDaypart,
    updated_at: nowIso,
    ...extraLeadUpdates,
  };

  if (channel === "call") {
    leadPatch.last_answered_call_at = nowIso;
  }

  if (channel === "text") {
    leadPatch.last_replied_text_at = nowIso;
  }

  if (channel === "idx") {
    leadPatch.last_idx_activity_at = nowIso;
  }

  const { error } = await db
    .from("leads")
    .update(leadPatch)
    .eq("id", leadId);

  if (error) {
    throw new Error(`Failed to mark meaningful engagement: ${error.message}`);
  }

  return {
    success: true,
    lead_id: leadId,
    applied_at: nowIso,
    channel,
    lead_patch: leadPatch,
  };
}