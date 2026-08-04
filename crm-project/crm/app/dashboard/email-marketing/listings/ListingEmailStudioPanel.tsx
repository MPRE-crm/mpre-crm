'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Check,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  Loader2,
  Mail,
  Monitor,
  Pencil,
  Save,
  Smartphone,
  X,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

import {
  buildEmailHtml,
  LUXURY_EMAIL_EDITIONS,
  normalizeLuxuryEmailEdition,
  normalizeTemplateKey,
  type Listing,
  type ListingPhoto,
  type LuxuryEmailEditionKey,
  type Profile,
} from '../../../../lib/listing-email-creative';

import ListingQuickNotePanel, {
  type PersonalFollowUpSettings,
} from './ListingQuickNotePanel';


const supabase =
  getSupabaseBrowser();

export type StudioEmailListing =
  Listing & {
    org_id: string;

    owner_user_id:
      | string
      | null;
  };

export type StudioEmailSection = {
  id: string;
  listing_id: string;
  section_key: string;
  status: string;
  template_key: string;
  template_locked: boolean;
  content:
    Record<string, unknown>;
  manual_override: boolean;
  generation_version: number;
  approved_at:
    | string
    | null;
};

export type StudioEmailPhoto =
  ListingPhoto & {
    thumbnail_url:
      | string
      | null;

    file_name: string;
  };

export type StudioEmailAssignment = {
  id: string;
  section_key: string;
  edition_key: string;
  slot_key: string;
  sort_order: number;
  media_id: string;

  selected_by:
    | 'samantha'
    | 'agent';

  is_locked: boolean;
};

type ListingEmailStudioPanelProps = {
  listing:
    StudioEmailListing;

  section:
    | StudioEmailSection
    | null;

  photos:
    StudioEmailPhoto[];

  assignments:
    StudioEmailAssignment[];

  onRefresh: () =>
    Promise<void>;
};

function stringValue(
  value: unknown,
  fallback = ''
) {
  return typeof value ===
    'string'
    ? value
    : fallback;
}

function recordValue(
  value: unknown
): Record<string, unknown> {
  return Boolean(value) &&
    typeof value ===
      'object' &&
    !Array.isArray(value)
    ? (
        value as
          Record<string, unknown>
      )
    : {};
}

function stringArrayValue(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const output:
    string[] = [];

  for (const item of value) {
    const cleaned =
      stringValue(item)
        .trim();

    if (
      cleaned &&
      !output.includes(cleaned)
    ) {
      output.push(cleaned);
    }
  }

  return output;
}

function sharedPersonalFollowUpValue(
  value: unknown
):
  | PersonalFollowUpSharedSettings
  | null {
  const source =
    recordValue(value);

  const hasSharedSettings =
    Object.prototype
      .hasOwnProperty.call(
        source,
        'enabled'
      ) ||
    Object.prototype
      .hasOwnProperty.call(
        source,
        'delay_hours'
      ) ||
    Object.prototype
      .hasOwnProperty.call(
        source,
        'stop_after_reply'
      );

  if (!hasSharedSettings) {
    return null;
  }

  return {
    version: 1,

    enabled:
      source.enabled ===
      true,

    delay_hours:
      source.delay_hours ===
          24 ||
        source.delay_hours ===
          48
        ? source.delay_hours
        : 36,

    stop_after_reply:
      true,
  };
}

function editionPersonalFollowUpValue(
  value: unknown
):
  | PersonalFollowUpEditionSettings
  | null {
  const source =
    recordValue(value);

  if (
    !Object.prototype
      .hasOwnProperty.call(
        source,
        'categories'
      )
  ) {
    return null;
  }

  return {
    version: 1,

    categories:
      recordValue(
        source.categories
      ) as
        PersonalFollowUpEditionSettings[
          'categories'
        ],
  };
}

type EmailEditionStatus =
  | 'not_prepared'
  | 'needs_review'
  | 'approved';

type PersonalFollowUpSharedSettings =
  Pick<
    PersonalFollowUpSettings,
    | 'version'
    | 'enabled'
    | 'delay_hours'
    | 'stop_after_reply'
  >;

type PersonalFollowUpEditionSettings =
  Pick<
    PersonalFollowUpSettings,
    | 'version'
    | 'categories'
  >;

type EmailEditionDraft = {
  subject: string;
  preview_text: string;
  headline: string;
  body: string;
  full_description: string;
  cta_label: string;
  photo_media_ids: string[];
  status:
    EmailEditionStatus;
  approved_at:
    | string
    | null;
  approved_by:
    | string
    | null;
  manual_override: boolean;

  copy_manual_override?:
    boolean;

  personal_follow_up?:
    PersonalFollowUpEditionSettings;

  [key: string]: unknown;
};

function editionStatusValue(
  value: unknown
): EmailEditionStatus {
  return value ===
      'approved' ||
    value ===
      'needs_review'
    ? value
    : 'not_prepared';
}

function normalizeEmailEditionDraft(
  value: unknown,
  fallback:
    Partial<
      EmailEditionDraft
    > = {}
): EmailEditionDraft {
  const source =
    recordValue(value);

  const sourcePhotoIds =
    stringArrayValue(
      source.photo_media_ids
    );

  return {
    ...source,

    subject:
      stringValue(
        source.subject,
        fallback.subject ||
          ''
      ),

    preview_text:
      stringValue(
        source.preview_text,
        fallback.preview_text ||
          ''
      ),

    headline:
      stringValue(
        source.headline,
        fallback.headline ||
          ''
      ),

    body:
      stringValue(
        source.body,
        fallback.body ||
          ''
      ),

    full_description:
      stringValue(
        source.full_description,
        fallback.full_description ||
          ''
      ),

    cta_label:
      stringValue(
        source.cta_label,
        fallback.cta_label ||
          'View Full Listing'
      ),

    photo_media_ids:
      sourcePhotoIds.length >
      0
        ? sourcePhotoIds
        : fallback
            .photo_media_ids ||
          [],

    status:
      editionStatusValue(
        source.status ??
        fallback.status
      ),

    approved_at:
      stringValue(
        source.approved_at,
        fallback.approved_at ||
          ''
      ) ||
      null,

    approved_by:
      stringValue(
        source.approved_by,
        fallback.approved_by ||
          ''
      ) ||
      null,

    manual_override:
      Boolean(
        source.manual_override ??
        fallback.manual_override
      ),

    copy_manual_override:
      Boolean(
        source
          .copy_manual_override ??
        fallback
          .copy_manual_override
      ),

    personal_follow_up:
      (
        source.personal_follow_up ??
        fallback.personal_follow_up
      ) as
        | PersonalFollowUpEditionSettings
        | undefined,
  };
}

const LUXURY_EMAIL_EDITION_DEFAULT_CTA:
  Record<
    LuxuryEmailEditionKey,
    string
  > = {
  launch:
    'View Full Listing',

  views_lifestyle:
    'Experience the Property',

  design_interiors:
    'Explore the Interiors',

  property_in_motion:
    'Watch the Property Film',

  closer_look:
    'Take a Closer Look',

  agent_spotlight:
    'Share With Your Buyers',

  fresh_opportunity:
    'Revisit the Property',
};

function assignmentRank(
  assignment:
    StudioEmailAssignment
) {
  if (
    assignment.slot_key ===
    'hero'
  ) {
    return -1000;
  }

  return assignment.sort_order;
}

function emailAssignmentIndex(
  assignment:
    StudioEmailAssignment
) {
  if (
    assignment.slot_key ===
    'hero' &&
    assignment.sort_order ===
      0
  ) {
    return 0;
  }

  if (
    assignment.slot_key ===
      'supporting' &&
    assignment.sort_order >=
      0 &&
    assignment.sort_order <=
      4
  ) {
    return (
      assignment.sort_order +
      1
    );
  }

  return null;
}

export default function ListingEmailStudioPanel({
  listing,
  section,
  photos,
  assignments,
  onRefresh,
}: ListingEmailStudioPanelProps) {
  const [
    profile,
    setProfile,
  ] = useState<
    Profile | null
  >(null);

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    previewMode,
    setPreviewMode,
  ] = useState<
    'desktop' | 'mobile'
  >('desktop');

  const [
    subject,
    setSubject,
  ] = useState('');

  const [
    previewText,
    setPreviewText,
  ] = useState('');

  const [
    headline,
    setHeadline,
  ] = useState('');

  const [
    body,
    setBody,
  ] = useState('');

  const [
    fullDescription,
    setFullDescription,
  ] = useState('');

  const [
    ctaLabel,
    setCtaLabel,
  ] = useState(
    'View Full Listing'
  );


  const [
    dirty,
    setDirty,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    refreshError,
    setRefreshError,
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
    repairingPhotos,
    setRepairingPhotos,
  ] = useState(false);

  const selectedPhotos =
    useMemo(() => {
      const photoById =
        new Map(
          photos.map(
            (photo) => [
              photo.id,
              photo,
            ]
          )
        );

      const selected:
        StudioEmailPhoto[] = [];

      const seen =
        new Set<string>();

      assignments
        .filter(
          (assignment) =>
            assignment
              .section_key ===
              'email' &&
            assignment
              .edition_key ===
              'launch'
        )
        .slice()
        .sort(
          (left, right) =>
            assignmentRank(
              left
            ) -
            assignmentRank(
              right
            )
        )
        .forEach(
          (assignment) => {
            const photo =
              photoById.get(
                assignment.media_id
              );

            if (
              photo &&
              !seen.has(
                photo.id
              )
            ) {
              selected.push(
                photo
              );

              seen.add(
                photo.id
              );
            }
          }
        );

      return selected;
    }, [
      photos,
      assignments,
    ]);

  const templateKey =
    normalizeTemplateKey(
      section?.template_key
    );

  const [
    luxuryEdition,
    setLuxuryEdition,
  ] = useState<
    LuxuryEmailEditionKey
  >('launch');

  const editionDraftsRef =
    useRef<
      Partial<
        Record<
          LuxuryEmailEditionKey,
          EmailEditionDraft
        >
      >
    >({});

  const [
    editionPhotoIds,
    setEditionPhotoIds,
  ] = useState<
    string[]
  >([]);

  const [
    editionStatus,
    setEditionStatus,
  ] = useState<
    EmailEditionStatus
  >('not_prepared');

  const [
    photoPickerIndex,
    setPhotoPickerIndex,
  ] = useState<
    number | null
  >(null);

  const sharedPersonalFollowUpRef =
    useRef<
      PersonalFollowUpSharedSettings |
      null
    >(null);

  const storedSectionEditions =
    recordValue(
      section
        ?.content
        ?.editions
    );

  const persistedSharedPersonalFollowUp =
    sharedPersonalFollowUpValue(
      section
        ?.content
        ?.personal_follow_up
    ) ||
    LUXURY_EMAIL_EDITIONS
      .map(
        (edition) =>
          sharedPersonalFollowUpValue(
            recordValue(
              storedSectionEditions[
                edition.value
              ]
            )
              .personal_follow_up
          )
      )
      .find(Boolean) ||
    null;

  const activeEditionPersonalFollowUp =
    editionPersonalFollowUpValue(
      editionDraftsRef
        .current[
        luxuryEdition
      ]
        ?.personal_follow_up
    ) ||
    editionPersonalFollowUpValue(
      recordValue(
        storedSectionEditions[
          luxuryEdition
        ]
      )
        .personal_follow_up
    ) ||
    null;

  const activeSharedPersonalFollowUp =
    sharedPersonalFollowUpRef
      .current ||
    persistedSharedPersonalFollowUp ||
    {
      version: 1,
      enabled: false,
      delay_hours: 36,
      stop_after_reply: true,
    };

  const activePersonalFollowUpSettings:
    PersonalFollowUpSettings = {
    ...activeSharedPersonalFollowUp,

    version: 1,

    categories:
      activeEditionPersonalFollowUp
        ?.categories ||
      {},
  };

  const marketingPhotos =
    useMemo(
      () =>
        photos.filter(
          (photo) =>
            photo.use_in_marketing
        ),
      [photos]
    );

  const activeEditionAssignmentsByIndex =
    useMemo(() => {
      const output =
        new Map<
          number,
          StudioEmailAssignment
        >();

      assignments
        .filter(
          (assignment) =>
            assignment
              .section_key ===
              'email' &&
            assignment
              .edition_key ===
              luxuryEdition
        )
        .forEach(
          (assignment) => {
            const index =
              emailAssignmentIndex(
                assignment
              );

            if (
              index !==
              null
            ) {
              output.set(
                index,
                assignment
              );
            }
          }
        );

      return output;
    }, [
      assignments,
      luxuryEdition,
    ]);

  const activeEditionPhotos =
    useMemo(() => {
      const photoById =
        new Map(
          photos.map(
            (photo) => [
              photo.id,
              photo,
            ]
          )
        );

      const output:
        StudioEmailPhoto[] = [];

      const seen =
        new Set<string>();

      for (
        const photoId of
        editionPhotoIds
      ) {
        const photo =
          photoById.get(
            photoId
          );

        if (
          photo &&
          !seen.has(photo.id)
        ) {
          output.push(photo);
          seen.add(photo.id);
        }
      }

      return output;
    }, [
      photos,
      editionPhotoIds,
    ]);

  useEffect(() => {
    const content =
      section?.content ||
      {};

    const fallbackHeadline =
      listing
        .campaign_headline ||
      listing.title;

    const fallbackBody =
      listing
        .short_marketing_description ||
      listing.public_remarks ||
      listing.description ||
      '';

    const selectedEditionKey =
      normalizeLuxuryEmailEdition(
        content.luxury_edition
      );

    const storedEditions =
      recordValue(
        content.editions
      );

    const launchPhotoIds =
      selectedPhotos.map(
        (photo) =>
          photo.id
      );

    const legacyLaunch =
      normalizeEmailEditionDraft(
        storedEditions.launch,
        {
          subject:
            stringValue(
              content.subject,
              `New Listing: ${listing.title}`
            ),

          preview_text:
            stringValue(
              content.preview_text,
              fallbackBody
            ),

          headline:
            stringValue(
              content.headline,
              fallbackHeadline
            ),

          body:
            stringValue(
              content.body,
              fallbackBody
            ),

          full_description:
            stringValue(
              content.full_description,
              listing.public_remarks ||
                listing.description ||
                ''
            ),

          cta_label:
            stringValue(
              content.cta_label,
              'View Full Listing'
            ),

          photo_media_ids:
            launchPhotoIds,

          status:
            editionStatusValue(
              section?.status
            ),

          approved_at:
            section
              ?.approved_at ||
            null,

          approved_by:
            null,

          manual_override:
            Boolean(
              section
                ?.manual_override
            ),
        }
      );

    const nextDrafts:
      Partial<
        Record<
          LuxuryEmailEditionKey,
          EmailEditionDraft
        >
      > = {};

    for (
      const edition of
      LUXURY_EMAIL_EDITIONS
    ) {
      const fallbackDraft =
        edition.value ===
          'launch'
          ? legacyLaunch
          : normalizeEmailEditionDraft(
              null,
              {
                cta_label:
                  LUXURY_EMAIL_EDITION_DEFAULT_CTA[
                    edition.value
                  ],

                status:
                  'not_prepared',

                photo_media_ids:
                  [],
              }
            );

      nextDrafts[
        edition.value
      ] =
        normalizeEmailEditionDraft(
          storedEditions[
            edition.value
          ],
          fallbackDraft
        );
    }

    editionDraftsRef.current =
      nextDrafts;

    const activeDraft =
      nextDrafts[
        selectedEditionKey
      ] ||
      legacyLaunch;

    setLuxuryEdition(
      selectedEditionKey
    );

    setSubject(
      activeDraft.subject
    );

    setPreviewText(
      activeDraft.preview_text
    );

    setHeadline(
      activeDraft.headline
    );

    setBody(
      activeDraft.body
    );

    setFullDescription(
      activeDraft
        .full_description
    );

    setCtaLabel(
      activeDraft.cta_label
    );

    setEditionPhotoIds(
      activeDraft
        .photo_media_ids
        .length >
      0
        ? activeDraft
            .photo_media_ids
        : selectedEditionKey ===
            'launch'
          ? launchPhotoIds
          : []
    );

    setEditionStatus(
      activeDraft.status
    );

    setDirty(false);

    setEditing(
      !section ||
      Object.keys(
        content
      ).length === 0
    );
  }, [
    listing,
    section,
    selectedPhotos,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setLoadingProfile(
          true
        );

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
          data: profileRow,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('*')
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
              'Marketing profile not found.'
          );
        }

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

        const identityResponse =
          await fetch(
            `/api/preferences/marketing-identity?listing_id=${encodeURIComponent(
              listing.id
            )}`,
            {
              method:
                'GET',

              headers: {
                Authorization:
                  `Bearer ${sessionResult.session.access_token}`,
              },

              cache:
                'no-store',
            }
          );

        const identityResult =
          await identityResponse
            .json()
            .catch(
              () => ({})
            );

        if (
          !identityResponse.ok ||
          !identityResult?.ok ||
          !identityResult?.profile
        ) {
          throw new Error(
            identityResult?.error ||
              'Could not load the saved marketing identity.'
          );
        }

        const response =
          await fetch(
            '/api/preferences/organization-compliance',
            {
              method:
                'GET',

              headers: {
                Authorization:
                  `Bearer ${sessionResult.session.access_token}`,
              },

              cache:
                'no-store',
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
              'Could not load brokerage compliance settings.'
          );
        }

        if (mounted) {
          const organizationProfile =
            (
              result.organization ||
              {}
            ) as Partial<Profile>;

          const personalProfile =
            identityResult.profile as Profile;

          setProfile({
            ...organizationProfile,
            ...personalProfile,
          } as Profile);
        }
      } catch (
        profileError: any
      ) {
        if (mounted) {
          setError(
            profileError
              ?.message ||
              'Could not load the email marketing identity.'
          );
        }
      } finally {
        if (mounted) {
          setLoadingProfile(
            false
          );
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const previewHtml =
    useMemo(() => {
      if (!profile) {
        return '';
      }

      return buildEmailHtml({
        listing: {
          ...listing,

          public_remarks:
            fullDescription,

          description:
            fullDescription,
        },

        photos:
          activeEditionPhotos,

        photoCount:
          Math.max(
            1,
            activeEditionPhotos.length
          ),

        headline,

        description:
          body,

        previewText,

        campaignType:
          'listing_ad',

        templateKey,

        luxuryEdition,

        generatedArtworkUrl:
          '',

        primaryCtaLabel:
          ctaLabel,

        audienceContactType:
          'realtor',

        profile,
      });
    }, [
      profile,
      listing,
      activeEditionPhotos,
      headline,
      body,
      fullDescription,
      previewText,
      templateKey,
      luxuryEdition,
      ctaLabel,
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

  const complianceReady =
    Boolean(
      profile
        ?.marketing_physical_address &&
      profile
        ?.marketing_licensed_business_name &&
      profile
        ?.marketing_privacy_policy_url
    );

  function switchLuxuryEdition(
    nextEdition:
      LuxuryEmailEditionKey
  ) {
    if (
      nextEdition ===
      luxuryEdition
    ) {
      return;
    }

    const currentWasDirty =
      dirty;

    const currentStored =
      normalizeEmailEditionDraft(
        editionDraftsRef
          .current[
          luxuryEdition
        ],
        {
          cta_label:
            LUXURY_EMAIL_EDITION_DEFAULT_CTA[
              luxuryEdition
            ],

          status:
            editionStatus,

          photo_media_ids:
            editionPhotoIds,
        }
      );

    editionDraftsRef.current[
      luxuryEdition
    ] = {
      ...currentStored,

      subject,

      preview_text:
        previewText,

      headline,

      body,

      full_description:
        fullDescription,

      cta_label:
        ctaLabel,

      photo_media_ids:
        editionPhotoIds,

      status:
        editionStatus,

      manual_override:
        currentStored
          .manual_override ||
        currentWasDirty,

      copy_manual_override:
        currentStored
          .copy_manual_override ===
          true ||
        currentWasDirty,
    };

    const nextDraft =
      normalizeEmailEditionDraft(
        editionDraftsRef
          .current[
          nextEdition
        ],
        {
          cta_label:
            LUXURY_EMAIL_EDITION_DEFAULT_CTA[
              nextEdition
            ],

          status:
            'not_prepared',

          photo_media_ids:
            [],
        }
      );

    setLuxuryEdition(
      nextEdition
    );

    setSubject(
      nextDraft.subject
    );

    setPreviewText(
      nextDraft.preview_text
    );

    setHeadline(
      nextDraft.headline
    );

    setBody(
      nextDraft.body
    );

    setFullDescription(
      nextDraft
        .full_description
    );

    setCtaLabel(
      nextDraft.cta_label
    );

    setEditionPhotoIds(
      nextDraft
        .photo_media_ids
        .length >
      0
        ? nextDraft
            .photo_media_ids
        : nextEdition ===
            'launch'
          ? selectedPhotos.map(
              (photo) =>
                photo.id
            )
          : []
    );

    setEditionStatus(
      nextDraft.status
    );

    setDirty(false);
    setError(null);
    setNotice(null);
  }

  function changeField(
    setter:
      (value: string) =>
        void,
    value: string
  ) {
    setter(value);
    setDirty(true);
    setError(null);
    setNotice(null);
  }

  function changePersonalFollowUpSettings(
    settings:
      PersonalFollowUpSettings,

    options?: {
      markDirty?: boolean;
    }
  ) {
    sharedPersonalFollowUpRef.current = {
      version: 1,

      enabled:
        settings.enabled,

      delay_hours:
        settings.delay_hours,

      stop_after_reply:
        true,
    };

    const currentStored =
      normalizeEmailEditionDraft(
        editionDraftsRef
          .current[
          luxuryEdition
        ],
        {
          cta_label:
            LUXURY_EMAIL_EDITION_DEFAULT_CTA[
              luxuryEdition
            ],

          status:
            editionStatus,

          photo_media_ids:
            editionPhotoIds,
        }
      );

    editionDraftsRef.current[
      luxuryEdition
    ] = {
      ...currentStored,

      personal_follow_up: {
        version: 1,

        categories:
          settings.categories,
      },

      manual_override:
        currentStored
          .manual_override,
    };

    if (
      options?.markDirty !==
      false
    ) {
      setError(null);
      setNotice(null);
    }
  }

  async function refreshEditionStoriesAndPhotos() {
    if (!section) {
      setError(
        'Prepare the Email section before refreshing its stories and photos.'
      );

      return;
    }

    try {
      setRepairingPhotos(
        true
      );

      setRefreshError(null);
      setError(null);
      setNotice(null);

      const {
        data:
          sessionResult,
        error:
          sessionError,
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

      const response =
        await fetch(
          '/api/marketing/listing-marketing-package/prepare',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${sessionResult.session.access_token}`,
            },

            body:
              JSON.stringify({
                listing_id:
                  listing.id,

                mode:
                  'refresh_email_edition_stories',
              }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            'Samantha could not compose the Email edition stories and photo sequences.'
        );
      }

      setPhotoPickerIndex(
        null
      );

      setNotice(
        result.message ||
          'Samantha composed all seven Email edition stories around their final photo sequences.'
      );

      await onRefresh();
    }
    catch (
      repairError: any
    ) {
      setRefreshError(
        (
          repairError?.message ||
          'Could not refresh the Email edition stories and photos.'
        ) +
          ' The photos and copy shown below are the previously saved version. This failed refresh saved nothing.'
      );
    }
    finally {
      setRepairingPhotos(
        false
      );
    }
  }

  async function selectEditionPhoto(
    photo:
      StudioEmailPhoto
  ) {
    const targetIndex =
      photoPickerIndex;

    if (
      targetIndex ===
        null ||
      !section
    ) {
      return;
    }

    if (
      editionPhotoIds.length !==
        6 ||
      new Set(
        editionPhotoIds
      ).size !== 6
    ) {
      setError(
        'This edition must have six valid photos before one can be replaced. Prepare the package with Samantha first.'
      );

      return;
    }

    const duplicateIndex =
      editionPhotoIds
        .findIndex(
          (
            photoId,
            index
          ) =>
            photoId ===
              photo.id &&
            index !==
              targetIndex
        );

    if (
      duplicateIndex >=
      0
    ) {
      setError(
        'That photo is already used in another slot for this edition.'
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

      const slot =
        targetIndex ===
          0
          ? {
              slot_key:
                'hero',
              sort_order:
                0,
            }
          : {
              slot_key:
                'supporting',
              sort_order:
                targetIndex -
                1,
            };

      const previousAssignment =
        activeEditionAssignmentsByIndex
          .get(
            targetIndex
          ) ||
        null;

      const nextPhotoIds =
        [
          ...editionPhotoIds,
        ];

      nextPhotoIds[
        targetIndex
      ] =
        photo.id;

      const storedEdition =
        normalizeEmailEditionDraft(
          editionDraftsRef
            .current[
            luxuryEdition
          ],
          {
            subject,
            preview_text:
              previewText,
            headline,
            body,
            full_description:
              fullDescription,
            cta_label:
              ctaLabel,
            photo_media_ids:
              editionPhotoIds,
            status:
              editionStatus,
          }
        );

      const nextEditionDraft:
        EmailEditionDraft = {
        ...storedEdition,

        subject,
        preview_text:
          previewText,
        headline,
        body,
        full_description:
          fullDescription,
        cta_label:
          ctaLabel,

        photo_media_ids:
          nextPhotoIds,

        status:
          'needs_review',

        approved_at:
          null,

        approved_by:
          null,

        manual_override:
          storedEdition
            .manual_override,

        copy_manual_override:
          storedEdition
            .copy_manual_override ===
            true,
      };

      const nextEditionDrafts = {
        ...editionDraftsRef
          .current,

        [luxuryEdition]:
          nextEditionDraft,
      };

      const nextContent = {
        ...section.content,

        subject:
          nextEditionDraft
            .subject,

        preview_text:
          nextEditionDraft
            .preview_text,

        headline:
          nextEditionDraft
            .headline,

        body:
          nextEditionDraft
            .body,

        full_description:
          nextEditionDraft
            .full_description,

        cta_label:
          nextEditionDraft
            .cta_label,

        luxury_edition:
          luxuryEdition,

        editions: {
          ...recordValue(
            section.content
              .editions
          ),

          ...nextEditionDrafts,
        },

        generated_asset_id:
          null,

        generated_asset_url:
          null,

        generated_asset_format:
          null,
      };

      const assignmentPayload = {
        listing_id:
          listing.id,

        org_id:
          listing.org_id,

        owner_user_id:
          listing
            .owner_user_id,

        section_key:
          'email',

        edition_key:
          luxuryEdition,

        ...slot,

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
      };

      const {
        error:
          assignmentError,
      } = await supabase
        .from(
          'listing_marketing_photo_assignments'
        )
        .upsert(
          assignmentPayload,
          {
            onConflict:
              'listing_id,section_key,edition_key,slot_key,sort_order',
          }
        );

      if (
        assignmentError
      ) {
        throw assignmentError;
      }

      const {
        error:
          sectionError,
      } = await supabase
        .from(
          'listing_marketing_sections'
        )
        .update({
          content:
            nextContent,

          manual_override:
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
          'id',
          section.id
        );

      if (
        sectionError
      ) {
        if (
          previousAssignment
        ) {
          await supabase
            .from(
              'listing_marketing_photo_assignments'
            )
            .upsert(
              {
                ...assignmentPayload,

                media_id:
                  previousAssignment
                    .media_id,

                selected_by:
                  previousAssignment
                    .selected_by,

                is_locked:
                  previousAssignment
                    .is_locked,
              },
              {
                onConflict:
                  'listing_id,section_key,edition_key,slot_key,sort_order',
              }
            );
        }
        else {
          await supabase
            .from(
              'listing_marketing_photo_assignments'
            )
            .delete()
            .eq(
              'listing_id',
              listing.id
            )
            .eq(
              'section_key',
              'email'
            )
            .eq(
              'edition_key',
              luxuryEdition
            )
            .eq(
              'slot_key',
              slot.slot_key
            )
            .eq(
              'sort_order',
              slot.sort_order
            );
        }

        throw sectionError;
      }

      editionDraftsRef.current =
        nextEditionDrafts;

      setEditionPhotoIds(
        nextPhotoIds
      );

      setEditionStatus(
        'needs_review'
      );

      setDirty(false);
      setPhotoPickerIndex(null);

      const editionLabel =
        LUXURY_EMAIL_EDITIONS
          .find(
            (edition) =>
              edition.value ===
                luxuryEdition
          )
          ?.label ||
        'Email edition';

      setNotice(
        editionLabel +
          ' photo updated and locked only for this edition and slot.'
      );

      await onRefresh();
    }
    catch (
      photoError: any
    ) {
      setError(
        photoError?.message ||
          'Could not save the edition photo.'
      );
    }
    finally {
      setSaving(false);
    }
  }

  async function saveCreative(
    nextStatus:
      | 'needs_review'
      | 'approved'
  ) {
    if (!section) {
      setError(
        'The Email section has not been prepared yet.'
      );

      return;
    }

    if (
      !subject.trim() ||
      !previewText.trim() ||
      !headline.trim() ||
      !fullDescription.trim() ||
      !ctaLabel.trim()
    ) {
      setError(
        'Complete the subject, inbox preview, headline, full listing description and main button text.'
      );

      return;
    }

    if (
      editionPhotoIds.length !==
        6 ||
      new Set(
        editionPhotoIds
      ).size !== 6
    ) {
      setError(
        'This Email edition must contain six unique valid photos before it can be saved or approved.'
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

      const approvedAt =
        nextStatus ===
        'approved'
          ? new Date()
              .toISOString()
          : null;

      const storedEdition =
        normalizeEmailEditionDraft(
          editionDraftsRef
            .current[
            luxuryEdition
          ],
          {
            cta_label:
              LUXURY_EMAIL_EDITION_DEFAULT_CTA[
                luxuryEdition
              ],

            status:
              editionStatus,

            photo_media_ids:
              editionPhotoIds,
          }
        );

      const nextEditionDraft:
        EmailEditionDraft = {
        ...storedEdition,

        subject:
          subject.trim(),

        preview_text:
          previewText.trim(),

        headline:
          headline.trim(),

        body:
          body.trim(),

        full_description:
          fullDescription.trim(),

        cta_label:
          ctaLabel.trim(),

        photo_media_ids:
          editionPhotoIds,

        status:
          nextStatus,

        approved_at:
          approvedAt,

        approved_by:
          nextStatus ===
            'approved'
            ? userResult
                .user.id
            : null,

        manual_override:
          storedEdition
            .manual_override ||
          dirty,

        copy_manual_override:
          storedEdition
            .copy_manual_override ===
            true ||
          dirty,
      };

      const nextEditionDrafts:
        Partial<
          Record<
            LuxuryEmailEditionKey,
            EmailEditionDraft
          >
        > = {
        ...editionDraftsRef
          .current,

        [luxuryEdition]:
          nextEditionDraft,
      };

      editionDraftsRef.current =
        nextEditionDrafts;

      const nextEditions = {
        ...recordValue(
          section.content
            .editions
        ),

        ...nextEditionDrafts,
      };

      const nextContent = {
        ...section.content,

        subject:
          nextEditionDraft
            .subject,

        preview_text:
          nextEditionDraft
            .preview_text,

        headline:
          nextEditionDraft
            .headline,

        body:
          nextEditionDraft
            .body,

        full_description:
          nextEditionDraft
            .full_description,

        cta_label:
          nextEditionDraft
            .cta_label,

        luxury_edition:
          luxuryEdition,

        editions:
          nextEditions,

        personal_follow_up:
          sharedPersonalFollowUpRef
            .current ||
          persistedSharedPersonalFollowUp ||
          {
            version: 1,
            enabled: false,
            delay_hours: 36,
            stop_after_reply: true,
          },

        generated_asset_id:
          null,

        generated_asset_url:
          null,

        generated_asset_format:
          null,
      };

      const {
        error: saveError,
      } = await supabase
        .from(
          'listing_marketing_sections'
        )
        .update({
          content:
            nextContent,

          manual_override:
            section
              .manual_override ||
            dirty,

          status:
            nextStatus,

          approved_at:
            approvedAt,

          approved_by:
            nextStatus ===
            'approved'
              ? userResult.user.id
              : null,

          updated_by:
            userResult.user.id,
        })
        .eq(
          'id',
          section.id
        );

      if (saveError) {
        throw saveError;
      }

      setDirty(false);
      setEditing(false);
      setEditionStatus(
        nextStatus
      );

      const editionLabel =
        LUXURY_EMAIL_EDITIONS.find(
          (edition) =>
            edition.value ===
            luxuryEdition
        )?.label ||
        'Luxury email edition';

      setNotice(
        nextStatus ===
        'approved'
          ? `${editionLabel} approved.`
          : `${editionLabel} draft saved. Review the preview, then approve it.`
      );

      await onRefresh();
    } catch (
      saveError: any
    ) {
      setError(
        saveError?.message ||
          'Could not save the email advertisement.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {refreshError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {refreshError}
          </div>

          <button
            type="button"
            onClick={() =>
              setRefreshError(
                null
              )
            }
            className="self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-violet-700">
              <Mail className="h-4 w-4" />
              Email Advertisement
            </div>

            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Creative Review and Approval
            </h3>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Review each Samantha-created marketing story, its wording and the property photos chosen to support that angle.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                repairingPhotos ||
                saving ||
                loadingProfile ||
                !section
              }
              onClick={() =>
                void refreshEditionStoriesAndPhotos()
              }
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {repairingPhotos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}

              {repairingPhotos
                ? 'Samantha Is Composing...'
                : 'Refresh Edition Stories & Photos'}
            </button>

            <button
              type="button"
              onClick={() =>
                setEditing(
                  (current) =>
                    !current
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />

              {editing
                ? 'Close Editor'
                : 'Edit Email'}
            </button>

            <button
              type="button"
              disabled={
                saving ||
                loadingProfile ||
                !section
              }
              onClick={() =>
                void saveCreative(
                  'needs_review'
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              Save Draft
            </button>

            <button
              type="button"
              disabled={
                saving ||
                loadingProfile ||
                !section
              }
              onClick={() =>
                void saveCreative(
                  'approved'
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />

              {editionStatus ===
              'approved'
                ? 'Approved'
                : 'Approve Edition'}
            </button>
          </div>
        </div>

        {templateKey ===
          'luxury' && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm font-bold text-slate-950">
              Luxury Email Edition
            </div>

            <div className="mt-1 text-sm leading-6 text-slate-600">
              Samantha creates a different marketing story, message and photo collection for each property angle.
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {LUXURY_EMAIL_EDITIONS.map(
                (edition) => {
                  const selected =
                    luxuryEdition ===
                    edition.value;

                  const editionState =
                    selected
                      ? editionStatus
                      : editionStatusValue(
                          editionDraftsRef
                            .current[
                            edition.value
                          ]?.status
                        );

                  return (
                    <button
                      key={
                        edition.value
                      }
                      type="button"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        switchLuxuryEdition(
                          edition.value
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                        selected
                          ? 'border-amber-500 bg-white ring-2 ring-amber-100'
                          : 'border-amber-100 bg-white/70 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-bold text-slate-950">
                          {edition.label}
                        </div>

                        {selected && (
                          <Check className="h-5 w-5 shrink-0 text-amber-700" />
                        )}
                      </div>

                      <div className="mt-2 text-sm leading-5 text-slate-600">
                        {
                          edition.description
                        }
                      </div>

                      <div
                        className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          editionState ===
                          'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : editionState ===
                              'needs_review'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {editionState ===
                        'approved'
                          ? 'Approved'
                          : editionState ===
                            'needs_review'
                            ? 'Needs Review'
                            : 'Prepare with Samantha'}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}

        {templateKey ===
          'luxury' && (
          <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-violet-800">
                  <ImageIcon className="h-4 w-4" />
                  Photos for This Edition
                </div>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Samantha selected these six photos for the active edition. Changing one locks only this edition and exact slot.
                </p>
              </div>

              <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700 shadow-sm">
                {activeEditionPhotos.length}/6 ready
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from(
                {
                  length: 6,
                },
                (
                  _,
                  index
                ) => {
                  const photoId =
                    editionPhotoIds[
                      index
                    ] ||
                    '';

                  const photo =
                    photos.find(
                      (candidate) =>
                        candidate.id ===
                          photoId
                    ) ||
                    null;

                  const assignment =
                    activeEditionAssignmentsByIndex
                      .get(index) ||
                    null;

                  return (
                    <div
                      key={index}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
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
                              photo.file_name
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-3 text-center text-xs font-semibold text-amber-700">
                            Photo needs repair
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {index ===
                          0
                            ? 'Hero'
                            : 'Supporting ' +
                              index}
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          {assignment
                            ?.is_locked
                            ? 'Your choice - locked'
                            : 'Samantha recommended'}
                        </div>

                        <button
                          type="button"
                          disabled={
                            saving ||
                            editionPhotoIds
                              .length !==
                              6
                          }
                          onClick={() =>
                            setPhotoPickerIndex(
                              index
                            )
                          }
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Change Photo
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {photoPickerIndex !==
              null && (
              <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-950">
                      Choose a replacement
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      The selected photo will be locked only to this edition and slot.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPhotoPickerIndex(
                        null
                      )
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    aria-label="Close photo picker"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {marketingPhotos.map(
                    (photo) => {
                      const usedInAnotherSlot =
                        editionPhotoIds
                          .some(
                            (
                              photoId,
                              index
                            ) =>
                              photoId ===
                                photo.id &&
                              index !==
                                photoPickerIndex
                          );

                      return (
                        <button
                          key={
                            photo.id
                          }
                          type="button"
                          disabled={
                            saving ||
                            usedInAnotherSlot
                          }
                          onClick={() =>
                            void selectEditionPhoto(
                              photo
                            )
                          }
                          className={
                            usedInAnotherSlot
                              ? 'overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left opacity-45'
                              : 'overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:border-violet-400 hover:ring-2 hover:ring-violet-100'
                          }
                        >
                          <div className="aspect-[4/3] bg-slate-100">
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
                          </div>

                          <div className="p-3 text-xs font-semibold text-slate-700">
                            {usedInAnotherSlot
                              ? 'Already used in this edition'
                              : photo.title ||
                                photo.file_name}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Creative Status
            </div>

            <div className={`mt-2 font-bold ${
              editionStatus ===
              'approved'
                ? 'text-emerald-700'
                : editionStatus ===
                  'needs_review'
                  ? 'text-amber-700'
                  : 'text-slate-600'
            }`}>
              {editionStatus ===
              'approved'
                ? 'Approved'
                : editionStatus ===
                  'needs_review'
                  ? 'Needs Review'
                  : 'Not Prepared'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Sender Identity
            </div>

            <div className={`mt-2 font-bold ${
              senderReady
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}>
              {senderReady
                ? 'Ready'
                : 'Needs Attention'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Email Compliance
            </div>

            <div className={`mt-2 font-bold ${
              complianceReady
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}>
              {complianceReady
                ? 'Ready'
                : 'Needs Attention'}
            </div>
          </div>
        </div>
      </section>

      {editing && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-700" />

            <h3 className="font-bold text-slate-950">
              Email Wording
            </h3>
          </div>

          <div className="mt-4 grid gap-4">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Email Subject
              </span>

              <input
                value={subject}
                onChange={(event) =>
                  changeField(
                    setSubject,
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Inbox Preview Text
              </span>

              <textarea
                value={previewText}
                onChange={(event) =>
                  changeField(
                    setPreviewText,
                    event.target.value
                  )
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Email Headline
              </span>

              <input
                value={headline}
                onChange={(event) =>
                  changeField(
                    setHeadline,
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>


            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Full Public Listing Description
              </span>

              <textarea
                value={fullDescription}
                onChange={(event) =>
                  changeField(
                    setFullDescription,
                    event.target.value
                  )
                }
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Main Button Text
              </span>

              <input
                value={ctaLabel}
                onChange={(event) =>
                  changeField(
                    setCtaLabel,
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </section>
      )}

      <ListingQuickNotePanel
        listing={listing}
        profile={profile}
        luxuryEdition={
          luxuryEdition
        }
        editionHeadline={
          headline
        }
        editionBody={
          body
        }
        initialSettings={
          activePersonalFollowUpSettings
        }
        settingsKey={
          `${section?.id || 'none'}:${luxuryEdition}`
        }
        onSettingsChange={
          changePersonalFollowUpSettings
        }
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-violet-700" />

            <div>
              <h3 className="font-bold text-slate-950">
                Live Email Preview
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Preview the finished advertisement before approving it.
              </p>
            </div>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() =>
                setPreviewMode(
                  'desktop'
                )
              }
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                previewMode ===
                'desktop'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Desktop
            </button>

            <button
              type="button"
              onClick={() =>
                setPreviewMode(
                  'mobile'
                )
              }
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                previewMode ===
                'mobile'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Mobile
            </button>
          </div>
        </div>

        {loadingProfile ? (
          <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Preparing email preview...
          </div>
        ) : previewHtml ? (
          <div className="mt-5 overflow-x-auto rounded-2xl bg-slate-100 p-4">
            <iframe
              title="Marketing Studio email preview"
              srcDoc={previewHtml}
              className={`mx-auto h-[940px] rounded-xl border border-slate-200 bg-white transition-all ${
                previewMode ===
                'mobile'
                  ? 'w-[390px] max-w-full'
                  : 'w-full'
              }`}
            />
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            The email preview could not be prepared.
          </div>
        )}
      </section>

      {section?.status ===
        'approved' &&
        !dirty && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Approved email creative is ready for campaign delivery.
        </div>
      )}
    </div>
  );
}
