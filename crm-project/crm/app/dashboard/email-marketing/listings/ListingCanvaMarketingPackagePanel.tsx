'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  Printer,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

import {
  CANVA_FLYER_STATUSES,
  CANVA_FLYER_STYLES,
  CANVA_FLYER_TEMPLATES,
  CANVA_FLYER_TYPES,
  canvaFlyerReadinessIssues,
  canvaFlyerTypeForKey,
  defaultCanvaFlyerCopy,
  emptyCanvaFlyerPackage,
  parseCanvaFlyerPackage,
  updateCanvaFlyerPiece,
  validateCanvaUrl,
  type CanvaFlyerCopy,
  type CanvaFlyerPieceState,
  type CanvaFlyerStatus,
  type CanvaFlyerStyle,
  type CanvaFlyerTemplate,
  type CanvaFlyerType,
} from '../../../../lib/listing-canva-marketing-package';

import {
  listingQrCodeDataUrl,
  type ListingQrAssignment,
} from '../../../../lib/client/listingQrCode';

import ListingGoldEstateFlyerPreview from './ListingGoldEstateFlyerPreview';
import ListingLuxuryBlackWhiteFlyerPreview from './ListingLuxuryBlackWhiteFlyerPreview';

const supabase =
  getSupabaseBrowser();

type FlyerStudioListing = {
  id: string;
  owner_user_id:
    | string
    | null;
  title: string;
  campaign_headline:
    | string
    | null;
  public_remarks:
    | string
    | null;
  short_marketing_description:
    | string
    | null;
  list_price:
    | number
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
  garage_spaces:
    | number
    | null;
  year_built:
    | number
    | null;
  lot_size_text:
    | string
    | null;
  website_status?:
    | string
    | null;
  public_url?:
    | string
    | null;
};

type FlyerStudioSection = {
  id: string;
  section_key: string;
  status: string;
  content:
    Record<string, unknown>;
  updated_at: string;
};

type FlyerStudioPhoto = {
  id: string;
  public_url: string;
  thumbnail_url:
    | string
    | null;
  file_name: string;
  title:
    | string
    | null;
  caption:
    | string
    | null;
  use_in_marketing: boolean;
};

type FlyerStudioAssignment = {
  section_key: string;
  slot_key: string;
  sort_order: number;
  media_id: string;
  selected_by:
    | 'samantha'
    | 'agent';
  is_locked: boolean;
};

type MarketingBrand = {
  name:
    | string
    | null;
  logo_url:
    | string
    | null;
};

type MarketingIdentityPayload = {
  profile: {
    marketing_from_name:
      | string
      | null;
    marketing_phone:
      | string
      | null;
    marketing_headshot_url:
      | string
      | null;
    marketing_from_email:
      | string
      | null;
    marketing_title:
      | string
      | null;
    marketing_website_url:
      | string
      | null;
    marketing_license_number:
      | string
      | null;
    marketing_logo_url:
      | string
      | null;
    marketing_signature_image_url:
      | string
      | null;
  };
  branding: {
    personal: MarketingBrand;
    organization: MarketingBrand;
    brokerage: MarketingBrand;
  };
  compliance: {
    advertisement_label:
      | string
      | null;
    standard_disclaimer:
      | string
      | null;
    mls_attribution:
      | string
      | null;
    broker_license_number:
      | string
      | null;
    public_office_address:
      | string
      | null;
  };
};

type FlyerDraft = {
  style:
    | CanvaFlyerStyle
    | '';
  templateName: string;
  templateUrl: string;
  completedDesignUrl: string;
  workflowStatus:
    CanvaFlyerStatus;
  copy: CanvaFlyerCopy;
};

type PhotoSlotRequest = {
  slotKey: string;
  sortOrder: number;
  label: string;
};

type Props = {
  listing:
    FlyerStudioListing;
  sections:
    FlyerStudioSection[];
  photos:
    FlyerStudioPhoto[];
  assignments:
    FlyerStudioAssignment[];
  saving: boolean;
  onChoosePhoto: (
    slot: PhotoSlotRequest
  ) => void;
  onRefresh: () =>
    Promise<void>;
};

type ListingQrResponse = {
  ok?: boolean;
  assignment?:
    | ListingQrAssignment
    | null;
  error?: string;
  message?: string;
};

const STEPS = [
  'Choose Flyer Type',
  'Choose Flyer Style',
  'Choose Canva Template',
  'Choose Flyer Photos',
  'Edit Flyer Wording',
  'Finish and Save Flyer',
] as const;

function flyerStepStorageKey(
  listingId: string
) {
  return `crm:flyer-active-step:${listingId}`;
}

function consumeRequestedFlyerStep(
  listingId: string
) {
  if (
    typeof window === 'undefined'
  ) {
    return 1;
  }

  const key =
    flyerStepStorageKey(
      listingId
    );
  const requested =
    window.sessionStorage
      .getItem(key);

  window.sessionStorage
    .removeItem(key);

  return requested === '4'
    ? 4
    : 1;
}

function text(value: unknown) {
  return typeof value ===
    'string'
    ? value.trim()
    : '';
}

function record(
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

function filenamePart(
  value: string,
  fallback: string
) {
  const cleaned =
    value
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        '-'
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        ''
      )
      .slice(0, 90);

  return cleaned ||
    fallback;
}

function flyerStatusLabel(
  status: CanvaFlyerStatus
) {
  const labels:
    Record<
      CanvaFlyerStatus,
      string
    > = {
      not_started:
        'Not Started',
      editing:
        'Editing',
      ready_for_review:
        'Ready for Review',
      approved:
        'Approved',
      exported:
        'Exported',
      printed:
        'Printed',
    };

  return labels[status];
}

function draftFromState(
  state:
    CanvaFlyerPieceState |
    undefined,
  defaultCopy:
    CanvaFlyerCopy
): FlyerDraft {
  return {
    style:
      state?.style ||
      '',
    templateName:
      state?.template_name ||
      '',
    templateUrl:
      state?.template_url ||
      '',
    completedDesignUrl:
      state
        ?.completed_design_url ||
      '',
    workflowStatus:
      state
        ?.workflow_status ||
      'not_started',
    copy:
      state?.copy
        ? {
            ...state.copy,
            feature_bullets: [
              ...state.copy
                .feature_bullets,
            ],
          }
        : {
            ...defaultCopy,
            feature_bullets: [
              ...defaultCopy
                .feature_bullets,
            ],
          },
  };
}

function candidateState(
  draft: FlyerDraft,
  persisted:
    CanvaFlyerPieceState |
    undefined
): CanvaFlyerPieceState {
  return {
    ...(draft.style
      ? {
          style:
            draft.style,
        }
      : {}),
    template_name:
      draft.templateName
        .trim(),
    template_url:
      draft.templateUrl
        .trim(),
    completed_design_url:
      draft
        .completedDesignUrl
        .trim(),
    workflow_status:
      draft.workflowStatus,
    copy: {
      ...draft.copy,
      headline:
        draft.copy.headline
          .trim(),
      public_description:
        draft.copy
          .public_description
          .trim(),
      short_description:
        draft.copy
          .short_description
          .trim(),
      feature_bullets:
        draft.copy
          .feature_bullets
          .map((item) =>
            item.trim()
          )
          .filter(Boolean),
      call_to_action:
        draft.copy
          .call_to_action
          .trim(),
      price_line:
        draft.copy
          .price_line
          .trim(),
      contact_line:
        draft.copy
          .contact_line
          .trim(),
    },
    updated_at:
      persisted?.updated_at ||
      new Date(0)
        .toISOString(),
    updated_by:
      persisted?.updated_by ||
      '00000000-0000-4000-8000-000000000000',
    status_history:
      persisted
        ?.status_history ||
      [],
  };
}

export default function ListingCanvaMarketingPackagePanel({
  listing,
  sections,
  photos,
  assignments,
  saving,
  onChoosePhoto,
  onRefresh,
}: Props) {
  const [
    qrAssignment,
    setQrAssignment,
  ] =
    useState<
      ListingQrAssignment | null
    >(null);

  const [
    qrCodeDataUrl,
    setQrCodeDataUrl,
  ] =
    useState('');

  const [
    qrLoading,
    setQrLoading,
  ] =
    useState(true);

  const [
    qrAssigning,
    setQrAssigning,
  ] =
    useState(false);

  const [
    qrError,
    setQrError,
  ] =
    useState<
      string | null
    >(null);

  const [
    qrNotice,
    setQrNotice,
  ] =
    useState<
      string | null
    >(null);

  const applyQrAssignment =
    useCallback(
      async (
        assignment:
          | ListingQrAssignment
          | null
      ) => {
        setQrAssignment(
          assignment
        );

        if (
          !assignment ||
          assignment.status !==
            'assigned'
        ) {
          setQrCodeDataUrl(
            ''
          );

          return;
        }

        const dataUrl =
          await listingQrCodeDataUrl(
            assignment.flyer_url,
            1024
          );

        setQrCodeDataUrl(
          dataUrl
        );
      },
      []
    );

  const loadListingQr =
    useCallback(
      async () => {
        try {
          setQrLoading(
            true
          );

          setQrError(
            null
          );

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
              sessionError
                ?.message ||
                'Your CRM session expired.'
            );
          }

          const response =
            await fetch(
              `/api/marketing/listing-qr?listing_id=${encodeURIComponent(
                listing.id
              )}`,
              {
                method:
                  'GET',

                headers: {
                  Authorization:
                    `Bearer ${sessionResult.session.access_token}`,
                },
              }
            );

          const result =
            (
              await response
                .json()
                .catch(
                  () => ({})
                )
            ) as
              ListingQrResponse;

          if (
            !response.ok ||
            !result.ok
          ) {
            throw new Error(
              result.error ||
                'The listing QR status could not be loaded.'
            );
          }

          await applyQrAssignment(
            result.assignment ||
              null
          );
        } catch (
          loadError: unknown
        ) {
          setQrError(
            loadError instanceof
              Error
              ? loadError.message
              : 'The listing QR status could not be loaded.'
          );
        } finally {
          setQrLoading(
            false
          );
        }
      },
      [
        applyQrAssignment,
        listing.id,
      ]
    );

  useEffect(() => {
    void loadListingQr();
  }, [loadListingQr]);

  async function assignListingQr() {
    try {
      setQrAssigning(
        true
      );

      setQrError(
        null
      );

      setQrNotice(
        null
      );

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
          sessionError
            ?.message ||
            'Your CRM session expired.'
        );
      }

      const response =
        await fetch(
          '/api/marketing/listing-qr',
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                listing_id:
                  listing.id,

                action:
                  'assign',
              }),
          }
        );

      const result =
        (
          await response
            .json()
            .catch(
              () => ({})
            )
        ) as
          ListingQrResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.assignment
      ) {
        throw new Error(
          result.error ||
            'The reusable QR code could not be assigned.'
        );
      }

      await applyQrAssignment(
        result.assignment
      );

      setQrNotice(
        result.message ||
          'The reusable QR code is assigned and ready for this flyer.'
      );
    } catch (
      assignError: unknown
    ) {
      setQrError(
        assignError instanceof
          Error
          ? assignError.message
          : 'The reusable QR code could not be assigned.'
      );
    } finally {
      setQrAssigning(
        false
      );
    }
  }

  const flyerSection =
    sections.find(
      (section) =>
        section.section_key ===
        'flyer'
    ) ||
    null;
  const flyerContent =
    record(
      flyerSection?.content
    );
  const parsed =
    useMemo(
      () =>
        parseCanvaFlyerPackage(
          flyerContent
            .canva_package
        ),
      [
        flyerContent
          .canva_package,
      ]
    );
  const preparedHeadline =
    text(
      flyerContent.headline
    );
  const preparedFeatures =
    flyerContent
      .feature_bullets;
  const preparedCta =
    text(
      flyerContent
        .call_to_action
    );
  const defaultCopy =
    useMemo(
      () =>
        defaultCanvaFlyerCopy({
          listingTitle:
            listing.title,
          campaignHeadline:
            listing
              .campaign_headline,
          publicRemarks:
            listing
              .public_remarks,
          shortDescription:
            listing
              .short_marketing_description,
          preparedHeadline,
          featureBullets:
            preparedFeatures,
          callToAction:
            preparedCta,
          listPrice:
            listing.list_price,
        }),
      [
        flyerSection
          ?.updated_at,
        listing
          .campaign_headline,
        listing.id,
        listing.list_price,
        listing.public_remarks,
        listing
          .short_marketing_description,
        listing.title,
        preparedCta,
        preparedHeadline,
        preparedFeatures,
      ]
    );
  const initialType =
    parsed.valid
      ? parsed.value
          .selected_type
      : 'flyer';
  const [
    flyerType,
    setFlyerType,
  ] =
    useState<CanvaFlyerType>(
      initialType
    );
  const [
    drafts,
    setDrafts,
  ] =
    useState<
      Record<
        CanvaFlyerType,
        FlyerDraft
      >
    >(() => ({
      flyer:
        draftFromState(
          parsed.valid
            ? parsed.value
                .pieces.flyer
            : undefined,
          defaultCopy
        ),
      brochure:
        draftFromState(
          parsed.valid
            ? parsed.value
                .pieces
                .brochure
            : undefined,
          defaultCopy
        ),
    }));
  const [
    activeStep,
    setActiveStep,
  ] = useState(() =>
    consumeRequestedFlyerStep(
      listing.id
    )
  );
  const [
    detailTemplate,
    setDetailTemplate,
  ] =
    useState<
      CanvaFlyerTemplate |
      null
    >(null);
  const [
    identity,
    setIdentity,
  ] =
    useState<
      MarketingIdentityPayload |
      null
    >(null);
  const [
    identityLoading,
    setIdentityLoading,
  ] =
    useState(true);
  const [
    identityError,
    setIdentityError,
  ] =
    useState<
      string |
      null
    >(null);
  const [
    localSaving,
    setLocalSaving,
  ] =
    useState(false);
  const [
    downloading,
    setDownloading,
  ] =
    useState<
      string |
      null
    >(null);
  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);
  const [
    notice,
    setNotice,
  ] =
    useState<
      string |
      null
    >(null);

  useEffect(() => {
    const selectedType =
      parsed.valid
        ? parsed.value
            .selected_type
        : 'flyer';

    setFlyerType(
      selectedType
    );
    setDrafts({
      flyer:
        draftFromState(
          parsed.valid
            ? parsed.value
                .pieces.flyer
            : undefined,
          defaultCopy
        ),
      brochure:
        draftFromState(
          parsed.valid
            ? parsed.value
                .pieces
                .brochure
            : undefined,
          defaultCopy
        ),
    });
  }, [
    defaultCopy,
    flyerSection?.updated_at,
    parsed,
  ]);

  useEffect(() => {
    let active = true;
    const controller =
      new AbortController();

    async function loadIdentity() {
      try {
        setIdentityLoading(
          true
        );
        setIdentityError(
          null
        );

        const {
          data:
            sessionResult,
        } =
          await supabase
            .auth
            .getSession();
        const token =
          sessionResult
            .session
            ?.access_token;

        if (!token) {
          throw new Error(
            'Your CRM session expired.'
          );
        }

        const response =
          await fetch(
            `/api/preferences/marketing-identity?listing_id=${encodeURIComponent(
              listing.id
            )}`,
            {
              method: 'GET',
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
              cache:
                'no-store',
              signal:
                controller
                  .signal,
            }
          );
        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
            'Flyer branding could not be loaded.'
          );
        }

        if (active) {
          setIdentity(
            result as
              MarketingIdentityPayload
          );
        }
      } catch (
        loadError:
          unknown
      ) {
        if (
          active &&
          !controller.signal
            .aborted
        ) {
          setIdentity(null);
          setIdentityError(
            loadError
              instanceof Error
              ? loadError
                  .message
              : 'Flyer branding could not be loaded.'
          );
        }
      } finally {
        if (active) {
          setIdentityLoading(
            false
          );
        }
      }
    }

    void loadIdentity();

    return () => {
      active = false;
      controller.abort();
    };
  }, [listing.id]);

  const draft =
    drafts[flyerType];
  const definition =
    canvaFlyerTypeForKey(
      flyerType
    );
  const availableTemplates =
    CANVA_FLYER_TEMPLATES.filter(
      (template) =>
        template.flyerType ===
          flyerType &&
        template.style ===
          draft.style
    );
  const activeTemplate =
    availableTemplates.find(
      (template) =>
        template.name ===
          draft.templateName
    ) ||
    null;
  const activePhotoSlots =
    activeTemplate?.photoSlots ||
    definition.photoSlots;
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
  const slotRows =
    activePhotoSlots.map(
      (slot) => {
        const assignment =
          assignments.find(
            (item) =>
              item.section_key ===
                'flyer' &&
              item.slot_key ===
                slot.slotKey &&
              item.sort_order ===
                slot.sortOrder
          ) ||
          null;
        const photo =
          assignment
            ? photoMap.get(
                assignment
                  .media_id
              ) ||
              null
            : null;

        return {
          slot,
          assignment,
          photo,
        };
      }
    );
  const assignedSlots =
    slotRows
      .filter(
        (row) =>
          Boolean(row.photo)
      )
      .map(
        (row) =>
          `${row.slot.slotKey}:${row.slot.sortOrder}`
      );
  const selectedPhotos =
    Array.from(
      new Map(
        slotRows
          .filter(
            (
              row
            ): row is
              typeof row & {
                photo:
                  FlyerStudioPhoto;
              } =>
              Boolean(
                row.photo
              )
          )
          .map((row) => [
            row.photo.id,
            row.photo,
          ])
      ).values()
    );
  const nativeGoldEstate =
    activeTemplate?.key ===
      'luxury-landscape-01-gold-estate';
  const nativeBlackWhiteShowcase =
    activeTemplate?.key ===
      'luxury-single-sided-04-black-white-showcase';
  const nativeFlyer =
    nativeGoldEstate ||
    nativeBlackWhiteShowcase;
  const brandingBlockers =
    useMemo(() => {
      if (
        identityLoading
      ) {
        return [];
      }

      if (
        identityError ||
        !identity
      ) {
        return [
          'Flyer branding could not be checked. Refresh and try again.',
        ];
      }

      const blockers:
        string[] = [];
      const add = (
        condition: boolean,
        message: string
      ) => {
        if (condition) {
          blockers.push(
            message
          );
        }
      };

      add(
        !text(
          identity
            .branding
            .personal
            .name
        ) &&
          !text(
            identity
              .profile
              .marketing_from_name
          ),
        'Agent name is missing. Update Marketing Identity.'
      );
      add(
        !text(
          identity
            .profile
            .marketing_phone
        ),
        'Agent phone is missing. Update Marketing Identity.'
      );
      add(
        !text(
          identity
            .branding
            .organization
            .logo_url
        ),
        'MPRE logo is missing. Update Organization Branding.'
      );
      add(
        !text(
          identity
            .branding
            .brokerage
            .name
        ),
        'Brokerage name is missing. Update Brokerage Branding.'
      );
      add(
        !text(
          identity
            .branding
            .brokerage
            .logo_url
        ),
        'Brokerage logo is missing. Update Brokerage Branding.'
      );
      add(
        !text(
          identity
            .compliance
            .advertisement_label
        ),
        'Advertising label is missing. Update Compliance.'
      );
      add(
        !text(
          identity
            .compliance
            .standard_disclaimer
        ),
        'Advertising disclaimer is missing. Update Compliance.'
      );

      return blockers;
    }, [
      identity,
      identityError,
      identityLoading,
    ]);
  const persistedState =
    parsed.valid
      ? parsed.value
          .pieces[
            flyerType
          ]
      : undefined;
  const currentCandidate =
    candidateState(
      draft,
      persistedState
    );
  const readinessIssues =
    canvaFlyerReadinessIssues(
      flyerType,
      {
        ...currentCandidate,
        workflow_status:
          'ready_for_review',
      },
      {
        assignedSlots,
        brandingBlockers,
        nativeDesign: nativeFlyer,
        sectionStatus:
          flyerSection
            ?.status ||
          'not_prepared',
      }
    );
  const approvalIssues =
    canvaFlyerReadinessIssues(
      flyerType,
      {
        ...currentCandidate,
        workflow_status:
          'approved',
      },
      {
        assignedSlots,
        brandingBlockers,
        nativeDesign: nativeFlyer,
        sectionStatus:
          'approved',
      }
    );
  const printedIssues =
    canvaFlyerReadinessIssues(
      flyerType,
      {
        ...currentCandidate,
        workflow_status:
          'printed',
      },
      {
        assignedSlots,
        brandingBlockers,
        nativeDesign: nativeFlyer,
        sectionStatus:
          'approved',
      }
    );
  const templateValidation =
    validateCanvaUrl(
      draft.templateUrl,
      {
        allowTemplateShortLink:
          true,
      }
    );
  const completedValidation =
    validateCanvaUrl(
      draft
        .completedDesignUrl
    );
  const busy =
    saving ||
    localSaving ||
    identityLoading;

  function updateDraft(
    patch:
      Partial<FlyerDraft>
  ) {
    setDrafts(
      (current) => ({
        ...current,
        [flyerType]: {
          ...current[
            flyerType
          ],
          ...patch,
        },
      })
    );
    setError(null);
    setNotice(null);
  }

  function updateCopy<
    Key extends
      keyof CanvaFlyerCopy
  >(
    key: Key,
    value:
      CanvaFlyerCopy[Key]
  ) {
    updateDraft({
      copy: {
        ...draft.copy,
        [key]: value,
      },
    });
  }

  async function copyValue(
    value: string,
    label: string
  ) {
    try {
      await navigator
        .clipboard
        .writeText(value);
      setNotice(
        `${label} copied.`
      );
      setError(null);
    } catch {
      setError(
        `${label} could not be copied.`
      );
    }
  }

  function flyerWording() {
    const footer = [
      text(
        identity
          ?.compliance
          .advertisement_label
      ),
      text(
        identity
          ?.branding
          .brokerage
          .name
      ),
      text(
        identity
          ?.compliance
          .broker_license_number
      )
        ? `License ${text(
            identity
              ?.compliance
              .broker_license_number
          )}`
        : '',
      text(
        identity
          ?.compliance
          .mls_attribution
      ),
      text(
        identity
          ?.compliance
          .standard_disclaimer
      ),
      text(
        identity
          ?.compliance
          .public_office_address
      ),
    ]
      .filter(Boolean)
      .join('\n');
    const fields = [
      [
        'HEADLINE',
        draft.copy.headline,
      ],
      [
        'MLS PUBLIC DESCRIPTION',
        draft.copy
          .public_description,
      ],
      [
        'SHORT DESCRIPTION',
        draft.copy
          .short_description,
      ],
      [
        'FEATURE BULLETS',
        draft.copy
          .feature_bullets
          .map(
            (item) =>
              `• ${item}`
          )
          .join('\n'),
      ],
      [
        'CALL TO ACTION',
        draft.copy
          .call_to_action,
      ],
      [
        'PRICE LINE',
        draft.copy.price_line,
      ],
      [
        'CONTACT LINE',
        draft.copy
          .contact_line,
      ],
      [
        'REQUIRED FLYER FOOTER',
        footer,
      ],
    ];

    return fields
      .filter(
        ([, value]) =>
          Boolean(
            value.trim()
          )
      )
      .map(
        ([label, value]) =>
          `${label}\n${value.trim()}`
      )
      .join('\n\n');
  }

  async function downloadUrl(
    url: string,
    filename: string
  ) {
    const response =
      await fetch(url, {
        method: 'GET',
        cache: 'no-store',
      });

    if (!response.ok) {
      throw new Error(
        `Download failed with status ${response.status}.`
      );
    }

    const blob =
      await response.blob();
    const objectUrl =
      URL.createObjectURL(
        blob
      );
    const anchor =
      document.createElement(
        'a'
      );

    anchor.href =
      objectUrl;
    anchor.download =
      filename;
    anchor.rel =
      'noopener noreferrer';
    document.body
      .appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(
      objectUrl
    );
  }

  function chooseTemplate(
    template:
      CanvaFlyerTemplate
  ) {
    updateDraft({
      templateName:
        template.name,
      templateUrl:
        template.url,
    });
    setDetailTemplate(
      null
    );
  }

  async function downloadSelectedPhotos() {
    if (
      selectedPhotos.length ===
      0
    ) {
      setError(
        'Choose at least one Flyer photo first.'
      );
      return;
    }

    try {
      setDownloading(
        'photos'
      );
      setError(null);
      let completed = 0;

      for (
        const [
          index,
          photo,
        ] of selectedPhotos
          .entries()
      ) {
        await downloadUrl(
          photo.public_url,
          `${String(
            index + 1
          ).padStart(
            2,
            '0'
          )}-${filenamePart(
            photo.file_name,
            `flyer-photo-${index + 1}.jpg`
          )}`
        );
        completed += 1;
      }

      setNotice(
        `${completed} separate Flyer photo files were prepared.`
      );
    } catch (
      downloadError:
        unknown
    ) {
      setError(
        downloadError
          instanceof Error
          ? downloadError
              .message
          : 'Flyer photos could not be downloaded.'
      );
    } finally {
      setDownloading(null);
    }
  }

  async function downloadBrandingFiles() {
    const candidates = [
      {
        url:
          text(
            identity
              ?.profile
              .marketing_headshot_url
          ),
        name:
          'agent-headshot',
      },
      {
        url:
          text(
            identity
              ?.branding
              .personal
              .logo_url
          ),
        name:
          'agent-logo',
      },
      {
        url:
          text(
            identity
              ?.branding
              .organization
              .logo_url
          ),
        name:
          'mpre-logo',
      },
      {
        url:
          text(
            identity
              ?.branding
              .brokerage
              .logo_url
          ),
        name:
          'brokerage-logo',
      },
    ].filter(
      (
        item
      ): item is {
        url: string;
        name: string;
      } =>
        Boolean(item.url)
    );

    if (
      candidates.length ===
      0
    ) {
      setError(
        'No Flyer branding files are available.'
      );
      return;
    }

    try {
      setDownloading(
        'branding'
      );
      setError(null);

      for (
        const item of
          candidates
      ) {
        await downloadUrl(
          item.url,
          `${item.name}.png`
        );
      }

      setNotice(
        `${candidates.length} separate Flyer branding files were prepared.`
      );
    } catch (
      downloadError:
        unknown
    ) {
      setError(
        downloadError
          instanceof Error
          ? downloadError
              .message
          : 'Flyer branding files could not be downloaded.'
      );
    } finally {
      setDownloading(null);
    }
  }

  async function recommendFlyerPhotos(
    templateKey: string
  ) {
    try {
      setLocalSaving(true);
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
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                listing_id:
                  listing.id,

                mode:
                  'recommend_flyer_photos',

                template_key:
                  templateKey,
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
          'Samantha could not recommend Flyer photos.'
        );
      }

      setNotice(
        result.message ||
        'Samantha recommended the best available Flyer photos.'
      );

      return true;
    } catch (
      recommendationError:
        unknown
    ) {
      setError(
        recommendationError
          instanceof Error
          ? recommendationError
              .message
          : 'Samantha could not recommend Flyer photos.'
      );

      return false;
    } finally {
      setLocalSaving(false);
    }
  }

  async function saveDesign(
    requestedStatus:
      CanvaFlyerStatus =
        draft
          .workflowStatus,
    refreshAfterSave = true
  ) {
    if (!flyerSection) {
      setError(
        'Prepare the Flyer section before saving.'
      );
      return false;
    }

    if (
      !templateValidation.valid
    ) {
      setError(
        templateValidation
          .error
      );
      setActiveStep(
        draft.style
          ? 3
          : 2
      );
      return false;
    }

    if (
      !completedValidation
        .valid
    ) {
      setError(
        completedValidation
          .error
      );
      setActiveStep(6);
      return false;
    }

    const approving = [
      'approved',
      'exported',
      'printed',
    ].includes(
      requestedStatus
    );
    const candidate = {
      ...currentCandidate,
      workflow_status:
        requestedStatus,
    };
    const issues =
      canvaFlyerReadinessIssues(
        flyerType,
        candidate,
        {
          assignedSlots,
          brandingBlockers,
          nativeDesign: nativeFlyer,
          sectionStatus:
            approving
              ? 'approved'
              : flyerSection
                  .status,
        }
      );

    if (
      ![
        'not_started',
        'editing',
      ].includes(
        requestedStatus
      ) &&
      issues.length > 0
    ) {
      setError(
        issues[0]
      );
      return false;
    }

    try {
      setLocalSaving(true);
      setError(null);
      setNotice(null);

      const {
        data:
          userResult,
        error:
          userError,
      } =
        await supabase
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

      const changedAt =
        new Date()
          .toISOString();
      const base =
        parsed.valid
          ? parsed.value
          : emptyCanvaFlyerPackage();
      const next =
        updateCanvaFlyerPiece(
          base,
          flyerType,
          {
            ...(draft.style
              ? {
                  style:
                    draft.style,
                }
              : {}),
            template_name:
              draft
                .templateName,
            template_url:
              draft
                .templateUrl,
            completed_design_url:
              draft
                .completedDesignUrl,
            workflow_status:
              requestedStatus,
            copy:
              candidate.copy,
          },
          userResult
            .user.id,
          changedAt
        );
      const update = {
        content: {
          ...flyerSection
            .content,
          canva_package:
            next,
        },
        status:
          approving
            ? 'approved'
            : 'needs_review',
        approved_at:
          approving
            ? changedAt
            : null,
        approved_by:
          approving
            ? userResult
                .user.id
            : null,
        updated_by:
          userResult.user.id,
      };
      const {
        data: savedRows,
        error:
          saveError,
      } =
        await supabase
          .from(
            'listing_marketing_sections'
          )
          .update(update)
          .eq(
            'id',
            flyerSection.id
          )
          .eq(
            'listing_id',
            listing.id
          )
          .eq(
            'section_key',
            'flyer'
          )
          .eq(
            'updated_at',
            flyerSection
              .updated_at
          )
          .select('id');

      if (saveError) {
        throw saveError;
      }

      if (
        !savedRows ||
        savedRows.length !==
          1
      ) {
        throw new Error(
          'This Flyer changed in another session. Refresh and review the latest version before saving.'
        );
      }

      updateDraft({
        workflowStatus:
          requestedStatus,
      });
      setNotice(
        requestedStatus ===
          'printed'
          ? 'Flyer marked printed.'
          : requestedStatus ===
              'approved'
            ? 'Flyer approved.'
            : 'Flyer design saved.'
      );

      if (refreshAfterSave) {
        await onRefresh();
      }

      return true;
    } catch (
      saveError:
        unknown
    ) {
      setError(
        saveError
          instanceof Error
          ? saveError
              .message
          : 'The Flyer could not be saved.'
      );
      return false;
    } finally {
      setLocalSaving(false);
    }
  }

  function stepSummary(
    step: number
  ) {
    if (step === 1) {
      return definition.name;
    }

    if (step === 2) {
      return CANVA_FLYER_STYLES.find(
        (style) =>
          style.key ===
          draft.style
      )?.name ||
        'Style not chosen';
    }

    if (step === 3) {
      return draft.templateName ||
        'Template not chosen';
    }

    if (step === 4) {
      return `${selectedPhotos.length} photo${selectedPhotos.length === 1 ? '' : 's'} selected`;
    }

    if (step === 5) {
      return draft.copy.headline ||
        'Wording not started';
    }

    return flyerStatusLabel(
      draft.workflowStatus
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-violet-700">
              <Sparkles className="h-5 w-5" />
              Flyer
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Prepare your Flyer, then finish the design in Canva.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Choose a Flyer type, template, photos and wording. Your listing
              information is not changed when you edit the Flyer.
            </p>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
            {flyerStatusLabel(
              draft
                .workflowStatus
            )}
          </span>
        </div>
      </section>

      {!parsed.valid && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          The earlier unfinished Canva draft is not part of the corrected
          Flyer. Saving will replace it with the new Flyer-only format.
        </div>
      )}

      {(error ||
        notice) && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ||
            notice}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-6">
          {STEPS.map(
            (
              label,
              index
            ) => {
              const step =
                index + 1;
              const active =
                activeStep ===
                step;

              return (
                <button
                  key={label}
                  type="button"
                  disabled={
                    step === 3 &&
                    !draft.style
                  }
                  onClick={() =>
                    setActiveStep(
                      step
                    )
                  }
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                      : 'border-slate-200 hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        active
                          ? 'bg-violet-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {step}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {label}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-[11px] text-slate-500">
                    {stepSummary(
                      step
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      {activeStep === 1 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">
            Choose Flyer Type
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Choose the format you plan to build in Canva.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {CANVA_FLYER_TYPES.map(
              (item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setFlyerType(
                      item.key
                    );
                    setError(null);
                    setNotice(null);
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${
                    flyerType ===
                    item.key
                      ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                      : 'border-slate-200 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-slate-950">
                      {item.name}
                    </div>
                    {flyerType ===
                      item.key && (
                      <CheckCircle2 className="h-5 w-5 text-violet-700" />
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </button>
              )
            )}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() =>
                setActiveStep(2)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
            >
              Choose Style
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {activeStep === 2 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">
            Choose Flyer Style
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Choose a style for this Flyer type. Your existing Flyer details
            stay in place if you change the style.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {CANVA_FLYER_STYLES.map(
              (style) => {
                const selected =
                  draft.style ===
                  style.key;

                return (
                  <button
                    key={
                      style.key
                    }
                    type="button"
                    aria-pressed={
                      selected
                    }
                    onClick={() =>
                      updateDraft({
                        style:
                          style.key,
                      })
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                    }`}
                  >
                    <span className="block text-base font-black text-slate-950">
                      {
                        style.name
                      }
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-slate-600">
                      {
                        style.description
                      }
                    </span>
                  </button>
                );
              }
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setActiveStep(1)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              disabled={
                !draft.style
              }
              onClick={() =>
                setActiveStep(3)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Choose Template
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {activeStep === 3 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">
            Choose Canva Template
          </h3>

          {availableTemplates
            .length === 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              No approved templates have been added for this Flyer choice yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {availableTemplates.map(
                (template) => {
                  const selected =
                    draft
                      .templateName ===
                      template.name &&
                    draft
                      .templateUrl ===
                      template.url;

                  return (
                    <article
                      key={
                        template.key
                      }
                      className={`flex min-h-full flex-col overflow-hidden rounded-2xl border bg-white transition ${
                        selected
                          ? 'border-violet-500 ring-2 ring-violet-100'
                          : 'border-slate-200'
                      }`}
                    >
                      {template.previewPath ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDetailTemplate(
                              template
                            )
                          }
                          className="flex aspect-[4/3] items-center justify-center bg-slate-100 p-2"
                        >
                          <img
                            src={
                              template.previewPath
                            }
                            alt={`${template.name} preview`}
                            className="h-full w-full object-contain"
                          />
                        </button>
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                          Preview available in Canva
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black leading-5 text-slate-950">
                            {
                              template.name
                            }
                          </h4>
                          {selected && (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-700" />
                          )}
                        </div>
                        <span className="mt-2 w-fit rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          {
                            template.orientation
                          }
                        </span>
                        <div className="mt-auto grid gap-2 pt-3">
                          {template.previewPath ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDetailTemplate(
                                  template
                                )
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              View Details
                            </button>
                          ) : (
                            <a
                              href={
                                template.url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Preview in Canva
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              chooseTemplate(
                                template
                              )
                            }
                            className={`rounded-xl px-3 py-2 text-xs font-bold ${
                              selected
                                ? 'bg-violet-100 text-violet-800'
                                : 'bg-violet-700 text-white hover:bg-violet-800'
                            }`}
                          >
                            {selected
                              ? 'Template Selected'
                              : 'Choose This Template'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setActiveStep(2)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            {availableTemplates
              .length > 0 && (
              <button
                type="button"
                disabled={
                  busy ||
                  !draft
                    .templateName ||
                  !templateValidation
                    .valid ||
                  !templateValidation
                    .normalized
                }
                onClick={() => {
                  void (
                    async () => {
                      const resumeKey =
                        flyerStepStorageKey(
                          listing.id
                        );

                      if (
                        typeof window !== 'undefined'
                      ) {
                        window.sessionStorage
                          .setItem(
                            resumeKey,
                            '4'
                          );
                      }

                      const saved =
                        await saveDesign(
                          'editing',
                          false
                        );

                      if (!saved) {
                        if (
                          typeof window !== 'undefined'
                        ) {
                          window.sessionStorage
                            .removeItem(
                              resumeKey
                            );
                        }

                        return;
                      }

                      if (
                        !activeTemplate
                      ) {
                        setError(
                          'Choose an approved Canva template before selecting photos.'
                        );

                        return;
                      }

                      const recommended =
                        await recommendFlyerPhotos(
                          activeTemplate
                            .key
                        );

                      if (!recommended) {
                        if (
                          typeof window !== 'undefined'
                        ) {
                          window.sessionStorage
                            .removeItem(
                              resumeKey
                            );
                        }

                        return;
                      }

                      if (
                        typeof window !== 'undefined'
                      ) {
                        window.sessionStorage
                          .setItem(
                            resumeKey,
                            '4'
                          );
                      }

                      await onRefresh();

                      setActiveStep(
                        4
                      );
                    }
                  )();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Choose Photos
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      )}

      {activeStep === 4 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">
            Choose Flyer Photos
          </h3>
          <p className="mt-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900">
            {activeTemplate
              ? `${activeTemplate.name} requires ${activePhotoSlots.length} listing photos.`
              : `This Flyer requires ${activePhotoSlots.length} listing photos.`}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Samantha&apos;s recommendations are shown first. Your replacement
            becomes the locked Flyer choice.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {slotRows.map(
              ({
                slot,
                assignment,
                photo,
              }) => (
                <div
                  key={`${slot.slotKey}-${slot.sortOrder}`}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="aspect-[4/3] bg-slate-100">
                    {photo ? (
                      <img
                        src={
                          photo
                            .thumbnail_url ||
                          photo
                            .public_url
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900">
                        {slot.label}
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          slot.required
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {slot.required
                          ? 'Required'
                          : 'Optional'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {assignment
                        ?.selected_by ===
                      'agent'
                        ? 'Your locked choice'
                        : assignment
                          ? 'Samantha recommended'
                          : 'Choose a photo'}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onChoosePhoto({
                          slotKey:
                            slot.slotKey,
                          sortOrder:
                            slot.sortOrder,
                          label:
                            slot.label,
                        })
                      }
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {photo
                        ? 'Replace Photo'
                        : 'Choose Photo'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setActiveStep(3)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveStep(5)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
            >
              Edit Flyer
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {activeStep === 5 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">
            Edit Flyer Wording
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            These edits apply only to this Flyer. They do not change the
            listing.
          </p>
          <div className="mt-5 grid gap-4">
            <label>
              <span className="text-sm font-bold text-slate-800">
                Headline
              </span>
              <input
                type="text"
                maxLength={240}
                value={
                  draft.copy
                    .headline
                }
                onChange={(event) =>
                  updateCopy(
                    'headline',
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-800">
                MLS Public Description
              </span>
              <textarea
                rows={8}
                maxLength={6000}
                value={
                  draft.copy
                    .public_description
                }
                onChange={(event) =>
                  updateCopy(
                    'public_description',
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Starts from MLS Public Remarks. Editing this field changes only
                the Flyer.
              </span>
            </label>
            <label>
              <span className="text-sm font-bold text-slate-800">
                Short Description
              </span>
              <textarea
                rows={3}
                maxLength={800}
                value={
                  draft.copy
                    .short_description
                }
                onChange={(event) =>
                  updateCopy(
                    'short_description',
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-800">
                Feature Bullets
              </span>
              <textarea
                rows={6}
                value={
                  draft.copy
                    .feature_bullets
                    .join('\n')
                }
                onChange={(event) =>
                  updateCopy(
                    'feature_bullets',
                    event.target
                      .value
                      .split(/\r?\n/)
                      .slice(0, 12)
                  )
                }
                placeholder="Enter one feature per line"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-800">
                Call to Action
              </span>
              <input
                type="text"
                maxLength={240}
                value={
                  draft.copy
                    .call_to_action
                }
                onChange={(event) =>
                  updateCopy(
                    'call_to_action',
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-bold text-slate-800">
                  Optional Price Line
                </span>
                <input
                  type="text"
                  maxLength={160}
                  value={
                    draft.copy
                      .price_line
                  }
                  onChange={(event) =>
                    updateCopy(
                      'price_line',
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>
              <label>
                <span className="text-sm font-bold text-slate-800">
                  Optional Contact Line
                </span>
                <input
                  type="text"
                  maxLength={280}
                  value={
                    draft.copy
                      .contact_line
                  }
                  onChange={(event) =>
                    updateCopy(
                      'contact_line',
                      event.target
                        .value
                    )
                  }
                  placeholder="Example: Call the listing agent for a private tour"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setActiveStep(4)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveStep(6)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {activeStep === 6 &&
        nativeFlyer && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Reusable Property QR Code
                </h3>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Loading this screen never assigns a code. A reusable code is assigned only when you click Assign QR Code.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    qrLoading ||
                    qrAssigning
                  }
                  onClick={() =>
                    void loadListingQr()
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Refresh QR Status
                </button>

                {!qrAssignment && (
                  <button
                    type="button"
                    disabled={
                      qrLoading ||
                      qrAssigning ||
                      listing
                        .website_status !==
                        'published' ||
                      !listing.public_url
                    }
                    onClick={() =>
                      void assignListingQr()
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {qrAssigning && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {qrAssigning
                      ? 'Assigning QR Code...'
                      : 'Assign QR Code'}
                  </button>
                )}
              </div>
            </div>

            {qrLoading ? (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading reusable QR status...
              </div>
            ) : qrAssignment ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    QR Number
                  </div>

                  <div className="mt-2 text-lg font-black text-slate-950">
                    QR-
                    {String(
                      qrAssignment
                        .code_number
                    ).padStart(
                      3,
                      '0'
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Status
                  </div>

                  <div className="mt-2 text-lg font-black capitalize text-slate-950">
                    {qrAssignment.status}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Public QR Address
                  </div>

                  <a
                    href={
                      qrAssignment
                        .public_url
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm font-bold text-blue-700 hover:text-blue-800"
                  >
                    {qrAssignment
                      .public_url}

                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Destination
                  </div>

                  {qrAssignment
                    .destination_url ? (
                    <a
                      href={
                        qrAssignment
                          .destination_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm font-bold text-blue-700 hover:text-blue-800"
                    >
                      {qrAssignment
                        .destination_url}

                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                  ) : (
                    <div className="mt-2 text-sm font-bold text-amber-700">
                      No active destination
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {listing
                  .website_status ===
                  'published' &&
                listing.public_url
                  ? 'No reusable QR code is assigned yet. Click Assign QR Code when you are ready.'
                  : 'Publish the property website before assigning its reusable QR code.'}
              </div>
            )}

            {qrNotice && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {qrNotice}
              </div>
            )}

            {qrError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {qrError}
              </div>
            )}
          </section>
        )}
      {activeStep === 6 &&
        nativeBlackWhiteShowcase && (
          <ListingLuxuryBlackWhiteFlyerPreview
            listing={listing}
            copy={draft.copy}
            photos={slotRows.flatMap(
              ({
                slot,
                photo,
              }) =>
                photo
                  ? [
                      {
                        label:
                          slot.label,
                        url:
                          photo.public_url,
                      },
                    ]
                  : []
            )}
            qrCodeDataUrl={
              qrCodeDataUrl
            }
            qrPublicUrl={
              qrAssignment
                ?.public_url ||
              null
            }
            identity={identity}
            identityLoading={
              identityLoading
            }
            issues={
              approvalIssues
            }
            status={
              draft.workflowStatus
            }
            saving={busy}
            saveDisabled={
              busy ||
              identityLoading ||
              readinessIssues
                .length > 0
            }
            approvalDisabled={
              busy ||
              identityLoading ||
              approvalIssues
                .length > 0
            }
            onBack={() =>
              setActiveStep(5)
            }
            onSave={() =>
              saveDesign(
                'ready_for_review'
              )
            }
            onApprove={() =>
              saveDesign(
                'approved'
              )
            }
          />
        )}
      {activeStep === 6 &&
        nativeGoldEstate && (
          <ListingGoldEstateFlyerPreview
            listing={listing}
            copy={draft.copy}
            photos={slotRows.flatMap(
              ({
                slot,
                photo,
              }) =>
                photo
                  ? [
                      {
                        label:
                          slot.label,
                        url:
                          photo.public_url,
                      },
                    ]
                  : []
            )}
            qrCodeDataUrl={
              qrCodeDataUrl
            }
            qrPublicUrl={
              qrAssignment
                ?.public_url ||
              null
            }
            identity={identity}
            identityLoading={
              identityLoading
            }
            issues={
              approvalIssues
            }
            status={
              draft.workflowStatus
            }
            saving={busy}
            saveDisabled={
              busy ||
              identityLoading ||
              readinessIssues
                .length > 0
            }
            approvalDisabled={
              busy ||
              identityLoading ||
              approvalIssues
                .length > 0
            }
            onBack={() =>
              setActiveStep(5)
            }
            onSave={() =>
              saveDesign(
                'ready_for_review'
              )
            }
            onApprove={() =>
              saveDesign(
                'approved'
              )
            }
          />
        )}

      {activeStep === 6 &&
        !nativeGoldEstate &&
        !nativeBlackWhiteShowcase && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">
            Open in Canva and Save Result
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Copy the Flyer wording, download the selected files, finish the
            design in Canva, then save the result here.
          </p>

          <div
            className={`mt-5 rounded-2xl border p-4 ${
              brandingBlockers
                .length === 0
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  brandingBlockers
                    .length === 0
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              />
              <div>
                {identityLoading ? (
                  <div className="text-sm font-bold text-slate-700">
                    Checking Flyer branding and advertising requirements...
                  </div>
                ) : brandingBlockers
                    .length ===
                  0 ? (
                  <div className="text-sm font-bold text-emerald-900">
                    Flyer branding and required advertising language are ready.
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-amber-950">
                      Complete these items before approval:
                    </div>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                      {brandingBlockers.map(
                        (blocker) => (
                          <li
                            key={
                              blocker
                            }
                          >
                            • {blocker}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {readinessIssues
            .length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-bold text-amber-950">
                Before Ready for Review
              </div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                {readinessIssues.map(
                  (issue) => (
                    <li
                      key={issue}
                    >
                      • {issue}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void copyValue(
                  flyerWording(),
                  'Flyer wording'
                )
              }
              disabled={
                !flyerWording()
              }
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              Copy Flyer Wording
            </button>
            <button
              type="button"
              onClick={() =>
                void downloadSelectedPhotos()
              }
              disabled={
                downloading !==
                  null ||
                selectedPhotos
                  .length === 0
              }
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
            >
              {downloading ===
              'photos' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Flyer Photos
            </button>
            <button
              type="button"
              onClick={() =>
                void downloadBrandingFiles()
              }
              disabled={
                downloading !==
                null
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {downloading ===
              'branding' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Flyer Branding
            </button>
            {templateValidation
              .valid &&
              templateValidation
                .normalized && (
                <a
                  href={
                    templateValidation
                      .normalized
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Canva
                </a>
              )}
          </div>

          <div className="mt-5 grid gap-4">
            <label>
              <span className="text-sm font-bold text-slate-800">
                Completed Canva Design Link
              </span>
              <input
                type="url"
                value={
                  draft
                    .completedDesignUrl
                }
                onChange={(event) =>
                  updateDraft({
                    completedDesignUrl:
                      event.target
                        .value,
                  })
                }
                placeholder="https://www.canva.com/..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
              {draft
                .completedDesignUrl &&
                !completedValidation
                  .valid && (
                  <span className="mt-1 block text-sm font-semibold text-red-700">
                    {
                      completedValidation
                        .error
                    }
                  </span>
                )}
            </label>
            <label>
              <span className="text-sm font-bold text-slate-800">
                Flyer Status
              </span>
              <select
                value={
                  draft
                    .workflowStatus
                }
                onChange={(event) =>
                  updateDraft({
                    workflowStatus:
                      event.target
                        .value as
                        CanvaFlyerStatus,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                {CANVA_FLYER_STATUSES.map(
                  (status) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {flyerStatusLabel(
                        status
                      )}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                busy ||
                !flyerSection
              }
              onClick={() =>
                void saveDesign()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {localSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Design
            </button>
            <button
              type="button"
              disabled={
                busy ||
                approvalIssues
                  .length > 0
              }
              onClick={() =>
                void saveDesign(
                  'approved'
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              Approve Flyer
            </button>
            <button
              type="button"
              disabled={
                busy ||
                printedIssues
                  .length > 0
              }
              onClick={() =>
                void saveDesign(
                  'printed'
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              Mark Printed
            </button>
          </div>

          {persistedState &&
            persistedState
              .status_history
              .length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Recent Flyer Activity
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {persistedState
                    .status_history
                    .slice(-5)
                    .reverse()
                    .map(
                      (
                        entry,
                        index
                      ) => (
                        <span
                          key={`${entry.changed_at}-${index}`}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          {flyerStatusLabel(
                            entry
                              .workflow_status
                          )}
                        </span>
                      )
                    )}
                </div>
              </div>
            )}

          <div className="mt-5">
            <button
              type="button"
              onClick={() =>
                setActiveStep(5)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Wording
            </button>
          </div>
        </section>
      )}

      {detailTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="flyer-template-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="flyer-template-detail-title"
                  className="text-xl font-black text-slate-950"
                >
                  {
                    detailTemplate.name
                  }
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                    Luxury
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    Single-Sided Flyer
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {
                      detailTemplate.orientation
                    }
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDetailTemplate(
                    null
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {detailTemplate
              .previewPath && (
              <div className="mt-5 flex max-h-[60vh] items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-3">
                <img
                  src={
                    detailTemplate
                      .previewPath
                  }
                  alt={`${detailTemplate.name} larger preview`}
                  className="max-h-[56vh] max-w-full object-contain"
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <a
                href={
                  detailTemplate.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50"
              >
                <ExternalLink className="h-4 w-4" />
                Preview in Canva
              </a>
              <button
                type="button"
                onClick={() =>
                  chooseTemplate(
                    detailTemplate
                  )
                }
                className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
              >
                Choose This Template
              </button>
              <button
                type="button"
                onClick={() =>
                  setDetailTemplate(
                    null
                  )
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
