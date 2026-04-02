import { createClient } from "@supabase/supabase-js";
import { getNextAssignee } from "../rotation/getNextAssignee";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function saveRelocationLead({
  org_id,
  first_name,
  last_name,
  email,
  phone,
  city,
  county,
  price_range,
  move_timeline,
  preferred_areas,
  monthly_payment_comfort,
  comparing_markets,
  clarity_topic,
  primary_objection,
  secondary_objection,
  objection_detail,
  biggest_concern,
  biggest_unknown,
  preferred_next_step,
  wants_home_search,
  wants_agent_call,
  wants_lender_connection,
  school_needs,
  commute_needs,
  routine_needs,
  neighborhood_must_haves,
  neighborhood_deal_breakers,
  overwhelm_source,
  sell_first_need,
  job_uncertainty_type,
  visit_focus,
  rate_concern_type,
  price_concern_type,
  rent_first_reason,
  bad_experience_type,
  inventory_problem,
  lender_need_type,
  cost_concern_type,
  pressure_concern_type,
  listing_focus,
  family_resistance_type,
  wrong_move_fear,
  tax_policy_concern_type,
  weather_concern_type,
  resale_concern_type,
  moving_too_fast_reason,
  callback_day,
  callback_time,
  appointment_choice,
  appointment_confidence,
  appointment_slot_label,
  appointment_slot_raw,
  notes,
  lead_source,
  lead_source_detail,
}: {
  org_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  county?: string | null;
  price_range?: string | null;
  move_timeline?: string | null;
  preferred_areas?: string | null;
  monthly_payment_comfort?: string | null;
  comparing_markets?: string | null;
  clarity_topic?: string | null;
  primary_objection?: string | null;
  secondary_objection?: string | null;
  objection_detail?: string | null;
  biggest_concern?: string | null;
  biggest_unknown?: string | null;
  preferred_next_step?: string | null;
  wants_home_search?: boolean;
  wants_agent_call?: boolean;
  wants_lender_connection?: boolean;
  school_needs?: string | null;
  commute_needs?: string | null;
  routine_needs?: string | null;
  neighborhood_must_haves?: string | null;
  neighborhood_deal_breakers?: string | null;
  overwhelm_source?: string | null;
  sell_first_need?: string | null;
  job_uncertainty_type?: string | null;
  visit_focus?: string | null;
  rate_concern_type?: string | null;
  price_concern_type?: string | null;
  rent_first_reason?: string | null;
  bad_experience_type?: string | null;
  inventory_problem?: string | null;
  lender_need_type?: string | null;
  cost_concern_type?: string | null;
  pressure_concern_type?: string | null;
  listing_focus?: string | null;
  family_resistance_type?: string | null;
  wrong_move_fear?: string | null;
  tax_policy_concern_type?: string | null;
  weather_concern_type?: string | null;
  resale_concern_type?: string | null;
  moving_too_fast_reason?: string | null;
  callback_day?: string | null;
  callback_time?: string | null;
  appointment_choice?: string | null;
  appointment_confidence?: string | null;
  appointment_slot_label?: string | null;
  appointment_slot_raw?: string | null;
  notes?: string | null;
  lead_source?: string | null;
  lead_source_detail?: string | null;
}) {
  /* -------------------------------------------------- */
  /* ROTATION                                           */
  /* -------------------------------------------------- */

  const assignee = await getNextAssignee(org_id).catch(() => null);
  const agent_id = assignee?.user_id ?? null;

  /* -------------------------------------------------- */
  /* SOURCE / HOOK NORMALIZATION                        */
  /* -------------------------------------------------- */

  const normalizedLeadSource =
    String(lead_source || "").trim() || "Unknown";

  const normalizedLeadSourceDetail =
    String(lead_source_detail || "").trim() || "Relocation Guide";

  /* -------------------------------------------------- */
  /* AGENT SUMMARY                                      */
  /* -------------------------------------------------- */

  const summaryParts = [
    "Relocation AI lead",
    `Lead source: ${normalizedLeadSource}`,
    `Hook / offer: ${normalizedLeadSourceDetail}`,
    move_timeline ? `Move timeline: ${move_timeline}` : null,
    price_range ? `Price range: ${price_range}` : null,
    monthly_payment_comfort
      ? `Monthly payment comfort: ${monthly_payment_comfort}`
      : null,
    preferred_areas ? `Preferred areas: ${preferred_areas}` : null,
    comparing_markets ? `Comparing markets: ${comparing_markets}` : null,
    primary_objection ? `Primary objection: ${primary_objection}` : null,
    secondary_objection ? `Secondary objection: ${secondary_objection}` : null,
    biggest_concern ? `Biggest concern: ${biggest_concern}` : null,
    biggest_unknown ? `Biggest unknown: ${biggest_unknown}` : null,
    preferred_next_step ? `Preferred next step: ${preferred_next_step}` : null,
    school_needs ? `School needs: ${school_needs}` : null,
    commute_needs ? `Commute needs: ${commute_needs}` : null,
    routine_needs ? `Routine needs: ${routine_needs}` : null,
    neighborhood_must_haves
      ? `Neighborhood must-haves: ${neighborhood_must_haves}`
      : null,
    neighborhood_deal_breakers
      ? `Neighborhood deal breakers: ${neighborhood_deal_breakers}`
      : null,
    overwhelm_source ? `Overwhelm source: ${overwhelm_source}` : null,
    sell_first_need ? `Needs to sell first: ${sell_first_need}` : null,
    job_uncertainty_type
      ? `Job relocation uncertainty: ${job_uncertainty_type}`
      : null,
    visit_focus ? `Visit focus: ${visit_focus}` : null,
    rate_concern_type ? `Rate concern: ${rate_concern_type}` : null,
    price_concern_type ? `Price concern: ${price_concern_type}` : null,
    rent_first_reason ? `Rent-first reason: ${rent_first_reason}` : null,
    bad_experience_type
      ? `Past bad experience: ${bad_experience_type}`
      : null,
    inventory_problem ? `Inventory problem: ${inventory_problem}` : null,
    lender_need_type ? `Lender need: ${lender_need_type}` : null,
    cost_concern_type ? `Cost concern: ${cost_concern_type}` : null,
    pressure_concern_type
      ? `Sales pressure concern: ${pressure_concern_type}`
      : null,
    listing_focus ? `Listing focus: ${listing_focus}` : null,
    family_resistance_type
      ? `Family resistance: ${family_resistance_type}`
      : null,
    wrong_move_fear ? `Wrong move fear: ${wrong_move_fear}` : null,
    tax_policy_concern_type
      ? `Taxes/policy concern: ${tax_policy_concern_type}`
      : null,
    weather_concern_type
      ? `Weather concern: ${weather_concern_type}`
      : null,
    resale_concern_type
      ? `Resale concern: ${resale_concern_type}`
      : null,
    moving_too_fast_reason
      ? `Moving too fast concern: ${moving_too_fast_reason}`
      : null,
    callback_day ? `Callback day: ${callback_day}` : null,
    callback_time ? `Callback time: ${callback_time}` : null,
    appointment_choice ? `Appointment choice: ${appointment_choice}` : null,
    appointment_confidence
      ? `Appointment confidence: ${appointment_confidence}`
      : null,
    appointment_slot_label
      ? `Appointment slot label: ${appointment_slot_label}`
      : null,
    appointment_slot_raw ? `Appointment slot raw: ${appointment_slot_raw}` : null,
    wants_home_search ? `Wants home search: yes` : null,
    wants_agent_call ? `Wants agent call: yes` : null,
    wants_lender_connection ? `Wants lender connection: yes` : null,
    clarity_topic ? `Needs clarity on: ${clarity_topic}` : null,
    objection_detail ? `Objection detail: ${objection_detail}` : null,
    notes ? `Call notes: ${notes}` : null,
  ].filter(Boolean);

  const ai_summary = summaryParts.join("\n");

  /* -------------------------------------------------- */
  /* INSERT LEAD                                        */
  /* -------------------------------------------------- */

  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id,
      first_name,
      last_name,
      name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
      email,
      phone,
      city,
      county,
      price_range,
      move_timeline,
      preferred_areas,
      monthly_payment_comfort,
      comparing_markets,
      clarity_topic,
      primary_objection,
      secondary_objection,
      objection_detail,
      biggest_concern,
      biggest_unknown,
      preferred_next_step,
      wants_home_search: wants_home_search ?? false,
      wants_agent_call: wants_agent_call ?? false,
      wants_lender_connection: wants_lender_connection ?? false,
      school_needs,
      commute_needs,
      routine_needs,
      neighborhood_must_haves,
      neighborhood_deal_breakers,
      overwhelm_source,
      sell_first_need,
      job_uncertainty_type,
      visit_focus,
      rate_concern_type,
      price_concern_type,
      rent_first_reason,
      bad_experience_type,
      inventory_problem,
      lender_need_type,
      cost_concern_type,
      pressure_concern_type,
      listing_focus,
      family_resistance_type,
      wrong_move_fear,
      tax_policy_concern_type,
      weather_concern_type,
      resale_concern_type,
      moving_too_fast_reason,
      callback_day,
      callback_time,
      appointment_choice,
      appointment_confidence,
      appointment_slot_label,
      appointment_slot_raw,
      notes: ai_summary,
      ai_summary,
      lead_type: "buyer",
      lead_source: normalizedLeadSource,
      lead_source_detail: normalizedLeadSourceDetail,
      agent_id,
      status: "new",
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Relocation lead insert failed:", error);
    return { ok: false, error };
  }

  return {
    ok: true,
    lead: data,
    assigned_agent: agent_id,
  };
}