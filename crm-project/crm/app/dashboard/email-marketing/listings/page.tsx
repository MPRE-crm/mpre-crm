'use client';

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react';

import { getSupabaseBrowser } from '../../../../lib/supabase-browser';

import ListingMediaManager, {
  type ListingMediaSummary,
} from './ListingMediaManager';


const supabase = getSupabaseBrowser();

type Role =
  | 'agent'
  | 'admin'
  | 'org_admin'
  | 'platform_admin';

type Profile = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
};

type ListingOwner = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  org_id: string;
};

type Contact = {
  id: string;
  org_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

type Listing = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  seller_contact_id: string | null;

  title: string;
  property_type: string | null;

  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;

  mls_number: string | null;
  list_price: number | null;
  listing_status: string;
  list_date: string | null;

  bedrooms: number | null;
  bathrooms: number | null;
  levels: string | null;
  garage_spaces: number | null;
  square_feet: number | null;
  year_built: number | null;

  lot_size_text: string | null;
  acres: number | null;

  county: string | null;
  subdivision: string | null;

  school_district: string | null;
  elementary_school: string | null;
  middle_school: string | null;
  high_school: string | null;

  hoa_fee: number | null;
  hoa_frequency: string | null;
  hoa_setup_fee: number | null;

  annual_taxes: number | null;
  tax_year: number | null;

  parcel_number: string | null;
  legal_description: string | null;

  inclusions: string | null;
  exclusions: string | null;
  directions: string | null;

  features: unknown;

  public_url: string | null;

  website_slug: string | null;
  website_template_key: string | null;
  website_status: string | null;
  website_published_at: string | null;

  virtual_tour_url: string | null;
  branded_video_url: string | null;
  unbranded_video_url: string | null;
  open_house_info: string | null;

  campaign_headline: string | null;
  short_marketing_description: string | null;

  primary_image_url: string | null;

  description: string | null;
  public_remarks: string | null;

  pending_date: string | null;
  close_date: string | null;

  review_status: string;
  review_confirmed_at: string | null;
  review_confirmed_by: string | null;

  data_source: string;
  created_at: string;
};

type IntakeSession = {
  id: string;
  org_id: string;
  owner_user_id: string;
  status: string;
};

type UploadedDocument = {
  id: string;
  intake_session_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  extraction_status: string;
  extracted_data?: Record<string, any>;
};

type ListingForm = {
  owner_user_id: string;
  seller_contact_id: string;

  title: string;
  property_type: string;

  property_address: string;
  city: string;
  state: string;
  zip: string;

  mls_number: string;
  list_price: string;
  listing_status: string;
  list_date: string;

  bedrooms: string;
  bathrooms: string;
  levels: string;
  garage_spaces: string;
  square_feet: string;
  year_built: string;

  lot_size_text: string;
  acres: string;

  county: string;
  subdivision: string;

  school_district: string;
  elementary_school: string;
  middle_school: string;
  high_school: string;

  hoa_fee: string;
  hoa_frequency: string;
  hoa_setup_fee: string;

  annual_taxes: string;
  tax_year: string;

  parcel_number: string;
  legal_description: string;

  features_text: string;
  inclusions: string;
  exclusions: string;
  directions: string;

  public_url: string;
  virtual_tour_url: string;
  branded_video_url: string;
  unbranded_video_url: string;
  open_house_info: string;

  campaign_headline: string;
  short_marketing_description: string;

  description: string;
};

const LISTING_STATUSES = [
  {
    value: 'draft',
    label: 'Draft',
  },
  {
    value: 'coming_soon',
    label: 'Coming Soon',
  },
  {
    value: 'active',
    label: 'Active',
  },
  {
    value: 'pending',
    label: 'Pending',
  },
  {
    value: 'sold',
    label: 'Sold',
  },
  {
    value: 'withdrawn',
    label: 'Withdrawn',
  },
  {
    value: 'expired',
    label: 'Expired',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
  },
];

const EMPTY_FORM: ListingForm = {
  owner_user_id: '',
  seller_contact_id: '',

  title: '',
  property_type: '',

  property_address: '',
  city: '',
  state: 'ID',
  zip: '',

  mls_number: '',
  list_price: '',
  listing_status: 'active',
  list_date: '',

  bedrooms: '',
  bathrooms: '',
  levels: '',
  garage_spaces: '',
  square_feet: '',
  year_built: '',

  lot_size_text: '',
  acres: '',

  county: '',
  subdivision: '',

  school_district: '',
  elementary_school: '',
  middle_school: '',
  high_school: '',

  hoa_fee: '',
  hoa_frequency: '',
  hoa_setup_fee: '',

  annual_taxes: '',
  tax_year: '',

  parcel_number: '',
  legal_description: '',

  features_text: '',
  inclusions: '',
  exclusions: '',
  directions: '',

  public_url: '',
  virtual_tour_url: '',
  branded_video_url: '',
  unbranded_video_url: '',
  open_house_info: '',

  campaign_headline: '',
  short_marketing_description: '',

  description: '',
};

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .replace(/-+/g, '-') ||
    'listing-document.pdf'
  );
}

function contactName(contact: Contact) {
  return (
    contact.display_name ||
    [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    contact.email ||
    'Unnamed contact'
  );
}

function formatPrice(value: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '-';

  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBytes(value?: number | null) {
  if (!value) return '-';

  const megabytes = value / 1024 / 1024;

  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }

  return `${(value / 1024).toFixed(1)} KB`;
}

function roleLabel(role: Role) {
  if (role === 'platform_admin') {
    return 'Platform Admin';
  }

  if (
    role === 'admin' ||
    role === 'org_admin'
  ) {
    return 'Admin';
  }

  return 'Agent';
}

function extractedText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function extractedNumberText(value: unknown) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    return value.trim();
  }

  return '';
}

function extractedStatus(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  return LISTING_STATUSES.some(
    (status) =>
      status.value === normalized
  )
    ? normalized
    : '';
}

function parseOptionalNumber(
  value: string,
  label: string
) {
  const cleaned = value
    .replace(/[$,%\s,]/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Enter a valid value for ${label}.`
    );
  }

  return parsed;
}

function parseOptionalInteger(
  value: string,
  label: string
) {
  const parsed = parseOptionalNumber(
    value,
    label
  );

  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed)) {
    throw new Error(
      `${label} must be a whole number.`
    );
  }

  return parsed;
}

function parseFeatures(value: string) {
  const unique = new Set<string>();

  for (const item of value.split(
    /[\n,;]+/
  )) {
    const cleaned = item.trim();

    if (cleaned) {
      unique.add(cleaned);
    }
  }

  return Array.from(unique);
}

function formValue(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value);
}

function listingFeaturesText(
  value: unknown
) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((item) => String(item))
      .join('\n');
  }

  return '';
}

function listingToForm(
  listing: Listing
): ListingForm {
  return {
    owner_user_id:
      listing.owner_user_id || '',

    seller_contact_id:
      listing.seller_contact_id || '',

    title:
      listing.title || '',

    property_type:
      listing.property_type || '',

    property_address:
      listing.property_address || '',

    city:
      listing.city || '',

    state:
      listing.state || 'ID',

    zip:
      listing.zip || '',

    mls_number:
      listing.mls_number || '',

    list_price:
      formValue(listing.list_price),

    listing_status:
      listing.listing_status || 'active',

    list_date:
      listing.list_date || '',

    bedrooms:
      formValue(listing.bedrooms),

    bathrooms:
      formValue(listing.bathrooms),

    levels:
      listing.levels || '',

    garage_spaces:
      formValue(
        listing.garage_spaces
      ),

    square_feet:
      formValue(
        listing.square_feet
      ),

    year_built:
      formValue(
        listing.year_built
      ),

    lot_size_text:
      listing.lot_size_text || '',

    acres:
      formValue(listing.acres),

    county:
      listing.county || '',

    subdivision:
      listing.subdivision || '',

    school_district:
      listing.school_district || '',

    elementary_school:
      listing.elementary_school || '',

    middle_school:
      listing.middle_school || '',

    high_school:
      listing.high_school || '',

    hoa_fee:
      formValue(listing.hoa_fee),

    hoa_frequency:
      listing.hoa_frequency || '',

    hoa_setup_fee:
      formValue(
        listing.hoa_setup_fee
      ),

    annual_taxes:
      formValue(
        listing.annual_taxes
      ),

    tax_year:
      formValue(listing.tax_year),

    parcel_number:
      listing.parcel_number || '',

    legal_description:
      listing.legal_description || '',

    features_text:
      listingFeaturesText(
        listing.features
      ),

    inclusions:
      listing.inclusions || '',

    exclusions:
      listing.exclusions || '',

    directions:
      listing.directions || '',

    public_url:
      listing.public_url || '',

    virtual_tour_url:
      listing.virtual_tour_url || '',

    branded_video_url:
      listing.branded_video_url || '',

    unbranded_video_url:
      listing.unbranded_video_url || '',

    open_house_info:
      listing.open_house_info || '',

    campaign_headline:
      listing.campaign_headline || '',

    short_marketing_description:
      listing
        .short_marketing_description ||
      '',

    description:
      listing.public_remarks ||
      listing.description ||
      '',
  };
}

export default function MarketingListingsPage() {
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploadingPdf, setUploadingPdf] =
    useState(false);

  const [extractingPdf, setExtractingPdf] =
    useState(false);

  const [
    savingListingId,
    setSavingListingId,
  ] = useState<string | null>(null);

  const [
    websiteTemplateDrafts,
    setWebsiteTemplateDrafts,
  ] = useState<Record<string, string>>({});

  const [
    websiteBlockers,
    setWebsiteBlockers,
  ] = useState<Record<string, string[]>>({});

  const [pdfInputKey, setPdfInputKey] =
    useState(0);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [owners, setOwners] =
    useState<ListingOwner[]>([]);

  const [contacts, setContacts] =
    useState<Contact[]>([]);

  const [listings, setListings] =
    useState<Listing[]>([]);

  const [pdfFile, setPdfFile] =
    useState<File | null>(null);

  const [intakeSession, setIntakeSession] =
    useState<IntakeSession | null>(null);

  const [
    uploadedDocument,
    setUploadedDocument,
  ] = useState<UploadedDocument | null>(
    null
  );

  const [form, setForm] =
    useState<ListingForm>(EMPTY_FORM);

  const [
    editingListingId,
    setEditingListingId,
  ] = useState<string | null>(null);

  const [
    reviewConfirmed,
    setReviewConfirmed,
  ] = useState(false);

  const [
    mediaSummary,
    setMediaSummary,
  ] = useState<ListingMediaSummary>({
    photoCount: 0,
    videoCount: 0,
    brandedVideoCount: 0,
    unbrandedVideoCount: 0,
    hasPrimaryPhoto: false,
  });

  function applyExtractedData(
    extracted: Record<string, any>
  ) {
    setForm((current) => ({
      ...current,

      title:
        extractedText(extracted.title) ||
        current.title,

      property_type:
        extractedText(
          extracted.property_type
        ) ||
        current.property_type,

      property_address:
        extractedText(
          extracted.property_address
        ) ||
        current.property_address,

      city:
        extractedText(extracted.city) ||
        current.city,

      state:
        extractedText(extracted.state) ||
        current.state,

      zip:
        extractedText(extracted.zip) ||
        current.zip,

      mls_number:
        extractedText(
          extracted.mls_number
        ) ||
        current.mls_number,

      list_price:
        extractedNumberText(
          extracted.list_price
        ) ||
        current.list_price,

      listing_status:
        extractedStatus(
          extracted.listing_status
        ) ||
        current.listing_status,

      list_date:
        extractedText(
          extracted.list_date
        ) ||
        current.list_date,

      bedrooms:
        extractedNumberText(
          extracted.bedrooms
        ) ||
        current.bedrooms,

      bathrooms:
        extractedNumberText(
          extracted.bathrooms
        ) ||
        current.bathrooms,

      levels:
        extractedText(extracted.levels) ||
        current.levels,

      garage_spaces:
        extractedNumberText(
          extracted.garage_spaces
        ) ||
        current.garage_spaces,

      square_feet:
        extractedNumberText(
          extracted.square_feet
        ) ||
        current.square_feet,

      year_built:
        extractedNumberText(
          extracted.year_built
        ) ||
        current.year_built,

      lot_size_text:
        extractedText(
          extracted.lot_size_text
        ) ||
        current.lot_size_text,

      acres:
        extractedNumberText(
          extracted.acres
        ) ||
        current.acres,

      county:
        extractedText(extracted.county) ||
        current.county,

      subdivision:
        extractedText(
          extracted.subdivision
        ) ||
        current.subdivision,

      school_district:
        extractedText(
          extracted.school_district
        ) ||
        current.school_district,

      elementary_school:
        extractedText(
          extracted.elementary_school
        ) ||
        current.elementary_school,

      middle_school:
        extractedText(
          extracted.middle_school
        ) ||
        current.middle_school,

      high_school:
        extractedText(
          extracted.high_school
        ) ||
        current.high_school,

      hoa_fee:
        extractedNumberText(
          extracted.hoa_fee
        ) ||
        current.hoa_fee,

      hoa_frequency:
        extractedText(
          extracted.hoa_frequency
        ) ||
        current.hoa_frequency,

      hoa_setup_fee:
        extractedNumberText(
          extracted.hoa_setup_fee
        ) ||
        current.hoa_setup_fee,

      annual_taxes:
        extractedNumberText(
          extracted.annual_taxes
        ) ||
        current.annual_taxes,

      tax_year:
        extractedNumberText(
          extracted.tax_year
        ) ||
        current.tax_year,

      parcel_number:
        extractedText(
          extracted.parcel_number
        ) ||
        current.parcel_number,

      legal_description:
        extractedText(
          extracted.legal_description
        ) ||
        current.legal_description,

      inclusions:
        extractedText(
          extracted.inclusions
        ) ||
        current.inclusions,

      exclusions:
        extractedText(
          extracted.exclusions
        ) ||
        current.exclusions,

      directions:
        extractedText(
          extracted.directions
        ) ||
        current.directions,

      features_text:
        Array.isArray(extracted.features)
          ? extracted.features
              .filter(Boolean)
              .join('\n')
          : current.features_text,

      public_url:
        extractedText(
          extracted.public_url
        ) ||
        current.public_url,

      virtual_tour_url:
        extractedText(
          extracted.virtual_tour_url
        ) ||
        current.virtual_tour_url,

      open_house_info:
        extractedText(
          extracted.open_house_info
        ) ||
        current.open_house_info,

      campaign_headline:
        extractedText(
          extracted.campaign_headline
        ) ||
        current.campaign_headline,

      short_marketing_description:
        extractedText(
          extracted
            .short_marketing_description
        ) ||
        current
          .short_marketing_description,

      description:
        extractedText(
          extracted.public_remarks
        ) ||
        current.description,
    }));
  }

  const selectedOwner = useMemo(
    () =>
      owners.find(
        (owner) =>
          owner.id === form.owner_user_id
      ) || null,
    [owners, form.owner_user_id]
  );

  const ownerLookup = useMemo(() => {
    return new Map(
      owners.map((owner) => [
        owner.id,
        owner.name,
      ])
    );
  }, [owners]);

  const sellerContacts = useMemo(() => {
    if (!selectedOwner?.org_id) {
      return contacts;
    }

    return contacts.filter(
      (contact) =>
        contact.org_id ===
        selectedOwner.org_id
    );
  }, [contacts, selectedOwner]);

  const activeListings = useMemo(
    () =>
      listings.filter((listing) =>
        ['coming_soon', 'active'].includes(
          listing.listing_status
        )
      ),
    [listings]
  );

  const pendingListings = useMemo(
    () =>
      listings.filter(
        (listing) =>
          listing.listing_status === 'pending'
      ),
    [listings]
  );

  const soldListings = useMemo(
    () =>
      listings.filter(
        (listing) =>
          listing.listing_status === 'sold'
      ),
    [listings]
  );

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: userResult,
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !userResult?.user
      ) {
        throw new Error(
          userError?.message ||
            'Not authenticated.'
        );
      }

      const userId =
        userResult.user.id;

      const {
        data: profileRow,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'id, email, role, org_id'
        )
        .eq('id', userId)
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

      if (!typedProfile.org_id) {
        throw new Error(
          'Your CRM profile does not have an organization.'
        );
      }

      setProfile(typedProfile);

      const {
        data: sessionResult,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const ownerResponse = await fetch(
        '/api/marketing/listing-owners',
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${sessionResult.session.access_token}`,
          },
          cache: 'no-store',
        }
      );

      const ownerPayload =
        await ownerResponse.json();

      if (
        !ownerResponse.ok ||
        !ownerPayload.ok
      ) {
        throw new Error(
          ownerPayload.error ||
            'Could not load listing owners.'
        );
      }

      const ownerRows =
        (ownerPayload.owners ||
          []) as ListingOwner[];

      setOwners(ownerRows);

      const defaultOwner =
        ownerRows.find(
          (owner) =>
            owner.id === typedProfile.id
        ) ||
        ownerRows[0] ||
        null;

      setForm((current) => {
        const existingOwnerStillValid =
          ownerRows.some(
            (owner) =>
              owner.id ===
              current.owner_user_id
          );

        if (existingOwnerStillValid) {
          return current;
        }

        return {
          ...current,
          owner_user_id:
            defaultOwner?.id || '',
        };
      });

      if (
        defaultOwner &&
        !editingListingId
      ) {
        const {
          data: draftRows,
          error: draftError,
        } = await supabase
          .from('listing_intake_sessions')
          .select(`
            id,
            org_id,
            owner_user_id,
            status
          `)
          .eq(
            'owner_user_id',
            defaultOwner.id
          )
          .is('listing_id', null)
          .in('status', [
            'draft',
            'extracting',
            'needs_review',
          ])
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(1);

        if (draftError) {
          throw new Error(
            draftError.message
          );
        }

        const restoredIntake =
          draftRows?.[0] ||
          null;

        if (restoredIntake) {
          const {
            data: documentRows,
            error: restoredDocumentError,
          } = await supabase
            .from('listing_documents')
            .select(`
              id,
              intake_session_id,
              storage_bucket,
              storage_path,
              file_name,
              file_size_bytes,
              extraction_status,
              extracted_data
            `)
            .eq(
              'intake_session_id',
              restoredIntake.id
            )
            .order(
              'uploaded_at',
              {
                ascending: false,
              }
            )
            .limit(1);

          if (restoredDocumentError) {
            throw new Error(
              restoredDocumentError.message
            );
          }

          const restoredDocument =
            documentRows?.[0] ||
            null;

          setIntakeSession(
            restoredIntake as IntakeSession
          );

          setUploadedDocument(
            restoredDocument as
              | UploadedDocument
              | null
          );

          if (
            restoredDocument
              ?.extraction_status ===
              'completed' &&
            restoredDocument
              ?.extracted_data
          ) {
            applyExtractedData(
              restoredDocument
                .extracted_data
            );
          }
        }
      }

      const [
        contactsResult,
        listingsResult,
      ] = await Promise.all([
        supabase
          .from('contacts')
          .select(`
            id,
            org_id,
            first_name,
            last_name,
            display_name,
            email
          `)
          .order(
            'display_name',
            {
              ascending: true,
            }
          )
          .limit(5000),

        supabase
          .from('listings')
          .select(`
            id,
            org_id,
            owner_user_id,
            seller_contact_id,
            title,
            property_type,
            property_address,
            city,
            state,
            zip,
            mls_number,
            list_price,
            listing_status,
            list_date,
            bedrooms,
            bathrooms,
            levels,
            garage_spaces,
            square_feet,
            year_built,
            lot_size_text,
            acres,
            county,
            subdivision,
            school_district,
            elementary_school,
            middle_school,
            high_school,
            hoa_fee,
            hoa_frequency,
            hoa_setup_fee,
            annual_taxes,
            tax_year,
            parcel_number,
            legal_description,
            inclusions,
            exclusions,
            directions,
            features,
            public_url,
            website_slug,
            website_template_key,
            website_status,
            website_published_at,
            virtual_tour_url,
            branded_video_url,
            unbranded_video_url,
            open_house_info,
            campaign_headline,
            short_marketing_description,
            primary_image_url,
            description,
            public_remarks,
            pending_date,
            close_date,
            review_status,
            review_confirmed_at,
            review_confirmed_by,
            data_source,
            created_at
          `)
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(500),
      ]);

      if (contactsResult.error) {
        throw new Error(
          contactsResult.error.message
        );
      }

      if (listingsResult.error) {
        throw new Error(
          listingsResult.error.message
        );
      }

      setContacts(
        (contactsResult.data ||
          []) as Contact[]
      );

      setListings(
        (listingsResult.data ||
          []) as Listing[]
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load listing data.'
      );

      setContacts([]);
      setListings([]);
      setOwners([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handlePdfSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ||
      null;

    setError(null);
    setNotice(null);

    if (!file) {
      setPdfFile(null);
      return;
    }

    const isPdf =
      file.type ===
        'application/pdf' ||
      file.name
        .toLowerCase()
        .endsWith('.pdf');

    if (!isPdf) {
      setPdfFile(null);

      setError(
        'Choose a PDF client-detail MLS file.'
      );

      setPdfInputKey(
        (current) => current + 1
      );

      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setPdfFile(null);

      setError(
        'The PDF is larger than 50 MB.'
      );

      setPdfInputKey(
        (current) => current + 1
      );

      return;
    }

    setPdfFile(file);
  }

  async function uploadClientDetailPdf() {
    if (!profile) {
      setError(
        'Your CRM profile is not loaded.'
      );
      return;
    }

    if (!selectedOwner) {
      setError(
        'Choose the listing owner first.'
      );
      return;
    }

    if (!pdfFile) {
      setError(
        'Choose the client-detail PDF first.'
      );
      return;
    }

    try {
      setUploadingPdf(true);
      setError(null);
      setNotice(null);

      const {
        data: intakeRow,
        error: intakeError,
      } = await supabase
        .from(
          'listing_intake_sessions'
        )
        .insert({
          org_id:
            selectedOwner.org_id,

          owner_user_id:
            selectedOwner.id,

          created_by:
            profile.id,

          status: 'draft',
        })
        .select(
          'id, org_id, owner_user_id, status'
        )
        .single();

      if (
        intakeError ||
        !intakeRow
      ) {
        throw new Error(
          intakeError?.message ||
            'Could not create the listing intake session.'
        );
      }

      const typedIntake =
        intakeRow as IntakeSession;

      const storagePath = [
        selectedOwner.org_id,
        selectedOwner.id,
        typedIntake.id,
        `${Date.now()}-${safeFileName(
          pdfFile.name
        )}`,
      ].join('/');

      const { error: uploadError } =
        await supabase.storage
          .from('listing-documents')
          .upload(
            storagePath,
            pdfFile,
            {
              cacheControl: '3600',
              upsert: false,
              contentType:
                'application/pdf',
            }
          );

      if (uploadError) {
        await supabase
          .from(
            'listing_intake_sessions'
          )
          .delete()
          .eq('id', typedIntake.id);

        throw uploadError;
      }

      const {
        data: documentRow,
        error: documentError,
      } = await supabase
        .from('listing_documents')
        .insert({
          intake_session_id:
            typedIntake.id,

          listing_id: null,

          org_id:
            selectedOwner.org_id,

          owner_user_id:
            selectedOwner.id,

          created_by:
            profile.id,

          document_type:
            'client_detail_mls',

          storage_bucket:
            'listing-documents',

          storage_path:
            storagePath,

          file_name:
            pdfFile.name,

          mime_type:
            pdfFile.type ||
            'application/pdf',

          file_size_bytes:
            pdfFile.size,

          extraction_status:
            'uploaded',
        })
        .select(`
          id,
          intake_session_id,
          storage_bucket,
          storage_path,
          file_name,
          file_size_bytes,
          extraction_status
        `)
        .single();

      if (
        documentError ||
        !documentRow
      ) {
        await supabase.storage
          .from('listing-documents')
          .remove([storagePath]);

        await supabase
          .from(
            'listing_intake_sessions'
          )
          .delete()
          .eq('id', typedIntake.id);

        throw new Error(
          documentError?.message ||
            'Could not register the uploaded document.'
        );
      }

      await supabase
        .from(
          'listing_intake_sessions'
        )
        .update({
          status: 'needs_review',
        })
        .eq('id', typedIntake.id);

      setIntakeSession({
        ...typedIntake,
        status: 'needs_review',
      });

      setUploadedDocument(
        documentRow as UploadedDocument
      );

      setNotice(
        'Client-detail PDF uploaded privately. It is ready for Samantha extraction.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Client-detail PDF upload failed.'
      );
    } finally {
      setUploadingPdf(false);
    }
  }

  async function extractWithSamantha() {
    if (!uploadedDocument) {
      setError(
        'Upload the client-detail PDF first.'
      );
      return;
    }

    try {
      setExtractingPdf(true);
      setError(null);
      setNotice(null);

      const {
        data: sessionResult,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      setUploadedDocument(
        (current) =>
          current
            ? {
                ...current,
                extraction_status:
                  'processing',
              }
            : current
      );

      const response = await fetch(
        '/api/marketing/listing-intake/extract',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${sessionResult.session.access_token}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            document_id:
              uploadedDocument.id,
          }),
        }
      );

      const payload =
        await response.json();

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.error ||
            'Samantha extraction failed.'
        );
      }

      const extracted =
        payload.extracted as
          Record<string, any>;

      applyExtractedData(extracted);

      setUploadedDocument(
        (current) =>
          current
            ? {
                ...current,
                extraction_status:
                  'completed',

                extracted_data:
                  extracted,
              }
            : current
      );

      setNotice(
        'Samantha extracted the MLS information. Review every field before saving.'
      );
    } catch (err: any) {
      setUploadedDocument(
        (current) =>
          current
            ? {
                ...current,
                extraction_status:
                  'failed',
              }
            : current
      );

      setError(
        err?.message ||
          'Samantha could not extract this PDF.'
      );
    } finally {
      setExtractingPdf(false);
    }
  }

  async function resetDraftIntake() {
    if (editingListingId) {
      setNotice(
        'This PDF is linked to a saved listing and cannot be removed with Restart Intake.'
      );

      return;
    }

    if (
      !intakeSession ||
      !uploadedDocument
    ) {
      setPdfFile(null);

      setPdfInputKey(
        (current) => current + 1
      );

      return;
    }

    const confirmed =
      window.confirm(
        'Remove this uploaded PDF and restart the listing intake?'
      );

    if (!confirmed) return;

    try {
      setError(null);
      setNotice(null);

      const { error: storageError } =
        await supabase.storage
          .from(
            uploadedDocument.storage_bucket
          )
          .remove([
            uploadedDocument.storage_path,
          ]);

      if (storageError) {
        throw storageError;
      }

      const { error: sessionDeleteError } =
        await supabase
          .from(
            'listing_intake_sessions'
          )
          .delete()
          .eq(
            'id',
            intakeSession.id
          );

      if (sessionDeleteError) {
        throw sessionDeleteError;
      }

      setIntakeSession(null);
      setUploadedDocument(null);
      setPdfFile(null);

      setPdfInputKey(
        (current) => current + 1
      );

      setNotice(
        'Draft listing intake removed.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not remove the draft intake.'
      );
    }
  }

  async function createListing() {
    if (!profile) {
      setError(
        'Your CRM profile is not loaded.'
      );
      return;
    }

    if (!selectedOwner) {
      setError(
        'Choose the listing owner.'
      );
      return;
    }

    if (!form.title.trim()) {
      setError(
        'Enter a listing title.'
      );
      return;
    }

    if (
      !form.property_address.trim()
    ) {
      setError(
        'Enter the property address.'
      );
      return;
    }

    let listPrice:
      | number
      | null = null;

    if (form.list_price.trim()) {
      const parsedPrice = Number(
        form.list_price.replace(
          /[$,\s]/g,
          ''
        )
      );

      if (
        !Number.isFinite(
          parsedPrice
        )
      ) {
        setError(
          'Enter a valid listing price.'
        );
        return;
      }

      listPrice = parsedPrice;
    }

    const bedrooms =
      parseOptionalNumber(
        form.bedrooms,
        'bedrooms'
      );

    const bathrooms =
      parseOptionalNumber(
        form.bathrooms,
        'bathrooms'
      );

    const garageSpaces =
      parseOptionalInteger(
        form.garage_spaces,
        'garage spaces'
      );

    const squareFeet =
      parseOptionalInteger(
        form.square_feet,
        'square feet'
      );

    const yearBuilt =
      parseOptionalInteger(
        form.year_built,
        'year built'
      );

    const acres =
      parseOptionalNumber(
        form.acres,
        'acreage'
      );

    const hoaFee =
      parseOptionalNumber(
        form.hoa_fee,
        'HOA fee'
      );

    const hoaSetupFee =
      parseOptionalNumber(
        form.hoa_setup_fee,
        'HOA setup fee'
      );

    const annualTaxes =
      parseOptionalNumber(
        form.annual_taxes,
        'annual taxes'
      );

    const taxYear =
      parseOptionalInteger(
        form.tax_year,
        'tax year'
      );

    const features =
      parseFeatures(
        form.features_text
      );

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const wasEditing =
        Boolean(editingListingId);

      const {
        data: listingRow,
        error: insertError,
      } = await supabase
        .from('listings')
        .upsert({
          id:
            editingListingId ||
            undefined,

          org_id:
            selectedOwner.org_id,

          owner_user_id:
            selectedOwner.id,

          seller_contact_id:
            form.seller_contact_id ||
            null,

          title:
            form.title.trim(),

          property_address:
            form.property_address.trim(),

          city:
            form.city.trim() ||
            null,

          state:
            form.state.trim() ||
            null,

          zip:
            form.zip.trim() ||
            null,

          mls_number:
            form.mls_number.trim() ||
            null,

          list_price:
            listPrice,

          listing_status:
            form.listing_status,

          property_type:
            form.property_type.trim() ||
            null,

          bedrooms,
          bathrooms,

          levels:
            form.levels.trim() ||
            null,

          garage_spaces:
            garageSpaces,

          square_feet:
            squareFeet,

          year_built:
            yearBuilt,

          lot_size_text:
            form.lot_size_text.trim() ||
            null,

          acres,

          county:
            form.county.trim() ||
            null,

          subdivision:
            form.subdivision.trim() ||
            null,

          school_district:
            form.school_district.trim() ||
            null,

          elementary_school:
            form.elementary_school.trim() ||
            null,

          middle_school:
            form.middle_school.trim() ||
            null,

          high_school:
            form.high_school.trim() ||
            null,

          hoa_fee:
            hoaFee,

          hoa_frequency:
            form.hoa_frequency.trim() ||
            null,

          hoa_setup_fee:
            hoaSetupFee,

          annual_taxes:
            annualTaxes,

          tax_year:
            taxYear,

          parcel_number:
            form.parcel_number.trim() ||
            null,

          legal_description:
            form.legal_description.trim() ||
            null,

          inclusions:
            form.inclusions.trim() ||
            null,

          exclusions:
            form.exclusions.trim() ||
            null,

          directions:
            form.directions.trim() ||
            null,

          features,

          public_url:
            form.public_url.trim() ||
            null,

          virtual_tour_url:
            form.virtual_tour_url.trim() ||
            null,

          branded_video_url:
            form.branded_video_url.trim() ||
            null,

          unbranded_video_url:
            form.unbranded_video_url.trim() ||
            null,

          open_house_info:
            form.open_house_info.trim() ||
            null,

          campaign_headline:
            form.campaign_headline.trim() ||
            null,

          short_marketing_description:
            form
              .short_marketing_description
              .trim() ||
            null,

          description:
            form.description.trim() ||
            null,

          public_remarks:
            form.description.trim() ||
            null,

          list_date:
            form.list_date ||
            null,

          data_source:
            uploadedDocument
              ? 'client_detail_pdf'
              : 'manual',

          source_last_refreshed_at:
            uploadedDocument
              ? new Date().toISOString()
              : null,

          review_status:
            reviewConfirmed
              ? 'confirmed'
              : 'draft',

          review_confirmed_at:
            reviewConfirmed
              ? new Date().toISOString()
              : null,

          review_confirmed_by:
            reviewConfirmed
              ? profile.id
              : null,
        }, {
          onConflict: 'id',
        })
        .select('id')
        .single();

      if (
        insertError ||
        !listingRow
      ) {
        throw new Error(
          insertError?.message ||
            'Could not save the listing.'
        );
      }

      if (intakeSession) {
        const {
          error: intakeUpdateError,
        } = await supabase
          .from(
            'listing_intake_sessions'
          )
          .update({
            listing_id:
              listingRow.id,

            status: 'saved',
          })
          .eq(
            'id',
            intakeSession.id
          );

        if (intakeUpdateError) {
          throw intakeUpdateError;
        }

        const {
          error: documentUpdateError,
        } = await supabase
          .from(
            'listing_documents'
          )
          .update({
            listing_id:
              listingRow.id,
          })
          .eq(
            'intake_session_id',
            intakeSession.id
          );

        if (documentUpdateError) {
          throw documentUpdateError;
        }

        const {
          error: mediaUpdateError,
        } = await supabase
          .from('listing_media')
          .update({
            listing_id:
              listingRow.id,
          })
          .eq(
            'intake_session_id',
            intakeSession.id
          );

        if (mediaUpdateError) {
          throw mediaUpdateError;
        }
      }

      const currentOwnerId =
        form.owner_user_id;

      setEditingListingId(null);
      setReviewConfirmed(false);

      setForm({
        ...EMPTY_FORM,
        owner_user_id:
          currentOwnerId,
      });

      setPdfFile(null);
      setUploadedDocument(null);
      setIntakeSession(null);

      setMediaSummary({
        photoCount: 0,
        videoCount: 0,
        brandedVideoCount: 0,
        unbrandedVideoCount: 0,
        hasPrimaryPhoto: false,
      });

      setPdfInputKey(
        (current) => current + 1
      );

      await loadData();

      setNotice(
        wasEditing
          ? 'Listing changes saved successfully.'
          : reviewConfirmed
          ? 'Listing saved and confirmed successfully.'
          : 'Listing saved as a draft.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not create the listing.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function beginEditListing(
    listing: Listing
  ) {
    if (!profile) {
      setError(
        'Your CRM profile is not loaded.'
      );

      return;
    }

    const ownerUserId =
      listing.owner_user_id ||
      profile.id;

    if (!ownerUserId) {
      setError(
        'This listing does not have an owner.'
      );

      return;
    }

    try {
      setError(null);
      setNotice(null);

      const {
        data: intakeRows,
        error: intakeError,
      } = await supabase
        .from(
          'listing_intake_sessions'
        )
        .select(`
          id,
          org_id,
          owner_user_id,
          status
        `)
        .eq(
          'listing_id',
          listing.id
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(1);

      if (intakeError) {
        throw intakeError;
      }

      let activeIntake =
        intakeRows?.[0] ||
        null;

      if (!activeIntake) {
        const {
          data: createdIntake,
          error: createdIntakeError,
        } = await supabase
          .from(
            'listing_intake_sessions'
          )
          .insert({
            org_id:
              listing.org_id,

            owner_user_id:
              ownerUserId,

            created_by:
              profile.id,

            listing_id:
              listing.id,

            status: 'saved',
          })
          .select(`
            id,
            org_id,
            owner_user_id,
            status
          `)
          .single();

        if (
          createdIntakeError ||
          !createdIntake
        ) {
          throw new Error(
            createdIntakeError?.message ||
            'Could not create an editing session.'
          );
        }

        activeIntake =
          createdIntake;
      }

      const {
        data: documentRows,
        error: documentError,
      } = await supabase
        .from('listing_documents')
        .select(`
          id,
          intake_session_id,
          storage_bucket,
          storage_path,
          file_name,
          file_size_bytes,
          extraction_status,
          extracted_data
        `)
        .eq(
          'listing_id',
          listing.id
        )
        .order(
          'uploaded_at',
          {
            ascending: false,
          }
        )
        .limit(1);

      if (documentError) {
        throw documentError;
      }

      setEditingListingId(
        listing.id
      );

      setReviewConfirmed(
        listing.review_status ===
          'confirmed' &&
        Boolean(
          listing.review_confirmed_at
        )
      );

      setForm(
        listingToForm(listing)
      );

      setIntakeSession(
        activeIntake as IntakeSession
      );

      setUploadedDocument(
        (documentRows?.[0] ||
          null) as
          | UploadedDocument
          | null
      );

      setPdfFile(null);

      setMediaSummary({
        photoCount: 0,
        videoCount: 0,
        brandedVideoCount: 0,
        unbrandedVideoCount: 0,
        hasPrimaryPhoto: false,
      });

      setPdfInputKey(
        (current) => current + 1
      );

      setNotice(
        `Editing ${listing.title}. Make your changes and press Save Changes.`
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not open the listing for editing.'
      );
    }
  }

  function cancelEditing() {
    const defaultOwner =
      owners.find(
        (owner) =>
          owner.id === profile?.id
      ) ||
      owners[0] ||
      null;

    setEditingListingId(null);
    setReviewConfirmed(false);

    setForm({
      ...EMPTY_FORM,

      owner_user_id:
        defaultOwner?.id || '',
    });

    setIntakeSession(null);
    setUploadedDocument(null);
    setPdfFile(null);

    setMediaSummary({
      photoCount: 0,
      videoCount: 0,
      brandedVideoCount: 0,
      unbrandedVideoCount: 0,
      hasPrimaryPhoto: false,
    });

    setPdfInputKey(
      (current) => current + 1
    );

    setError(null);

    setNotice(
      'Editing cancelled. No saved listing data was changed.'
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function updateListingStatus(
    listingId: string,
    listingStatus: string
  ) {
    try {
      setSavingListingId(
        listingId
      );

      setError(null);
      setNotice(null);

      const patch:
        Record<string, any> = {
        listing_status:
          listingStatus,
      };

      if (
        listingStatus === 'pending'
      ) {
        patch.pending_date =
          new Date()
            .toISOString()
            .slice(0, 10);
      }

      if (
        listingStatus === 'sold'
      ) {
        patch.close_date =
          new Date()
            .toISOString()
            .slice(0, 10);
      }

      const { error: updateError } =
        await supabase
          .from('listings')
          .update(patch)
          .eq('id', listingId);

      if (updateError) {
        throw updateError;
      }

      setListings((current) =>
        current.map((listing) =>
          listing.id === listingId
            ? {
                ...listing,
                ...patch,
              }
            : listing
        )
      );

      setNotice(
        'Listing status updated.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not update the listing status.'
      );
    } finally {
      setSavingListingId(null);
    }
  }

  async function updateListingWebsite(
    listing: Listing,
    action: 'publish' | 'unpublish'
  ) {
    if (
      action === 'unpublish' &&
      !window.confirm(
        'Remove this property website from public view? The saved slug will remain available for republishing.'
      )
    ) {
      return;
    }

    try {
      setSavingListingId(
        listing.id
      );

      setError(null);
      setNotice(null);

      setWebsiteBlockers(
        (current) => ({
          ...current,
          [listing.id]: [],
        })
      );

      const {
        data: sessionResult,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const templateKey =
        websiteTemplateDrafts[
          listing.id
        ] ||
        listing.website_template_key ||
        'standard';

      const response = await fetch(
        '/api/marketing/listing-websites/publish',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${sessionResult.session.access_token}`,
          },

          body: JSON.stringify({
            listing_id:
              listing.id,

            action,

            template_key:
              templateKey,
          }),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result?.ok
      ) {
        const blockers =
          Array.isArray(
            result?.blockers
          )
            ? result.blockers
                .map(
                  (item: unknown) =>
                    String(
                      item || ''
                    ).trim()
                )
                .filter(Boolean)
            : [];

        if (
          blockers.length > 0
        ) {
          setWebsiteBlockers(
            (current) => ({
              ...current,
              [listing.id]:
                blockers,
            })
          );
        }

        throw new Error(
          result?.error ||
            'The property website action failed.'
        );
      }

      const updated =
        result.listing || {};

      setListings(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              listing.id
                ? {
                    ...item,

                    website_slug:
                      updated.website_slug ??
                      item.website_slug,

                    website_template_key:
                      updated.website_template_key ??
                      templateKey,

                    website_status:
                      updated.website_status ??
                      item.website_status,

                    website_published_at:
                      updated.website_published_at ??
                      null,

                    public_url:
                      updated.public_url ??
                      null,
                  }
                : item
          )
      );

      setWebsiteTemplateDrafts(
        (current) => ({
          ...current,

          [listing.id]:
            updated.website_template_key ||
            templateKey,
        })
      );

      setWebsiteBlockers(
        (current) => ({
          ...current,
          [listing.id]: [],
        })
      );

      setNotice(
        result?.message ||
          (
            action ===
            'publish'
              ? 'The compliant property website is now published.'
              : 'The property website is no longer public.'
          )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'The property website action failed.'
      );
    } finally {
      setSavingListingId(null);
    }
  }

  const readinessPrice = Number(
    form.list_price.replace(
      /[$,\s]/g,
      ''
    )
  );

  const campaignReadiness = [
    {
      label: 'Listing owner assigned',
      ready: Boolean(selectedOwner),
    },
    {
      label: 'Property address entered',
      ready: Boolean(
        form.property_address.trim()
      ),
    },
    {
      label: 'List price entered',
      ready:
        Number.isFinite(readinessPrice) &&
        readinessPrice > 0,
    },
    {
      label: 'Public remarks entered',
      ready: Boolean(
        form.description.trim()
      ),
    },
    {
      label: 'Public listing website entered',
      ready: Boolean(
        form.public_url.trim()
      ),
    },
    {
      label: 'Primary photo selected',
      ready:
        mediaSummary.hasPrimaryPhoto,
    },
    {
      label: 'Reviewed and confirmed',
      ready:
        reviewConfirmed,
    },
  ];

  const campaignReady =
    campaignReadiness.every(
      (item) => item.ready
    );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a
              href="/dashboard/email-marketing"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Email Marketing
            </a>

            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
              <Building2 className="h-4 w-4" />
              Listing Intake
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Add and Manage Listings
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Assign the listing owner, upload the
              client-detail MLS PDF privately and review the
              listing before saving.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Listings
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {listings.length}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {activeListings.length}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {pendingListings.length}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sold
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {soldListings.length}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <UserRound className="h-5 w-5 text-blue-600" />
            Listing Owner
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Agents automatically see themselves. Admins and
            platform admins can assign the correct CRM user.
          </p>
        </div>

        <label className="block max-w-2xl">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Agent / Owner
          </span>

          <select
            value={form.owner_user_id}
            disabled={
              profile?.role === 'agent' ||
              Boolean(uploadedDocument)
            }
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                owner_user_id:
                  event.target.value,

                seller_contact_id: '',
              }))
            }
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">
              Choose the listing owner
            </option>

            {owners.map((owner) => (
              <option
                key={owner.id}
                value={owner.id}
              >
                {owner.name}
                {owner.email
                  ? ` — ${owner.email}`
                  : ''}
                {` (${roleLabel(owner.role)})`}
              </option>
            ))}
          </select>

          {uploadedDocument && (
            <div className="mt-2 text-xs text-amber-700">
              The owner is locked to the uploaded document.
              Restart the intake to change it.
            </div>
          )}
        </label>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-blue-100 p-2 text-blue-700">
            <FileText className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Client-Detail MLS PDF
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              This document is stored privately. It will not
              be published with the listing or emailed to
              recipients.
            </p>
          </div>
        </div>

        {!uploadedDocument ? (
          <div className="space-y-4">
            <input
              key={pdfInputKey}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfSelection}
              className="block w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700"
            />

            {pdfFile && (
              <div className="max-w-2xl rounded-2xl border border-blue-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  {pdfFile.name}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {formatBytes(pdfFile.size)}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={
                uploadingPdf ||
                !pdfFile ||
                !selectedOwner
              }
              onClick={uploadClientDetailPdf}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />

              {uploadingPdf
                ? 'Uploading Privately...'
                : 'Upload Client-Detail PDF'}
            </button>
          </div>
        ) : (
          <div className="max-w-3xl rounded-2xl border border-emerald-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  {uploadedDocument.file_name}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {formatBytes(
                    uploadedDocument.file_size_bytes
                  )}
                  {' · '}
                  Private Supabase document
                  {' · '}
                  {uploadedDocument.extraction_status}
                </div>
              </div>

              {editingListingId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  Linked to saved listing
                </div>
              ) : (
                <button
                  type="button"
                  onClick={resetDraftIntake}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart Intake
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm text-blue-800">
                {uploadedDocument.extraction_status ===
                'completed'
                  ? 'Samantha extraction is complete. Review the populated listing fields below.'
                  : uploadedDocument.extraction_status ===
                    'processing'
                  ? 'Samantha is reading the PDF and extracting the listing information...'
                  : uploadedDocument.extraction_status ===
                    'failed'
                  ? 'The last extraction attempt failed. Review the error above and try again.'
                  : 'Upload verified. Samantha can now read the private PDF and populate the listing.'}
              </div>

              <button
                type="button"
                disabled={extractingPdf}
                onClick={extractWithSamantha}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />

                {extractingPdf
                  ? 'Samantha Is Extracting...'
                  : uploadedDocument.extraction_status ===
                    'completed'
                  ? 'Extract Again with Samantha'
                  : 'Extract with Samantha'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingListingId
              ? 'Edit Listing Details'
              : 'Listing Details'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            These fields remain editable. Nothing is saved
            until you review and press Save Listing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Listing Title
            </span>

            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title:
                    event.target.value,
                }))
              }
              placeholder="Example: Sky Mesa View Home"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Property Address
            </span>

            <input
              value={
                form.property_address
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  property_address:
                    event.target.value,
                }))
              }
              placeholder="2976 E Parulo Drive"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              City
            </span>

            <input
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  city:
                    event.target.value,
                }))
              }
              placeholder="Meridian"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              State
            </span>

            <input
              value={form.state}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  state:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              ZIP
            </span>

            <input
              value={form.zip}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  zip:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              MLS Number
            </span>

            <input
              value={form.mls_number}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  mls_number:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              List Price
            </span>

            <input
              value={form.list_price}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  list_price:
                    event.target.value,
                }))
              }
              placeholder="1099900"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>

            <select
              value={
                form.listing_status
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  listing_status:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {LISTING_STATUSES.map(
                (status) => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              List Date
            </span>

            <input
              type="date"
              value={form.list_date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  list_date:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Seller Contact
            </span>

            <select
              value={
                form.seller_contact_id
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  seller_contact_id:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="">
                No seller contact selected
              </option>

              {sellerContacts.map(
                (contact) => (
                  <option
                    key={contact.id}
                    value={contact.id}
                  >
                    {contactName(contact)}
                    {contact.email
                      ? ` — ${contact.email}`
                      : ''}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="md:col-span-2 xl:col-span-4 mt-4 border-t border-slate-200 pt-5">
            <h3 className="text-base font-semibold text-slate-900">
              Property Facts
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Samantha extracted these facts from the client-detail PDF. Review each value.
            </p>
          </div>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Property Type
            </span>

            <input
              value={form.property_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  property_type:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bedrooms
            </span>

            <input
              value={form.bedrooms}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bedrooms:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bathrooms
            </span>

            <input
              value={form.bathrooms}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bathrooms:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Square Feet
            </span>

            <input
              value={form.square_feet}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  square_feet:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Garage Spaces
            </span>

            <input
              value={form.garage_spaces}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  garage_spaces:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Levels
            </span>

            <input
              value={form.levels}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  levels:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Year Built
            </span>

            <input
              value={form.year_built}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  year_built:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lot Size
            </span>

            <input
              value={form.lot_size_text}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lot_size_text:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Acres
            </span>

            <input
              value={form.acres}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  acres:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              County
            </span>

            <input
              value={form.county}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  county:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subdivision
            </span>

            <input
              value={form.subdivision}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subdivision:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <div className="md:col-span-2 xl:col-span-4 mt-4 border-t border-slate-200 pt-5">
            <h3 className="text-base font-semibold text-slate-900">
              Schools, HOA and Taxes
            </h3>
          </div>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              School District
            </span>

            <input
              value={form.school_district}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  school_district:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Elementary School
            </span>

            <input
              value={form.elementary_school}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  elementary_school:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Middle School
            </span>

            <input
              value={form.middle_school}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  middle_school:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              High School
            </span>

            <input
              value={form.high_school}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  high_school:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              HOA Fee
            </span>

            <input
              value={form.hoa_fee}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hoa_fee:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              HOA Frequency
            </span>

            <input
              value={form.hoa_frequency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hoa_frequency:
                    event.target.value,
                }))
              }
              placeholder="Monthly, quarterly, annually..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              HOA Setup Fee
            </span>

            <input
              value={form.hoa_setup_fee}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hoa_setup_fee:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Annual Taxes
            </span>

            <input
              value={form.annual_taxes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  annual_taxes:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tax Year
            </span>

            <input
              value={form.tax_year}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tax_year:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parcel Number
            </span>

            <input
              value={form.parcel_number}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  parcel_number:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Legal Description
            </span>

            <textarea
              value={form.legal_description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  legal_description:
                    event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <div className="md:col-span-2 xl:col-span-4 mt-4 border-t border-slate-200 pt-5">
            <h3 className="text-base font-semibold text-slate-900">
              Features and Included Items
            </h3>
          </div>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Features and Amenities
            </span>

            <textarea
              value={form.features_text}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  features_text:
                    event.target.value,
                }))
              }
              rows={7}
              placeholder="One feature per line..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-1 xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Inclusions
            </span>

            <textarea
              value={form.inclusions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  inclusions:
                    event.target.value,
                }))
              }
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-1 xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exclusions
            </span>

            <textarea
              value={form.exclusions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  exclusions:
                    event.target.value,
                }))
              }
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Directions
            </span>

            <textarea
              value={form.directions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  directions:
                    event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <div className="md:col-span-2 xl:col-span-4 mt-4 border-t border-slate-200 pt-5">
            <h3 className="text-base font-semibold text-slate-900">
              Marketing, Websites and Videos
            </h3>
          </div>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Public Listing Website
            </span>

            <input
              type="url"
              value={form.public_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  public_url:
                    event.target.value,
                }))
              }
              placeholder="https://..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Virtual Tour URL
            </span>

            <input
              type="url"
              value={form.virtual_tour_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  virtual_tour_url:
                    event.target.value,
                }))
              }
              placeholder="https://..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Branded YouTube / Video URL
            </span>

            <input
              type="url"
              value={form.branded_video_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  branded_video_url:
                    event.target.value,
                }))
              }
              placeholder="https://youtube.com/..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Unbranded YouTube / Video URL
            </span>

            <input
              type="url"
              value={form.unbranded_video_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unbranded_video_url:
                    event.target.value,
                }))
              }
              placeholder="https://youtube.com/..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Open House Information
            </span>

            <textarea
              value={form.open_house_info}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  open_house_info:
                    event.target.value,
                }))
              }
              rows={3}
              placeholder="Date, time and notes..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Campaign Headline
            </span>

            <input
              value={form.campaign_headline}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  campaign_headline:
                    event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Short Advertising Description
            </span>

            <textarea
              value={
                form.short_marketing_description
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  short_marketing_description:
                    event.target.value,
                }))
              }
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Full Public Listing Description
            </span>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description:
                    event.target.value,
                }))
              }
              rows={8}
              placeholder="Public marketing remarks..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        {intakeSession &&
        selectedOwner &&
        profile ? (
          <ListingMediaManager
            intakeSessionId={
              intakeSession.id
            }
            listingId={
              editingListingId
            }
            orgId={
              selectedOwner.org_id
            }
            ownerUserId={
              selectedOwner.id
            }
            createdBy={
              profile.id
            }
            disabled={saving}
            onSummaryChange={
              setMediaSummary
            }
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Upload the client-detail PDF first to create the
            secure listing-intake session used for photos and
            videos.
          </div>
        )}

        <section
          className={
            campaignReady
              ? 'mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5'
              : 'mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5'
          }
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Campaign-Readiness Check
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            This listing may be saved before every item is
            complete, but email sending remains blocked until
            all required campaign items are ready.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {campaignReadiness.map(
              (item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-xl border border-white/70 bg-white px-3 py-2 text-sm"
                >
                  <span
                    className={
                      item.ready
                        ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
                        : 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700'
                    }
                  >
                    {item.ready
                      ? '✓'
                      : '!'}
                  </span>

                  <span
                    className={
                      item.ready
                        ? 'text-slate-700'
                        : 'font-medium text-amber-800'
                    }
                  >
                    {item.label}
                  </span>
                </div>
              )
            )}
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/80 bg-white p-4">
            <input
              type="checkbox"
              checked={
                reviewConfirmed
              }
              onChange={(event) =>
                setReviewConfirmed(
                  event.target.checked
                )
              }
              className="mt-0.5 h-5 w-5"
            />

            <span>
              <span className="block font-semibold text-slate-900">
                Reviewed and Confirmed
              </span>

              <span className="mt-1 block text-sm text-slate-600">
                I reviewed the extracted property facts,
                public remarks, links, photos, media order,
                and marketing selections.
              </span>
            </span>
          </label>

          <div className="mt-4 font-semibold">
            {campaignReady
              ? 'All current campaign requirements are ready.'
              : 'Complete the remaining items before sending an email campaign.'}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={createListing}
            disabled={
              saving ||
              !selectedOwner
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />

            {saving
              ? editingListingId
                ? 'Saving Changes...'
                : 'Saving Listing...'
              : editingListingId
              ? 'Save Changes'
              : reviewConfirmed
              ? 'Confirm and Save Listing'
              : 'Save Draft Listing'}
          </button>

          {editingListingId && (
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel Editing
            </button>
          )}

          <div className="w-full text-xs text-slate-500">
            Leaving Reviewed and Confirmed unchecked saves the
            listing as a draft. You can reopen and finish it
            later.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Listing Database
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {listings.length} listings currently visible to
            your CRM role.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">
                  Listing
                </th>

                <th className="px-4 py-3">
                  Owner
                </th>

                <th className="px-4 py-3">
                  Address
                </th>

                <th className="px-4 py-3">
                  MLS
                </th>

                <th className="px-4 py-3">
                  Price
                </th>

                <th className="px-4 py-3">
                  List Date
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3">
                  Property Website
                </th>

                <th className="px-4 py-3">
                  Edit
                </th>
              </tr>
            </thead>

            <tbody>
              {listings.map(
                (listing) => (
                  <tr
                    key={listing.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {listing.title}
                      </div>

                      <div className="text-xs text-slate-500">
                        {listing.data_source}
                        {' · '}
                        {listing.review_status}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {listing.owner_user_id
                        ? ownerLookup.get(
                            listing.owner_user_id
                          ) ||
                          'CRM user'
                        : '-'}
                    </td>

                    <td className="px-4 py-3">
                      {listing.property_address}

                      {listing.city
                        ? `, ${listing.city}`
                        : ''}

                      {listing.state
                        ? `, ${listing.state}`
                        : ''}

                      {listing.zip
                        ? ` ${listing.zip}`
                        : ''}
                    </td>

                    <td className="px-4 py-3">
                      {listing.mls_number ||
                        '-'}
                    </td>

                    <td className="px-4 py-3">
                      {formatPrice(
                        listing.list_price
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {formatDate(
                        listing.list_date
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={
                          listing.listing_status
                        }
                        disabled={
                          savingListingId ===
                          listing.id
                        }
                        onChange={(event) =>
                          updateListingStatus(
                            listing.id,
                            event.target.value
                          )
                        }
                        className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        {LISTING_STATUSES.map(
                          (status) => (
                            <option
                              key={
                                status.value
                              }
                              value={
                                status.value
                              }
                            >
                              {status.label}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td className="min-w-[320px] px-4 py-3 align-top">
                      <div className="space-y-2">
                        <a
                          href={`/dashboard/email-marketing/listings/${listing.id}/website-studio`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800"
                        >
                          <Sparkles className="h-3.5 w-3.5" />

                          Open Website Studio
                        </a>


                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              listing.website_status ===
                              'published'
                                ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                                : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600'
                            }
                          >
                            {listing.website_status ||
                              'draft'}
                          </span>

                          {listing.website_slug && (
                            <span className="text-[11px] text-slate-400">
                              /property/
                              {listing.website_slug}
                            </span>
                          )}
                        </div>

                        <select
                          value={
                            websiteTemplateDrafts[
                              listing.id
                            ] ||
                            listing.website_template_key ||
                            'standard'
                          }
                          disabled={
                            savingListingId ===
                              listing.id ||
                            listing.website_status ===
                              'published'
                          }
                          onChange={(event) =>
                            setWebsiteTemplateDrafts(
                              (current) => ({
                                ...current,

                                [listing.id]:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="luxury">
                            Luxury
                          </option>

                          <option value="standard">
                            Standard
                          </option>

                          <option value="modern">
                            Modern
                          </option>
                        </select>

                        <div className="flex flex-wrap gap-2">
                          {listing.website_status ===
                          'published' ? (
                            <>
                              {listing.public_url && (
                                <a
                                  href={
                                    listing.public_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  View Website

                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}

                              <button
                                type="button"
                                disabled={
                                  savingListingId ===
                                  listing.id
                                }
                                onClick={() =>
                                  updateListingWebsite(
                                    listing,
                                    'unpublish'
                                  )
                                }
                                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingListingId ===
                                listing.id
                                  ? 'Working...'
                                  : 'Unpublish'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                savingListingId ===
                                listing.id
                              }
                              onClick={() =>
                                updateListingWebsite(
                                  listing,
                                  'publish'
                                )
                              }
                              className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingListingId ===
                              listing.id
                                ? 'Checking Compliance...'
                                : 'Publish Website'}
                            </button>
                          )}
                        </div>

                        {websiteBlockers[
                          listing.id
                        ]?.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                            <div className="font-semibold">
                              Compliance items required:
                            </div>

                            <ul className="mt-2 list-disc space-y-1 pl-4">
                              {websiteBlockers[
                                listing.id
                              ].map(
                                (
                                  blocker,
                                  blockerIndex
                                ) => (
                                  <li
                                    key={`${listing.id}-${blockerIndex}`}
                                  >
                                    {blocker}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          beginEditListing(
                            listing
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}

              {!loading &&
                listings.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No listings have been added yet.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-5 text-sm text-slate-500">
            Loading listings...
          </div>
        )}
      </section>
    </div>
  );
}





