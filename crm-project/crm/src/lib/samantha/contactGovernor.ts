export type LeadHeatStatus = "hot" | "warm" | "cold";

export type PreferredChannel = "call" | "text" | "unknown";

export type SamanthaAction = "call_now" | "text_now" | "wait" | "none";

export type SamanthaReasonCode =
  | "NEW_LEAD_HOT"
  | "HOT_AFTER_RECENT_ENGAGEMENT"
  | "WARM_DAY_3_TO_7"
  | "COLD_AFTER_DAY_7"
  | "REENGAGED_TO_HOT"
  | "OUTSIDE_CONTACT_HOURS"
  | "QUIET_HOURS"
  | "CALL_LIMIT_REACHED"
  | "TEXT_LIMIT_REACHED"
  | "MIN_GAP_NOT_MET"
  | "TOO_SOON_SINCE_LAST_CONTACT"
  | "TOO_SOON_SINCE_LAST_CALL"
  | "TOO_SOON_SINCE_LAST_TEXT"
  | "NO_PHONE"
  | "NO_TEXT_CAPABLE_PHONE"
  | "HOT_PRIORITY_CALL"
  | "TEXT_FALLBACK"
  | "WARM_TEXT_FIRST"
  | "WARM_CALL_ALLOWED"
  | "COLD_TEXT_NURTURE"
  | "COLD_NURTURE_WAIT"
  | "COLD_NURTURE_NOT_DUE"
  | "MEANINGFUL_ENGAGEMENT_RECENT"
  | "AGENT_ESCALATION_REENGAGED"
  | "AGENT_ESCALATION_HOT"
  | "MANUAL_OVERRIDE_ACTIVE"
  | "DO_NOT_CONTACT"
  | "LEAD_CLOSED"
  | "APPOINTMENT_ALREADY_SET";

export interface SamanthaLead {
  id: string;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;

  status?: string | null;
  lead_heat?: LeadHeatStatus | null;

  phone?: string | null;
  can_text?: boolean | null;
  do_not_contact?: boolean | null;

  assigned_agent_id?: string | null;
  appointment_at?: string | Date | null;
  closed_at?: string | Date | null;

  last_contact_attempt_at?: string | Date | null;
  last_call_attempt_at?: string | Date | null;
  last_text_attempt_at?: string | Date | null;

  last_call_answered_at?: string | Date | null;
  last_text_reply_at?: string | Date | null;
  last_meaningful_engagement_at?: string | Date | null;

  calls_today_count?: number | null;
  texts_today_count?: number | null;

  manual_contact_pause_until?: string | Date | null;
  manual_override_active?: boolean | null;

  preferred_contact_start_hour?: number | null;
  preferred_contact_end_hour?: number | null;
}

export interface SamanthaGovernorConfig {
  contactStartHour: number;
  contactEndHour: number;
  weekendsAllowed: boolean;

  hotDurationHours: number;
  warmDurationDays: number;

  hotMinGapHours: number;
  warmMinGapHours: number;
  coldMinGapHours: number;

  maxCallsPerDay: number;
  maxTextsPerDayHotDay1: number;
  maxTextsPerDayHotAfterDay1: number;
  maxTextsPerDayWarm: number;
  maxTextsPerDayCold: number;

  recentMeaningfulEngagementCooldownHours: number;
  escalationOnReengagement: boolean;
  escalationOnHotLead: boolean;

  coldNurtureIntervalHours: number;
}

export interface SamanthaGovernorContext {
  now?: Date;
  timezone?: string;
  isNewLead?: boolean;
  justReengaged?: boolean;
  preferredChannel?: PreferredChannel;
  activeConversation?: boolean;
}

export interface SamanthaGovernorDecision {
  action: SamanthaAction;
  should_call: boolean;
  should_text: boolean;
  should_wait: boolean;

  heat_status: LeadHeatStatus;
  escalate_to_agent: boolean;

  contact_allowed_now: boolean;
  next_contact_at: string | null;

  preferred_channel: PreferredChannel;
  reason_codes: SamanthaReasonCode[];
}

export const DEFAULT_SAMANTHA_GOVERNOR_CONFIG: SamanthaGovernorConfig = {
  contactStartHour: 8,
  contactEndHour: 19,
  weekendsAllowed: true,

  hotDurationHours: 48,
  warmDurationDays: 7,

  hotMinGapHours: 24,
  warmMinGapHours: 24,
  coldMinGapHours: 72,

  maxCallsPerDay: 1,
  maxTextsPerDayHotDay1: 2,
  maxTextsPerDayHotAfterDay1: 1,
  maxTextsPerDayWarm: 1,
  maxTextsPerDayCold: 1,

  recentMeaningfulEngagementCooldownHours: 12,
  escalationOnReengagement: true,
  escalationOnHotLead: false,

  coldNurtureIntervalHours: 72,
};

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hoursBetween(older: Date, newer: Date): number {
  return (newer.getTime() - older.getTime()) / (1000 * 60 * 60);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function maxDate(dates: Array<Date | null>): Date | null {
  const valid = dates.filter((d): d is Date => !!d);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function startOfNextAllowedWindow(
  now: Date,
  config: SamanthaGovernorConfig
): Date {
  const next = new Date(now);

  while (true) {
    if (!config.weekendsAllowed && isWeekend(next)) {
      next.setDate(next.getDate() + 1);
      next.setHours(config.contactStartHour, 0, 0, 0);
      continue;
    }

    const hour = next.getHours();

    if (hour < config.contactStartHour) {
      next.setHours(config.contactStartHour, 0, 0, 0);
      return next;
    }

    if (hour >= config.contactEndHour) {
      next.setDate(next.getDate() + 1);
      next.setHours(config.contactStartHour, 0, 0, 0);
      continue;
    }

    return next;
  }
}

function isWithinContactWindow(
  now: Date,
  config: SamanthaGovernorConfig
): boolean {
  if (!config.weekendsAllowed && isWeekend(now)) return false;
  const hour = now.getHours();
  return hour >= config.contactStartHour && hour < config.contactEndHour;
}

function minGapHoursForHeat(
  heat: LeadHeatStatus,
  config: SamanthaGovernorConfig
): number {
  if (heat === "hot") return config.hotMinGapHours;
  if (heat === "warm") return config.warmMinGapHours;
  return config.coldMinGapHours;
}

function computeHeatStatus(
  lead: SamanthaLead,
  now: Date,
  context: SamanthaGovernorContext,
  reasons: SamanthaReasonCode[],
  config: SamanthaGovernorConfig
): LeadHeatStatus {
  if (context.justReengaged) {
    reasons.push("REENGAGED_TO_HOT");
    return "hot";
  }

  const createdAt = toDate(lead.created_at) ?? now;
  const lastMeaningfulAt = toDate(lead.last_meaningful_engagement_at);
  const anchor = lastMeaningfulAt ?? createdAt;
  const ageHours = hoursBetween(anchor, now);

  if (ageHours <= config.hotDurationHours) {
    reasons.push(lastMeaningfulAt ? "HOT_AFTER_RECENT_ENGAGEMENT" : "NEW_LEAD_HOT");
    return "hot";
  }

  if (ageHours <= config.warmDurationDays * 24) {
    reasons.push("WARM_DAY_3_TO_7");
    return "warm";
  }

  reasons.push("COLD_AFTER_DAY_7");
  return "cold";
}

function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function isBrandNewLeadDay1(
  lead: SamanthaLead,
  now: Date
): boolean {
  const createdAt = toDate(lead.created_at);
  if (!createdAt) return false;
  return hoursBetween(createdAt, now) <= 24;
}

function getHotTextLimit(
  lead: SamanthaLead,
  now: Date,
  config: SamanthaGovernorConfig
): number {
  if (isBrandNewLeadDay1(lead, now)) {
    return config.maxTextsPerDayHotDay1;
  }

  return config.maxTextsPerDayHotAfterDay1;
}

function maxTextsForHeat(
  lead: SamanthaLead,
  heat: LeadHeatStatus,
  now: Date,
  config: SamanthaGovernorConfig
): number {
  if (heat === "hot") {
    return getHotTextLimit(lead, now, config);
  }

  if (heat === "warm") {
    return config.maxTextsPerDayWarm;
  }

  return config.maxTextsPerDayCold;
}

function getNextColdNurtureTime(
  now: Date,
  lead: SamanthaLead,
  config: SamanthaGovernorConfig
): Date {
  const lastTextAt = toDate(lead.last_text_attempt_at);
  const lastContactAt = toDate(lead.last_contact_attempt_at);
  const anchor = maxDate([lastTextAt, lastContactAt]);

  if (!anchor) {
    return startOfNextAllowedWindow(now, config);
  }

  return startOfNextAllowedWindow(
    addHours(anchor, config.coldNurtureIntervalHours),
    config
  );
}

export function evaluateLeadContactState(
  lead: SamanthaLead,
  context: SamanthaGovernorContext = {},
  config: SamanthaGovernorConfig = DEFAULT_SAMANTHA_GOVERNOR_CONFIG
): SamanthaGovernorDecision {
  const now = context.now ?? new Date();
  const reasons: SamanthaReasonCode[] = [];
  const preferredChannel = context.preferredChannel ?? "unknown";

  const effectiveConfig: SamanthaGovernorConfig = {
  ...config,
  contactStartHour:
    typeof lead.preferred_contact_start_hour === "number"
      ? lead.preferred_contact_start_hour
      : config.contactStartHour,
  contactEndHour:
    typeof lead.preferred_contact_end_hour === "number"
      ? lead.preferred_contact_end_hour
      : config.contactEndHour,
};

  const lastContactAt = toDate(lead.last_contact_attempt_at);
  const lastCallAt = toDate(lead.last_call_attempt_at);
  const lastTextAt = toDate(lead.last_text_attempt_at);
  const lastMeaningfulAt = toDate(lead.last_meaningful_engagement_at);
  const manualPauseUntil = toDate(lead.manual_contact_pause_until);
  const appointmentAt = toDate(lead.appointment_at);
  const closedAt = toDate(lead.closed_at);

  const callsToday = lead.calls_today_count ?? 0;
  const textsToday = lead.texts_today_count ?? 0;

const heat = computeHeatStatus(lead, now, context, reasons, effectiveConfig);

  let escalateToAgent = false;
  if (context.justReengaged && effectiveConfig.escalationOnReengagement) {
    escalateToAgent = true;
    reasons.push("AGENT_ESCALATION_REENGAGED");
  } else if (heat === "hot" && effectiveConfig.escalationOnHotLead) {
    escalateToAgent = true;
    reasons.push("AGENT_ESCALATION_HOT");
  }

  if (lead.do_not_contact) {
    reasons.push("DO_NOT_CONTACT");
    return {
      action: "none",
      should_call: false,
      should_text: false,
      should_wait: true,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: false,
      next_contact_at: null,
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (closedAt || lead.status === "closed") {
    reasons.push("LEAD_CLOSED");
    return {
      action: "none",
      should_call: false,
      should_text: false,
      should_wait: true,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: false,
      next_contact_at: null,
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (appointmentAt) {
    reasons.push("APPOINTMENT_ALREADY_SET");
    return {
      action: "none",
      should_call: false,
      should_text: false,
      should_wait: true,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: false,
      next_contact_at: null,
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (lead.manual_override_active || (manualPauseUntil && manualPauseUntil > now)) {
    reasons.push("MANUAL_OVERRIDE_ACTIVE");
    return {
      action: "wait",
      should_call: false,
      should_text: false,
      should_wait: true,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: false,
      next_contact_at: isoOrNull(manualPauseUntil),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  let nextAllowedAt: Date | null = null;

if (!isWithinContactWindow(now, effectiveConfig)) {
  reasons.push(
    now.getHours() < effectiveConfig.contactStartHour
      ? "QUIET_HOURS"
      : "OUTSIDE_CONTACT_HOURS"
  );
  nextAllowedAt = startOfNextAllowedWindow(now, effectiveConfig);
}

  const minGapHours = minGapHoursForHeat(heat, effectiveConfig);
  const gapAnchor = maxDate([lastContactAt, lastCallAt, lastTextAt]);

  if (gapAnchor) {
    const elapsed = hoursBetween(gapAnchor, now);
    if (elapsed < minGapHours) {
      reasons.push("MIN_GAP_NOT_MET");
      reasons.push("TOO_SOON_SINCE_LAST_CONTACT");
      const gapRelease = addHours(gapAnchor, minGapHours);
      nextAllowedAt = maxDate([nextAllowedAt, gapRelease]);
    }
  }

  if (lastCallAt && hoursBetween(lastCallAt, now) < 24) {
    reasons.push("TOO_SOON_SINCE_LAST_CALL");
    const callRelease = addHours(lastCallAt, 24);
    nextAllowedAt = maxDate([nextAllowedAt, callRelease]);
  }

 const maxTextsToday = maxTextsForHeat(lead, heat, now, effectiveConfig);

  const canCall = !!lead.phone && callsToday < effectiveConfig.maxCallsPerDay;
  const canText =
    !!lead.phone &&
    (lead.can_text ?? true) &&
    textsToday < maxTextsToday;

  if (lastTextAt && textsToday >= maxTextsToday) {
    reasons.push("TEXT_LIMIT_REACHED");
    const tomorrowWindow = startOfNextAllowedWindow(addDays(now, 1), effectiveConfig);
    nextAllowedAt = maxDate([nextAllowedAt, tomorrowWindow]);
  }

  if (callsToday >= effectiveConfig.maxCallsPerDay) {
    reasons.push("CALL_LIMIT_REACHED");

    // Only block the day completely if text is not a valid fallback.
    if (!canText) {
      const tomorrowWindow = startOfNextAllowedWindow(addDays(now, 1), effectiveConfig);
      nextAllowedAt = maxDate([nextAllowedAt, tomorrowWindow]);
    }
  }

  if (
    lastMeaningfulAt &&
    !context.activeConversation &&
    hoursBetween(lastMeaningfulAt, now) < effectiveConfig.recentMeaningfulEngagementCooldownHours
  ) {
    reasons.push("MEANINGFUL_ENGAGEMENT_RECENT");
    const coolOffRelease = addHours(
     lastMeaningfulAt,
     effectiveConfig.recentMeaningfulEngagementCooldownHours
    );
    nextAllowedAt = maxDate([nextAllowedAt, coolOffRelease]);
  }

  const contactAllowedNow =
    nextAllowedAt === null ||
    (nextAllowedAt <= now && isWithinContactWindow(now, effectiveConfig));

  if (!lead.phone) {
    reasons.push("NO_PHONE");
  }

  if (!!lead.phone && !(lead.can_text ?? true)) {
    reasons.push("NO_TEXT_CAPABLE_PHONE");
  }

  if (!contactAllowedNow) {
    return {
      action: "wait",
      should_call: false,
      should_text: false,
      should_wait: true,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: false,
      next_contact_at: isoOrNull(nextAllowedAt),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (heat === "hot" && canCall) {
    reasons.push("HOT_PRIORITY_CALL");
    return {
      action: "call_now",
      should_call: true,
      should_text: false,
      should_wait: false,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: true,
      next_contact_at: isoOrNull(now),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (heat === "hot" && canText) {
    reasons.push("TEXT_FALLBACK");
    return {
      action: "text_now",
      should_call: false,
      should_text: true,
      should_wait: false,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: true,
      next_contact_at: isoOrNull(now),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (heat === "warm" && canText) {
    reasons.push("WARM_TEXT_FIRST");
    return {
      action: "text_now",
      should_call: false,
      should_text: true,
      should_wait: false,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: true,
      next_contact_at: isoOrNull(now),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (heat === "warm" && canCall) {
    reasons.push("WARM_CALL_ALLOWED");
    return {
      action: "call_now",
      should_call: true,
      should_text: false,
      should_wait: false,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: true,
      next_contact_at: isoOrNull(now),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  if (heat === "cold") {
    const nextColdTouchAt = getNextColdNurtureTime(now, lead, effectiveConfig);

    if (nextColdTouchAt > now) {
      reasons.push("COLD_NURTURE_NOT_DUE");
      reasons.push("COLD_NURTURE_WAIT");
      return {
        action: "wait",
        should_call: false,
        should_text: false,
        should_wait: true,
        heat_status: heat,
        escalate_to_agent: escalateToAgent,
        contact_allowed_now: false,
        next_contact_at: isoOrNull(nextColdTouchAt),
        preferred_channel: preferredChannel,
        reason_codes: reasons,
      };
    }

    if (canText) {
      reasons.push("COLD_TEXT_NURTURE");
      return {
        action: "text_now",
        should_call: false,
        should_text: true,
        should_wait: false,
        heat_status: heat,
        escalate_to_agent: escalateToAgent,
        contact_allowed_now: true,
        next_contact_at: isoOrNull(now),
        preferred_channel: preferredChannel,
        reason_codes: reasons,
      };
    }

    reasons.push("COLD_NURTURE_WAIT");
    return {
      action: "wait",
      should_call: false,
      should_text: false,
      should_wait: true,
      heat_status: heat,
      escalate_to_agent: escalateToAgent,
      contact_allowed_now: false,
      next_contact_at: isoOrNull(getNextColdNurtureTime(addHours(now, 1), lead, effectiveConfig)),
      preferred_channel: preferredChannel,
      reason_codes: reasons,
    };
  }

  return {
    action: "wait",
    should_call: false,
    should_text: false,
    should_wait: true,
    heat_status: heat,
    escalate_to_agent: escalateToAgent,
    contact_allowed_now: false,
    next_contact_at: isoOrNull(startOfNextAllowedWindow(addDays(now, 1), effectiveConfig)),
    preferred_channel: preferredChannel,
    reason_codes: reasons,
  };
}