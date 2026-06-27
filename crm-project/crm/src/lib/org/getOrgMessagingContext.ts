import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { MPRE_BOISE_ORG_ID } from "../guideAssets/getActiveGuideUrl";

export type OrgMessagingContext = {
  orgId: string;
  orgName: string;
  brandName: string;
  brokerageName: string;
  city: string;
  state: string;
  marketName: string;
  guideTitle: string;
  guideLabel: string;
  teamLabel: string;
  signatureHtml: string;
  signatureText: string;
  areaQuestion: string;
};

function clean(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function buildAreaQuestion(marketName: string) {
  const normalized = marketName.toLowerCase();

  if (normalized.includes("boise") || normalized.includes("treasure valley")) {
    return "Are you mostly looking at Boise itself, or are you also considering Meridian, Eagle, Nampa, Kuna, Star, or Caldwell?";
  }

  if (normalized.includes("twin falls")) {
    return "Are you mostly looking at Twin Falls itself, or are you also considering nearby Magic Valley communities?";
  }

  if (
    normalized.includes("coeur") ||
    normalized.includes("cda") ||
    normalized.includes("north idaho")
  ) {
    return "Are you mostly looking at Coeur d'Alene itself, or are you also considering nearby North Idaho communities?";
  }

  return `Are you mostly looking in ${marketName}, or are you also considering nearby areas?`;
}

async function getActiveGuideTitle(orgId: string, guideType: string) {
  const { data } = await supabaseAdmin
    .from("guide_assets")
    .select("title")
    .eq("org_id", orgId)
    .eq("guide_type", guideType)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.title || null;
}

export async function getOrgMessagingContext(
  orgId?: string | null,
  guideType = "relocation"
): Promise<OrgMessagingContext> {
  const resolvedOrgId = orgId || MPRE_BOISE_ORG_ID;

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name, brokerage_name, city, state, market_name, org_display")
    .eq("id", resolvedOrgId)
    .maybeSingle();

  const orgName = clean(org?.name, "MPRE Boise");
  const brandName = clean(org?.org_display, orgName);
  const brokerageName = clean(org?.brokerage_name, "Homes of Idaho");
  const city = clean(org?.city, "Boise");
  const state = clean(org?.state, "Idaho");
  const marketName = clean(org?.market_name, city);

  const guideTitle = clean(
    await getActiveGuideTitle(resolvedOrgId, guideType),
    `${marketName} Area Relocation Guide`
  );

  const guideLabel = guideTitle.toLowerCase().includes("guide")
    ? guideTitle
    : `${marketName} relocation guide`;

  return {
    orgId: resolvedOrgId,
    orgName,
    brandName,
    brokerageName,
    city,
    state,
    marketName,
    guideTitle,
    guideLabel,
    teamLabel: `the ${brandName} team`,
    signatureHtml: `${brandName}<br />${brokerageName}`,
    signatureText: `${brandName}\n${brokerageName}`,
    areaQuestion: buildAreaQuestion(marketName),
  };
}
