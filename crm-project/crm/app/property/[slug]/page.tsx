import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import {
  Bath,
  BedDouble,
  CalendarDays,
  CarFront,
  ExternalLink,
  Home,
  Mail,
  MapPin,
  Maximize2,
  Phone,
  PlayCircle,
  Ruler,
  Sparkles,
} from "lucide-react";

import {
  supabaseServer,
} from "../../../lib/supabaseServer";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type ListingRow = {
  id: string;
  org_id: string;
  owner_user_id:
    | string
    | null;

  title: string;
  property_type:
    | string
    | null;

  property_address: string;
  city:
    | string
    | null;
  state:
    | string
    | null;
  zip:
    | string
    | null;

  mls_number:
    | string
    | null;

  list_price:
    | number
    | null;

  listing_status: string;

  bedrooms:
    | number
    | null;

  bathrooms:
    | number
    | null;

  levels:
    | string
    | null;

  garage_spaces:
    | number
    | null;

  square_feet:
    | number
    | null;

  year_built:
    | number
    | null;

  lot_size_text:
    | string
    | null;

  acres:
    | number
    | null;

  subdivision:
    | string
    | null;

  features: unknown;

  campaign_headline:
    | string
    | null;

  short_marketing_description:
    | string
    | null;

  public_remarks:
    | string
    | null;

  description:
    | string
    | null;

  public_url:
    | string
    | null;

  virtual_tour_url:
    | string
    | null;

  branded_video_url:
    | string
    | null;

  unbranded_video_url:
    | string
    | null;

  primary_image_url:
    | string
    | null;

  website_slug:
    | string
    | null;

  website_template_key: string;
  website_status: string;

  website_generated_asset_id:
    | string
    | null;
};

type ListingPhoto = {
  id: string;
  public_url: string;
  sort_order: number;
  is_primary: boolean;
  title:
    | string
    | null;
  caption:
    | string
    | null;
};

type AgentRow = {
  id: string;
  name:
    | string
    | null;
  email:
    | string
    | null;

  marketing_phone:
    | string
    | null;

  marketing_title:
    | string
    | null;

  marketing_headshot_url:
    | string
    | null;

  marketing_logo_url:
    | string
    | null;

  marketing_brokerage:
    | string
    | null;

  marketing_website_url:
    | string
    | null;

  marketing_facebook_url:
    | string
    | null;

  marketing_instagram_url:
    | string
    | null;

  marketing_youtube_url:
    | string
    | null;

  marketing_tiktok_url:
    | string
    | null;

  marketing_designations: unknown;
  marketing_certifications: unknown;

  marketing_license_number:
    | string
    | null;

  marketing_office_phone:
    | string
    | null;

  marketing_office_address:
    | string
    | null;

  marketing_physical_address:
    | string
    | null;
};

type OrganizationRow = {
  id: string;
  name:
    | string
    | null;

  org_display:
    | string
    | null;

  brokerage_name:
    | string
    | null;

  marketing_privacy_policy_url:
    | string
    | null;

  marketing_standard_disclaimer:
    | string
    | null;

  marketing_broker_license_number:
    | string
    | null;

  marketing_licensed_business_name:
    | string
    | null;

  marketing_advertisement_label:
    | string
    | null;
};

type GeneratedAssetRow = {
  id: string;
  public_url:
    | string
    | null;
  generation_status: string;
};

type PropertyPageData = {
  listing: ListingRow;
  photos: ListingPhoto[];
  agent: AgentRow | null;
  organization: OrganizationRow | null;
  generatedArtwork:
    | GeneratedAssetRow
    | null;
};

function formatPrice(
  value:
    | number
    | null
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(value)
  ) {
    return "Price available upon request";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatNumber(
  value:
    | number
    | null
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(value)
  ) {
    return "";
  }

  return new Intl.NumberFormat(
    "en-US"
  ).format(value);
}

function formatAddress(
  listing: ListingRow
) {
  return [
    listing.property_address,
    listing.city,
    listing.state,
    listing.zip,
  ]
    .filter(Boolean)
    .join(", ")
    .replace(
      /,\s([A-Z]{2}),\s/,
      ", $1 "
    );
}

function normalizeStringArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      String(item || "").trim()
    )
    .filter(Boolean);
}

function propertyFeatures(
  value: unknown
) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        String(item || "").trim()
      )
      .filter(Boolean);
  }

  if (
    typeof value ===
      "string"
  ) {
    return value
      .split(/\r?\n|,/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  return [];
}

function phoneHref(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

  const normalized =
    value.replace(
      /[^\d+]/g,
      ""
    );

  return normalized
    ? `tel:${normalized}`
    : "";
}

function youtubeEmbedUrl(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

  try {
    const url =
      new URL(value);

    let videoId = "";

    if (
      url.hostname.includes(
        "youtu.be"
      )
    ) {
      videoId =
        url.pathname
          .replace("/", "")
          .trim();
    }
    else if (
      url.hostname.includes(
        "youtube.com"
      )
    ) {
      videoId =
        url.searchParams.get(
          "v"
        ) || "";

      if (
        !videoId &&
        url.pathname.includes(
          "/embed/"
        )
      ) {
        videoId =
          url.pathname
            .split("/embed/")[1]
            ?.split("/")[0] ||
          "";
      }
    }

    return videoId
      ? `https://www.youtube.com/embed/${encodeURIComponent(
          videoId
        )}`
      : "";
  }
  catch {
    return "";
  }
}

function siteOrigin() {
  return (
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.replace(/\/+$/, "") ||
    "https://easyrealtor.homes"
  );
}

function themeFor(
  templateKey: string
) {
  if (
    templateKey ===
    "modern"
  ) {
    return {
      label:
        "Modern Collection",
      accent:
        "#2563eb",
      accentSoft:
        "#dbeafe",
      dark:
        "#111827",
    };
  }

  if (
    templateKey ===
    "standard"
  ) {
    return {
      label:
        "Featured Property",
      accent:
        "#0369a1",
      accentSoft:
        "#e0f2fe",
      dark:
        "#0f172a",
    };
  }

  if (
    templateKey ===
    "realtor_blast"
  ) {
    return {
      label:
        "Agent Preview",
      accent:
        "#b91c1c",
      accentSoft:
        "#fee2e2",
      dark:
        "#111827",
    };
  }

  return {
    label:
      "Luxury Collection",
    accent:
      "#b89146",
    accentSoft:
      "#f5ead0",
    dark:
      "#080b10",
  };
}

async function loadPropertyPage(
  slug: string
): Promise<
  PropertyPageData | null
> {
  const normalizedSlug =
    String(slug || "")
      .trim()
      .toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const {
    data: listingData,
    error: listingError,
  } = await supabaseServer
    .from("listings")
    .select(`
      id,
      org_id,
      owner_user_id,
      title,
      property_type,
      property_address,
      city,
      state,
      zip,
      mls_number,
      list_price,
      listing_status,
      bedrooms,
      bathrooms,
      levels,
      garage_spaces,
      square_feet,
      year_built,
      lot_size_text,
      acres,
      subdivision,
      features,
      campaign_headline,
      short_marketing_description,
      public_remarks,
      description,
      public_url,
      virtual_tour_url,
      branded_video_url,
      unbranded_video_url,
      primary_image_url,
      website_slug,
      website_template_key,
      website_status,
      website_generated_asset_id
    `)
    .eq(
      "website_slug",
      normalizedSlug
    )
    .eq(
      "website_status",
      "published"
    )
    .maybeSingle();

  if (
    listingError ||
    !listingData
  ) {
    if (listingError) {
      console.error(
        "Public property listing load failed:",
        listingError
      );
    }

    return null;
  }

  const listing =
    listingData as ListingRow;

  const {
    data: photoData,
    error: photoError,
  } = await supabaseServer
    .from("listing_media")
    .select(`
      id,
      public_url,
      sort_order,
      is_primary,
      title,
      caption
    `)
    .eq(
      "listing_id",
      listing.id
    )
    .eq(
      "media_type",
      "photo"
    )
    .eq(
      "use_in_marketing",
      true
    )
    .order(
      "is_primary",
      {
        ascending: false,
      }
    )
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (photoError) {
    console.error(
      "Public property photos load failed:",
      photoError
    );
  }

  let agent:
    | AgentRow
    | null =
    null;

  if (
    listing.owner_user_id
  ) {
    const {
      data: agentData,
      error: agentError,
    } = await supabaseServer
      .from("profiles")
      .select(`
        id,
        name,
        email,
        marketing_phone,
        marketing_title,
        marketing_headshot_url,
        marketing_logo_url,
        marketing_brokerage,
        marketing_website_url,
        marketing_facebook_url,
        marketing_instagram_url,
        marketing_youtube_url,
        marketing_tiktok_url,
        marketing_designations,
        marketing_certifications,
        marketing_license_number,
        marketing_office_phone,
        marketing_office_address,
        marketing_physical_address
      `)
      .eq(
        "id",
        listing.owner_user_id
      )
      .maybeSingle();

    if (agentError) {
      console.error(
        "Public property agent load failed:",
        agentError
      );
    }

    agent =
      (agentData as AgentRow) ||
      null;
  }

  const {
    data: organizationData,
    error: organizationError,
  } = await supabaseServer
    .from("organizations")
    .select(`
      id,
      name,
      org_display,
      brokerage_name,
      marketing_privacy_policy_url,
      marketing_standard_disclaimer,
      marketing_broker_license_number,
      marketing_licensed_business_name,
      marketing_advertisement_label
    `)
    .eq(
      "id",
      listing.org_id
    )
    .maybeSingle();

  if (organizationError) {
    console.error(
      "Public property organization load failed:",
      organizationError
    );
  }

  let generatedArtwork:
    | GeneratedAssetRow
    | null =
    null;

  if (
    listing.website_generated_asset_id
  ) {
    const {
      data: assetData,
      error: assetError,
    } = await supabaseServer
      .from(
        "generated_marketing_assets"
      )
      .select(`
        id,
        public_url,
        generation_status
      `)
      .eq(
        "id",
        listing.website_generated_asset_id
      )
      .eq(
        "generation_status",
        "ready"
      )
      .maybeSingle();

    if (assetError) {
      console.error(
        "Public property generated artwork load failed:",
        assetError
      );
    }

    generatedArtwork =
      (assetData as GeneratedAssetRow) ||
      null;
  }

  return {
    listing,
    photos:
      (photoData ||
        []) as ListingPhoto[],
    agent,
    organization:
      (organizationData as OrganizationRow) ||
      null,
    generatedArtwork,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;

  const pageData =
    await loadPropertyPage(
      slug
    );

  if (!pageData) {
    return {
      title:
        "Property Not Available | EasyRealtor.homes",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const {
    listing,
    photos,
  } = pageData;

  const title =
    `${listing.campaign_headline ||
      listing.title} | ${formatAddress(
      listing
    )}`;

  const description =
    listing
      .short_marketing_description ||
    listing.public_remarks ||
    listing.description ||
    `View details and photography for ${formatAddress(
      listing
    )}.`;

  const heroImage =
    photos[0]
      ?.public_url ||
    listing.primary_image_url ||
    undefined;

  const canonical =
    `${siteOrigin()}/property/${encodeURIComponent(
      slug
    )}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url:
        canonical,
      type:
        "website",
      images:
        heroImage
          ? [
              {
                url:
                  heroImage,
              },
            ]
          : [],
    },
    twitter: {
      card:
        "summary_large_image",
      title,
      description,
      images:
        heroImage
          ? [
              heroImage,
            ]
          : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PropertyPage({
  params,
}: PageProps) {
  const {
    slug,
  } = await params;

  const pageData =
    await loadPropertyPage(
      slug
    );

  if (!pageData) {
    notFound();
  }

  const {
    listing,
    photos,
    agent,
    organization,
    generatedArtwork,
  } = pageData;

  const theme =
    themeFor(
      listing.website_template_key
    );

  const heroPhoto =
    photos[0]
      ?.public_url ||
    listing.primary_image_url ||
    "";

  const features =
    propertyFeatures(
      listing.features
    );

  const description =
    listing.public_remarks ||
    listing.description ||
    listing
      .short_marketing_description ||
    "";

  const videoUrl =
    listing
      .branded_video_url ||
    "";

  const videoEmbedUrl =
    youtubeEmbedUrl(
      videoUrl
    );

  const phone =
    agent
      ?.marketing_phone ||
    agent
      ?.marketing_office_phone ||
    "";

  const phoneLink =
    phoneHref(phone);

  const email =
    agent?.email ||
    "";

  const showingEmailLink =
    email
      ? `mailto:${email}?subject=${encodeURIComponent(
          `Private showing request - ${formatAddress(
            listing
          )}`
        )}`
      : "";

  const designations =
    normalizeStringArray(
      agent
        ?.marketing_designations
    );

  const certifications =
    normalizeStringArray(
      agent
        ?.marketing_certifications
    );

  const brokerage =
    agent
      ?.marketing_brokerage ||
    [
      organization
        ?.org_display,
      organization
        ?.brokerage_name,
    ]
      .filter(Boolean)
      .join(" | ") ||
    "MPRE Boise | Homes of Idaho";

  const disclaimer =
    organization
      ?.marketing_standard_disclaimer ||
    "Information is deemed reliable but not guaranteed. Property information, price, availability, features and measurements are subject to change. Buyers should independently verify all information.";

  const socialLinks = [
    {
      label:
        "Facebook",
      url:
        agent
          ?.marketing_facebook_url,
    },
    {
      label:
        "Instagram",
      url:
        agent
          ?.marketing_instagram_url,
    },
    {
      label:
        "YouTube",
      url:
        agent
          ?.marketing_youtube_url,
    },
    {
      label:
        "TikTok",
      url:
        agent
          ?.marketing_tiktok_url,
    },
  ].filter(
    (
      item
    ): item is {
      label: string;
      url: string;
    } =>
      Boolean(item.url)
  );

  const propertyFacts = [
    {
      label:
        "Bedrooms",
      value:
        listing.bedrooms !==
        null
          ? String(
              listing.bedrooms
            )
          : "—",
      icon:
        BedDouble,
    },
    {
      label:
        "Bathrooms",
      value:
        listing.bathrooms !==
        null
          ? String(
              listing.bathrooms
            )
          : "—",
      icon:
        Bath,
    },
    {
      label:
        "Square Feet",
      value:
        formatNumber(
          listing.square_feet
        ) || "—",
      icon:
        Ruler,
    },
    {
      label:
        "Garage",
      value:
        listing.garage_spaces !==
        null
          ? `${listing.garage_spaces} Car`
          : "—",
      icon:
        CarFront,
    },
    {
      label:
        "Lot",
      value:
        listing.acres !==
        null
          ? `${listing.acres} Acres`
          : listing
              .lot_size_text ||
            "—",
      icon:
        Maximize2,
    },
    {
      label:
        "Built",
      value:
        listing.year_built !==
        null
          ? String(
              listing.year_built
            )
          : "—",
      icon:
        CalendarDays,
    },
  ];

  return (
    <main
      className="min-h-screen bg-[#080b10] text-white"
      style={{
        backgroundColor:
          theme.dark,
      }}
    >
      <section className="relative min-h-[88vh] overflow-hidden">
        {heroPhoto ? (
          <img
            src={heroPhoto}
            alt={`${listing.property_address} exterior`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-[#080b10]" />

        <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <nav className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-white/95 px-3 py-2 shadow-xl">
                <img
                  src="/MPREcrm.png"
                  alt="MPRE Boise"
                  className="h-10 w-auto sm:h-12"
                />
              </div>

              <div className="rounded-xl bg-white/95 px-3 py-2 shadow-xl">
                <img
                  src="/HomesofIdahocrm.png"
                  alt="Homes of Idaho"
                  className="h-10 w-auto sm:h-12"
                />
              </div>
            </div>

            <div className="rounded-full border border-white/20 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md">
              {organization
                ?.marketing_advertisement_label ||
                "Advertisement"}
            </div>
          </nav>

          <div className="mt-auto max-w-5xl pb-10 pt-28 sm:pb-16">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white shadow-xl"
              style={{
                backgroundColor:
                  theme.accent,
              }}
            >
              <Sparkles className="h-4 w-4" />
              {theme.label}
            </div>

            <h1 className="mt-6 max-w-5xl text-4xl font-semibold leading-[1.05] tracking-tight text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">
              {listing
                .campaign_headline ||
                listing.title}
            </h1>

            <div className="mt-5 flex items-start gap-2 text-base text-white/90 sm:text-xl">
              <MapPin className="mt-1 h-5 w-5 shrink-0" />

              <span>
                {formatAddress(
                  listing
                )}
              </span>
            </div>

            <div className="mt-6 text-3xl font-semibold text-white sm:text-5xl">
              {formatPrice(
                listing.list_price
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#gallery"
                className="rounded-full px-6 py-3 text-sm font-bold text-white shadow-xl transition hover:scale-[1.02]"
                style={{
                  backgroundColor:
                    theme.accent,
                }}
              >
                Explore the Property
              </a>

              <a
                href="#contact"
                className="rounded-full border border-white/35 bg-white/10 px-6 py-3 text-sm font-bold text-white shadow-xl backdrop-blur-md transition hover:bg-white/20"
              >
                Request a Private Showing
              </a>
            </div>

            <div className="mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {propertyFacts.map(
                ({
                  label,
                  value,
                  icon: Icon,
                }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-md"
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{
                        color:
                          theme.accentSoft,
                      }}
                    />

                    <div className="mt-3 text-lg font-bold text-white">
                      {value}
                    </div>

                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/60">
                      {label}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-28">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.28em]"
            style={{
              color:
                theme.accent,
            }}
          >
            {[
              listing.subdivision,
              [listing.city, listing.state]
                .filter(Boolean)
                .join(", "),
            ]
              .filter(Boolean)
              .join(" · ") ||
              formatAddress(listing)}
          </p>

          <h2 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {listing.property_type
              ? `${listing.property_type} in ${
                  listing.subdivision ||
                  listing.city ||
                  "Idaho"
                }`
              : listing.title}
          </h2>

          {listing
            .short_marketing_description && (
            <p className="mt-6 text-xl leading-8 text-white/75">
              {
                listing
                  .short_marketing_description
              }
            </p>
          )}

          {description && (
            <p className="mt-8 whitespace-pre-line text-base leading-8 text-white/70 sm:text-lg">
              {description}
            </p>
          )}
        </div>

        <div className="relative">
          {generatedArtwork
            ?.public_url ? (
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
              <img
                src={
                  generatedArtwork
                    .public_url
                }
                alt="Decorative luxury architectural artwork"
                className="aspect-[4/3] h-full w-full object-cover"
              />
            </div>
          ) : heroPhoto ? (
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
              <img
                src={heroPhoto}
                alt={`${listing.property_address} featured view`}
                className="aspect-[4/3] h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          <div
            className="absolute -bottom-6 -left-4 hidden rounded-2xl px-6 py-5 shadow-2xl sm:block"
            style={{
              backgroundColor:
                theme.accent,
            }}
          >
            <div className="text-2xl font-bold text-white">
              {listing
                .square_feet
                ? `${formatNumber(
                    listing
                      .square_feet
                  )} SF`
                : "Luxury"}
            </div>

            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/80">
              {listing.levels
                ? `${listing.levels} living`
                : listing.property_type ||
                  "Featured residence"}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.035]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.28em]"
              style={{
                color:
                  theme.accent,
              }}
            >
              Property Highlights
            </p>

            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
              Designed for elevated everyday living
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features
              .slice(
                0,
                18
              )
              .map(
                (
                  feature
                ) => (
                  <div
                    key={feature}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        backgroundColor:
                          theme.accent,
                      }}
                    >
                      ✓
                    </span>

                    <span>
                      {feature}
                    </span>
                  </div>
                )
              )}
          </div>
        </div>
      </section>

      <section
        id="gallery"
        className="scroll-mt-8"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[0.28em]"
                style={{
                  color:
                    theme.accent,
                }}
              >
                Property Gallery
              </p>

              <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                Explore every detail
              </h2>
            </div>

            <div className="text-sm text-white/55">
              {photos.length} professionally selected photographs
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map(
              (
                photo,
                index
              ) => (
                <a
                  key={photo.id}
                  href={
                    photo.public_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={
                    index === 0
                      ? "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl sm:col-span-2 lg:col-span-2 lg:row-span-2"
                      : "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl"
                  }
                >
                  <img
                    src={
                      photo.public_url
                    }
                    alt={
                      photo.caption ||
                      photo.title ||
                      `${listing.property_address} property photo ${
                        index + 1
                      }`
                    }
                    className={
                      index === 0
                        ? "h-full min-h-[420px] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                        : "aspect-[4/3] h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    }
                    loading={
                      index < 3
                        ? "eager"
                        : "lazy"
                    }
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                  <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                </a>
              )
            )}
          </div>
        </div>
      </section>

      {(videoEmbedUrl ||
        listing
          .virtual_tour_url) && (
        <section className="border-y border-white/10 bg-white/[0.035]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                {videoEmbedUrl ? (
                  <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
                    <iframe
                      src={
                        videoEmbedUrl
                      }
                      title={`${listing.property_address} property video`}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : heroPhoto ? (
                  <img
                    src={heroPhoto}
                    alt={`${listing.property_address} property tour`}
                    className="aspect-video w-full rounded-[2rem] object-cover shadow-2xl"
                    loading="lazy"
                  />
                ) : null}
              </div>

              <div>
                <PlayCircle
                  className="h-10 w-10"
                  style={{
                    color:
                      theme.accent,
                  }}
                />

                <p
                  className="mt-5 text-xs font-bold uppercase tracking-[0.28em]"
                  style={{
                    color:
                      theme.accent,
                  }}
                >
                  Property Experience
                </p>

                <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">
                  Tour the home from wherever you are
                </h2>

                <p className="mt-6 text-base leading-8 text-white/65">
                  Watch the property film, explore the interactive 3D tour, and experience the layout before scheduling your private showing.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  {videoUrl && (
                    <a
                      href={
                        videoUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
                      style={{
                        backgroundColor:
                          theme.accent,
                      }}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Watch Property Film
                    </a>
                  )}

                  {listing
                    .virtual_tour_url && (
                    <a
                      href={
                        listing
                          .virtual_tour_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                    >
                      <Home className="h-4 w-4" />
                      Explore 3D Tour
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section
        id="contact"
        className="scroll-mt-8"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] shadow-2xl">
            <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
              <div className="relative min-h-[420px] bg-black/30">
                {agent
                  ?.marketing_headshot_url ? (
                  <img
                    src={
                      agent
                        .marketing_headshot_url
                    }
                    alt={
                      agent.name ||
                      "Listing agent"
                    }
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full min-h-[420px] items-center justify-center">
                    <Home className="h-20 w-20 text-white/20" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </div>

              <div className="p-7 sm:p-10 lg:p-14">
                <p
                  className="text-xs font-bold uppercase tracking-[0.28em]"
                  style={{
                    color:
                      theme.accent,
                  }}
                >
                  Private Showings
                </p>

                <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                  Experience this home in person
                </h2>

                <p className="mt-6 max-w-2xl text-base leading-8 text-white/65">
                  Contact the listing agent directly for property questions, current availability, or to arrange a private showing.
                </p>

                <div className="mt-9">
                  <div className="text-2xl font-bold text-white">
                    {agent
                      ?.name ||
                      "Mike Petras"}
                  </div>

                  <div className="mt-1 text-sm text-white/60">
                    {[
                      agent
                        ?.marketing_title,
                      ...designations,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>

                  <div className="mt-2 text-sm font-semibold text-white/80">
                    {brokerage}
                  </div>

                  {certifications.length >
                    0 && (
                    <div className="mt-2 text-xs text-white/50">
                      {certifications.join(
                        " · "
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {phoneLink && (
                    <a
                      href={
                        phoneLink
                      }
                      className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
                      style={{
                        backgroundColor:
                          theme.accent,
                      }}
                    >
                      <Phone className="h-4 w-4" />
                      {phone}
                    </a>
                  )}

                  {showingEmailLink && (
                    <a
                      href={
                        showingEmailLink
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                    >
                      <Mail className="h-4 w-4" />
                      Request Showing
                    </a>
                  )}

                  {agent
                    ?.marketing_website_url && (
                    <a
                      href={
                        agent
                          .marketing_website_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                    >
                      Agent Website
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>

                {socialLinks.length >
                  0 && (
                  <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {socialLinks.map(
                      (
                        item
                      ) => (
                        <a
                          key={
                            item.label
                          }
                          href={
                            item.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-white/55 transition hover:text-white"
                        >
                          {
                            item.label
                          }
                        </a>
                      )
                    )}
                  </div>
                )}

                <div className="mt-10 border-t border-white/10 pt-6 text-xs leading-6 text-white/45">
                  License #
                  {agent
                    ?.marketing_license_number ||
                    "SP51458"}

                  {organization
                    ?.marketing_broker_license_number
                    ? ` · Brokerage License #${organization.marketing_broker_license_number}`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/30">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-xl bg-white px-3 py-2">
                  <img
                    src="/MPREcrm.png"
                    alt="MPRE Boise"
                    className="h-10 w-auto"
                  />
                </div>

                <div className="rounded-xl bg-white px-3 py-2">
                  <img
                    src="/HomesofIdahocrm.png"
                    alt="Homes of Idaho"
                    className="h-10 w-auto"
                  />
                </div>

                <img
                  src="/equal-housing-opportunity-logo.png"
                  alt="Equal Housing Opportunity"
                  className="h-10 w-auto"
                />
              </div>

              <p className="mt-6 text-sm font-semibold text-white/80">
                {organization
                  ?.marketing_licensed_business_name ||
                  "HOMES OF IDAHO, INC"}
              </p>

              <p className="mt-2 max-w-xl text-xs leading-6 text-white/45">
                {agent
                  ?.marketing_physical_address ||
                  agent
                    ?.marketing_office_address ||
                  "3597 E. Monarch Sky Way Ste 320, Meridian, ID 83646"}
              </p>
            </div>

            <div className="max-w-2xl text-xs leading-6 text-white/45">
              <p>
                {disclaimer}
              </p>

              {listing
                .mls_number && (
                <p className="mt-3">
                  MLS #
                  {
                    listing
                      .mls_number
                  }
                </p>
              )}

              {organization
                ?.marketing_privacy_policy_url && (
                <p className="mt-3">
                  <a
                    href={
                      organization
                        .marketing_privacy_policy_url
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-white/65 hover:text-white"
                  >
                    Privacy Policy
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <p>
              ©{" "}
              {new Date()
                .getFullYear()}{" "}
              EasyRealtor.homes. All rights reserved.
            </p>

            <p>
              Property marketing powered by EasyRealtor.homes.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}


