'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Users,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

import {
  buildMarketingContactText,
  buildMarketingFooterHtml,
} from '../../../../lib/marketing-email-footer';

const supabase =
  getSupabaseBrowser();

type Profile = {
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

type Listing = {
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

type ListingPhoto = {
  id: string;
  public_url: string;
  sort_order: number;
  is_primary: boolean;
  use_in_marketing: boolean;
  title: string | null;
  caption: string | null;
};

type Contact = {
  id: string;

  email:
    | string
    | null;

  contact_type: string;
  lifecycle_stage: string;

  company:
    | string
    | null;

  email_marketing_status:
    string;

  do_not_contact:
    boolean;

  tags:
    | string[]
    | null;
};

type Campaign = {
  id: string;

  listing_id:
    | string
    | null;

  campaign_type: string;

  name: string;
  subject: string;

  preview_text:
    | string
    | null;

  status: string;

  total_recipients:
    number;

  audience_filter:
    Record<string, any>;

  design_settings:
    Record<string, any>;

  test_sent_at:
    | string
    | null;

  created_at: string;
  updated_at: string;
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

function buildTextBody(
  listing: Listing,
  headline: string,
  description: string,
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
      ? `View listing: ${listing.public_url}`
      : '',
    '',
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

function buildEmailHtml({
  listing,
  photos,
  photoCount,
  headline,
  description,
  previewText,
  campaignType,
  profile,
}: {
  listing: Listing;
  photos: ListingPhoto[];
  photoCount: number;
  headline: string;
  description: string;
  previewText: string;
  campaignType: string;
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
            style="display:block;width:100%;height:auto;border-radius:10px;"
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
                  style="display:block;width:100%;height:auto;border-radius:10px;"
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

    listing.mls_number
      ? `MLS ${listing.mls_number}`
      : '',
  ]
    .filter(Boolean)
    .join(' • ');

  const publicButton =
    listing.public_url
      ? `
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          align="center"
          style="margin:26px auto;"
        >
          <tr>
            <td
              bgcolor="#ea580c"
              style="border-radius:10px;"
            >
              <a
                href="${escapeHtml(
                  listing.public_url
                )}"
                style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;"
              >
                View Property Details
              </a>
            </td>
          </tr>
        </table>
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
    style="margin:0;padding:0;background:#f1f5f9;"
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
      style="background:#f1f5f9;"
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
            style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;"
          >
            <tr>
              <td
                style="padding:28px 30px 22px;text-align:center;font-family:Arial,sans-serif;"
              >
                <div
                  style="font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;"
                >
                  ${escapeHtml(
                    typeLabel(
                      campaignType
                    )
                  )}
                </div>

                <h1
                  style="margin:10px 0 8px;font-size:30px;line-height:1.2;color:#0f172a;"
                >
                  ${escapeHtml(
                    headline
                  )}
                </h1>

                <div
                  style="font-size:18px;font-weight:bold;color:#ea580c;"
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
                        width="640"
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
                        style="margin-bottom:18px;padding:12px 15px;border-radius:10px;background:#eff6ff;text-align:center;font-size:15px;font-weight:bold;color:#1e3a8a;"
                      >
                        ${escapeHtml(
                          facts
                        )}
                      </div>
                    `
                    : ''
                }

                <p
                  style="margin:0;font-size:16px;line-height:1.7;color:#334155;"
                >
                  ${escapeHtml(
                    description
                  ).replace(
                    /\n/g,
                    '<br />'
                  )}
                </p>

                ${publicButton}
              </td>
            </tr>

            ${
              galleryRows
                ? `
                  <tr>
                    <td
                      style="padding:0 20px 24px;"
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

export default function CampaignsPage() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingPhotos,
    setLoadingPhotos,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    sendingTest,
    setSendingTest,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    notice,
    setNotice,
  ] = useState<
    string | null
  >(null);

  const [
    profile,
    setProfile,
  ] = useState<
    Profile | null
  >(null);

  const [
    listings,
    setListings,
  ] = useState<Listing[]>(
    []
  );

  const [
    readinessRows,
    setReadinessRows,
  ] = useState<
    Readiness[]
  >([]);

  const [
    contacts,
    setContacts,
  ] = useState<Contact[]>(
    []
  );

  const [
    suppressionEmails,
    setSuppressionEmails,
  ] = useState<
    Set<string>
  >(new Set());

  const [
    campaigns,
    setCampaigns,
  ] = useState<
    Campaign[]
  >([]);

  const [
    photos,
    setPhotos,
  ] = useState<
    ListingPhoto[]
  >([]);

  const [
    editingCampaignId,
    setEditingCampaignId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedListingId,
    setSelectedListingId,
  ] = useState('');

  const [
    campaignType,
    setCampaignType,
  ] = useState(
    'listing_ad'
  );

  const [
    campaignName,
    setCampaignName,
  ] = useState('');

  const [
    subject,
    setSubject,
  ] = useState('');

  const [
    previewText,
    setPreviewText,
  ] = useState('');

  const [
    contactTypeFilter,
    setContactTypeFilter,
  ] = useState('realtor');

  const [
    lifecycleFilter,
    setLifecycleFilter,
  ] = useState('all');

  const [
    companyFilter,
    setCompanyFilter,
  ] = useState('all');

  const [
    photoCount,
    setPhotoCount,
  ] = useState(6);

  const selectedListing =
    useMemo(
      () =>
        listings.find(
          (listing) =>
            listing.id ===
            selectedListingId
        ) || null,
      [
        listings,
        selectedListingId,
      ]
    );

  const readinessByListing =
    useMemo(
      () =>
        new Map(
          readinessRows.map(
            (row) => [
              row.listing_id,
              row,
            ]
          )
        ),
      [readinessRows]
    );

  const selectedReadiness =
    selectedListing
      ? readinessByListing.get(
          selectedListing.id
        ) || null
      : null;

  const companies =
    useMemo(() => {
      return Array.from(
        new Set(
          contacts
            .map(
              (contact) =>
                contact.company?.trim()
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      ).sort((a, b) =>
        a.localeCompare(b)
      );
    }, [contacts]);

  const eligibleContacts =
    useMemo(() => {
      return contacts.filter(
        (contact) => {
          const email =
            contact.email
              ?.trim()
              .toLowerCase();

          if (!email) {
            return false;
          }

          if (
            contact
              .email_marketing_status !==
            'active'
          ) {
            return false;
          }

          if (
            contact.do_not_contact
          ) {
            return false;
          }

          if (
            contact
              .lifecycle_stage ===
            'archived'
          ) {
            return false;
          }

          if (
            suppressionEmails.has(
              email
            )
          ) {
            return false;
          }

          if (
            contactTypeFilter !==
              'all' &&
            contact.contact_type !==
              contactTypeFilter
          ) {
            return false;
          }

          if (
            lifecycleFilter !==
              'all' &&
            contact
              .lifecycle_stage !==
              lifecycleFilter
          ) {
            return false;
          }

          if (
            companyFilter !==
              'all' &&
            contact.company !==
              companyFilter
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      contacts,
      suppressionEmails,
      contactTypeFilter,
      lifecycleFilter,
      companyFilter,
    ]);

  const headline =
    selectedListing
      ?.campaign_headline ||
    selectedListing?.title ||
    '';

  const marketingDescription =
    selectedListing
      ?.short_marketing_description ||
    selectedListing
      ?.public_remarks ||
    selectedListing
      ?.description ||
    '';

  const previewHtml =
    useMemo(() => {
      if (
        !selectedListing ||
        !profile
      ) {
        return '';
      }

      return buildEmailHtml({
        listing:
          selectedListing,

        photos,

        photoCount,

        headline,

        description:
          marketingDescription,

        previewText,

        campaignType,

        profile,
      });
    }, [
      selectedListing,
      profile,
      photos,
      photoCount,
      headline,
      marketingDescription,
      previewText,
      campaignType,
    ]);

  const senderReady =
    Boolean(
      profile
        ?.marketing_from_name &&
        profile
          ?.marketing_from_email &&
        profile
          ?.marketing_reply_to_email &&
        profile
          ?.marketing_email_enabled
    );

  const professionalFooterReady =
    Boolean(
      profile
        ?.marketing_phone
        ?.trim() &&
        profile
          ?.marketing_title
          ?.trim() &&
        profile
          ?.marketing_brokerage
          ?.trim() &&
        profile
          ?.marketing_headshot_url
          ?.trim()
    );

  const organizationComplianceReady =
    Boolean(
      profile
        ?.marketing_licensed_business_name &&
        profile
          ?.marketing_privacy_policy_url
    );

  const physicalAddressReady =
    Boolean(
      profile
        ?.marketing_physical_address
        ?.trim()
    );

  const listingReady =
    Boolean(
      selectedReadiness
        ?.campaign_ready
    );

  const testReady =
    Boolean(
      selectedListing &&
        listingReady &&
        senderReady &&
        professionalFooterReady &&
        organizationComplianceReady &&
        physicalAddressReady &&
        subject.trim() &&
        campaignName.trim() &&
        previewHtml
    );

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: userResult,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !userResult?.user
      ) {
        throw new Error(
          userError?.message ||
            'Not authenticated.'
        );
      }

      const {
        data: profileRow,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          org_id,
          role,
          marketing_from_name,
          marketing_from_email,
          marketing_reply_to_email,
          marketing_physical_address,
          marketing_email_enabled,
          marketing_phone,
          marketing_title,
          marketing_brokerage,
          marketing_website_url,
          marketing_license_number,
          marketing_headshot_url,
          marketing_signature_text,
          marketing_signature_image_url,
          marketing_logo_url,
          marketing_office_phone,
          marketing_office_address,
          marketing_appointment_url,
          marketing_designations,
          marketing_certifications,
          marketing_service_areas,
          marketing_languages,
          marketing_disclaimer,
          marketing_facebook_url,
          marketing_instagram_url,
          marketing_linkedin_url,
          marketing_youtube_url,
          marketing_tiktok_url,
          marketing_x_url
        `)
        .eq(
          'id',
          userResult.user.id
        )
        .single();

      if (
        profileError ||
        !profileRow
      ) {
        throw new Error(
          profileError?.message ||
            'Profile not found.'
        );
      }

      const typedProfile =
        profileRow as Profile;

      if (
        !typedProfile.org_id
      ) {
        throw new Error(
          'Your CRM profile is missing an organization.'
        );
      }

      const {
        data: sessionResult,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const complianceResponse =
        await fetch(
          '/api/preferences/organization-compliance',
          {
            method: 'GET',

            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,
            },

            cache: 'no-store',
          }
        );

      const complianceResult =
        await complianceResponse.json();

      if (
        !complianceResponse.ok ||
        !complianceResult.ok
      ) {
        throw new Error(
          complianceResult.error ||
            'Could not load brokerage compliance settings.'
        );
      }

      const mergedProfile = {
        ...typedProfile,
        ...complianceResult.organization,
      } as Profile;

      setProfile(
        mergedProfile
      );

      const [
        listingResult,
        readinessResult,
        contactResult,
        suppressionResult,
        campaignResult,
      ] = await Promise.all([
        supabase
          .from('listings')
          .select(`
            id,
            owner_user_id,
            title,
            property_address,
            city,
            state,
            zip,
            mls_number,
            list_price,
            listing_status,
            public_url,
            campaign_headline,
            short_marketing_description,
            public_remarks,
            description,
            bedrooms,
            bathrooms,
            square_feet,
            review_status
          `)
          .order(
            'created_at',
            {
              ascending: false,
            }
          ),

        supabase
          .from(
            'listing_campaign_readiness'
          )
          .select(`
            listing_id,
            has_title,
            has_address,
            has_price,
            has_public_remarks,
            has_public_link,
            has_listing_owner,
            has_primary_photo,
            has_confirmed_review,
            campaign_ready
          `),

        supabase
          .from('contacts')
          .select(`
            id,
            email,
            contact_type,
            lifecycle_stage,
            company,
            email_marketing_status,
            do_not_contact,
            tags
          `)
          .limit(10000),

        supabase
          .from(
            'email_suppressions'
          )
          .select(
            'email_normalized'
          )
          .limit(10000),

        supabase
          .from(
            'email_campaigns'
          )
          .select(`
            id,
            listing_id,
            campaign_type,
            name,
            subject,
            preview_text,
            status,
            total_recipients,
            audience_filter,
            design_settings,
            test_sent_at,
            created_at,
            updated_at
          `)
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(250),
      ]);

      if (
        listingResult.error
      ) {
        throw listingResult.error;
      }

      if (
        readinessResult.error
      ) {
        throw readinessResult.error;
      }

      if (
        contactResult.error
      ) {
        throw contactResult.error;
      }

      if (
        suppressionResult.error
      ) {
        throw suppressionResult.error;
      }

      if (
        campaignResult.error
      ) {
        throw campaignResult.error;
      }

      const listingRows =
        (listingResult.data ||
          []) as Listing[];

      setListings(
        listingRows
      );

      setReadinessRows(
        (readinessResult.data ||
          []) as Readiness[]
      );

      setContacts(
        (contactResult.data ||
          []) as Contact[]
      );

      setSuppressionEmails(
        new Set(
          (
            suppressionResult.data ||
            []
          )
            .map(
              (row) =>
                row.email_normalized
                  ?.trim()
                  .toLowerCase()
            )
            .filter(Boolean)
        )
      );

      setCampaigns(
        (campaignResult.data ||
          []) as Campaign[]
      );

      setSelectedListingId(
        (current) =>
          current ||
          listingRows[0]?.id ||
          ''
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load campaign data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (
      !selectedListingId
    ) {
      setPhotos([]);
      return;
    }

    let mounted = true;

    async function loadPhotos() {
      try {
        setLoadingPhotos(true);

        const {
          data,
          error: photoError,
        } = await supabase
          .from('listing_media')
          .select(`
            id,
            public_url,
            sort_order,
            is_primary,
            use_in_marketing,
            title,
            caption
          `)
          .eq(
            'listing_id',
            selectedListingId
          )
          .eq(
            'media_type',
            'photo'
          )
          .eq(
            'use_in_marketing',
            true
          )
          .order(
            'sort_order',
            {
              ascending: true,
            }
          );

        if (photoError) {
          throw photoError;
        }

        if (mounted) {
          setPhotos(
            (data ||
              []) as ListingPhoto[]
          );
        }
      } catch (err: any) {
        if (mounted) {
          setError(
            err?.message ||
              'Could not load listing photos.'
          );

          setPhotos([]);
        }
      } finally {
        if (mounted) {
          setLoadingPhotos(false);
        }
      }
    }

    loadPhotos();

    return () => {
      mounted = false;
    };
  }, [selectedListingId]);

  useEffect(() => {
    if (
      !selectedListing ||
      editingCampaignId
    ) {
      return;
    }

    if (
      !campaignName.trim()
    ) {
      setCampaignName(
        `${typeLabel(
          campaignType
        )} - ${
          selectedListing.title
        }`
      );
    }

    if (!subject.trim()) {
      setSubject(
        `${
          selectedListing
            .listing_status ===
          'coming_soon'
            ? 'Coming Soon'
            : 'New Listing'
        }: ${
          selectedListing.title
        }`
      );
    }

    if (
      !previewText.trim()
    ) {
      setPreviewText(
        selectedListing
          .short_marketing_description ||
          `${listingAddress(
            selectedListing
          )} — ${formatPrice(
            selectedListing.list_price
          )}`
      );
    }
  }, [
    selectedListing,
    editingCampaignId,
  ]);

  function chooseListing(
    listingId: string
  ) {
    setEditingCampaignId(
      null
    );

    setSelectedListingId(
      listingId
    );

    const listing =
      listings.find(
        (item) =>
          item.id === listingId
      );

    if (!listing) {
      return;
    }

    setCampaignName(
      `${typeLabel(
        campaignType
      )} - ${listing.title}`
    );

    setSubject(
      `${
        listing.listing_status ===
        'coming_soon'
          ? 'Coming Soon'
          : 'New Listing'
      }: ${listing.title}`
    );

    setPreviewText(
      listing
        .short_marketing_description ||
      `${listingAddress(
        listing
      )} — ${formatPrice(
        listing.list_price
      )}`
    );
  }

  function startNewCampaign() {
    setEditingCampaignId(
      null
    );

    setCampaignType(
      'listing_ad'
    );

    setCampaignName('');
    setSubject('');
    setPreviewText('');

    setContactTypeFilter(
      'realtor'
    );

    setLifecycleFilter(
      'all'
    );

    setCompanyFilter(
      'all'
    );

    setPhotoCount(6);

    setNotice(
      'New campaign draft started.'
    );
  }

  function openCampaign(
    campaign: Campaign
  ) {
    setEditingCampaignId(
      campaign.id
    );

    setSelectedListingId(
      campaign.listing_id ||
        ''
    );

    setCampaignType(
      campaign.campaign_type
    );

    setCampaignName(
      campaign.name
    );

    setSubject(
      campaign.subject
    );

    setPreviewText(
      campaign.preview_text ||
        ''
    );

    setContactTypeFilter(
      campaign
        .audience_filter
        ?.contact_type ||
        'all'
    );

    setLifecycleFilter(
      campaign
        .audience_filter
        ?.lifecycle_stage ||
        'all'
    );

    setCompanyFilter(
      campaign
        .audience_filter
        ?.company ||
        'all'
    );

    setPhotoCount(
      Number(
        campaign
          .design_settings
          ?.photo_count ||
          6
      )
    );

    setError(null);

    setNotice(
      `Editing campaign: ${campaign.name}`
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveDraft(
    silent = false
  ): Promise<
    string | null
  > {
    if (
      !profile?.org_id
    ) {
      setError(
        'Your CRM profile is missing an organization.'
      );

      return null;
    }

    if (!selectedListing) {
      setError(
        'Choose a listing.'
      );

      return null;
    }

    if (
      !campaignName.trim()
    ) {
      setError(
        'Enter a campaign name.'
      );

      return null;
    }

    if (!subject.trim()) {
      setError(
        'Enter an email subject.'
      );

      return null;
    }

    if (!previewHtml) {
      setError(
        'The email preview could not be created.'
      );

      return null;
    }

    try {
      setSaving(true);
      setError(null);

      if (!silent) {
        setNotice(null);
      }

      const payload = {
        org_id:
          profile.org_id,

        owner_user_id:
          profile.id,

        listing_id:
          selectedListing.id,

        campaign_type:
          campaignType,

        name:
          campaignName.trim(),

        subject:
          subject.trim(),

        preview_text:
          previewText.trim() ||
          null,

        from_name:
          profile
            .marketing_from_name,

        from_email:
          profile
            .marketing_from_email,

        reply_to_email:
          profile
            .marketing_reply_to_email,

        html_body:
          previewHtml,

        text_body:
          buildTextBody(
            selectedListing,
            headline,
            marketingDescription,
            profile
          ),

        physical_address:
          profile
            .marketing_physical_address,

        status: 'draft',

        total_recipients:
          eligibleContacts.length,

        audience_filter: {
          contact_type:
            contactTypeFilter,

          lifecycle_stage:
            lifecycleFilter,

          company:
            companyFilter,

          eligibility:
            'active_not_suppressed',
        },

        design_settings: {
          photo_count:
            Math.min(
              photoCount,
              photos.length
            ),

          photo_order_source:
            'listing_media_sort_order',

          primary_first: true,
        },
      };

      let savedRow:
        | { id: string }
        | null = null;

      if (
        editingCampaignId
      ) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from(
            'email_campaigns'
          )
          .update(payload)
          .eq(
            'id',
            editingCampaignId
          )
          .select('id')
          .single();

        if (updateError) {
          throw updateError;
        }

        savedRow = data;
      } else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from(
            'email_campaigns'
          )
          .insert(payload)
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        savedRow = data;
      }

      if (!savedRow?.id) {
        throw new Error(
          'Campaign draft was not returned after saving.'
        );
      }

      setEditingCampaignId(
        savedRow.id
      );

      const {
        data: refreshed,
        error: refreshError,
      } = await supabase
        .from(
          'email_campaigns'
        )
        .select(`
          id,
          listing_id,
          campaign_type,
          name,
          subject,
          preview_text,
          status,
          total_recipients,
          audience_filter,
          design_settings,
          test_sent_at,
          created_at,
          updated_at
        `)
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(250);

      if (refreshError) {
        throw refreshError;
      }

      setCampaigns(
        (refreshed ||
          []) as Campaign[]
      );

      if (!silent) {
        setNotice(
          editingCampaignId
            ? 'Campaign draft updated successfully.'
            : 'Campaign draft saved successfully.'
        );
      }

      return savedRow.id;
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not save the campaign draft.'
      );

      return null;
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testReady) {
      setError(
        'Complete the sender, listing-readiness and mailing-address requirements first.'
      );

      return;
    }

    try {
      setSendingTest(true);
      setError(null);
      setNotice(null);

      const campaignId =
        await saveDraft(true);

      if (!campaignId) {
        return;
      }

      const {
        data: sessionResult,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const response =
        await fetch(
          '/api/marketing/email-campaigns/test',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              campaign_id:
                campaignId,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.error ||
            'Test email failed.'
        );
      }

      setNotice(
        `Test email sent to ${result.to}.`
      );

      await loadData();
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not send the test email.'
      );
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading campaigns...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/email-marketing"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Email Marketing
            </Link>

            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
              <Mail className="h-4 w-4" />
              Campaign Builder
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Build and Preview Email Campaigns
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Choose a listing and audience, preview the email,
              save the campaign draft and send a test to yourself.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={
                startNewCampaign
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              New Campaign
            </button>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.35fr)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Campaign Setup
            </h2>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Listing
                </span>

                <select
                  value={
                    selectedListingId
                  }
                  onChange={(event) =>
                    chooseListing(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">
                    Choose a listing
                  </option>

                  {listings.map(
                    (listing) => (
                      <option
                        key={listing.id}
                        value={listing.id}
                      >
                        {listing.title}
                        {' — '}
                        {formatPrice(
                          listing.list_price
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Campaign Type
                </span>

                <select
                  value={campaignType}
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setCampaignType(
                      value
                    );

                    if (
                      selectedListing
                    ) {
                      setCampaignName(
                        `${typeLabel(
                          value
                        )} - ${
                          selectedListing.title
                        }`
                      );
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  {CAMPAIGN_TYPES.map(
                    (item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Internal Campaign Name
                </span>

                <input
                  value={campaignName}
                  onChange={(event) =>
                    setCampaignName(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email Subject
                </span>

                <input
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Inbox Preview Text
                </span>

                <textarea
                  value={previewText}
                  onChange={(event) =>
                    setPreviewText(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />

              <h2 className="text-lg font-semibold text-slate-900">
                Audience
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact Type
                </span>

                <select
                  value={
                    contactTypeFilter
                  }
                  onChange={(event) =>
                    setContactTypeFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="all">
                    All Contact Types
                  </option>

                  <option value="realtor">
                    Realtors
                  </option>

                  <option value="consumer">
                    Consumers
                  </option>

                  <option value="lender">
                    Lenders
                  </option>

                  <option value="builder">
                    Builders
                  </option>

                  <option value="vendor">
                    Vendors
                  </option>

                  <option value="professional">
                    Professionals
                  </option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lifecycle
                </span>

                <select
                  value={
                    lifecycleFilter
                  }
                  onChange={(event) =>
                    setLifecycleFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="all">
                    All Lifecycles
                  </option>

                  <option value="prospect">
                    Prospect
                  </option>

                  <option value="sphere">
                    Sphere
                  </option>

                  <option value="past_client">
                    Past Client
                  </option>

                  <option value="closed_client">
                    Closed Client
                  </option>

                  <option value="referral_partner">
                    Referral Partner
                  </option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company
                </span>

                <select
                  value={
                    companyFilter
                  }
                  onChange={(event) =>
                    setCompanyFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="all">
                    All Companies
                  </option>

                  {companies.map(
                    (company) => (
                      <option
                        key={company}
                        value={company}
                      >
                        {company}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Eligible Recipients
              </div>

              <div className="mt-1 text-3xl font-bold text-slate-900">
                {eligibleContacts.length}
              </div>

              <div className="mt-1 text-xs text-slate-600">
                Active contacts after opt-out, DNC and suppression filtering.
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-orange-600" />

              <h2 className="text-lg font-semibold text-slate-900">
                Email Photos
              </h2>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ordered Marketing Photos
              </span>

              <select
                value={photoCount}
                onChange={(event) =>
                  setPhotoCount(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                {[1, 2, 4, 6, 8, 10, 12].map(
                  (count) => (
                    <option
                      key={count}
                      value={count}
                    >
                      First {count} photo
                      {count === 1
                        ? ''
                        : 's'}
                    </option>
                  )
                )}
              </select>
            </label>

            <div className="mt-3 text-xs text-slate-500">
              {loadingPhotos
                ? 'Loading photos...'
                : `${photos.length} listing photos are currently selected for marketing.`}
            </div>

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photos
                  .slice(
                    0,
                    photoCount
                  )
                  .map(
                    (
                      photo,
                      index
                    ) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        <img
                          src={
                            photo.public_url
                          }
                          alt={
                            photo.caption ||
                            photo.title ||
                            `Photo ${
                              index + 1
                            }`
                          }
                          className="h-full w-full object-cover"
                        />

                        <div className="absolute left-1 top-1 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {index + 1}
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-violet-600" />

                <h2 className="text-lg font-semibold text-slate-900">
                  Live Email Preview
                </h2>
              </div>

              <div className="text-xs text-slate-500">
                Desktop-width preview
              </div>
            </div>

            {previewHtml ? (
              <iframe
                title="Email campaign preview"
                srcDoc={previewHtml}
                className="h-[900px] w-full rounded-2xl border border-slate-200 bg-slate-100"
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">
                Choose a listing to create the preview.
              </div>
            )}
          </section>

          <section
            className={
              testReady
                ? 'rounded-3xl border border-emerald-200 bg-emerald-50 p-5'
                : 'rounded-3xl border border-amber-200 bg-amber-50 p-5'
            }
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Campaign Readiness
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                {
                  label:
                    'Listing campaign-ready',
                  ready:
                    listingReady,
                },
                {
                  label:
                    'Sender identity complete',
                  ready:
                    senderReady,
                },
                {
                  label:
                    'Professional contact footer',
                  ready:
                    professionalFooterReady,
                },
                {
                  label:
                    'Brokerage legal identity',
                  ready:
                    organizationComplianceReady,
                },
                {
                  label:
                    'Business mailing address',
                  ready:
                    physicalAddressReady,
                },
                {
                  label:
                    'Email preview generated',
                  ready:
                    Boolean(
                      previewHtml
                    ),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white bg-white px-3 py-2 text-sm"
                >
                  <span
                    className={
                      item.ready
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-amber-700'
                    }
                  >
                    {item.ready
                      ? 'Ready'
                      : 'Missing'}
                  </span>

                  <span className="ml-2 text-slate-700">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {!selectedReadiness?.has_public_link &&
              selectedListing && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-sm text-amber-800">
                  The selected listing is missing its Public Listing Website URL.
                  Add it through the Listings page before sending.
                </div>
              )}

            {!professionalFooterReady && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-sm text-amber-800">
                Your professional email footer is incomplete. Add your headshot,
                phone, title and brokerage through{' '}
                <Link
                  href="/dashboard/preferences"
                  className="font-bold underline"
                >
                  Preferences
                </Link>.
              </div>
            )}

            {!organizationComplianceReady && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-sm text-amber-800">
                The licensed brokerage identity or privacy-policy URL is incomplete.
                Update the Brokerage and Email Compliance section through{' '}
                <Link
                  href="/dashboard/preferences"
                  className="font-bold underline"
                >
                  Preferences
                </Link>.
              </div>
            )}

            {!physicalAddressReady && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-sm text-amber-800">
                Your commercial-email business mailing address is missing.
                Add it through{' '}
                <Link
                  href="/dashboard/preferences"
                  className="font-bold underline"
                >
                  Preferences
                </Link>.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  saveDraft()
                }
                disabled={
                  saving ||
                  !selectedListing
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {editingCampaignId
                  ? 'Save Draft Changes'
                  : 'Save Campaign Draft'}
              </button>

              <button
                type="button"
                onClick={sendTest}
                disabled={
                  sendingTest ||
                  saving ||
                  !testReady
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}

                Send Test to Myself
              </button>

              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600"
              >
                <Send className="h-4 w-4" />
                Mass Send Locked
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Mass sending remains locked until recipient snapshotting,
              unsubscribe links, tracking and production safeguards are completed.
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Saved Campaign Drafts
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {campaigns.length} campaigns currently visible.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">
                  Campaign
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3">
                  Recipients
                </th>

                <th className="px-4 py-3">
                  Test Sent
                </th>

                <th className="px-4 py-3">
                  Edit
                </th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map(
                (campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {campaign.name}
                      </div>

                      <div className="text-xs text-slate-500">
                        {campaign.subject}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {campaign.status}
                    </td>

                    <td className="px-4 py-3">
                      {campaign.total_recipients}
                    </td>

                    <td className="px-4 py-3">
                      {campaign.test_sent_at
                        ? new Date(
                            campaign.test_sent_at
                          ).toLocaleString()
                        : '-'}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          openCampaign(
                            campaign
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}

              {campaigns.length ===
                0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No campaign drafts have been saved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}




