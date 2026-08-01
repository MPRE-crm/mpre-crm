export const CANVA_FLYER_PACKAGE_VERSION =
  2 as const;

export const CANVA_FLYER_PACKAGE_MAX_BYTES =
  48 * 1024;

export const CANVA_FLYER_HISTORY_LIMIT =
  40;

export const CANVA_FLYER_STATUSES = [
  'not_started',
  'editing',
  'ready_for_review',
  'approved',
  'exported',
  'printed',
] as const;

export type CanvaFlyerStatus =
  (typeof CANVA_FLYER_STATUSES)[number];

export const CANVA_FLYER_TYPES = [
  {
    key: 'flyer',
    name: 'Single-Sided Flyer',
    description:
      'A focused one-page flyer with a cover photo and up to two supporting photos.',
    photoSlots: [
      {
        slotKey: 'cover',
        sortOrder: 0,
        label: 'Cover Photo',
        required: true,
      },
      {
        slotKey: 'interior',
        sortOrder: 0,
        label: 'Supporting Photo 1',
        required: false,
      },
      {
        slotKey: 'interior',
        sortOrder: 1,
        label: 'Supporting Photo 2',
        required: false,
      },
    ],
  },
  {
    key: 'brochure',
    name: 'Double-Sided Flyer / Brochure',
    description:
      'A front-and-back handout using the cover and all three interior photos.',
    photoSlots: [
      {
        slotKey: 'cover',
        sortOrder: 0,
        label: 'Front Cover Photo',
        required: true,
      },
      {
        slotKey: 'interior',
        sortOrder: 0,
        label: 'Back Photo 1',
        required: true,
      },
      {
        slotKey: 'interior',
        sortOrder: 1,
        label: 'Back Photo 2',
        required: true,
      },
      {
        slotKey: 'interior',
        sortOrder: 2,
        label: 'Back Photo 3',
        required: true,
      },
    ],
  },
] as const;

export type CanvaFlyerType =
  (typeof CANVA_FLYER_TYPES)[number]['key'];

export const CANVA_FLYER_STYLES = [
  {
    key: 'luxury',
    name: 'Luxury',
    description:
      'Elegant, high-end presentation with strong photography and refined typography.',
  },
  {
    key: 'standard',
    name: 'Standard',
    description:
      'Clean, professional real-estate flyer designed for broad buyer appeal.',
  },
  {
    key: 'modern_minimal',
    name: 'Modern Minimal',
    description:
      'Simple, spacious design with minimal text and prominent property photography.',
  },
] as const;

export type CanvaFlyerStyle =
  (typeof CANVA_FLYER_STYLES)[number]['key'];

export type CanvaFlyerPhotoSlot = {
  slotKey: string;
  sortOrder: number;
  label: string;
  required: boolean;
};

export type CanvaFlyerTemplate = {
  key: string;
  name: string;
  flyerType: CanvaFlyerType;
  style: CanvaFlyerStyle;
  url: string;
  orientation:
    | 'Portrait'
    | 'Landscape';
  previewPath:
    | string
    | null;
  photoSlots:
    readonly CanvaFlyerPhotoSlot[];
};

function requiredPhotoSlots(
  count: number
): readonly CanvaFlyerPhotoSlot[] {
  const labels = [
    'Main Exterior',
    'Kitchen',
    'Living Room',
    'Primary Bedroom',
    'Primary Bathroom',
    'Best Outdoor / View',
  ] as const;

  return Array.from(
    {
      length: count,
    },
    (_, index) =>
      index === 0
        ? {
            slotKey: 'cover',
            sortOrder: 0,
            label:
              labels[index],
            required: true,
          }
        : {
            slotKey: 'interior',
            sortOrder:
              index - 1,
            label:
              labels[index] ||
              `Supporting Photo ${index}`,
            required: true,
          }
  );
}

export const CANVA_FLYER_TEMPLATES:
  readonly CanvaFlyerTemplate[] = [
    {
      key: 'luxury-single-sided-01-luxe-home',
      name: 'Luxury Single-Sided 01 – Luxe Home',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/oyxs9rw4kmo53b8',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-01-luxe-home.png',
      photoSlots:
        requiredPhotoSlots(6),
    },
    {
      key: 'luxury-single-sided-02-charcoal-estate',
      name: 'Luxury Single-Sided 02 – Charcoal Estate',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/77mfogwdwzdbmud',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-02-charcoal-estate.png',
      photoSlots:
        requiredPhotoSlots(4),
    },
    {
      key: 'luxury-single-sided-03-monochrome-modern',
      name: 'Luxury Single-Sided 03 – Monochrome Modern',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/50t4a3ahdrln0iv',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-03-monochrome-modern.png',
      photoSlots:
        requiredPhotoSlots(4),
    },
    {
      key: 'luxury-single-sided-04-black-white-showcase',
      name: 'Luxury Single-Sided 04 – Black & White Showcase',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/4vpcru80kf0dr4u',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-04-black-white-showcase.png',
      photoSlots:
        requiredPhotoSlots(5),
    },
    {
      key: 'luxury-single-sided-05-silver-grid-residence',
      name: 'Luxury Single-Sided 05 – Silver Grid Residence',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/4gby4c6p8mjx4yu',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-05-silver-grid-residence.png',
      photoSlots:
        requiredPhotoSlots(5),
    },
    {
      key: 'luxury-single-sided-06-navy-estate-showcase',
      name: 'Luxury Single-Sided 06 – Navy Estate Showcase',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/a3i9hfjto9ik3lo',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-06-navy-estate-showcase.png',
      photoSlots:
        requiredPhotoSlots(5),
    },
    {
      key: 'luxury-single-sided-07-ivory-property-portfolio',
      name: 'Luxury Single-Sided 07 – Ivory Property Portfolio',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/fn666ok1b7z0evd',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-07-ivory-property-portfolio.png',
      photoSlots:
        requiredPhotoSlots(3),
    },
    {
      key: 'luxury-single-sided-08-black-label-residence',
      name: 'Luxury Single-Sided 08 – Black Label Residence',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/gh623motu9epo8r',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-08-black-label-residence.png',
      photoSlots:
        requiredPhotoSlots(3),
    },
    {
      key: 'luxury-single-sided-09-emerald-luxury-living',
      name: 'Luxury Single-Sided 09 – Emerald Luxury Living',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/gikwmetslhg1dr8',
      orientation: 'Portrait',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-single-sided-09-emerald-luxury-living.png',
      photoSlots:
        requiredPhotoSlots(5),
    },
    {
      key: 'luxury-landscape-01-gold-estate',
      name: 'Luxury Landscape 01 – Gold Estate',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/gvmz1r6libvv24j',
      orientation: 'Landscape',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-landscape-01-gold-estate.png',
      photoSlots:
        requiredPhotoSlots(4),
    },
    {
      key: 'luxury-landscape-02-ivory-estate',
      name: 'Luxury Landscape 02 – Ivory Estate',
      flyerType: 'flyer',
      style: 'luxury',
      url: 'https://canva.link/1hhv965kx23tmxk',
      orientation: 'Landscape',
      previewPath:
        '/marketing/canva-templates/luxury/single-sided/luxury-landscape-02-ivory-estate.png',
      photoSlots:
        requiredPhotoSlots(5),
    },
  ];

export type CanvaFlyerCopy = {
  headline: string;
  public_description: string;
  short_description: string;
  feature_bullets: string[];
  call_to_action: string;
  price_line: string;
  contact_line: string;
};

export type CanvaFlyerHistoryEntry = {
  workflow_status: CanvaFlyerStatus;
  changed_at: string;
  changed_by: string;
};

export type CanvaFlyerPieceState = {
  style?: CanvaFlyerStyle;
  template_name: string;
  template_url: string;
  completed_design_url: string;
  workflow_status: CanvaFlyerStatus;
  copy: CanvaFlyerCopy;
  updated_at: string;
  updated_by: string;
  status_history: CanvaFlyerHistoryEntry[];
};

export type CanvaFlyerPackage = {
  version:
    typeof CANVA_FLYER_PACKAGE_VERSION;
  selected_type: CanvaFlyerType;
  pieces: Partial<
    Record<
      CanvaFlyerType,
      CanvaFlyerPieceState
    >
  >;
};

export type CanvaFlyerParseResult = {
  valid: boolean;
  value: CanvaFlyerPackage;
  errors: string[];
};

export type CanvaFlyerReadinessContext = {
  assignedSlots: readonly string[];
  brandingBlockers: readonly string[];
  sectionStatus: string;
  nativeDesign?: boolean;
};

const PACKAGE_KEYS = [
  'version',
  'selected_type',
  'pieces',
] as const;

const PIECE_KEYS = [
  'style',
  'template_name',
  'template_url',
  'completed_design_url',
  'workflow_status',
  'copy',
  'updated_at',
  'updated_by',
  'status_history',
] as const;

const PIECE_REQUIRED_KEYS =
  PIECE_KEYS.filter(
    (key) =>
      key !== 'style'
  );

const COPY_KEYS = [
  'headline',
  'public_description',
  'short_description',
  'feature_bullets',
  'call_to_action',
  'price_line',
  'contact_line',
] as const;

const HISTORY_KEYS = [
  'workflow_status',
  'changed_at',
  'changed_by',
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
) {
  const keys =
    Object.keys(value);

  return keys.every((key) =>
    allowed.includes(key)
  ) &&
    allowed.every((key) =>
      keys.includes(key)
    );
}

function hasRequiredKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[]
) {
  const keys =
    Object.keys(value);

  return keys.every((key) =>
    allowed.includes(key)
  ) &&
    required.every((key) =>
      keys.includes(key)
    );
}

function utf8Size(value: unknown) {
  return new TextEncoder().encode(
    JSON.stringify(value)
  ).length;
}

function isFlyerType(
  value: unknown
): value is CanvaFlyerType {
  return typeof value === 'string' &&
    (
      CANVA_FLYER_TYPES.map(
        (item) => item.key
      ) as readonly string[]
    ).includes(value);
}

function isFlyerStatus(
  value: unknown
): value is CanvaFlyerStatus {
  return typeof value === 'string' &&
    (
      CANVA_FLYER_STATUSES as
        readonly string[]
    ).includes(value);
}

function isFlyerStyle(
  value: unknown
): value is CanvaFlyerStyle {
  return typeof value === 'string' &&
    (
      CANVA_FLYER_STYLES.map(
        (item) => item.key
      ) as readonly string[]
    ).includes(value);
}

function isIsoTimestamp(
  value: unknown
): value is string {
  return typeof value === 'string' &&
    Number.isFinite(
      Date.parse(value)
    );
}

function cleanString(
  value: unknown,
  maximumLength: number
) {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned.length <=
    maximumLength
    ? cleaned
    : null;
}

function validateCopy(
  input: unknown,
  path: string,
  errors: string[]
): CanvaFlyerCopy | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(
      input,
      COPY_KEYS
    )
  ) {
    errors.push(
      `${path} has an invalid shape.`
    );
    return null;
  }

  const headline =
    cleanString(
      input.headline,
      240
    );
  const publicDescription =
    cleanString(
      input.public_description,
      6000
    );
  const shortDescription =
    cleanString(
      input.short_description,
      800
    );
  const callToAction =
    cleanString(
      input.call_to_action,
      240
    );
  const priceLine =
    cleanString(
      input.price_line,
      160
    );
  const contactLine =
    cleanString(
      input.contact_line,
      280
    );

  if (
    headline === null ||
    publicDescription === null ||
    shortDescription === null ||
    callToAction === null ||
    priceLine === null ||
    contactLine === null
  ) {
    errors.push(
      `${path} contains text that is missing, invalid, or too long.`
    );
    return null;
  }

  if (
    !Array.isArray(
      input.feature_bullets
    ) ||
    input.feature_bullets.length >
      12
  ) {
    errors.push(
      `${path}.feature_bullets must contain no more than 12 items.`
    );
    return null;
  }

  const featureBullets:
    string[] = [];

  for (
    const [
      index,
      item,
    ] of input
      .feature_bullets
      .entries()
  ) {
    const bullet =
      cleanString(
        item,
        240
      );

    if (
      bullet === null ||
      !bullet
    ) {
      errors.push(
        `${path}.feature_bullets[${index}] is invalid.`
      );
      continue;
    }

    featureBullets.push(
      bullet
    );
  }

  return {
    headline,
    public_description:
      publicDescription,
    short_description:
      shortDescription,
    feature_bullets:
      featureBullets,
    call_to_action:
      callToAction,
    price_line:
      priceLine,
    contact_line:
      contactLine,
  };
}

function validateHistory(
  input: unknown,
  path: string,
  errors: string[]
) {
  if (
    !Array.isArray(input) ||
    input.length >
      CANVA_FLYER_HISTORY_LIMIT
  ) {
    errors.push(
      `${path} has too many entries or is not a list.`
    );
    return [];
  }

  const history:
    CanvaFlyerHistoryEntry[] = [];

  for (
    const [
      index,
      item,
    ] of input.entries()
  ) {
    const itemPath =
      `${path}[${index}]`;

    if (
      !isRecord(item) ||
      !hasExactKeys(
        item,
        HISTORY_KEYS
      ) ||
      !isFlyerStatus(
        item.workflow_status
      ) ||
      !isIsoTimestamp(
        item.changed_at
      ) ||
      typeof item.changed_by !==
        'string' ||
      !UUID_PATTERN.test(
        item.changed_by
      )
    ) {
      errors.push(
        `${itemPath} is invalid.`
      );
      continue;
    }

    history.push({
      workflow_status:
        item.workflow_status,
      changed_at:
        item.changed_at,
      changed_by:
        item.changed_by,
    });
  }

  return history;
}

export function canvaFlyerTypeForKey(
  key: CanvaFlyerType
) {
  return CANVA_FLYER_TYPES.find(
    (item) =>
      item.key === key
  ) ||
    CANVA_FLYER_TYPES[0];
}

export function emptyCanvaFlyerPackage():
  CanvaFlyerPackage {
  return {
    version:
      CANVA_FLYER_PACKAGE_VERSION,
    selected_type:
      'flyer',
    pieces: {},
  };
}

export function validateCanvaUrl(
  input: unknown,
  options: {
    allowTemplateShortLink?: boolean;
  } = {}
): {
  valid: boolean;
  normalized: string;
  error: string;
} {
  if (
    input === null ||
    input === undefined ||
    input === ''
  ) {
    return {
      valid: true,
      normalized: '',
      error: '',
    };
  }

  if (typeof input !== 'string') {
    return {
      valid: false,
      normalized: '',
      error:
        'Enter a valid Canva link.',
    };
  }

  const value =
    input.trim();

  if (
    !value ||
    value.length > 1000
  ) {
    return {
      valid: false,
      normalized: '',
      error:
        'The Canva link is empty or too long.',
    };
  }

  try {
    const url =
      new URL(value);
    const hostname =
      url.hostname
        .toLowerCase()
        .replace(/\.$/, '');
    const approvedCanvaHost =
      hostname ===
        'canva.com' ||
      hostname.endsWith(
        '.canva.com'
      );
    const approvedTemplateShortLink =
      options.allowTemplateShortLink ===
        true &&
      hostname ===
        'canva.link';

    if (
      url.protocol !==
        'https:' ||
      !(
        approvedCanvaHost ||
        approvedTemplateShortLink
      ) ||
      Boolean(
        url.username ||
        url.password
      ) ||
      Boolean(
        url.port &&
        url.port !== '443'
      )
    ) {
      return {
        valid: false,
        normalized: '',
        error:
          options.allowTemplateShortLink
            ? 'Use an HTTPS link from canva.com or canva.link.'
            : 'Use an HTTPS link from canva.com.',
      };
    }

    url.hash = '';

    return {
      valid: true,
      normalized:
        url.toString(),
      error: '',
    };
  } catch {
    return {
      valid: false,
      normalized: '',
      error:
        'Enter a valid Canva link.',
    };
  }
}

export function parseCanvaFlyerPackage(
  input: unknown
): CanvaFlyerParseResult {
  if (
    input === null ||
    input === undefined
  ) {
    return {
      valid: true,
      value:
        emptyCanvaFlyerPackage(),
      errors: [],
    };
  }

  const errors: string[] =
    [];

  if (
    !isRecord(input) ||
    !hasExactKeys(
      input,
      PACKAGE_KEYS
    )
  ) {
    return {
      valid: false,
      value:
        emptyCanvaFlyerPackage(),
      errors: [
        'The saved Flyer draft uses an unsupported format.',
      ],
    };
  }

  if (
    input.version !==
    CANVA_FLYER_PACKAGE_VERSION
  ) {
    errors.push(
      'The saved Flyer draft uses an older format.'
    );
  }

  if (
    !isFlyerType(
      input.selected_type
    )
  ) {
    errors.push(
      'The saved Flyer type is invalid.'
    );
  }

  if (
    !isRecord(input.pieces)
  ) {
    errors.push(
      'The saved Flyer drafts are invalid.'
    );
  }

  const pieces:
    CanvaFlyerPackage['pieces'] =
      {};

  if (isRecord(input.pieces)) {
    const pieceKeys =
      Object.keys(
        input.pieces
      );

    if (
      pieceKeys.length > 2 ||
      pieceKeys.some(
        (key) =>
          !isFlyerType(key)
      )
    ) {
      errors.push(
        'The saved Flyer draft contains an unsupported Flyer type.'
      );
    }

    for (
      const [
        key,
        value,
      ] of Object.entries(
        input.pieces
      )
    ) {
      if (
        !isFlyerType(key)
      ) {
        continue;
      }

      const path =
        `pieces.${key}`;

      if (
        !isRecord(value) ||
        !hasRequiredKeys(
          value,
          PIECE_KEYS,
          PIECE_REQUIRED_KEYS
        )
      ) {
        errors.push(
          `${path} has an invalid shape.`
        );
        continue;
      }

      const templateName =
        cleanString(
          value.template_name,
          160
        );
      const style =
        value.style ===
        undefined
          ? undefined
          : isFlyerStyle(
                value.style
              )
            ? value.style
            : null;
      const template =
        validateCanvaUrl(
          value.template_url,
          {
            allowTemplateShortLink:
              true,
          }
        );
      const completed =
        validateCanvaUrl(
          value.completed_design_url
        );
      const copy =
        validateCopy(
          value.copy,
          `${path}.copy`,
          errors
        );
      const history =
        validateHistory(
          value.status_history,
          `${path}.status_history`,
          errors
        );

      if (
        templateName === null
      ) {
        errors.push(
          `${path}.template_name is invalid.`
        );
      }

      if (style === null) {
        errors.push(
          `${path}.style is invalid.`
        );
      }

      if (!template.valid) {
        errors.push(
          `${path}.template_url is invalid.`
        );
      }

      if (!completed.valid) {
        errors.push(
          `${path}.completed_design_url is invalid.`
        );
      }

      if (
        !isFlyerStatus(
          value.workflow_status
        )
      ) {
        errors.push(
          `${path}.workflow_status is invalid.`
        );
      }

      if (
        !isIsoTimestamp(
          value.updated_at
        ) ||
        typeof value.updated_by !==
          'string' ||
        !UUID_PATTERN.test(
          value.updated_by
        )
      ) {
        errors.push(
          `${path} has invalid update information.`
        );
      }

      if (
        style !== null &&
        templateName !== null &&
        template.valid &&
        completed.valid &&
        copy &&
        isFlyerStatus(
          value.workflow_status
        ) &&
        isIsoTimestamp(
          value.updated_at
        ) &&
        typeof value.updated_by ===
          'string' &&
        UUID_PATTERN.test(
          value.updated_by
        )
      ) {
        pieces[key] = {
          ...(style
            ? {
                style,
              }
            : {}),
          template_name:
            templateName,
          template_url:
            template.normalized,
          completed_design_url:
            completed.normalized,
          workflow_status:
            value.workflow_status,
          copy,
          updated_at:
            value.updated_at,
          updated_by:
            value.updated_by,
          status_history:
            history,
        };
      }
    }
  }

  const selectedType =
    isFlyerType(
      input.selected_type
    )
      ? input.selected_type
      : 'flyer';
  const normalized:
    CanvaFlyerPackage = {
      version:
        CANVA_FLYER_PACKAGE_VERSION,
      selected_type:
        selectedType,
      pieces,
    };

  if (
    utf8Size(normalized) >
    CANVA_FLYER_PACKAGE_MAX_BYTES
  ) {
    errors.push(
      'The saved Flyer draft is too large.'
    );
  }

  return {
    valid:
      errors.length === 0,
    value:
      errors.length === 0
        ? normalized
        : emptyCanvaFlyerPackage(),
    errors,
  };
}

export function canvaPackageForPreservation(
  input: unknown
) {
  if (
    input === null ||
    input === undefined
  ) {
    return null;
  }

  const parsed =
    parseCanvaFlyerPackage(
      input
    );

  return parsed.valid
    ? parsed.value
    : null;
}

export function updateCanvaFlyerPiece(
  existing: CanvaFlyerPackage,
  flyerType: CanvaFlyerType,
  draft: {
    style?: CanvaFlyerStyle;
    template_name: string;
    template_url: string;
    completed_design_url: string;
    workflow_status: CanvaFlyerStatus;
    copy: CanvaFlyerCopy;
  },
  actorId: string,
  changedAt =
    new Date().toISOString()
) {
  if (
    !UUID_PATTERN.test(
      actorId
    )
  ) {
    throw new Error(
      'Your CRM session is invalid.'
    );
  }

  if (
    !isFlyerType(
      flyerType
    ) ||
    !isIsoTimestamp(
      changedAt
    )
  ) {
    throw new Error(
      'The Flyer update is invalid.'
    );
  }

  const current =
    existing.pieces[
      flyerType
    ];
  const history =
    current
      ? [
          ...current
            .status_history,
        ]
      : [];

  if (
    !current ||
    current.workflow_status !==
      draft.workflow_status
  ) {
    history.push({
      workflow_status:
        draft.workflow_status,
      changed_at:
        changedAt,
      changed_by:
        actorId,
    });
  }

  const candidate:
    CanvaFlyerPackage = {
      version:
        CANVA_FLYER_PACKAGE_VERSION,
      selected_type:
        flyerType,
      pieces: {
        ...existing.pieces,
        [flyerType]: {
          ...draft,
          updated_at:
            changedAt,
          updated_by:
            actorId,
          status_history:
            history.slice(
              -CANVA_FLYER_HISTORY_LIMIT
            ),
        },
      },
    };
  const parsed =
    parseCanvaFlyerPackage(
      candidate
    );

  if (!parsed.valid) {
    throw new Error(
      parsed.errors[0] ||
      'The Flyer could not be saved.'
    );
  }

  return parsed.value;
}

export function defaultCanvaFlyerCopy(
  input: {
    listingTitle: string;
    campaignHeadline:
      string | null;
    publicRemarks:
      string | null;
    shortDescription:
      string | null;
    preparedHeadline:
      string | null;
    featureBullets:
      unknown;
    callToAction:
      string | null;
    listPrice:
      number | null;
  }
): CanvaFlyerCopy {
  const bullets =
    Array.isArray(
      input.featureBullets
    )
      ? Array.from(
          new Set(
            input
              .featureBullets
              .filter(
                (
                  value
                ): value is string =>
                  typeof value ===
                    'string' &&
                  Boolean(
                    value.trim()
                  )
              )
              .map((value) =>
                value
                  .trim()
                  .slice(
                    0,
                    240
                  )
              )
          )
        ).slice(0, 12)
      : [];
  const priceLine =
    typeof input.listPrice ===
      'number' &&
    Number.isFinite(
      input.listPrice
    )
      ? new Intl.NumberFormat(
          'en-US',
          {
            style:
              'currency',
            currency:
              'USD',
            maximumFractionDigits:
              0,
          }
        ).format(
          input.listPrice
        )
      : '';

  return {
    headline:
      input.preparedHeadline
        ?.trim() ||
      input.campaignHeadline
        ?.trim() ||
      input.listingTitle
        .trim(),
    public_description:
      input.publicRemarks
        ?.trim() ||
      '',
    short_description:
      input.shortDescription
        ?.trim() ||
      '',
    feature_bullets:
      bullets,
    call_to_action:
      input.callToAction
        ?.trim() ||
      '',
    price_line:
      priceLine,
    contact_line: '',
  };
}

function needsFinishedDesign(
  status: CanvaFlyerStatus
) {
  return [
    'approved',
    'exported',
    'printed',
  ].includes(status);
}

export function canvaFlyerReadinessIssues(
  flyerType: CanvaFlyerType,
  state:
    CanvaFlyerPieceState,
  context:
    CanvaFlyerReadinessContext
) {
  const issues: string[] =
    [];
  const add = (
    message: string
  ) => {
    if (
      !issues.includes(
        message
      )
    ) {
      issues.push(
        message
      );
    }
  };
  const definition =
    canvaFlyerTypeForKey(
      flyerType
    );

  if (
    !state.template_name
      .trim()
  ) {
    add(
      'Add a name for the Canva template.'
    );
  }

  const template =
    validateCanvaUrl(
      state.template_url,
      {
        allowTemplateShortLink:
          true,
      }
    );

  if (
    !state.template_url ||
    !template.valid
  ) {
    add(
      'Choose a valid Canva template link.'
    );
  }

  if (
    needsFinishedDesign(
      state.workflow_status
    ) &&
    !context.nativeDesign
  ) {
    const completed =
      validateCanvaUrl(
        state
          .completed_design_url
      );

    if (
      !state
        .completed_design_url ||
      !completed.valid
    ) {
      add(
        'Save the completed Canva design link before approval.'
      );
    }
  }

  if (
    !state.copy.headline.trim()
  ) {
    add(
      'Add a Flyer headline.'
    );
  }

  if (
    !state.copy
      .public_description
      .trim()
  ) {
    add(
      'MLS Public Description is missing.'
    );
  }

  const selectedTemplate =
    CANVA_FLYER_TEMPLATES.find(
      (item) =>
        item.flyerType ===
          flyerType &&
        item.name ===
          state.template_name
    ) ||
    null;
  const photoSlots =
    selectedTemplate?.photoSlots ||
    definition.photoSlots;

  for (
    const slot of
      photoSlots
  ) {
    const slotId =
      `${slot.slotKey}:${slot.sortOrder}`;

    if (
      slot.required &&
      !context
        .assignedSlots
        .includes(slotId)
    ) {
      add(
        `${slot.label} is required.`
      );
    }
  }

  for (
    const blocker of
      context.brandingBlockers
  ) {
    add(blocker);
  }

  if (
    needsFinishedDesign(
      state.workflow_status
    ) &&
    context.sectionStatus !==
      'approved'
  ) {
    add(
      'Approve the Flyer before marking it approved, exported, or printed.'
    );
  }

  return issues;
}
