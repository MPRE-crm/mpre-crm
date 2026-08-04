'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  Loader2,
  Mail,
  Megaphone,
  Monitor,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';

import {
  useParams,
} from 'next/navigation';

import {
  getSupabaseBrowser,
} from '../../../../../../lib/supabase-browser';

import {
  LISTING_EMAIL_EXTERNAL_EVENTS,
  listingEmailEventDefinition,
  type ListingEmailExternalEventKey,
} from '../../../../../../lib/listing-email-events';

import ListingWebsiteEnrichmentPanel from '../../ListingWebsiteEnrichmentPanel';
import ListingEmailStudioPanel from '../../ListingEmailStudioPanel';
import ListingRealtorMatchPanel from '../../ListingRealtorMatchPanel';
import ListingSocialStudioPanel from '../../ListingSocialStudioPanel';
import ListingCanvaMarketingPackagePanel from '../../ListingCanvaMarketingPackagePanel';
import PropertyWebsitePreviewPanel from '../../PropertyWebsitePreviewPanel';

const supabase =
  getSupabaseBrowser();

type TabKey =
  | 'overview'
  | 'photos'
  | 'property_website'
  | 'email'
  | 'social'
  | 'flyer'
  | 'video'
  | 'seller_report';

type SectionKey =
  | 'property_website'
  | 'email'
  | 'social'
  | 'flyer'
  | 'video'
  | 'seller_report';

type ListingRow = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  title: string;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  review_status: string;
  website_status: string | null;
  public_url: string | null;
  mls_number: string | null;
  list_price: number | null;
  listing_status: string;
  unbranded_video_url: string | null;
  campaign_headline: string | null;
  short_marketing_description: string | null;
  public_remarks: string | null;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  acres: number | null;
  garage_spaces: number | null;
  year_built: number | null;
  lot_size_text: string | null;
};

type SectionRow = {
  id: string;
  listing_id: string;
  section_key: SectionKey;
  status: string;
  template_key: string;
  template_locked: boolean;
  content: Record<string, unknown>;
  manual_override: boolean;
  generation_version: number;
  generation_model: string | null;
  prepared_at: string | null;
  approved_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type PhotoRow = {
  id: string;
  public_url: string;
  thumbnail_url: string | null;
  file_name: string;
  title: string | null;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
  use_in_marketing: boolean;
};

type PhotoAssignment = {
  id: string;
  listing_id: string;
  section_key: SectionKey;
  edition_key: string;
  slot_key: string;
  sort_order: number;
  media_id: string;
  selected_by: 'samantha' | 'agent';
  is_locked: boolean;
};

type PhotoPickerTarget = {
  sectionKey: SectionKey;
  slotKey: string;
  sortOrder: number;
  label: string;
};

type ListingEmailEventFormState = {
  event_start_at: string;
  original_price: string;
  video_url: string;
  incentive_summary: string;
  deadline_at: string;
  photo_media_ids: string[];
};

const EMPTY_LISTING_EMAIL_EVENT_DETAILS:
  ListingEmailEventFormState = {
  event_start_at: '',
  original_price: '',
  video_url: '',
  incentive_summary: '',
  deadline_at: '',
  photo_media_ids: [],
};

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: typeof Sparkles;
}> = [
  {
    key: 'overview',
    label: 'Overview',
    icon: Sparkles,
  },
  {
    key: 'photos',
    label: 'Photos',
    icon: Images,
  },
  {
    key: 'property_website',
    label: 'Property Website',
    icon: Monitor,
  },
  {
    key: 'email',
    label: 'Email',
    icon: Mail,
  },
  {
    key: 'social',
    label: 'Social',
    icon: Megaphone,
  },
  {
    key: 'flyer',
    label: 'Flyer',
    icon: FileText,
  },
  {
    key: 'video',
    label: 'Video',
    icon: Play,
  },
  {
    key: 'seller_report',
    label: 'Seller Report',
    icon: BarChart3,
  },
];

const SECTION_DEFINITIONS:
  Record<
    SectionKey,
    {
      title: string;
      description: string;
      templates: Array<{
        key: string;
        name: string;
        description: string;
      }>;
      photoSlots: Array<{
        slotKey: string;
        sortOrder: number;
        label: string;
      }>;
    }
  > = {
  property_website: {
    title:
      'Property Website',

    description:
      'Feature cards, hero image, gallery, descriptions, calls to action, map, nearby destinations and schools.',

    templates: [
      {
        key:
          'luxury_editorial',

        name:
          'Luxury Editorial',

        description:
          'High-end magazine presentation with dramatic photography.',
      },
      {
        key:
          'modern_showcase',

        name:
          'Modern Showcase',

        description:
          'Clean architectural layout with sharp visual hierarchy.',
      },
      {
        key:
          'clean_standard',

        name:
          'Clean Standard',

        description:
          'Professional and familiar presentation for any listing.',
      },
    ],

    photoSlots: [
      {
        slotKey:
          'hero',
        sortOrder:
          0,
        label:
          'Hero Photo',
      },
      {
        slotKey:
          'gallery',
        sortOrder:
          0,
        label:
          'Gallery Photo 1',
      },
      {
        slotKey:
          'gallery',
        sortOrder:
          1,
        label:
          'Gallery Photo 2',
      },
      {
        slotKey:
          'gallery',
        sortOrder:
          2,
        label:
          'Gallery Photo 3',
      },
    ],
  },

  email: {
    title:
      'Email Advertisement',

    description:
      'Subject line, preview text, complete email copy, hero image and supporting photos.',

    templates: [
      {
        key:
          'luxury',
        name:
          'Luxury',
        description:
          'Premium editorial email with navy, cream and gold styling.',
      },
      {
        key:
          'standard',
        name:
          'Standard',
        description:
          'Clean professional email with familiar blue accents.',
      },
      {
        key:
          'modern',
        name:
          'Modern / Minimal',
        description:
          'Minimal black-and-white presentation with strong spacing.',
      },
      {
        key:
          'realtor_blast',
        name:
          'Realtor Blast',
        description:
          'High-impact agent-to-agent property announcement.',
      },
    ],

    photoSlots: [
      {
        slotKey:
          'hero',
        sortOrder:
          0,
        label:
          'Main Email Photo',
      },
      {
        slotKey:
          'supporting',
        sortOrder:
          0,
        label:
          'Supporting Photo 1',
      },
      {
        slotKey:
          'supporting',
        sortOrder:
          1,
        label:
          'Supporting Photo 2',
      },
      {
        slotKey:
          'supporting',
        sortOrder:
          2,
        label:
          'Supporting Photo 3',
      },
      {
        slotKey:
          'supporting',
        sortOrder:
          3,
        label:
          'Supporting Photo 4',
      },
      {
        slotKey:
          'supporting',
        sortOrder:
          4,
        label:
          'Supporting Photo 5',
      },
    ],
  },

  social: {
    title:
      'Social Media',

    description:
      'Manual Instagram, Facebook, LinkedIn and X creative previews, captions and PNG exports.',

    templates: [
      {
        key:
          'single_photo',
        name:
          'Single Photo',
        description:
          'One strong property image with concise listing copy.',
      },
      {
        key:
          'carousel',
        name:
          'Photo Carousel',
        description:
          'A multi-photo property story designed for swiping.',
      },
      {
        key:
          'story_reel',
        name:
          'Story / Reel',
        description:
          'Vertical short-form presentation and cover image.',
      },
    ],

    photoSlots: [
      {
        slotKey:
          'primary',
        sortOrder:
          0,
        label:
          'Main Social Photo',
      },
      {
        slotKey:
          'carousel',
        sortOrder:
          0,
        label:
          'Carousel Photo 1',
      },
      {
        slotKey:
          'carousel',
        sortOrder:
          1,
        label:
          'Carousel Photo 2',
      },
      {
        slotKey:
          'carousel',
        sortOrder:
          2,
        label:
          'Carousel Photo 3',
      },
      {
        slotKey:
          'carousel',
        sortOrder:
          3,
        label:
          'Carousel Photo 4',
      },
    ],
  },

  flyer: {
    title:
      'Flyer',

    description:
      'Choose a single- or double-sided Flyer, select photos and wording, then finish the design in Canva.',

    templates: [
      {
        key:
          'luxury_brochure',
        name:
          'Luxury Brochure',
        description:
          'Editorial cover and premium feature presentation.',
      },
      {
        key:
          'modern_grid',
        name:
          'Modern Photo Grid',
        description:
          'Strong photography arranged in a clean modern grid.',
      },
      {
        key:
          'clean_one_page',
        name:
          'Clean One-Page',
        description:
          'Simple, professional and easy to print or share.',
      },
    ],

    photoSlots: [
      {
        slotKey:
          'cover',
        sortOrder:
          0,
        label:
          'Flyer Cover',
      },
      {
        slotKey:
          'interior',
        sortOrder:
          0,
        label:
          'Interior Photo 1',
      },
      {
        slotKey:
          'interior',
        sortOrder:
          1,
        label:
          'Interior Photo 2',
      },
      {
        slotKey:
          'interior',
        sortOrder:
          2,
        label:
          'Interior Photo 3',
      },
    ],
  },

  video: {
    title:
      'Video Scripts & Captions',

    description:
      'Short-form hooks, 30-, 60- and 90-second scripts, captions and visual sequence.',

    templates: [
      {
        key:
          'reel_30',
        name:
          '30-Second Reel',
        description:
          'Fast hook and concise property walkthrough.',
      },
      {
        key:
          'tour_60',
        name:
          '60-Second Tour',
        description:
          'Balanced property story with room for key features.',
      },
      {
        key:
          'youtube_90',
        name:
          '90-Second YouTube',
        description:
          'Longer narrative with opening, property tour and close.',
      },
    ],

    photoSlots: [
      {
        slotKey:
          'cover',
        sortOrder:
          0,
        label:
          'Video Cover',
      },
      {
        slotKey:
          'scene',
        sortOrder:
          0,
        label:
          'Scene 1',
      },
      {
        slotKey:
          'scene',
        sortOrder:
          1,
        label:
          'Scene 2',
      },
      {
        slotKey:
          'scene',
        sortOrder:
          2,
        label:
          'Scene 3',
      },
      {
        slotKey:
          'scene',
        sortOrder:
          3,
        label:
          'Scene 4',
      },
    ],
  },

  seller_report: {
    title:
      'Future Seller Report',

    description:
      'Reusable introduction, report structure and approved listing imagery for future activity reporting.',

    templates: [
      {
        key:
          'visual_snapshot',
        name:
          'Visual Snapshot',
        description:
          'Quick visual overview of listing activity and marketing.',
      },
      {
        key:
          'detailed_weekly',
        name:
          'Detailed Weekly',
        description:
          'Expanded seller update with campaign and engagement detail.',
      },
      {
        key:
          'executive_summary',
        name:
          'Executive Summary',
        description:
          'Concise strategic summary focused on decisions and next steps.',
      },
    ],

    photoSlots: [
      {
        slotKey:
          'cover',
        sortOrder:
          0,
        label:
          'Report Cover',
      },
      {
        slotKey:
          'supporting',
        sortOrder:
          0,
        label:
          'Supporting Photo',
      },
    ],
  },
};

function defaultTemplate(
  sectionKey: SectionKey
) {
  return SECTION_DEFINITIONS[
    sectionKey
  ].templates[0].key;
}

function statusLabel(
  status:
    | string
    | null
    | undefined
) {
  switch (status) {
    case 'preparing':
      return 'Preparing';

    case 'needs_review':
      return 'Needs Review';

    case 'approved':
      return 'Approved';

    case 'needs_refresh':
      return 'Needs Refresh';

    case 'failed':
      return 'Failed';

    default:
      return 'Not Prepared';
  }
}

function statusClasses(
  status:
    | string
    | null
    | undefined
) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700';

    case 'needs_review':
      return 'bg-amber-100 text-amber-800';

    case 'preparing':
      return 'bg-blue-100 text-blue-700';

    case 'needs_refresh':
      return 'bg-orange-100 text-orange-700';

    case 'failed':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function fieldLabel(
  key: string
) {
  return key
    .replace(
      /_/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

export default function MarketingStudioPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const listingId =
    typeof params?.id ===
    'string'
      ? params.id
      : '';

  const [
    activeTab,
    setActiveTab,
  ] = useState<TabKey>(
    'overview'
  );

  const [loading, setLoading] =
    useState(true);

  const [
    preparing,
    setPreparing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [listing, setListing] =
    useState<ListingRow | null>(
      null
    );

  const [sections, setSections] =
    useState<SectionRow[]>([]);

  const [photos, setPhotos] =
    useState<PhotoRow[]>([]);

  const [
    assignments,
    setAssignments,
  ] = useState<
    PhotoAssignment[]
  >([]);

  const [
    hasManualHighlights,
    setHasManualHighlights,
  ] = useState(false);

  const [
    emailEventType,
    setEmailEventType,
  ] = useState<
    ListingEmailExternalEventKey
  >('new_listing');

  const [
    emailEventDetails,
    setEmailEventDetails,
  ] = useState<
    ListingEmailEventFormState
  >(() => ({
    ...EMPTY_LISTING_EMAIL_EVENT_DETAILS,
    photo_media_ids: [],
  }));

  const [
    photoPickerTarget,
    setPhotoPickerTarget,
  ] = useState<
    PhotoPickerTarget | null
  >(null);

  const sectionMap =
    useMemo(
      () =>
        new Map(
          sections.map(
            (section) => [
              section.section_key,
              section,
            ]
          )
        ),
      [sections]
    );

  const photoMap =
    useMemo(
      () =>
        new Map(
          photos.map(
            (photo) => [
              photo.id,
              photo,
            ]
          )
        ),
      [photos]
    );

  const marketingPhotos =
    useMemo(
      () =>
        photos.filter(
          (photo) =>
            photo.use_in_marketing
        ),
      [photos]
    );

  const selectedEmailEventDefinition =
    listingEmailEventDefinition(
      emailEventType
    );

  const loadStudio =
    useCallback(async () => {
      if (!listingId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const {
          data: userResult,
          error: userError,
        } = await supabase
          .auth
          .getUser();

        if (
          userError ||
          !userResult.user
        ) {
          throw new Error(
            userError?.message ||
              'Your CRM session expired.'
          );
        }

        const {
          data: listingData,
          error: listingError,
        } = await supabase
          .from('listings')
          .select(`
            id,
            org_id,
            owner_user_id,
            title,
            property_address,
            city,
            state,
            zip,
            review_status,
            website_status,
            public_url,
            mls_number,
            list_price,
            listing_status,
            unbranded_video_url,
            campaign_headline,
            short_marketing_description,
            public_remarks,
            description,
            bedrooms,
            bathrooms,
            square_feet,
            acres,
            garage_spaces,
            year_built,
            lot_size_text
          `)
          .eq(
            'id',
            listingId
          )
          .single();

        if (
          listingError ||
          !listingData
        ) {
          throw new Error(
            listingError?.message ||
              'Listing not found.'
          );
        }

        const loadedListing =
          listingData as ListingRow;

        if (
          !loadedListing
            .owner_user_id
        ) {
          throw new Error(
            'Assign a listing owner before using Marketing Studio.'
          );
        }

        const [
          sectionResult,
          photoResult,
          assignmentResult,
          highlightResult,
        ] = await Promise.all([
          supabase
            .from(
              'listing_marketing_sections'
            )
            .select(`
              id,
              listing_id,
              section_key,
              status,
              template_key,
              template_locked,
              content,
              manual_override,
              generation_version,
              generation_model,
              prepared_at,
              approved_at,
              last_error,
              updated_at
            `)
            .eq(
              'listing_id',
              listingId
            ),

          supabase
            .from(
              'listing_media'
            )
            .select(`
              id,
              public_url,
              thumbnail_url,
              file_name,
              title,
              caption,
              sort_order,
              is_primary,
              use_in_marketing
            `)
            .eq(
              'listing_id',
              listingId
            )
            .eq(
              'media_type',
              'photo'
            )
            .order(
              'sort_order',
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from(
              'listing_marketing_photo_assignments'
            )
            .select(`
              id,
              listing_id,
              section_key,
              edition_key,
              slot_key,
              sort_order,
              media_id,
              selected_by,
              is_locked
            `)
            .eq(
              'listing_id',
              listingId
            )
            .order(
              'sort_order',
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from(
              'listing_website_highlights'
            )
            .select(
              'id, manual_override'
            )
            .eq(
              'listing_id',
              listingId
            ),
        ]);

        if (sectionResult.error) {
          throw sectionResult.error;
        }

        if (photoResult.error) {
          throw photoResult.error;
        }

        if (
          assignmentResult.error
        ) {
          throw assignmentResult.error;
        }

        if (
          highlightResult.error
        ) {
          throw highlightResult.error;
        }

        const loadedSections =
          (
            sectionResult.data ||
            []
          ) as SectionRow[];

        const existingKeys =
          new Set(
            loadedSections.map(
              (section) =>
                section.section_key
            )
          );

        const sectionKeys =
          Object.keys(
            SECTION_DEFINITIONS
          ) as SectionKey[];

        const missingKeys =
          sectionKeys.filter(
            (sectionKey) =>
              !existingKeys.has(
                sectionKey
              )
          );

        if (
          missingKeys.length >
          0
        ) {
          const {
            error: insertError,
          } = await supabase
            .from(
              'listing_marketing_sections'
            )
            .upsert(
              missingKeys.map(
                (sectionKey) => ({
                  listing_id:
                    loadedListing.id,

                  org_id:
                    loadedListing.org_id,

                  owner_user_id:
                    loadedListing
                      .owner_user_id,

                  section_key:
                    sectionKey,

                  status:
                    'not_prepared',

                  template_key:
                    defaultTemplate(
                      sectionKey
                    ),

                  created_by:
                    userResult.user.id,

                  updated_by:
                    userResult.user.id,
                })
              ),
              {
                onConflict:
                  'listing_id,section_key',

                ignoreDuplicates:
                  true,
              }
            );

          if (insertError) {
            throw insertError;
          }

          const {
            data:
              refreshedSections,
            error:
              refreshedError,
          } = await supabase
            .from(
              'listing_marketing_sections'
            )
            .select(`
              id,
              listing_id,
              section_key,
              status,
              template_key,
              template_locked,
              content,
              manual_override,
              generation_version,
              generation_model,
              prepared_at,
              approved_at,
              last_error,
              updated_at
            `)
            .eq(
              'listing_id',
              listingId
            );

          if (refreshedError) {
            throw refreshedError;
          }

          setSections(
            (
              refreshedSections ||
              []
            ) as SectionRow[]
          );
        } else {
          setSections(
            loadedSections
          );
        }

        setListing(
          loadedListing
        );

        setPhotos(
          (
            photoResult.data ||
            []
          ) as PhotoRow[]
        );

        setAssignments(
          (
            assignmentResult.data ||
            []
          ) as PhotoAssignment[]
        );

        setHasManualHighlights(
          (
            highlightResult.data ||
            []
          ).some(
            (highlight: any) =>
              Boolean(
                highlight
                  .manual_override
              )
          )
        );
      } catch (loadError: any) {
        setError(
          loadError?.message ||
            'Could not load Marketing Studio.'
        );
      } finally {
        setLoading(false);
      }
    }, [listingId]);

  useEffect(() => {
    void loadStudio();
  }, [loadStudio]);

  useEffect(() => {
    const emailSection =
      sections.find(
        (section) =>
          section.section_key ===
          'email'
      ) || null;

    const contentValue =
      emailSection?.content;

    const contentRecord =
      contentValue &&
      typeof contentValue === 'object' &&
      !Array.isArray(
        contentValue
      )
        ? contentValue as
            Record<string, unknown>
        : {};

    const storedEventType =
      typeof contentRecord
        .event_type ===
        'string'
        ? contentRecord
            .event_type
            .trim()
        : '';

    const resolvedEventType:
      ListingEmailExternalEventKey =
      LISTING_EMAIL_EXTERNAL_EVENTS
        .some(
          (definition) =>
            definition.value ===
              storedEventType
        )
        ? storedEventType as
            ListingEmailExternalEventKey
        : 'new_listing';

    const detailsValue =
      contentRecord
        .event_details;

    const detailsRecord =
      detailsValue &&
      typeof detailsValue === 'object' &&
      !Array.isArray(
        detailsValue
      )
        ? detailsValue as
            Record<string, unknown>
        : {};

    function stringValue(
      value: unknown
    ) {
      if (
        typeof value ===
        'string'
      ) {
        return value;
      }

      if (
        typeof value ===
        'number' &&
        Number.isFinite(value)
      ) {
        return String(value);
      }

      return '';
    }

    function dateTimeLocalValue(
      value: unknown
    ) {
      const cleaned =
        stringValue(value)
          .trim();

      if (!cleaned) {
        return '';
      }

      const parsed =
        new Date(cleaned);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return cleaned.slice(
          0,
          16
        );
      }

      const localDate =
        new Date(
          parsed.getTime() -
            parsed
              .getTimezoneOffset() *
              60_000
        );

      return localDate
        .toISOString()
        .slice(
          0,
          16
        );
    }

    const storedPhotoIds =
      Array.isArray(
        detailsRecord
          .photo_media_ids
      )
        ? detailsRecord
            .photo_media_ids
            .filter(
              (
                photoId
              ): photoId is string =>
                typeof photoId ===
                  'string' &&
                marketingPhotos.some(
                  (photo) =>
                    photo.id ===
                      photoId
                )
            )
        : [];

    const storedVideoUrl =
      stringValue(
        detailsRecord
          .video_url
      ).trim();

    setEmailEventType(
      resolvedEventType
    );

    setEmailEventDetails({
      event_start_at:
        dateTimeLocalValue(
          detailsRecord
            .event_start_at
        ),

      original_price:
        stringValue(
          detailsRecord
            .original_price
        ),

      video_url:
        storedVideoUrl ||
        (
          resolvedEventType ===
            'new_video' ||
          resolvedEventType ===
            'virtual_tour'
            ? listing
                ?.unbranded_video_url ||
              ''
            : ''
        ),

      incentive_summary:
        stringValue(
          detailsRecord
            .incentive_summary
        ),

      deadline_at:
        dateTimeLocalValue(
          detailsRecord
            .deadline_at
        ),

      photo_media_ids:
        storedPhotoIds,
    });
  }, [
    sections,
    listing,
    marketingPhotos,
  ]);

  async function prepareCompletePackage() {
    if (!listing) {
      return;
    }

    if (
      listing.review_status !==
      'confirmed'
    ) {
      setError(
        'Review and confirm the listing facts before Samantha prepares the marketing package.'
      );

      return;
    }

    const requiredEventDetails =
      selectedEmailEventDefinition
        .requiredDetails;

    const packageEventDetails:
      Record<string, unknown> =
      {};

    if (
      requiredEventDetails.includes(
        'event_start_at'
      )
    ) {
      const eventStartAt =
        emailEventDetails
          .event_start_at
          .trim();

      if (!eventStartAt) {
        setError(
          'Enter the verified event date and start time.'
        );

        return;
      }

      packageEventDetails
        .event_start_at =
        eventStartAt;
    }

    if (
      emailEventType ===
        'price_improvement'
    ) {
      const originalPrice =
        Number(
          emailEventDetails
            .original_price
            .replace(
              /[$,\s]/g,
              ''
            )
        );

      if (
        !Number.isFinite(
          originalPrice
        ) ||
        originalPrice <= 0
      ) {
        setError(
          'Enter the verified original listing price.'
        );

        return;
      }

      if (
        listing.list_price ===
          null ||
        !Number.isFinite(
          listing.list_price
        ) ||
        listing.list_price <= 0
      ) {
        setError(
          'Confirm the current listing price before preparing a Price Improvement package.'
        );

        return;
      }

      if (
        originalPrice <=
          listing.list_price
      ) {
        setError(
          'The original price must be higher than the current listing price.'
        );

        return;
      }

      packageEventDetails
        .original_price =
        originalPrice;

      packageEventDetails
        .new_price =
        listing.list_price;
    }

    if (
      requiredEventDetails.includes(
        'video_url'
      )
    ) {
      const videoUrl =
        emailEventDetails
          .video_url
          .trim();

      if (!videoUrl) {
        setError(
          'Enter the verified property video or virtual-tour URL.'
        );

        return;
      }

      packageEventDetails
        .video_url =
        videoUrl;
    }

    if (
      requiredEventDetails.includes(
        'incentive_summary'
      )
    ) {
      const incentiveSummary =
        emailEventDetails
          .incentive_summary
          .trim();

      if (!incentiveSummary) {
        setError(
          'Enter the verified incentive or rate-buydown terms.'
        );

        return;
      }

      packageEventDetails
        .incentive_summary =
        incentiveSummary;
    }

    if (
      requiredEventDetails.includes(
        'deadline_at'
      )
    ) {
      const deadlineAt =
        emailEventDetails
          .deadline_at
          .trim();

      if (!deadlineAt) {
        setError(
          'Enter the verified deadline date and time.'
        );

        return;
      }

      packageEventDetails
        .deadline_at =
        deadlineAt;
    }

    if (
      requiredEventDetails.includes(
        'photo_media_ids'
      )
    ) {
      if (
        emailEventDetails
          .photo_media_ids
          .length === 0
      ) {
        setError(
          'Choose at least one newly added listing photo.'
        );

        return;
      }

      packageEventDetails
        .photo_media_ids =
        [
          ...emailEventDetails
            .photo_media_ids,
        ];
    }

    try {
      setPreparing(true);
      setError(null);
      setNotice(null);

      const {
        data: sessionResult,
        error: sessionError,
      } = await supabase
        .auth
        .getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const headers = {
        Authorization:
          `Bearer ${sessionResult.session.access_token}`,

        'Content-Type':
          'application/json',
      };

      if (!hasManualHighlights) {
        const websiteResponse =
          await fetch(
            '/api/marketing/listing-websites/research',
            {
              method:
                'POST',

              headers,

              body:
                JSON.stringify({
                  listing_id:
                    listing.id,
                }),
            }
          );

        const websiteResult =
          await websiteResponse
            .json()
            .catch(
              () => ({})
            );

        if (
          !websiteResponse.ok ||
          !websiteResult?.ok
        ) {
          throw new Error(
            websiteResult?.error ||
              'Samantha could not prepare the property highlights.'
          );
        }
      }

      const packageResponse =
        await fetch(
          '/api/marketing/listing-marketing-package/prepare',
          {
            method:
              'POST',

            headers,

            body:
              JSON.stringify({
                listing_id:
                  listing.id,

                event_type:
                  emailEventType,

                event_details:
                  packageEventDetails,
              }),
          }
        );

      const packageResult =
        await packageResponse
          .json()
          .catch(
            () => ({})
          );

      if (
        !packageResponse.ok ||
        !packageResult?.ok
      ) {
        throw new Error(
          packageResult?.error ||
            'Samantha could not prepare the complete marketing package.'
        );
      }

      setNotice(
        packageResult.message ||
          'Samantha prepared the complete marketing package.'
      );

      await loadStudio();
    } catch (prepareError: any) {
      setError(
        prepareError?.message ||
          'Samantha could not prepare the complete marketing package.'
      );
    } finally {
      setPreparing(false);
    }
  }

  async function chooseTemplate(
    sectionKey: SectionKey,
    templateKey: string
  ) {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const {
        data: userResult,
        error: userError,
      } = await supabase
        .auth
        .getUser();

      if (
        userError ||
        !userResult.user
      ) {
        throw new Error(
          userError?.message ||
            'Your CRM session expired.'
        );
      }

      const {
        error: updateError,
      } = await supabase
        .from(
          'listing_marketing_sections'
        )
        .update({
          template_key:
            templateKey,

          template_locked:
            true,

          status:
            'needs_review',

          approved_at:
            null,

          approved_by:
            null,

          updated_by:
            userResult.user.id,
        })
        .eq(
          'listing_id',
          listingId
        )
        .eq(
          'section_key',
          sectionKey
        );

      if (updateError) {
        throw updateError;
      }

      setNotice(
        'Template updated. Samantha will keep this choice during regeneration.'
      );

      await loadStudio();
    } catch (templateError: any) {
      setError(
        templateError?.message ||
          'Could not update the template.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function selectPhoto(
    photo: PhotoRow
  ) {
    if (
      !photoPickerTarget ||
      !listing
    ) {
      return;
    }

    if (
      photoPickerTarget
        .sectionKey ===
      'email'
    ) {
      setError(
        'Email photos must be changed inside the active Email edition.'
      );

      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const {
        data: userResult,
        error: userError,
      } = await supabase
        .auth
        .getUser();

      if (
        userError ||
        !userResult.user
      ) {
        throw new Error(
          userError?.message ||
            'Your CRM session expired.'
        );
      }

      const {
        error: assignmentError,
      } = await supabase
        .from(
          'listing_marketing_photo_assignments'
        )
        .upsert(
          {
            listing_id:
              listing.id,

            org_id:
              listing.org_id,

            owner_user_id:
              listing.owner_user_id,

            section_key:
              photoPickerTarget
                .sectionKey,

            edition_key:
              'shared',

            slot_key:
              photoPickerTarget
                .slotKey,

            sort_order:
              photoPickerTarget
                .sortOrder,

            media_id:
              photo.id,

            selected_by:
              'agent',

            is_locked:
              true,

            created_by:
              userResult.user.id,

            updated_by:
              userResult.user.id,
          },
          {
            onConflict:
              'listing_id,section_key,edition_key,slot_key,sort_order',
          }
        );

      if (assignmentError) {
        throw assignmentError;
      }

      const {
        error: sectionError,
      } = await supabase
        .from(
          'listing_marketing_sections'
        )
        .update({
          status:
            'needs_review',

          approved_at:
            null,

          approved_by:
            null,

          updated_by:
            userResult.user.id,
        })
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'section_key',
          photoPickerTarget
            .sectionKey
        );

      if (sectionError) {
        throw sectionError;
      }

      setPhotoPickerTarget(null);

      setNotice(
        'Photo updated and locked. Samantha will not replace your choice.'
      );

      await loadStudio();
    } catch (photoError: any) {
      setError(
        photoError?.message ||
          'Could not save the photo selection.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveSection(
    sectionKey: SectionKey
  ) {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const {
        data: userResult,
        error: userError,
      } = await supabase
        .auth
        .getUser();

      if (
        userError ||
        !userResult.user
      ) {
        throw new Error(
          userError?.message ||
            'Your CRM session expired.'
        );
      }

      const approvedAt =
        new Date()
          .toISOString();

      const {
        error: approvalError,
      } = await supabase
        .from(
          'listing_marketing_sections'
        )
        .update({
          status:
            'approved',

          approved_at:
            approvedAt,

          approved_by:
            userResult.user.id,

          updated_by:
            userResult.user.id,
        })
        .eq(
          'listing_id',
          listingId
        )
        .eq(
          'section_key',
          sectionKey
        );

      if (approvalError) {
        throw approvalError;
      }

      setNotice(
        `${SECTION_DEFINITIONS[sectionKey].title} approved.`
      );

      await loadStudio();
    } catch (approvalError: any) {
      setError(
        approvalError?.message ||
          'Could not approve this section.'
      );
    } finally {
      setSaving(false);
    }
  }

  function assignmentFor(
    sectionKey: SectionKey,
    slotKey: string,
    sortOrder: number
  ) {
    return (
      assignments.find(
        (assignment) =>
          assignment
            .section_key ===
            sectionKey &&
          assignment.slot_key ===
            slotKey &&
          assignment.sort_order ===
            sortOrder
      ) || null
    );
  }

  function openSection(
    sectionKey: SectionKey
  ) {
    setActiveTab(
      sectionKey
    );
  }

  function renderContent(
    section:
      | SectionRow
      | null
  ) {
    if (
      !section ||
      !section.content ||
      Object.keys(
        section.content
      ).length === 0
    ) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-violet-500" />

          <div className="mt-3 font-semibold text-slate-800">
            Samantha has not prepared this section yet.
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Use Prepare Complete Marketing Package at the top.
          </div>
        </div>
      );
    }

    const entries =
      Object.entries(
        section.content
      ).filter(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          value !== '' &&
          value !== 'not_started'
      );

    return (
      <div className="grid gap-3">
        {entries.map(
          ([key, value]) => (
            <div
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {fieldLabel(key)}
              </div>

              {Array.isArray(
                value
              ) ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                  {value.map(
                    (
                      item,
                      index
                    ) => (
                      <li
                        key={
                          index
                        }
                      >
                        {String(
                          item
                        )}
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {String(value)}
                </div>
              )}
            </div>
          )
        )}
      </div>
    );
  }

  function renderPhotoSlots(
    sectionKey: SectionKey
  ) {
    if (
      sectionKey ===
      'email'
    ) {
      return null;
    }

    const definition =
      SECTION_DEFINITIONS[
        sectionKey
      ];

    return (
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {definition.photoSlots.map(
          (slot) => {
            const assignment =
              assignmentFor(
                sectionKey,
                slot.slotKey,
                slot.sortOrder
              );

            const photo =
              assignment
                ? photoMap.get(
                    assignment.media_id
                  ) || null
                : null;

            return (
              <div
                key={`${slot.slotKey}-${slot.sortOrder}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="aspect-[4/3] bg-slate-100">
                  {photo ? (
                    <img
                      src={
                        photo.thumbnail_url ||
                        photo.public_url
                      }
                      alt={
                        photo.title ||
                        photo.caption ||
                        slot.label
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                      No photo selected
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <div className="font-semibold text-slate-900">
                    {slot.label}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {assignment
                      ?.is_locked
                      ? 'Agent choice locked'
                      : assignment
                      ? 'Samantha recommended'
                      : 'Choose a photo'}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPhotoPickerTarget({
                        sectionKey,
                        slotKey:
                          slot.slotKey,
                        sortOrder:
                          slot.sortOrder,
                        label:
                          slot.label,
                      })
                    }
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />

                    {photo
                      ? 'Change Photo'
                      : 'Choose Photo'}
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>
    );
  }

  function renderSection(
    sectionKey: SectionKey
  ) {
    const definition =
      SECTION_DEFINITIONS[
        sectionKey
      ];

    const section =
      sectionMap.get(
        sectionKey
      ) || null;

    return (
      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                {definition.title}
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                {definition.description}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses(
                section?.status
              )}`}
            >
              {statusLabel(
                section?.status
              )}
            </span>
          </div>
        </section>

        {sectionKey !==
          'social' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-violet-700" />

            <h3 className="font-bold text-slate-950">
              Choose a Layout
            </h3>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {definition.templates.map(
              (template) => {
                const selected =
                  section
                    ?.template_key ===
                  template.key;

                return (
                  <button
                    key={
                      template.key
                    }
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void chooseTemplate(
                        sectionKey,
                        template.key
                      )
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-slate-900">
                        {template.name}
                      </div>

                      {selected && (
                        <Check className="h-5 w-5 text-violet-700" />
                      )}
                    </div>

                    <div className="mt-2 text-sm leading-5 text-slate-600">
                      {template.description}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-950">
                Photos for This Section
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Samantha recommends photos. Click Change Photo to make and lock your own choice.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {renderPhotoSlots(
              sectionKey
            )}
          </div>
        </section>

        {sectionKey ===
          'property_website' && (
          <ListingWebsiteEnrichmentPanel
            listingId={
              listingId
            }
            listingTitle={
              listing?.title ||
              'Listing'
            }
            listingReviewStatus={
              listing
                ?.review_status ||
              ''
            }
            initiallyExpanded={
              false
            }
            reviewMode="full_review"
          />
        )}

        {sectionKey ===
          'email' &&
        listing ? (
          <>
            <ListingRealtorMatchPanel
              listingId={
                listing.id
              }
              listingTitle={
                listing.title
              }
            />

            <ListingEmailStudioPanel
              listing={
                listing
              }
              section={
                section
              }
              photos={
                photos
              }
              assignments={
                assignments
              }
              onRefresh={
                loadStudio
              }
            />
          </>
        ) : sectionKey ===
            'social' &&
          listing ? (
          <ListingSocialStudioPanel
            listing={
              listing
            }
            section={
              section
            }
            photos={
              photos
            }
            assignments={
              assignments
            }
            saving={
              saving
            }
            onApprove={() =>
              approveSection(
                'social'
              )
            }
          />
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">
                  Samantha's Draft
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Review the finished wording. Detailed editing controls come next.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  saving ||
                  !section ||
                  section.status ===
                    'not_prepared'
                }
                onClick={() =>
                  void approveSection(
                    sectionKey
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />

                {section?.status ===
                'approved'
                  ? 'Approved'
                  : 'Approve This Section'}
              </button>
            </div>

            <div className="mt-4">
              {renderContent(
                section
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />

          Loading Marketing Studio...
        </div>
      </div>
    );
  }

  if (
    error &&
    !listing
  ) {
    return (
      <div className="space-y-4">
        <a
          href="/dashboard/email-marketing/listings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />

          Back to Listings
        </a>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  const fullAddress = [
    listing.property_address,
    listing.city,
    listing.state,
    listing.zip,
  ]
    .filter(Boolean)
    .join(', ');

  const approvedCount =
    sections.filter(
      (section) =>
        section.status ===
        'approved'
    ).length;

  const attentionCount =
    sections.filter(
      (section) =>
        [
          'needs_review',
          'needs_refresh',
          'failed',
        ].includes(
          section.status
        )
    ).length;

  return (
    <div className="space-y-5 pb-24">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-blue-50 p-6 shadow-sm">
        <a
          href="/dashboard/email-marketing/listings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />

          Back to Listings
        </a>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
              <Sparkles className="h-4 w-4" />

              Marketing Studio
            </div>

            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {listing.title}
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              {fullAddress}
            </p>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Samantha prepares the complete package. Review the finished sections, change only what you dislike, then approve.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {listing.public_url && (
              <a
                href={
                  listing.public_url
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                View Current Website

                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <button
              type="button"
              onClick={() =>
                void loadStudio()
              }
              disabled={
                loading ||
                preparing
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />

              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                void prepareCompletePackage()
              }
              disabled={
                preparing ||
                marketingPhotos.length ===
                  0
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preparing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}

              {preparing
                ? 'Samantha Is Preparing Everything...'
                : 'Prepare Complete Marketing Package'}
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-wide text-violet-700">
              Listing Marketing Event
            </div>

            <h2 className="mt-1 text-lg font-bold text-slate-950">
              Tell Samantha what changed
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Choose the verified listing event before preparing the marketing package. Samantha will use it for the Email section while preserving approved copy and locked photos.
            </p>
          </div>

          <label className="block w-full xl:max-w-sm">
            <span className="text-sm font-bold text-slate-800">
              Marketing event
            </span>

            <select
              value={emailEventType}
              onChange={(event) => {
                const nextEventType =
                  event.target.value as
                    ListingEmailExternalEventKey;

                setEmailEventType(
                  nextEventType
                );

                if (
                  (
                    nextEventType ===
                      'new_video' ||
                    nextEventType ===
                      'virtual_tour'
                  ) &&
                  !emailEventDetails
                    .video_url
                    .trim() &&
                  listing
                    .unbranded_video_url
                ) {
                  setEmailEventDetails(
                    (current) => ({
                      ...current,
                      video_url:
                        listing
                          .unbranded_video_url ||
                        '',
                    })
                  );
                }

                setError(null);
                setNotice(null);
              }}
              disabled={preparing}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {LISTING_EMAIL_EXTERNAL_EVENTS.map(
                (definition) => (
                  <option
                    key={definition.value}
                    value={definition.value}
                  >
                    {definition.label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-violet-100 bg-white p-4">
          <div className="text-sm font-bold text-slate-900">
            {selectedEmailEventDefinition.label}
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            {selectedEmailEventDefinition.samanthaBrief}
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {selectedEmailEventDefinition
            .requiredDetails
            .includes(
              'event_start_at'
            ) && (
            <label className="block">
              <span className="text-sm font-bold text-slate-800">
                Event date and start time
              </span>

              <input
                type="datetime-local"
                value={emailEventDetails.event_start_at}
                onChange={(event) => {
                  setEmailEventDetails(
                    (current) => ({
                      ...current,
                      event_start_at:
                        event.target.value,
                    })
                  );

                  setError(null);
                  setNotice(null);
                }}
                disabled={preparing}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          )}

          {emailEventType ===
            'price_improvement' && (
            <>
              <label className="block">
                <span className="text-sm font-bold text-slate-800">
                  Original listing price
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={emailEventDetails.original_price}
                  onChange={(event) => {
                    setEmailEventDetails(
                      (current) => ({
                        ...current,
                        original_price:
                          event.target.value,
                      })
                    );

                    setError(null);
                    setNotice(null);
                  }}
                  placeholder="$1,099,900"
                  disabled={preparing}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div>
                <div className="text-sm font-bold text-slate-800">
                  Current verified price
                </div>

                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-bold text-slate-900">
                  {listing.list_price ===
                  null
                    ? 'Current price unavailable'
                    : new Intl.NumberFormat(
                        'en-US',
                        {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits:
                            0,
                        }
                      ).format(
                        listing.list_price
                      )}
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This comes directly from the current listing record and will be used as the new price.
                </p>
              </div>
            </>
          )}

          {selectedEmailEventDefinition
            .requiredDetails
            .includes(
              'video_url'
            ) && (
            <label className="block lg:col-span-2">
              <span className="text-sm font-bold text-slate-800">
                Property video or virtual-tour URL
              </span>

              <input
                type="url"
                value={emailEventDetails.video_url}
                onChange={(event) => {
                  setEmailEventDetails(
                    (current) => ({
                      ...current,
                      video_url:
                        event.target.value,
                    })
                  );

                  setError(null);
                  setNotice(null);
                }}
                placeholder="https://..."
                disabled={preparing}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          )}

          {selectedEmailEventDefinition
            .requiredDetails
            .includes(
              'incentive_summary'
            ) && (
            <label className="block lg:col-span-2">
              <span className="text-sm font-bold text-slate-800">
                Verified incentive terms
              </span>

              <textarea
                value={emailEventDetails.incentive_summary}
                onChange={(event) => {
                  setEmailEventDetails(
                    (current) => ({
                      ...current,
                      incentive_summary:
                        event.target.value,
                    })
                  );

                  setError(null);
                  setNotice(null);
                }}
                maxLength={1000}
                rows={4}
                disabled={preparing}
                placeholder="Enter only the approved seller incentive or rate-buydown terms and any required disclaimer."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <span className="mt-1 block text-right text-xs text-slate-500">
                {emailEventDetails.incentive_summary.length}/1000
              </span>
            </label>
          )}

          {selectedEmailEventDefinition
            .requiredDetails
            .includes(
              'deadline_at'
            ) && (
            <label className="block">
              <span className="text-sm font-bold text-slate-800">
                Deadline date and time
              </span>

              <input
                type="datetime-local"
                value={emailEventDetails.deadline_at}
                onChange={(event) => {
                  setEmailEventDetails(
                    (current) => ({
                      ...current,
                      deadline_at:
                        event.target.value,
                    })
                  );

                  setError(null);
                  setNotice(null);
                }}
                disabled={preparing}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          )}
        </div>

        {selectedEmailEventDefinition
          .requiredDetails
          .includes(
            'photo_media_ids'
          ) && (
          <div className="mt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-800">
                  Newly added listing photos
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Select only the new, approved property photos Samantha should prioritize in this announcement.
                </p>
              </div>

              <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                {emailEventDetails.photo_media_ids.length} selected
              </div>
            </div>

            {marketingPhotos.length ===
            0 ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                No approved marketing photos are currently available for this listing.
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {marketingPhotos.map(
                  (photo) => {
                    const selected =
                      emailEventDetails
                        .photo_media_ids
                        .includes(
                          photo.id
                        );

                    return (
                      <label
                        key={photo.id}
                        className={
                          selected
                            ? 'cursor-pointer overflow-hidden rounded-xl border-2 border-violet-500 bg-violet-50 shadow-sm'
                            : 'cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-violet-300'
                        }
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                          <img
                            src={
                              photo.thumbnail_url ||
                              photo.public_url
                            }
                            alt={
                              photo.title ||
                              photo.file_name
                            }
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="flex items-start gap-3 p-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const nextPhotoIds =
                                event.target.checked
                                  ? [
                                      ...new Set([
                                        ...emailEventDetails
                                          .photo_media_ids,
                                        photo.id,
                                      ]),
                                    ]
                                  : emailEventDetails
                                      .photo_media_ids
                                      .filter(
                                        (photoId) =>
                                          photoId !==
                                            photo.id
                                      );

                              setEmailEventDetails(
                                (current) => ({
                                  ...current,
                                  photo_media_ids:
                                    nextPhotoIds,
                                })
                              );

                              setError(null);
                              setNotice(null);
                            }}
                            disabled={preparing}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                          />

                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">
                              {photo.title ||
                                photo.file_name}
                            </span>

                            {photo.caption && (
                              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                                {photo.caption}
                              </span>
                            )}
                          </span>
                        </div>
                      </label>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}

        {selectedEmailEventDefinition
          .requiredDetails.length ===
          0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            No additional event details are required. Samantha will use the verified listing facts already stored in the CRM.
          </div>
        )}
      </section>

      <nav className="sticky top-0 z-30 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1">
          {TABS.map(
            (tab) => {
              const Icon =
                tab.icon;

              const section =
                tab.key ===
                  'overview' ||
                tab.key ===
                  'photos'
                  ? null
                  : sectionMap.get(
                      tab.key
                    ) || null;

              return (
                <button
                  key={
                    tab.key
                  }
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab.key
                    )
                  }
                  className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    activeTab ===
                    tab.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />

                  {tab.label}

                  {section && (
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        section.status ===
                        'approved'
                          ? 'bg-emerald-500'
                          : section.status ===
                            'needs_review'
                          ? 'bg-amber-500'
                          : section.status ===
                            'failed'
                          ? 'bg-red-500'
                          : 'bg-slate-300'
                      }`}
                    />
                  )}
                </button>
              );
            }
          )}
        </div>
      </nav>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {activeTab ===
        'overview' && (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-3xl font-bold text-slate-950">
                {approvedCount}
                /6
              </div>

              <div className="mt-1 text-sm text-slate-600">
                Sections approved
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-3xl font-bold text-amber-700">
                {attentionCount}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                Need your attention
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-3xl font-bold text-blue-700">
                {marketingPhotos.length}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                Marketing photos
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              Your Marketing Package
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Open only the section you need. Everything else stays organized here.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(
                Object.keys(
                  SECTION_DEFINITIONS
                ) as SectionKey[]
              ).map(
                (sectionKey) => {
                  const definition =
                    SECTION_DEFINITIONS[
                      sectionKey
                    ];

                  const section =
                    sectionMap.get(
                      sectionKey
                    ) || null;

                  return (
                    <button
                      key={
                        sectionKey
                      }
                      type="button"
                      onClick={() =>
                        openSection(
                          sectionKey
                        )
                      }
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-bold text-slate-900">
                          {definition.title}
                        </div>

                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>

                      <div className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">
                        {definition.description}
                      </div>

                      <span
                        className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                          section?.status
                        )}`}
                      >
                        {statusLabel(
                          section?.status
                        )}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-950">
              Verified research still required
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-900">
              Driving times, nearby destinations and school information are not generated from guesses. Those will use verified map, route, school and district sources in the next controlled build.
            </p>
          </section>
        </div>
      )}

      {activeTab ===
        'photos' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Master Photo Library
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Photos selected for marketing are available throughout the studio. Return to Edit Listing to upload, remove or reorder the master library.
              </p>
            </div>

            <a
              href="/dashboard/email-marketing/listings"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Pencil className="h-4 w-4" />

              Edit Listing Photos
            </a>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {photos.map(
              (
                photo,
                index
              ) => {
                const usedBy =
                  assignments.filter(
                    (assignment) =>
                      assignment
                        .media_id ===
                      photo.id
                  );

                return (
                  <div
                    key={
                      photo.id
                    }
                    className={`overflow-hidden rounded-2xl border bg-white ${
                      photo.use_in_marketing
                        ? 'border-emerald-300'
                        : 'border-slate-200 opacity-55'
                    }`}
                  >
                    <div className="relative aspect-square bg-slate-100">
                      <img
                        src={
                          photo.thumbnail_url ||
                          photo.public_url
                        }
                        alt={
                          photo.title ||
                          photo.caption ||
                          photo.file_name
                        }
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-bold text-white">
                        #{index + 1}
                      </div>

                      {photo.is_primary && (
                        <div className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold text-amber-950">
                          Primary
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        {photo.title ||
                          photo.file_name}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {usedBy
                          .slice(
                            0,
                            3
                          )
                          .map(
                            (
                              assignment
                            ) => (
                              <span
                                key={
                                  assignment.id
                                }
                                className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-700"
                              >
                                {
                                  SECTION_DEFINITIONS[
                                    assignment
                                      .section_key
                                  ].title
                                }
                              </span>
                            )
                          )}
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}

      {activeTab ===
        'property_website' &&
        listing && (
          <div className="space-y-5">
            {renderSection(
              'property_website'
            )}

            <PropertyWebsitePreviewPanel
              title={listing.title}
              publicUrl={
                listing.public_url
              }
            />
          </div>
        )}

      {activeTab ===
        'email' &&
        renderSection(
          'email'
        )}

      {activeTab ===
        'social' &&
        renderSection(
          'social'
        )}

      {activeTab ===
        'flyer' &&
        listing && (
          <ListingCanvaMarketingPackagePanel
            listing={listing}
            sections={sections}
            photos={photos}
            assignments={assignments}
            saving={saving}
            onChoosePhoto={(
              slot
            ) =>
              setPhotoPickerTarget({
                sectionKey:
                  'flyer',
                slotKey:
                  slot.slotKey,
                sortOrder:
                  slot.sortOrder,
                label:
                  slot.label,
              })
            }
            onRefresh={
              loadStudio
            }
          />
        )}

      {activeTab ===
        'video' &&
        renderSection(
          'video'
        )}

      {activeTab ===
        'seller_report' &&
        renderSection(
          'seller_report'
        )}

      {photoPickerTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() =>
            setPhotoPickerTarget(
              null
            )
          }
        >
          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="font-bold text-slate-950">
                  Choose {photoPickerTarget.label}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Your choice will be locked so Samantha cannot replace it.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPhotoPickerTarget(
                    null
                  )
                }
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {marketingPhotos.map(
                (
                  photo,
                  index
                ) => (
                  <button
                    key={
                      photo.id
                    }
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void selectPhoto(
                        photo
                      )
                    }
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-blue-500 hover:shadow-md disabled:opacity-50"
                  >
                    <div className="relative aspect-square bg-slate-100">
                      <img
                        src={
                          photo.thumbnail_url ||
                          photo.public_url
                        }
                        alt={
                          photo.title ||
                          photo.caption ||
                          photo.file_name
                        }
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />

                      <div className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-bold text-white">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="truncate p-3 text-xs font-semibold text-slate-800">
                      {photo.title ||
                        photo.file_name}
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
