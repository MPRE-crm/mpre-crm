import {
  evaluateLeadContactState,
  type SamanthaLead,
} from "./contactGovernor";

function printScenario(name: string, lead: SamanthaLead, now: Date, context = {}) {
  const result = evaluateLeadContactState(lead, { now, ...context });

  console.log(`\n=== ${name} ===`);
  console.log(
    JSON.stringify(
      {
        action: result.action,
        should_call: result.should_call,
        should_text: result.should_text,
        should_wait: result.should_wait,
        heat_status: result.heat_status,
        escalate_to_agent: result.escalate_to_agent,
        contact_allowed_now: result.contact_allowed_now,
        next_contact_at: result.next_contact_at,
        preferred_channel: result.preferred_channel,
        reason_codes: result.reason_codes,
      },
      null,
      2
    )
  );
}

const baseNow = new Date("2026-03-18T10:00:00");

const scenarios: Array<{
  name: string;
  lead: SamanthaLead;
  now?: Date;
  context?: Record<string, unknown>;
}> = [
  {
    name: "1) Brand-new hot lead during contact hours",
    lead: {
      id: "lead-1",
      created_at: "2026-03-18T08:30:00",
      phone: "2085551001",
      can_text: true,
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "2) Hot lead outside contact hours",
    now: new Date("2026-03-18T21:15:00"),
    lead: {
      id: "lead-2",
      created_at: "2026-03-18T18:30:00",
      phone: "2085551002",
      can_text: true,
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "3) Warm lead with text available",
    lead: {
      id: "lead-3",
      created_at: "2026-03-13T09:00:00",
      phone: "2085551003",
      can_text: true,
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "4) Cold lead not due yet",
    lead: {
      id: "lead-4",
      created_at: "2026-03-01T09:00:00",
      phone: "2085551004",
      can_text: true,
      last_text_attempt_at: "2026-03-16T09:00:00",
      last_contact_attempt_at: "2026-03-16T09:00:00",
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "5) Re-engaged old lead",
    lead: {
      id: "lead-5",
      created_at: "2026-02-20T09:00:00",
      last_meaningful_engagement_at: "2026-03-10T10:00:00",
      phone: "2085551005",
      can_text: true,
      calls_today_count: 0,
      texts_today_count: 0,
    },
    context: {
      justReengaged: true,
    },
  },
  {
    name: "6) Do-not-contact lead",
    lead: {
      id: "lead-6",
      created_at: "2026-03-18T08:00:00",
      phone: "2085551006",
      can_text: true,
      do_not_contact: true,
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "7) Appointment already set",
    lead: {
      id: "lead-7",
      created_at: "2026-03-18T08:00:00",
      phone: "2085551007",
      can_text: true,
      appointment_at: "2026-03-20T14:00:00",
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "8) Manual pause active",
    lead: {
      id: "lead-8",
      created_at: "2026-03-18T08:00:00",
      phone: "2085551008",
      can_text: true,
      manual_contact_pause_until: "2026-03-19T11:00:00",
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
  {
    name: "9) Hot lead already used daily call, should text fallback",
    lead: {
      id: "lead-9",
      created_at: "2026-03-18T07:30:00",
      phone: "2085551009",
      can_text: true,
      calls_today_count: 1,
      texts_today_count: 0,
      last_call_attempt_at: "2026-03-17T08:00:00",
      last_contact_attempt_at: "2026-03-17T08:00:00",
    },
  },
  {
    name: "10) Warm lead cannot text, should allow call",
    lead: {
      id: "lead-10",
      created_at: "2026-03-14T09:00:00",
      phone: "2085551010",
      can_text: false,
      calls_today_count: 0,
      texts_today_count: 0,
    },
  },
];

for (const scenario of scenarios) {
  printScenario(
    scenario.name,
    scenario.lead,
    scenario.now ?? baseNow,
    scenario.context ?? {}
  );
}