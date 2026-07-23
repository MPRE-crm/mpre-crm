import {
  buildMarketingContactText,
  buildMarketingFooterHtml,
} from './marketing-email-footer';
export type Profile = {
  id: string;
  email: string | null;
  org_id: string | null;
  role: string;

  marketing_from_name:
    | string
    | null;

  marketing_from_email:
    | string
    | null;

  marketing_reply_to_email:
    | string
    | null;

  marketing_physical_address:
    | string
    | null;

  marketing_email_enabled:
    boolean;

  marketing_phone:
    | string
    | null;

  marketing_title:
    | string
    | null;

  marketing_brokerage:
    | string
    | null;

  marketing_website_url:
    | string
    | null;

  marketing_license_number:
    | string
    | null;

  marketing_headshot_url:
    | string
    | null;

  marketing_signature_text:
    | string
    | null;

  marketing_signature_image_url:
    | string
    | null;

  marketing_logo_url:
    | string
    | null;

  marketing_office_phone:
    | string
    | null;

  marketing_office_address:
    | string
    | null;

  marketing_appointment_url:
    | string
    | null;

  marketing_designations:
    | string[]
    | null;

  marketing_certifications:
    | string[]
    | null;

  marketing_service_areas:
    | string[]
    | null;

  marketing_languages:
    | string[]
    | null;

  marketing_disclaimer:
    | string
    | null;

  marketing_facebook_url:
    | string
    | null;

  marketing_instagram_url:
    | string
    | null;

  marketing_linkedin_url:
    | string
    | null;

  marketing_youtube_url:
    | string
    | null;

  marketing_tiktok_url:
    | string
    | null;

  marketing_x_url:
    | string
    | null;

  marketing_licensed_business_name:
    | string
    | null;

  marketing_broker_license_number:
    | string
    | null;

  marketing_license_state:
    | string
    | null;

  marketing_privacy_policy_url:
    | string
    | null;

  marketing_mls_attribution:
    | string
    | null;

  marketing_standard_disclaimer:
    | string
    | null;

  marketing_advertisement_label:
    | string
    | null;
};

export type Listing = {
  id: string;
  owner_user_id:
    | string
    | null;

  title: string;
  property_address: string;

  city: string | null;
  state: string | null;
  zip: string | null;

  mls_number:
    | string
    | null;

  list_price:
    | number
    | null;

  listing_status: string;

  public_url:
    | string
    | null;

  unbranded_video_url:
    | string
    | null;

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

  bedrooms:
    | number
    | null;

  bathrooms:
    | number
    | null;

  square_feet:
    | number
    | null;

  acres:
    | number
    | null;

  lot_size_text:
    | string
    | null;

  review_status: string;
};

type Readiness = {
  listing_id: string;

  has_title: boolean;
  has_address: boolean;
  has_price: boolean;
  has_public_remarks: boolean;
  has_public_link: boolean;
  has_listing_owner: boolean;
  has_primary_photo: boolean;
  has_confirmed_review: boolean;

  campaign_ready: boolean;
};

export type ListingPhoto = {
  id: string;
  public_url: string;
  sort_order: number;
  is_primary: boolean;
  use_in_marketing: boolean;
  title: string | null;
  caption: string | null;
};

const CAMPAIGN_TYPES = [
  {
    value: 'listing_ad',
    label: 'Listing Advertisement',
  },
  {
    value: 'open_house',
    label: 'Open House',
  },
  {
    value: 'price_change',
    label: 'Price Change',
  },
  {
    value: 'coming_soon',
    label: 'Coming Soon',
  },
  {
    value: 'just_sold',
    label: 'Just Sold',
  },
  {
    value: 'newsletter',
    label: 'Newsletter',
  },
  {
    value: 'client_update',
    label: 'Client Update',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

export const EMAIL_TEMPLATES = [
  {
    value: 'luxury',
    label: 'Luxury',
    description:
      'Editorial serif typography, warm white and restrained gold.',
    pageBackground: '#ede8df',
    cardBackground: '#fffdf8',
    cardBorder:
      '1px solid #d6c7a5',
    cardRadius: '0px',
    shadow:
      '0 14px 36px rgba(40,32,20,0.18)',
    bannerBackground: '#111827',
    bannerColor: '#f8fafc',
    headingFont:
      "Georgia, 'Times New Roman', serif",
    headingColor: '#111827',
    accent: '#b7791f',
    factsBackground: '#111827',
    factsColor: '#f8fafc',
    bodyColor: '#374151',
    buttonRadius: '0px',
    imageRadius: '0px',
    secondaryAction: '#111827',
  },
  {
    value: 'standard',
    label: 'Standard',
    description:
      'Clean professional presentation with familiar blue accents.',
    pageBackground: '#e8edf4',
    cardBackground: '#ffffff',
    cardBorder:
      '1px solid #dbe3ee',
    cardRadius: '16px',
    shadow:
      '0 12px 30px rgba(15,23,42,0.12)',
    bannerBackground: '#1d4ed8',
    bannerColor: '#ffffff',
    headingFont:
      'Arial, sans-serif',
    headingColor: '#0f172a',
    accent: '#2563eb',
    factsBackground: '#eff6ff',
    factsColor: '#1e3a8a',
    bodyColor: '#334155',
    buttonRadius: '8px',
    imageRadius: '8px',
    secondaryAction: '#0f172a',
  },
  {
    value: 'modern',
    label: 'Modern / Minimal',
    description:
      'Minimal black-and-white layout with sharp editorial spacing.',
    pageBackground: '#f4f4f5',
    cardBackground: '#ffffff',
    cardBorder:
      '1px solid #e4e4e7',
    cardRadius: '0px',
    shadow: 'none',
    bannerBackground: '#ffffff',
    bannerColor: '#18181b',
    headingFont:
      'Arial, sans-serif',
    headingColor: '#09090b',
    accent: '#18181b',
    factsBackground: '#f4f4f5',
    factsColor: '#18181b',
    bodyColor: '#3f3f46',
    buttonRadius: '0px',
    imageRadius: '0px',
    secondaryAction: '#18181b',
  },
  {
    value: 'realtor_blast',
    label: 'Realtor Blast',
    description:
      'High-contrast agent outreach built for fast scanning and sharing.',
    pageBackground: '#eaf2ff',
    cardBackground: '#ffffff',
    cardBorder:
      '1px solid #bfdbfe',
    cardRadius: '14px',
    shadow:
      '0 12px 30px rgba(30,64,175,0.16)',
    bannerBackground: '#b91c1c',
    bannerColor: '#ffffff',
    headingFont:
      'Arial, sans-serif',
    headingColor: '#0f172a',
    accent: '#dc2626',
    factsBackground: '#1d4ed8',
    factsColor: '#ffffff',
    bodyColor: '#334155',
    buttonRadius: '8px',
    imageRadius: '6px',
    secondaryAction: '#1d4ed8',
  },
] as const;

export type EmailTemplateKey =
  (typeof EMAIL_TEMPLATES)[number]['value'];

export function normalizeTemplateKey(
  value: unknown
): EmailTemplateKey {
  const normalized =
    String(value || '').trim();

  return EMAIL_TEMPLATES.some(
    (template) =>
      template.value ===
      normalized
  )
    ? (normalized as EmailTemplateKey)
    : 'luxury';
}

function youtubeVideoId(
  value: unknown
) {
  const raw =
    String(
      value || ''
    ).trim();

  if (!raw) {
    return '';
  }

  try {
    const parsed =
      new URL(raw);

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(
          /^www./,
          ''
        );

    if (
      hostname ===
      'youtu.be'
    ) {
      return (
        parsed.pathname
          .split('/')
          .filter(Boolean)[0] ||
        ''
      );
    }

    if (
      hostname.endsWith(
        'youtube.com'
      )
    ) {
      const queryId =
        parsed.searchParams.get(
          'v'
        );

      if (queryId) {
        return queryId;
      }

      const parts =
        parsed.pathname
          .split('/')
          .filter(Boolean);

      const markerIndex =
        parts.findIndex(
          (part) =>
            [
              'embed',
              'shorts',
              'live',
            ].includes(
              part
            )
        );

      if (
        markerIndex >= 0 &&
        parts[
          markerIndex + 1
        ]
      ) {
        return parts[
          markerIndex + 1
        ];
      }
    }
  } catch {
    // Fall through to the
    // lightweight URL matcher.
  }

  const fallback =
    raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{6,})/i
    );

  return (
    fallback?.[1] ||
    ''
  );
}

function youtubeThumbnailUrl(
  value: unknown
) {
  const videoId =
    youtubeVideoId(
      value
    );

  return videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : '';
}

function escapeHtml(
  value: unknown
) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPrice(
  value:
    | number
    | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function listingAddress(
  listing: Listing
) {
  return [
    listing.property_address,
    listing.city,
    listing.state,
    listing.zip,
  ]
    .filter(Boolean)
    .join(', ')
    .replace(
      /,\s(\d{5})$/,
      ' $1'
    );
}

function typeLabel(
  value: string
) {
  return (
    CAMPAIGN_TYPES.find(
      (item) =>
        item.value === value
    )?.label ||
    'Email Campaign'
  );
}

export function buildTextBody(
  listing: Listing,
  headline: string,
  description: string,
  audienceContactType: string,
  profile: Profile
) {
  return [
    headline,
    '',
    listingAddress(listing),
    formatPrice(
      listing.list_price
    ),
    '',
    description,
    '',
    listing.public_url
      ? `View the full listing and photo collection: ${listing.public_url}`
      : '',
    listing.unbranded_video_url
      ? `Watch the unbranded property video: ${listing.unbranded_video_url}`
      : '',
    audienceContactType ===
    'realtor'
      ? ''
      : null,

    audienceContactType ===
    'realtor'
      ? 'Agent-to-agent note:'
      : null,

    audienceContactType ===
    'realtor'
      ? 'Please share this home with buyers who may appreciate its setting, presentation and lifestyle. I am happy to answer questions or coordinate a private showing.'
      : null,

    audienceContactType ===
    'realtor'
      ? ''
      : null,
    `MLS: ${
      listing.mls_number || '-'
    }`,
    '',
    buildMarketingContactText(
      profile
    ),
  ]
    .filter(
      (line) =>
        line !== null &&
        line !== undefined
    )
    .join('\n');
}

function buildLuxuryEmailHtml({
  listing,
  photos,
  photoCount,
  headline,
  description,
  previewText,
  campaignType,
  primaryCtaLabel,
  audienceContactType,
  profile,
}: {
  listing: Listing;
  photos: ListingPhoto[];
  photoCount: number;
  headline: string;
  description: string;
  previewText: string;
  campaignType: string;
  primaryCtaLabel?: string;
  audienceContactType: string;
  profile: Profile;
}) {
  const chosenPhotos =
    photos.slice(
      0,
      Math.max(
        1,
        photoCount
      )
    );

  const heroPhoto =
    chosenPhotos[0] ||
    null;

  const galleryPhotos =
    chosenPhotos.slice(1);

  const galleryLead =
    galleryPhotos[0] ||
    null;

  const galleryTail =
    galleryPhotos.slice(1);

  const address =
    listingAddress(
      listing
    );

  const price =
    formatPrice(
      listing.list_price
    );

  const publicUrl =
    listing
      .public_url
      ?.trim() ||
    '';

  const videoUrl =
    listing
      .unbranded_video_url
      ?.trim() ||
    '';

  const videoThumbnail =
    youtubeThumbnailUrl(
      videoUrl
    );


  const displayName =
    profile
      .marketing_from_name
      ?.trim() ||
    'Listing Professional';

  const brokerageName =
    profile
      .marketing_brokerage
      ?.trim() ||
    profile
      .marketing_licensed_business_name
      ?.trim() ||
    'Distinctive Property Presentation';

  const brokerageLogoUrl =
    profile
      .marketing_logo_url
      ?.trim() ||
    'https://easyrealtor.homes/HomesofIdahocrm.png';

  const mpreLogoUrl =
    'https://easyrealtor.homes/MPREcrm.png';

const buttonText =
    primaryCtaLabel
      ?.trim() ||
    'Explore the Residence';

  const introDescription =
    description.trim();

  const fullDescription =
    listing.public_remarks?.trim() ||
    listing.description?.trim() ||
    '';

  let expandedDescription =
    fullDescription;

  if (
    introDescription &&
    expandedDescription &&
    expandedDescription
      .toLocaleLowerCase()
      .startsWith(
        introDescription
          .toLocaleLowerCase()
      )
  ) {
    expandedDescription =
      expandedDescription
        .slice(
          introDescription.length
        )
        .replace(
          /^[\s.,;:–—-]+/,
          ''
        )
        .trim();
  }

  if (
    expandedDescription
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase() ===
    introDescription
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase()
  ) {
    expandedDescription =
      '';
  }

  const escapedIntro =
    escapeHtml(
      introDescription
    ).replace(
      /\n/g,
      '<br />'
    );

  const escapedExpanded =
    escapeHtml(
      expandedDescription
    ).replace(
      /\n/g,
      '<br />'
    );

  const lotSize =
    listing.acres !==
      null &&
    listing.acres !==
      undefined
      ? `${Number(
          listing.acres
        ).toLocaleString(
          'en-US',
          {
            maximumFractionDigits:
              3,
          }
        )} Acres`
      : listing
          .lot_size_text
          ?.trim() ||
        '';

  const statItems = [
    {
      label:
        'Bedrooms',

      value:
        listing.bedrooms !==
        null
          ? String(
              listing.bedrooms
            )
          : '',
    },
    {
      label:
        'Bathrooms',

      value:
        listing.bathrooms !==
        null
          ? String(
              listing.bathrooms
            )
          : '',
    },
    {
      label:
        'Interior',

      value:
        listing.square_feet !==
        null
          ? `${new Intl.NumberFormat(
              'en-US'
            ).format(
              listing.square_feet
            )} SF`
          : '',
    },
    {
      label:
        'Lot Size',

      value:
        lotSize,
    },
  ].filter(
    (item) =>
      Boolean(
        item.value
      )
  );

  const statCells =
    statItems
      .map(
        (
          item,
          index
        ) => `
          <td
            class="luxury-stat"
            width="${
              100 /
              statItems.length
            }%"
            valign="top"
            style="padding:22px 10px;border-right:${
              index ===
              statItems.length - 1
                ? '0'
                : '1px solid #3a3428'
            };text-align:center;font-family:Arial,sans-serif;"
          >
            <div
              style="font-size:11px;line-height:1.2;letter-spacing:2px;text-transform:uppercase;color:#a99772;"
            >
              ${escapeHtml(
                item.label
              )}
            </div>

            <div
              style="margin-top:9px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.1;color:#ffffff;"
            >
              ${escapeHtml(
                item.value
              )}
            </div>
          </td>
        `
      )
      .join('');

  const leadGalleryHtml =
    galleryLead
      ? `
        <tr>
          <td
            style="padding:0 34px 18px;"
          >
            <img
              src="${escapeHtml(
                galleryLead
                  .public_url
              )}"
              alt="${escapeHtml(
                galleryLead
                  .caption ||
                galleryLead
                  .title ||
                listing.title
              )}"
              width="652"
              style="display:block;width:100%;height:auto;border:0;"
            />
          </td>
        </tr>
      `
      : '';

  let galleryRows = '';

  for (
    let index = 0;
    index <
    galleryTail.length;
    index += 2
  ) {
    const left =
      galleryTail[index];

    const right =
      galleryTail[
        index + 1
      ];

    galleryRows += right
      ? `
        <tr>
          <td
            class="luxury-gallery-cell"
            width="50%"
            valign="top"
            style="padding:0 7px 14px 0;"
          >
            <img
              src="${escapeHtml(
                left.public_url
              )}"
              alt="${escapeHtml(
                left.caption ||
                left.title ||
                listing.title
              )}"
              width="315"
              style="display:block;width:100%;height:auto;border:0;"
            />
          </td>

          <td
            class="luxury-gallery-cell"
            width="50%"
            valign="top"
            style="padding:0 0 14px 7px;"
          >
            <img
              src="${escapeHtml(
                right.public_url
              )}"
              alt="${escapeHtml(
                right.caption ||
                right.title ||
                listing.title
              )}"
              width="315"
              style="display:block;width:100%;height:auto;border:0;"
            />
          </td>
        </tr>
      `
      : `
        <tr>
          <td
            class="luxury-gallery-cell"
            colspan="2"
            width="100%"
            valign="top"
            style="padding:0 0 14px;"
          >
            <img
              src="${escapeHtml(
                left.public_url
              )}"
              alt="${escapeHtml(
                left.caption ||
                left.title ||
                listing.title
              )}"
              width="638"
              style="display:block;width:100%;height:auto;border:0;"
            />
          </td>
        </tr>
      `;
  }

  const realtorEditorial =
    audienceContactType ===
    'realtor'
      ? `
        <tr>
          <td
            class="luxury-pad"
            style="padding:8px 58px 48px;background:#f5f0e7;"
          >
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="border-top:1px solid #c7af7d;border-bottom:1px solid #c7af7d;"
            >
              <tr>
                <td
                  style="padding:28px 4px;font-family:Arial,sans-serif;"
                >
                  <div
                    style="font-size:10px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#9b7a3b;"
                  >
                    A Note for the Buyer’s Agent
                  </div>

                  <div
                    style="margin-top:12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#15130f;"
                  >
                    A residence designed to be experienced in person.
                  </div>

                  <div
                    style="margin-top:13px;font-size:14px;line-height:1.8;color:#514b40;"
                  >
                    Share this presentation with buyers who value thoughtful design, polished finishes and a distinctive sense of place. Contact ${escapeHtml(
                      displayName
                    )} directly for property questions or private-showing coordination.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : '';

  return `
<!doctype html>
<html>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <meta
      http-equiv="Content-Type"
      content="text/html; charset=UTF-8"
    />

    <style>
      @media only screen and (max-width:640px) {
        .luxury-shell {
          width:100% !important;
        }

        .luxury-pad {
          padding-left:24px !important;
          padding-right:24px !important;
        }

        .luxury-title {
          font-size:38px !important;
          line-height:1.08 !important;
        }

        .luxury-stat {
          display:block !important;
          width:100% !important;
          border-right:0 !important;
          border-bottom:1px solid #3a3428 !important;
        }

        .luxury-gallery-cell {
          display:block !important;
          width:100% !important;
          padding:0 0 14px !important;
        }
      }
    </style>
  </head>

  <body
    style="margin:0;padding:0;background:#d8d1c5;"
  >
    <div
      style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;"
    >
      ${escapeHtml(
        previewText
      )}
    </div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="width:100%;background:#d8d1c5;"
    >
      <tr>
        <td
          align="center"
          style="padding:28px 10px;"
        >
          <table
            class="luxury-shell"
            role="presentation"
            width="720"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="width:720px;max-width:720px;background:#f8f4ec;box-shadow:0 22px 60px rgba(26,22,16,0.24);"
          >
            <tr>
              <td
                class="luxury-pad"
                style="padding:34px 48px 30px;background:#11100e;border-bottom:1px solid #5b4a2f;"
              >
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                >
                  <tr>
                    <td
                      valign="middle"
                    >
                      <table
                        role="presentation"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                      >
                        <tr>
                          <td
                            valign="middle"
                            style="padding-right:14px;"
                          >
                            <img
                              src="${escapeHtml(
                                mpreLogoUrl
                              )}"
                              alt="MPRE"
                              style="display:block;max-width:116px;max-height:52px;width:auto;height:auto;border:0;background:transparent;"
                            />
                          </td>

                          <td
                            valign="middle"
                          >
                            <img
                              src="${escapeHtml(
                                brokerageLogoUrl
                              )}"
                              alt="${escapeHtml(
                                brokerageName
                              )}"
                              style="display:block;max-width:128px;max-height:52px;width:auto;height:auto;border:0;background:transparent;"
                            />
                          </td>
                        </tr>
                      </table>
                    </td>

                    <td
                      valign="middle"
                      align="right"
                      style="font-family:Arial,sans-serif;"
                    >
                      <div
                        style="font-size:10px;font-weight:bold;letter-spacing:2.2px;text-transform:uppercase;color:#c7af7d;"
                      >
                        Luxury Listing Presentation
                      </div>

                      <div
                        style="margin-top:7px;font-size:11px;color:#aaa296;"
                      >
                        ${escapeHtml(
                          typeLabel(
                            campaignType
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${
              heroPhoto
                ? `
                  <tr>
                    <td>
                      ${
                        publicUrl
                          ? `
                            <a
                              href="${escapeHtml(
                                publicUrl
                              )}"
                              style="display:block;text-decoration:none;"
                            >
                          `
                          : ''
                      }

                      <img
                        src="${escapeHtml(
                          heroPhoto
                            .public_url
                        )}"
                        alt="${escapeHtml(
                          heroPhoto
                            .caption ||
                          heroPhoto
                            .title ||
                          listing.title
                        )}"
                        width="720"
                        style="display:block;width:100%;height:auto;border:0;"
                      />

                      ${
                        publicUrl
                          ? '</a>'
                          : ''
                      }
                    </td>
                  </tr>
                `
                : ''
            }

            <tr>
              <td
                class="luxury-pad"
                style="padding:52px 58px 46px;background:#f8f4ec;text-align:center;"
              >
                <div
                  style="font-family:Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#9b7a3b;"
                >
                  An Exceptional Offering
                </div>

                <div
                  style="margin:18px auto 0;width:56px;height:1px;background:#b99a5e;"
                ></div>

                <h1
                  class="luxury-title"
                  style="margin:24px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:48px;font-weight:normal;line-height:1.08;letter-spacing:-1px;color:#15130f;"
                >
                  ${escapeHtml(
                    headline
                  )}
                </h1>

                <div
                  style="margin-top:23px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.2;color:#9b6b23;"
                >
                  ${escapeHtml(
                    price
                  )}
                </div>

                <div
                  style="margin-top:12px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.5px;color:#625b50;"
                >
                  ${escapeHtml(
                    address
                  )}
                </div>

                ${
                  listing.mls_number
                    ? `
                      <div
                        style="margin-top:6px;font-family:Arial,sans-serif;font-size:9px;letter-spacing:1.1px;text-transform:uppercase;color:#9a9082;"
                      >
                        MLS #${escapeHtml(
                          listing
                            .mls_number
                        )}
                      </div>
                    `
                    : ''
                }
              </td>
            </tr>

            ${
              statItems.length >
              0
                ? `
                  <tr>
                    <td
                      style="background:#171510;"
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                      >
                        <tr>
                          ${statCells}
                        </tr>
                      </table>
                    </td>
                  </tr>
                `
                : ''
            }

            <tr>
              <td
                class="luxury-pad"
                style="padding:48px 64px 50px;background:#ffffff;text-align:center;font-family:Arial,sans-serif;"
              >
                <div
                  style="font-size:10px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#9b7a3b;"
                >
                  The Residence
                </div>

                ${
                  false && escapedIntro
                    ? `
                      <div
                        style="margin:17px auto 0;max-width:570px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.65;color:#3e392f;"
                      >
                        ${escapedIntro}
                      </div>
                    `
                    : ''
                }

                ${
                  escapedExpanded
                    ? `
                      <div
                        style="margin:22px auto 24px;max-width:570px;padding-top:21px;border-top:1px solid #e4ddd0;text-align:left;font-size:14px;line-height:1.8;color:#5a5348;"
                      >
                        ${escapedExpanded}
                      </div>
                    `
                    : ''
                }

                ${
                  publicUrl
                    ? `
                      <table
                        role="presentation"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        align="center"
                        style="margin:0 auto;"
                      >
                        <tr>
                          <td
                            style="border:1px solid #a88445;background:#ffffff;"
                          >
                            <a
                              href="${escapeHtml(
                                publicUrl
                              )}"
                              style="display:inline-block;padding:13px 27px;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;color:#6f5327;text-decoration:none;"
                            >
                              ${escapeHtml(
                                buttonText
                              )}
                            </a>
                          </td>
                        </tr>
                      </table>
                    `
                    : ''
                }
              </td>
            </tr>

            ${
              videoUrl
                ? `
                  <tr>
                    <td
                      class="luxury-pad"
                      style="padding:0 34px 42px;background:#ffffff;"
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        style="background:#15130f;"
                      >
                        ${
                          videoThumbnail
                            ? `
                              <tr>
                                <td>
                                  <table
                                    role="presentation"
                                    width="652"
                                    cellpadding="0"
                                    cellspacing="0"
                                    border="0"
                                    style="width:100%;max-width:652px;"
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        valign="middle"
                                        background="${escapeHtml(
                                          videoThumbnail
                                        )}"
                                        style="height:367px;background-color:#15130f;background-image:url('${escapeHtml(
                                          videoThumbnail
                                        )}');background-position:center center;background-repeat:no-repeat;background-size:cover;"
                                      >
                                        <!--[if gte mso 9]>
                                        <v:rect
                                          xmlns:v="urn:schemas-microsoft-com:vml"
                                          fill="true"
                                          stroke="false"
                                          style="width:489pt;height:275pt;"
                                        >
                                          <v:fill
                                            type="frame"
                                            src="${escapeHtml(
                                              videoThumbnail
                                            )}"
                                            color="#15130f"
                                          />
                                          <v:textbox
                                            inset="0,0,0,0"
                                          >
                                        <![endif]-->

                                        <table
                                          role="presentation"
                                          width="100%"
                                          height="367"
                                          cellpadding="0"
                                          cellspacing="0"
                                          border="0"
                                        >
                                          <tr>
                                            <td
                                              align="center"
                                              valign="middle"
                                            >
                                              <a
                                                href="${escapeHtml(
                                                  videoUrl
                                                )}"
                                                aria-label="Play property film"
                                                style="display:inline-block;padding:15px 28px 14px 31px;border-radius:18px;background:#ff0033;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:30px;font-weight:bold;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,0.28);"
                                              >
                                                &#9654;
                                              </a>
                                            </td>
                                          </tr>
                                        </table>

                                        <!--[if gte mso 9]>
                                          </v:textbox>
                                        </v:rect>
                                        <![endif]-->
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            `
                            : ''
                        }

                        <tr>
                          <td
                            style="padding:28px 30px;text-align:center;"
                          >
                            <div
                              style="font-family:Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#b99a5e;"
                            >
                              Property Film
                            </div>

                            <div
                              style="margin-top:10px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#ffffff;"
                            >
                              Experience the home in motion
                            </div>

                            <div
                              style="margin-top:13px;"
                            >
                              <a
                                href="${escapeHtml(
                                  videoUrl
                                )}"
                                style="font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#d5bd8d;text-decoration:none;"
                              >
                                Watch the property film &rarr;
                              </a>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                `
                : ''
            }

            ${
              galleryLead ||
              galleryRows
                ? `
                  <tr>
                    <td
                      class="luxury-pad"
                      style="padding:48px 34px 24px;background:#f5f0e7;text-align:center;"
                    >
                      <div
                        style="font-family:Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#9b7a3b;"
                      >
                        Curated Details
                      </div>

                      <div
                        style="margin-top:11px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;color:#15130f;"
                      >
                        A closer look at the residence
                      </div>

                      <div
                        style="margin:17px auto 0;width:48px;height:1px;background:#b99a5e;"
                      ></div>
                    </td>
                  </tr>

                  ${leadGalleryHtml}

                  ${
                    galleryRows
                      ? `
                        <tr>
                          <td
                            style="padding:0 34px 34px;background:#f5f0e7;"
                          >
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                            >
                              ${galleryRows}
                            </table>
                          </td>
                        </tr>
                      `
                      : ''
                  }
                `
                : ''
            }

            ${realtorEditorial}

            ${buildMarketingFooterHtml(
              profile
            )}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
export function buildEmailHtml({
  listing,
  photos,
  photoCount,
  headline,
  description,
  previewText,
  campaignType,
  templateKey,
  generatedArtworkUrl,
  primaryCtaLabel,
  audienceContactType,
  profile,
}: {
  listing: Listing;
  photos: ListingPhoto[];
  photoCount: number;
  headline: string;
  description: string;
  previewText: string;
  campaignType: string;
  templateKey: EmailTemplateKey;
  generatedArtworkUrl: string;
  primaryCtaLabel?: string;
  audienceContactType: string;
  profile: Profile;
}) {
  if (
    templateKey ===
    'luxury'
  ) {
    return buildLuxuryEmailHtml({
      listing,
      photos,
      photoCount,
      headline,
      description,
      previewText,
      campaignType,
      primaryCtaLabel,
      audienceContactType,
      profile,
    });
  }

  const template =
    EMAIL_TEMPLATES.find(
      (item) =>
        item.value ===
        templateKey
    ) || EMAIL_TEMPLATES[0];

  const isRealtorAudience =
    audienceContactType ===
    'realtor';

  const chosenPhotos =
    photos.slice(
      0,
      Math.max(
        1,
        photoCount
      )
    );

  const heroPhoto =
    chosenPhotos[0];

  const galleryPhotos =
    chosenPhotos.slice(1);

  let galleryRows = '';

  for (
    let index = 0;
    index <
    galleryPhotos.length;
    index += 2
  ) {
    const left =
      galleryPhotos[index];

    const right =
      galleryPhotos[
        index + 1
      ];

    galleryRows += `
      <tr>
        <td
          width="50%"
          valign="top"
          style="padding:6px;"
        >
          <img
            src="${escapeHtml(
              left.public_url
            )}"
            alt="${escapeHtml(
              left.caption ||
                left.title ||
                listing.title
            )}"
            width="280"
            style="display:block;width:100%;height:auto;border-radius:${template.imageRadius};"
          />
        </td>

        <td
          width="50%"
          valign="top"
          style="padding:6px;"
        >
          ${
            right
              ? `
                <img
                  src="${escapeHtml(
                    right.public_url
                  )}"
                  alt="${escapeHtml(
                    right.caption ||
                      right.title ||
                      listing.title
                  )}"
                  width="280"
                  style="display:block;width:100%;height:auto;border-radius:${template.imageRadius};"
                />
              `
              : '&nbsp;'
          }
        </td>
      </tr>
    `;
  }

  const facts = [
    listing.bedrooms !==
      null
      ? `${listing.bedrooms} Beds`
      : '',

    listing.bathrooms !==
      null
      ? `${listing.bathrooms} Baths`
      : '',

    listing.square_feet !==
      null
      ? `${Number(
          listing.square_feet
        ).toLocaleString()} Sq Ft`
      : '',

    listing.acres !==
      null &&
    listing.acres !==
      undefined
      ? `${listing.acres} Acres`
      : listing
          .lot_size_text
          ?.trim() ||
        '',
  ]
    .filter(Boolean)
    .join(' • ');

  const publicUrl =
    listing.public_url
      ?.trim() ||
    '';


  const generatedArtwork =
    generatedArtworkUrl
      .trim();

  const videoUrl =
    listing
      .unbranded_video_url
      ?.trim() ||
    '';

  const phone =
    profile
      .marketing_phone
      ?.trim() ||
    '';

  const phoneUrl =
    phone
      ? `tel:${phone.replace(
          /[^\d+]/g,
          ''
        )}`
      : '';

  const marketingName =
    profile
      .marketing_from_name
      ?.trim() ||
    'Listing Agent';

  const brandName =
    profile
      .marketing_brokerage
      ?.trim() ||
    'MPRE';

  const brandLogoUrl =
    profile
      .marketing_logo_url
      ?.trim() ||
    '';

  const videoThumbnailUrl =
    youtubeThumbnailUrl(
      videoUrl
    );

  const actionButtons = [
    publicUrl
      ? {
          label:
            primaryCtaLabel?.trim() || 'View Full Listing',
          url: publicUrl,
          background:
            template.accent,
        }
      : null,

    videoUrl
      ? {
          label:
            'Watch Property Video',
          url: videoUrl,
          background:
            template.secondaryAction,
        }
      : null,

    phoneUrl
      ? {
          label:
            `Call or Text ${marketingName}`,
          url: phoneUrl,
          background:
            '#2563eb',
        }
      : null,
  ]
    .filter(
      (
        button
      ): button is {
        label: string;
        url: string;
        background: string;
      } =>
        Boolean(button)
    )
    .map(
      (button) => `
        <a
          href="${escapeHtml(
            button.url
          )}"
          style="display:inline-block;margin:5px 4px;padding:13px 19px;border-radius:${template.buttonRadius};background:${button.background};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;"
        >
          ${escapeHtml(
            button.label
          )}
        </a>
      `
    )
    .join('');

  const realtorSection =
    isRealtorAudience
      ? `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="margin-top:26px;background:#fff8eb;border:1px solid #f6d79b;border-radius:16px;"
    >
      <tr>
        <td
          style="padding:24px 25px;font-family:Arial,sans-serif;"
        >
          <div
            style="font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#a16207;"
          >
            Agent-to-Agent Note
          </div>

          <div
            style="margin-top:7px;font-size:22px;font-weight:bold;line-height:1.3;color:#0f172a;"
          >
            Why This Home Deserves a Showing
          </div>

          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="margin-top:14px;"
          >
            <tr>
              <td
                width="28"
                valign="top"
                style="padding:4px 0;color:#d97706;font-size:18px;font-weight:bold;"
              >
                &#10003;
              </td>

              <td
                style="padding:4px 0;font-size:14px;line-height:1.65;color:#475569;"
              >
                Strong presentation and a clear property story make it easy to introduce to qualified buyers.
              </td>
            </tr>

            <tr>
              <td
                width="28"
                valign="top"
                style="padding:4px 0;color:#d97706;font-size:18px;font-weight:bold;"
              >
                &#10003;
              </td>

              <td
                style="padding:4px 0;font-size:14px;line-height:1.65;color:#475569;"
              >
                Professional photography${
                  videoUrl
                    ? ' and an unbranded video'
                    : ''
                } provide share-ready material before the showing.
              </td>
            </tr>

            <tr>
              <td
                width="28"
                valign="top"
                style="padding:4px 0;color:#d97706;font-size:18px;font-weight:bold;"
              >
                &#10003;
              </td>

              <td
                style="padding:4px 0;font-size:14px;line-height:1.65;color:#475569;"
              >
                Contact ${escapeHtml(
                  profile
                    .marketing_from_name ||
                    'the listing agent'
                )} directly with questions or for private-showing coordination.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
      : '';

  const videoFeature =
    videoUrl
      ? `
        <tr>
          <td
            style="padding:0 28px 30px;"
          >
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="background:#0f172a;border-radius:16px;"
            >
              <tr>
                <td
                  style="padding:25px;text-align:center;font-family:Arial,sans-serif;"
                >
                  ${
                    videoThumbnailUrl
                      ? `
                        <a
                          href="${escapeHtml(
                            videoUrl
                          )}"
                          style="display:block;text-decoration:none;"
                        >
                          <img
                            src="${escapeHtml(
                              videoThumbnailUrl
                            )}"
                            alt="Property video preview"
                            width="580"
                            style="display:block;width:100%;max-width:580px;height:auto;margin:0 auto 18px;border:0;border-radius:12px;"
                          />
                        </a>
                      `
                      : ''
                  }

                  <div
                    style="display:inline-block;width:58px;height:58px;border-radius:50%;background:#d97706;color:#ffffff;font-size:27px;line-height:58px;text-align:center;"
                  >
                    &#9654;
                  </div>

                  <div
                    style="margin-top:14px;font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#fbbf24;"
                  >
                    Share-Ready Property Video
                  </div>

                  <div
                    style="margin-top:7px;font-size:22px;font-weight:bold;line-height:1.25;color:#ffffff;"
                  >
                    ${isRealtorAudience
                      ? 'Preview the Home Before the Showing'
                      : 'Take a Closer Look at the Property'}
                  </div>

                  <div
                    style="margin:10px auto 0;max-width:480px;font-size:14px;line-height:1.7;color:#cbd5e1;"
                  >
                    ${isRealtorAudience
                      ? 'Preview the home with your buyers or forward the unbranded property video directly to them.'
                      : 'Watch the property video for a closer look at the home, its features and overall presentation.'}
                  </div>

                  <div
                    style="margin-top:18px;"
                  >
                    <a
                      href="${escapeHtml(
                        videoUrl
                      )}"
                      style="display:inline-block;padding:13px 22px;border-radius:10px;background:#ffffff;color:#0f172a;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;"
                    >
                      ${isRealtorAudience
                        ? 'Watch the Unbranded Video'
                        : 'Watch the Property Video'}
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : '';

  const galleryButton =
    publicUrl
      ? `
        <div
          style="margin-top:20px;text-align:center;"
        >
          <a
            href="${escapeHtml(
              publicUrl
            )}"
            style="display:inline-block;padding:12px 20px;border:1px solid #cbd5e1;border-radius:10px;color:#0f172a;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;"
          >
            View All ${photos.length} Photos
          </a>
        </div>
      `
      : '';

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />

    <meta
      name="viewport"
      content="width=device-width,initial-scale=1"
    />

    <title>
      ${escapeHtml(headline)}
    </title>
  </head>

  <body
    style="margin:0;padding:0;background:${template.pageBackground};"
  >
    <div
      style="display:none;max-height:0;overflow:hidden;opacity:0;"
    >
      ${escapeHtml(
        previewText
      )}
    </div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:${template.pageBackground};"
    >
      <tr>
        <td
          align="center"
          style="padding:24px 10px;"
        >
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:680px;background:${template.cardBackground};border:${template.cardBorder};border-radius:${template.cardRadius};overflow:hidden;box-shadow:${template.shadow};"
          >
            <tr>
              <td
                style="padding:20px 28px 16px;text-align:center;font-family:Arial,sans-serif;"
              >
                ${
                  brandLogoUrl
                    ? `
                      <img
                        src="${escapeHtml(
                          brandLogoUrl
                        )}"
                        alt="${escapeHtml(
                          brandName
                        )}"
                        width="180"
                        style="display:block;width:auto;max-width:180px;max-height:74px;margin:0 auto;border:0;"
                      />
                    `
                    : `
                      <div
                        style="font-size:28px;font-weight:800;letter-spacing:1px;color:${template.headingColor};"
                      >
                        ${escapeHtml(
                          brandName
                        )}
                      </div>
                    `
                }

                ${
                  brandLogoUrl
                    ? `
                      <div
                        style="margin-top:8px;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;"
                      >
                        ${escapeHtml(
                          brandName
                        )}
                      </div>
                    `
                    : ''
                }
              </td>
            </tr>

            <tr>
              <td
                style="padding:13px 28px;background:${template.bannerBackground};text-align:center;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${template.bannerColor};"
              >
                ${isRealtorAudience
                  ? 'A Share-Ready Property Spotlight for Your Buyers'
                  : 'Featured Property Spotlight'}
              </td>
            </tr>

            ${
              generatedArtwork
                ? `
                  <tr>
                    <td>
                      ${
                        publicUrl
                          ? `
                            <a
                              href="${escapeHtml(
                                publicUrl
                              )}"
                              style="display:block;text-decoration:none;"
                            >
                          `
                          : ''
                      }

                      <img
                        src="${escapeHtml(
                          generatedArtwork
                        )}"
                        alt="Decorative real-estate campaign artwork"
                        width="680"
                        style="display:block;width:100%;height:auto;border:0;"
                      />

                      ${
                        publicUrl
                          ? '</a>'
                          : ''
                      }
                    </td>
                  </tr>
                `
                : ''
            }
            <tr>
              <td
                style="padding:32px 34px 27px;text-align:center;font-family:${template.headingFont};"
              >
                <div
                  style="font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${template.accent};"
                >
                  ${escapeHtml(
                    typeLabel(
                      campaignType
                    )
                  )}
                </div>

                <h1
                  style="margin:14px auto 9px;max-width:570px;font-family:${template.headingFont};font-size:34px;line-height:1.15;color:${template.headingColor};"
                >
                  ${escapeHtml(
                    headline
                  )}
                </h1>

                <div
                  style="font-size:22px;font-weight:bold;color:${template.accent};"
                >
                  ${escapeHtml(
                    formatPrice(
                      listing.list_price
                    )
                  )}
                </div>

                <div
                  style="margin-top:8px;font-size:15px;color:#475569;"
                >
                  ${escapeHtml(
                    listingAddress(
                      listing
                    )
                  )}
                </div>
              </td>
            </tr>

            ${
              heroPhoto
                ? `
                  <tr>
                    <td>
                      <img
                        src="${escapeHtml(
                          heroPhoto.public_url
                        )}"
                        alt="${escapeHtml(
                          heroPhoto.caption ||
                            heroPhoto.title ||
                            listing.title
                        )}"
                        width="680"
                        style="display:block;width:100%;height:auto;"
                      />
                    </td>
                  </tr>
                `
                : ''
            }

            <tr>
              <td
                style="padding:26px 30px;font-family:Arial,sans-serif;"
              >
                ${
                  facts
                    ? `
                      <div
                        style="margin-bottom:20px;padding:14px 16px;border-radius:${template.buttonRadius};background:${template.factsBackground};text-align:center;font-size:15px;font-weight:bold;color:${template.factsColor};"
                      >
                        ${escapeHtml(
                          facts
                        )}
                      </div>
                    `
                    : ''
                }

                ${
                  description.trim()
                    ? `
                      <p
                        style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:${template.bodyColor};"
                      >
                        ${escapeHtml(
                          description
                        ).replace(
                          /\n/g,
                          '<br />'
                        )}
                      </p>
                    `
                    : ''
                }

                ${
                  actionButtons
                    ? `
                      <div
                        style="margin-top:23px;text-align:center;"
                      >
                        ${actionButtons}
                      </div>
                    `
                    : ''
                }

                ${realtorSection}
              </td>
            </tr>

            ${videoFeature}

            ${
              galleryRows
                ? `
                  <tr>
                    <td
                      style="padding:0 20px 24px;"
                    >
                      <div
                        style="padding:0 6px 13px;text-align:center;font-family:Arial,sans-serif;"
                      >
                        <div
                          style="font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${template.accent};"
                        >
                          A Closer Look
                        </div>

                        <div
                          style="margin-top:6px;font-family:${template.headingFont};font-size:24px;font-weight:bold;color:${template.headingColor};"
                        >
                          Explore the Property
                        </div>
                      </div>

                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                      >
                        ${galleryRows}
                      </table>

                      ${galleryButton}
                    </td>
                  </tr>
                `
                : ''
            }

            ${buildMarketingFooterHtml(
              profile
            )}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
