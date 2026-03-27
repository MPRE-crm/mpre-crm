import { evaluateLeadContactState } from "./contactGovernor";

export type PostIdxAction = "text_now" | "call_now" | "notify_agent" | "wait";

export type ResolvePostIdxActionArgs = {
  lead: any;
  now?: Date;
};

export type ResolvePostIdxActionResult = {
  action: PostIdxAction;
  governor_action: string;
  heat_status: string;
  reason_codes: string[];
  escalate_to_agent: boolean;
};

function hasBookedAppointment(lead: any) {
  return Boolean(
    lead?.appointment_date ||
      lead?.appointment_status === "Confirmed" ||
      lead?.appointment_status === "Rescheduled" ||
      lead?.agent_status === "appointment_booked" ||
      lead?.agent_status === "appointment_rescheduled"
  );
}

function normalizeText(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function wantsDirectAgentHelp(lead: any) {
  return (
    lead?.wants_agent_call === true ||
    normalizeText(lead?.preferred_next_step).includes("agent") ||
    normalizeText(lead?.appointment_type).includes("agent")
  );
}

function alreadyCalledToday(lead: any, now: Date) {
  const today = now.toISOString().slice(0, 10);
  return (
    lead?.calls_today_date === today &&
    Number(lead?.calls_today_count ?? 0) >= 1
  );
}

function alreadyTextedToday(lead: any, now: Date) {
  const today = now.toISOString().slice(0, 10);
  return (
    lead?.texts_today_date === today &&
    Number(lead?.texts_today_count ?? 0) >= 1
  );
}

export function resolvePostIdxAction({
  lead,
  now = new Date(),
}: ResolvePostIdxActionArgs): ResolvePostIdxActionResult {
  const governor = evaluateLeadContactState(lead, { now });

  const reasonCodes: string[] = [...(governor.reason_codes ?? [])];

  if (hasBookedAppointment(lead)) {
    reasonCodes.push("APPOINTMENT_ALREADY_EXISTS");
    return {
      action: "wait",
      governor_action: governor.action,
      heat_status: governor.heat_status,
      reason_codes: reasonCodes,
      escalate_to_agent: false,
    };
  }

  if (lead?.do_not_call === true) {
    if (governor.action === "text_now") {
      reasonCodes.push("DO_NOT_CALL_TEXT_ALLOWED");
      return {
        action: "text_now",
        governor_action: governor.action,
        heat_status: governor.heat_status,
        reason_codes: reasonCodes,
        escalate_to_agent: false,
      };
    }

    reasonCodes.push("DO_NOT_CALL_WAIT");
    return {
      action: "wait",
      governor_action: governor.action,
      heat_status: governor.heat_status,
      reason_codes: reasonCodes,
      escalate_to_agent: false,
    };
  }

  if (wantsDirectAgentHelp(lead)) {
    reasonCodes.push("DIRECT_AGENT_HELP_REQUESTED");

    if (governor.escalate_to_agent) {
      reasonCodes.push("GOVERNOR_ESCALATE_TO_AGENT");
      return {
        action: "notify_agent",
        governor_action: governor.action,
        heat_status: governor.heat_status,
        reason_codes: reasonCodes,
        escalate_to_agent: true,
      };
    }

    if (governor.action === "call_now" && !alreadyCalledToday(lead, now)) {
      reasonCodes.push("AGENT_HELP_CALL_NOW");
      return {
        action: "call_now",
        governor_action: governor.action,
        heat_status: governor.heat_status,
        reason_codes: reasonCodes,
        escalate_to_agent: false,
      };
    }

    if (governor.action === "text_now" && !alreadyTextedToday(lead, now)) {
      reasonCodes.push("AGENT_HELP_TEXT_NOW");
      return {
        action: "text_now",
        governor_action: governor.action,
        heat_status: governor.heat_status,
        reason_codes: reasonCodes,
        escalate_to_agent: false,
      };
    }

    reasonCodes.push("AGENT_HELP_WAIT");
    return {
      action: "wait",
      governor_action: governor.action,
      heat_status: governor.heat_status,
      reason_codes: reasonCodes,
      escalate_to_agent: false,
    };
  }

  if (governor.action === "call_now" && !alreadyCalledToday(lead, now)) {
    reasonCodes.push("IDX_CALL_NOW");
    return {
      action: "call_now",
      governor_action: governor.action,
      heat_status: governor.heat_status,
      reason_codes: reasonCodes,
      escalate_to_agent: false,
    };
  }

  if (governor.action === "text_now" && !alreadyTextedToday(lead, now)) {
    reasonCodes.push("IDX_TEXT_NOW");
    return {
      action: "text_now",
      governor_action: governor.action,
      heat_status: governor.heat_status,
      reason_codes: reasonCodes,
      escalate_to_agent: false,
    };
  }

  if (governor.escalate_to_agent) {
    reasonCodes.push("IDX_NOTIFY_AGENT");
    return {
      action: "notify_agent",
      governor_action: governor.action,
      heat_status: governor.heat_status,
      reason_codes: reasonCodes,
      escalate_to_agent: true,
    };
  }

  reasonCodes.push("IDX_WAIT");
  return {
    action: "wait",
    governor_action: governor.action,
    heat_status: governor.heat_status,
    reason_codes: reasonCodes,
    escalate_to_agent: false,
  };
}