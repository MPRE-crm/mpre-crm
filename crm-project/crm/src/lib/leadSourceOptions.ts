export const LEAD_SOURCE_OPTIONS = [
  "Facebook Ad",
  "YouTube",
  "Google Search",
  "Google Business Profile",
  "Website",
  "Direct",
  "Referral",
  "Agent Referral",
  "Builder Referral",
  "Sphere",
  "Past Client",
  "Open House",
  "Zillow",
  "Realtor.com",
  "Homes.com",
  "Corporate Relocation",
  "Other",
  "Unknown",
] as const;

export const LEAD_SOURCE_DETAIL_OPTIONS = [
  "Relocation Guide",
  "Home Search Tool",
  "First-Time Buyer Guide",
  "New Construction Guide",
  "Cost of Living Guide",
  "Area Comparison Guide",
  "School / Neighborhood Guide",
  "Price Drop Alerts",
  "Coming Soon List",
  "Off-Market List",
  "Property Alerts",
  "Seller Valuation Tool",
  "Seller Guide",
  "FSBO Guide",
  "Cancelled Listing Guide",
  "Probate Guide",
  "Divorce Guide",
  "Inherited Home Guide",
  "Downsizing Guide",
  "Sell As-Is Guide",
  "Net Sheet Estimate",
  "Investor Guide",
  "Deal Alert List",
  "Rent Estimate Report",
  "Cash Flow Guide",
  "Flip Opportunity Guide",
  "Luxury Guide",
  "Open House Registration",
  "Website Contact Form",
  "Buyer Consultation Request",
  "Seller Consultation Request",
  "Lender Referral Form",
  "Buyer Seminar / Workshop",
  "Seller Seminar / Workshop",
  "Boise Market Update",
  "Monthly Market Report",
  "Mortgage Rate Update",
  "Payment Calculator",
  "Affordability Calculator",
  "Rent vs Buy Calculator",
  "Buy Before You Sell Guide",
  "Move-Up Buyer Guide",
  "VA Buyer Guide",
  "FHA Buyer Guide",
  "USDA Buyer Guide",
  "Down Payment Assistance Guide",
  "Closing Cost Guide",
  "Boise New Resident Guide",
  "Idaho Tax Guide",
  "Commute Map Guide",
  "School Ratings Guide",
  "HOA Guide",
  "Acreage / Land Guide",
  "RV Garage Home List",
  "Shop / Barn Property List",
  "Waterfront / View Home List",
  "55+ Living Guide",
  "Boise Condo Guide",
  "Townhome Guide",
  "Fixer-Upper Guide",
  "As-Is Buyer Guide",
  "Builder Incentives Guide",
  "New Construction Inventory List",
  "Investment Property Alerts",
  "Duplex / Fourplex List",
  "House Hacking Guide",
  "Landlord Starter Guide",
  "BRRRR Guide",
  "Short-Term Rental Guide",
  "Mid-Term Rental Guide",
  "Probate Timeline Guide",
  "Inherited Home Value Report",
  "Divorce Sale Options Guide",
  "Pre-Listing Checklist",
  "Seller Timing Report",
  "Home Equity Report",
  "Price Reduction Strategy Guide",
  "Listing Prep Checklist",
  "Staging Checklist",
  "Open House Checklist",
  "Boise Relocation Quiz",
  "Home Search Setup Request",
  "Cash Offer Request",
  "Agent Interview Guide",
  "Neighborhood Match Quiz",
  "What Can I Buy Report",
  "What’s My Payment Report",
  "Other",
  "Unknown",
] as const;

export type LeadSourceOption = (typeof LEAD_SOURCE_OPTIONS)[number];
export type LeadSourceDetailOption = (typeof LEAD_SOURCE_DETAIL_OPTIONS)[number];
export type LeadTypeOption = "buyer" | "seller" | "investor";

function sortAlpha<T extends string>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export const SORTED_LEAD_SOURCE_OPTIONS = sortAlpha(LEAD_SOURCE_OPTIONS);
export const SORTED_LEAD_SOURCE_DETAIL_OPTIONS = sortAlpha(LEAD_SOURCE_DETAIL_OPTIONS);

const SOURCE_DETAIL_TO_LEAD_TYPE: Partial<Record<LeadSourceDetailOption, LeadTypeOption>> = {
  "55+ Living Guide": "buyer",
  "Acreage / Land Guide": "buyer",
  "Affordability Calculator": "buyer",
  "Area Comparison Guide": "buyer",
  "As-Is Buyer Guide": "buyer",
  "Boise Condo Guide": "buyer",
  "Boise New Resident Guide": "buyer",
  "Boise Relocation Quiz": "buyer",
  "BRRRR Guide": "investor",
  "Builder Incentives Guide": "buyer",
  "Buyer Consultation Request": "buyer",
  "Buyer Seminar / Workshop": "buyer",
  "Buy Before You Sell Guide": "seller",
  "Cash Flow Guide": "investor",
  "Cash Offer Request": "seller",
  "Cancelled Listing Guide": "seller",
  "Closing Cost Guide": "buyer",
  "Coming Soon List": "buyer",
  "Commute Map Guide": "buyer",
  "Cost of Living Guide": "buyer",
  "Deal Alert List": "investor",
  "Divorce Guide": "seller",
  "Divorce Sale Options Guide": "seller",
  "Down Payment Assistance Guide": "buyer",
  "Downsizing Guide": "seller",
  "Duplex / Fourplex List": "investor",
  "FHA Buyer Guide": "buyer",
  "First-Time Buyer Guide": "buyer",
  "Fixer-Upper Guide": "buyer",
  "Flip Opportunity Guide": "investor",
  "FSBO Guide": "seller",
  "HOA Guide": "buyer",
  "Home Equity Report": "seller",
  "Home Search Setup Request": "buyer",
  "Home Search Tool": "buyer",
  "House Hacking Guide": "investor",
  "Idaho Tax Guide": "buyer",
  "Inherited Home Guide": "seller",
  "Inherited Home Value Report": "seller",
  "Investment Property Alerts": "investor",
  "Investor Guide": "investor",
  "Landlord Starter Guide": "investor",
  "Listing Prep Checklist": "seller",
  "Move-Up Buyer Guide": "buyer",
  "Neighborhood Match Quiz": "buyer",
  "Net Sheet Estimate": "seller",
  "New Construction Guide": "buyer",
  "New Construction Inventory List": "buyer",
  "Off-Market List": "buyer",
  "Open House Registration": "buyer",
  "Payment Calculator": "buyer",
  "Pre-Listing Checklist": "seller",
  "Price Drop Alerts": "buyer",
  "Price Reduction Strategy Guide": "seller",
  "Probate Guide": "seller",
  "Probate Timeline Guide": "seller",
  "Property Alerts": "buyer",
  "Relocation Guide": "buyer",
  "Rent Estimate Report": "investor",
  "Rent vs Buy Calculator": "buyer",
  "RV Garage Home List": "buyer",
  "School / Neighborhood Guide": "buyer",
  "School Ratings Guide": "buyer",
  "Sell As-Is Guide": "seller",
  "Seller Consultation Request": "seller",
  "Seller Guide": "seller",
  "Seller Timing Report": "seller",
  "Seller Valuation Tool": "seller",
  "Shop / Barn Property List": "buyer",
  "Short-Term Rental Guide": "investor",
  "Staging Checklist": "seller",
  "Townhome Guide": "buyer",
  "USDA Buyer Guide": "buyer",
  "VA Buyer Guide": "buyer",
  "Waterfront / View Home List": "buyer",
  "What Can I Buy Report": "buyer",
  "What’s My Payment Report": "buyer",
};

const SOURCE_TO_LEAD_TYPE: Partial<Record<LeadSourceOption, LeadTypeOption>> = {
  "Builder Referral": "buyer",
  "Corporate Relocation": "buyer",
  "Open House": "buyer",
};

function cleanValue(value?: string | null): string {
  return String(value || "").trim();
}

export function inferLeadTypeFromSourceDetail(
  sourceDetail?: string | null
): LeadTypeOption | null {
  const cleaned = cleanValue(sourceDetail);

  if (!cleaned || cleaned === "Unknown" || cleaned === "Other") {
    return null;
  }

  return SOURCE_DETAIL_TO_LEAD_TYPE[cleaned as LeadSourceDetailOption] ?? null;
}

export function inferLeadTypeFromSource(source?: string | null): LeadTypeOption | null {
  const cleaned = cleanValue(source);

  if (!cleaned || cleaned === "Unknown" || cleaned === "Other") {
    return null;
  }

  return SOURCE_TO_LEAD_TYPE[cleaned as LeadSourceOption] ?? null;
}

export function inferLeadType(params: {
  source?: string | null;
  sourceDetail?: string | null;
  currentLeadType?: string | null;
}): LeadTypeOption | null {
  return (
    inferLeadTypeFromSourceDetail(params.sourceDetail) ||
    inferLeadTypeFromSource(params.source) ||
    (cleanValue(params.currentLeadType) as LeadTypeOption | "") ||
    null
  );
}