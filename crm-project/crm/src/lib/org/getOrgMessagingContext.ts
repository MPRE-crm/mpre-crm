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
  guideYear: number | null;
  teamLabel: string;
  signatureHtml: string;
  signatureText: string;
  areaQuestion: string;
};

type ActiveGuideMetadata = {
  title: string | null;
  year: number | null;
  displayTitle: string | null;
};

function clean(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function parseGuideYear(value: unknown) {
  const numberValue = Number(value);

  if (
    Number.isInteger(numberValue) &&
    numberValue >= 2000 &&
    numberValue <= 2100
  ) {
    return numberValue;
  }

  return null;
}

function titleStartsWithYear(title: string, year: number) {
  return new RegExp(`^\\s*${year}\\b`).test(title);
}

function buildGuideDisplayTitle(
  title: string | null | undefined,
  year: number | null,
  fallback: string
) {
  const baseTitle = clean(title, fallback);

  if (!year) return baseTitle;
  if (titleStartsWithYear(baseTitle, year)) return baseTitle;

  return `${year} ${baseTitle}`;
}

function getMetadataDisplayTitle(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).display_title;
  const text = String(value || "").trim();

  return text || null;
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

async function getActiveGuideMetadata(
  orgId: string,
  guideType: string
): Promise<ActiveGuideMetadata> {
  const { data } = await supabaseAdmin
    .from("guide_assets")
    .select("title, year, metadata")
    .eq("org_id", orgId)
    .eq("guide_type", guideType)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    title: data?.title || null,
    year: parseGuideYear(data?.year),
    displayTitle: getMetadataDisplayTitle(data?.metadata),
  };
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

  const activeGuide = await getActiveGuideMetadata(resolvedOrgId, guideType);
  const fallbackGuideTitle = `${marketName} Area Relocation Guide`;

  const guideTitle = buildGuideDisplayTitle(
    activeGuide.displayTitle || activeGuide.title,
    activeGuide.year,
    fallbackGuideTitle
  );

  const fallbackGuideLabel = buildGuideDisplayTitle(
    `${marketName} relocation guide`,
    activeGuide.year,
    `${marketName} relocation guide`
  );

  const guideLabel = guideTitle.toLowerCase().includes("guide")
    ? guideTitle
    : fallbackGuideLabel;

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
    guideYear: activeGuide.year,
    teamLabel: `the ${brandName} team`,
    signatureHtml: `${brandName}<br />${brokerageName}`,
    signatureText: `${brandName}\n${brokerageName}`,
    areaQuestion: buildAreaQuestion(marketName),
  };
}
