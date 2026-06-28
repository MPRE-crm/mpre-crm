import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export type GuideType =
  | "relocation"
  | "fsbo"
  | "buyer"
  | "seller"
  | "home_valuation"
  | "open_house"
  | "other";

export const MPRE_BOISE_ORG_ID = "2486c9e9-d0bc-4a3d-be91-9406c52d178c";

type GetActiveGuideUrlParams = {
  orgId?: string | null;
  orgSlug?: string | null;
  guideType: GuideType;
  fallbackUrl?: string | null;
};

export async function getActiveGuideUrl({
  orgId,
  orgSlug,
  guideType,
  fallbackUrl = null,
}: GetActiveGuideUrlParams): Promise<string | null> {
  try {
    let resolvedOrgId = String(orgId || "").trim();

    if (!resolvedOrgId && orgSlug) {
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", orgSlug)
        .maybeSingle();

      if (orgError) {
        console.error("getActiveGuideUrl org lookup error:", orgError);
      }

      resolvedOrgId = String(org?.id || "").trim();
    }

    if (!resolvedOrgId) {
      return fallbackUrl || null;
    }

    const { data: guide, error: guideError } = await supabaseAdmin
      .from("guide_assets")
      .select("public_url, storage_bucket, storage_path")
      .eq("org_id", resolvedOrgId)
      .eq("guide_type", guideType)
      .eq("status", "active")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (guideError) {
      console.error("getActiveGuideUrl guide lookup error:", guideError);
      return fallbackUrl || null;
    }

    if (guide?.public_url) {
      return guide.public_url;
    }

    if (guide?.storage_bucket && guide?.storage_path) {
      const { data } = supabaseAdmin.storage
        .from(guide.storage_bucket)
        .getPublicUrl(guide.storage_path);

      return data?.publicUrl || fallbackUrl || null;
    }

    return fallbackUrl || null;
  } catch (error) {
    console.error("getActiveGuideUrl error:", error);
    return fallbackUrl || null;
  }
}

export async function getMpreBoiseRelocationGuideUrl(): Promise<string | null> {
  return getActiveGuideUrl({
    orgId: MPRE_BOISE_ORG_ID,
    guideType: "relocation",
    fallbackUrl: process.env.RELOCATION_GUIDE_URL || null,
  });
}

