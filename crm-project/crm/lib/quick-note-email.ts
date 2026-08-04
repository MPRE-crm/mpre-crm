import type {
  Listing,
  LuxuryEmailEditionKey,
  Profile,
} from './listing-email-creative';

import {
  buildMarketingComplianceFooterHtml,
  buildMarketingSocialLinksHtml,
} from './marketing-email-footer';

export const QUICK_NOTE_AUDIENCES = [
  'reverse_prospecting_realtor',
  'realtor',
  'lender',
  'title_escrow',
  'professional',
  'active_client',
  'past_client',
  'sphere',
  'vendor_partner',
  'prospect',
  'unknown',
] as const;
export type QuickNoteAudience =
  (typeof QUICK_NOTE_AUDIENCES)[number];

export const QUICK_NOTE_EDITION_LABELS:
  Record<
    LuxuryEmailEditionKey,
    string
  > = {
    launch:
      'Luxury Launch',

    views_lifestyle:
      'Views & Lifestyle',

    design_interiors:
      'Design & Interiors',

    property_in_motion:
      'Property in Motion',

    closer_look:
      'A Closer Look',

    agent_spotlight:
      'Agent Spotlight',

    fresh_opportunity:
      'Fresh Opportunity',
  };

const QUICK_NOTE_EDITION_FOLLOW_UP:
  Record<
    LuxuryEmailEditionKey,
    string
  > = {
    launch:
      'I pulled together the strongest photos and details in one place so you can quickly see what makes this home stand out.',

    views_lifestyle:
      'The setting is a big part of what separates this home, especially the views and connection to outdoor living. The full email shows that side of the property much better than a standard listing summary.',

    design_interiors:
      'The finishes and main living spaces deserve a closer look, especially how the home comes together from room to room. The full email gives those details room to stand out.',

    property_in_motion:
      'The full presentation makes it easier to understand how the home flows from one space to the next. That experience is difficult to capture in a standard listing description.',

    closer_look:
      'I highlighted useful details and spaces that can be easy to miss on a quick first look. The full email makes it easier to decide whether those features fit a buyer’s day-to-day needs.',

    agent_spotlight:
      'I pulled together the features that may matter most to an active buyer so you can quickly decide whether this property fits someone in your pipeline.',

    fresh_opportunity:
      'I presented the property from a different perspective to surface features that may have been overlooked the first time. It may be worth another look for the right buyer.',
  };

const QUICK_NOTE_ACTIVE_CLIENT_EDITION_FOLLOW_UP:
  Record<
    LuxuryEmailEditionKey,
    string
  > = {
    launch:
      'I pulled together the strongest photos and details so you can quickly decide whether this home fits what you are looking for.',

    views_lifestyle:
      'The setting, views and outdoor lifestyle are a major part of this home. The full email should help you decide whether they match the experience you are looking for.',

    design_interiors:
      'I highlighted the finishes, layout and main living spaces so you can decide whether they match your priorities for a home.',

    property_in_motion:
      'The full presentation makes it easier to picture how you would move through the home and whether it would work for your everyday life.',

    closer_look:
      'I highlighted details and useful spaces that could matter to your comfort, routine and day-to-day needs.',

    agent_spotlight:
      'I pulled together the features that may matter most to you so you can quickly decide whether this property deserves a closer look.',

    fresh_opportunity:
      'I presented the property from a different perspective to help you decide whether it may fit your needs after all.',
  };

const QUICK_NOTE_PROSPECT_EDITION_FOLLOW_UP:
  Record<
    LuxuryEmailEditionKey,
    string
  > = {
    launch:
      'I pulled together the strongest photos and details so you can quickly decide whether this home may be worth considering for you.',

    views_lifestyle:
      'The setting, views and outdoor lifestyle are a major part of what separates this home. The full email should help you decide whether that experience appeals to you.',

    design_interiors:
      'I highlighted the finishes, layout and main living spaces so you can decide whether the home could match what you are looking for.',

    property_in_motion:
      'The full presentation makes it easier to picture how the home flows and whether it could work for your everyday life.',

    closer_look:
      'I highlighted details and useful spaces that may not stand out in a quick listing search but could matter to your decision.',

    agent_spotlight:
      'I pulled together the features that may matter most to you so you can quickly decide whether the property is worth exploring further.',

    fresh_opportunity:
      'I presented the property from a different perspective so you can decide whether it may deserve another look.',
  };

function editionFollowUpForAudience(
  edition:
    LuxuryEmailEditionKey,
  audience:
    QuickNoteAudience
): string {
  if (
    audience ===
    'active_client'
  ) {
    return QUICK_NOTE_ACTIVE_CLIENT_EDITION_FOLLOW_UP[
      edition
    ];
  }

  if (
    audience ===
    'prospect'
  ) {
    return QUICK_NOTE_PROSPECT_EDITION_FOLLOW_UP[
      edition
    ];
  }

  return QUICK_NOTE_EDITION_FOLLOW_UP[
    edition
  ];
}

export type QuickNoteContact = {
  first_name?: string | null;
  contact_type?: string | null;
  lifecycle_stage?: string | null;
  source?: string | null;
  tags?: string[] | null;
  reverse_prospecting_match?: boolean;
};

export type QuickNoteClassification = {
  audience: QuickNoteAudience;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  needs_review: boolean;
};

export type QuickNoteDraft = {
  audience: QuickNoteAudience;
  audience_label: string;

  luxury_edition:
    LuxuryEmailEditionKey;

  edition_label:
    string;
  classification_confidence:
    | 'high'
    | 'medium'
    | 'low';
  classification_reason: string;
  needs_classification_review: boolean;
  subject: string;
  preview_text: string;
  follow_up_paragraph: string;
  text: string;
  html: string;
  stop_after_reply: true;
};

type BuildQuickNoteInput = {
  listing: Listing;
  profile: Profile;
  contact?: QuickNoteContact | null;
  audience?: QuickNoteAudience;

  luxury_edition?:
    LuxuryEmailEditionKey;

  edition_headline?:
    | string
    | null;

  edition_body?:
    | string
    | null;

  edition_message_override?:
    | string
    | null;

  subject_override?: string | null;
  preview_text_override?: string | null;
  unsubscribe_url?: string | null;
  preferences_url?: string | null;
};

const AUDIENCE_LABELS:
  Record<QuickNoteAudience, string> = {
    reverse_prospecting_realtor:
      'Reverse-Prospecting Realtor',

    realtor:
      'Realtor',

    lender:
      'Lender',

    title_escrow:
      'Title / Escrow',

    professional:
      'Professional',

    active_client:
      'Active Client',

    past_client:
      'Past or Closed Client',

    sphere:
      'Sphere of Influence',

    vendor_partner:
      'Vendor or Partner',

    prospect:
      'Prospect',

    unknown:
      'General Contact',
  };
function clean(
  value: unknown
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalize(
  value: unknown
): string {
  return clean(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function includesAny(
  value: string,
  terms: string[]
): boolean {
  return terms.some(
    (term) =>
      value.includes(term)
  );
}

function escapeHtml(
  value: unknown
): string {
  return clean(value)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

function firstSentence(
  value: unknown,
  maxLength = 240
): string {
  const text =
    clean(value)
      .replace(
        /\s+/g,
        ' '
      );

  if (!text) {
    return '';
  }

  const punctuationIndexes = [
    text.indexOf('. '),
    text.indexOf('! '),
    text.indexOf('? '),
  ].filter(
    (index) =>
      index >= 0
  );

  const sentenceEnd =
    punctuationIndexes.length
      ? Math.min(
          ...punctuationIndexes
        ) + 1
      : text.length;

  const sentence =
    text.slice(
      0,
      sentenceEnd
    );

  if (
    sentence.length <=
    maxLength
  ) {
    return sentence;
  }

  return `${sentence
    .slice(
      0,
      maxLength - 1
    )
    .trim()}…`;
}

function buildPropertyName(
  listing: Listing
): string {
  return (
    clean(
      listing.property_address
    ) ||
    clean(
      listing.title
    ) ||
    'this property'
  );
}

function buildFullAddress(
  listing: Listing
): string {
  const locality = [
    clean(listing.city),
    clean(listing.state),
    clean(listing.zip),
  ]
    .filter(Boolean)
    .join(' ');

  return [
    clean(
      listing.property_address
    ),
    locality,
  ]
    .filter(Boolean)
    .join(', ');
}

export function classifyQuickNoteAudience(
  contact?: QuickNoteContact | null
): QuickNoteClassification {
  if (!contact) {
    return {
      audience:
        'unknown',
      confidence:
        'low',
      reason:
        'No contact classification data was supplied.',
      needs_review:
        true,
    };
  }

  const contactType =
    normalize(
      contact.contact_type
    );

  const lifecycleStage =
    normalize(
      contact.lifecycle_stage
    );

  const source =
    normalize(
      contact.source
    );

  const tags =
    (
      contact.tags ||
      []
    )
      .map(normalize)
      .filter(Boolean)
      .join(' ');

  const combined = [
    contactType,
    lifecycleStage,
    source,
    tags,
  ]
    .filter(Boolean)
    .join(' ');

  const realtorRelationship =
    contactType ===
      'realtor' ||
    includesAny(
      combined,
      [
        'realtor',
        'real estate agent',
        'real estate broker',
        'broker associate',
      ]
    );

  if (
    contact
      .reverse_prospecting_match &&
    realtorRelationship
  ) {
    return {
      audience:
        'reverse_prospecting_realtor',
      confidence:
        'high',
      reason:
        'The Realtor has a verified listing-specific Buyer Match or reverse-prospecting connection.',
      needs_review:
        false,
    };
  }

  switch (contactType) {
    case 'realtor':
      return {
        audience:
          'realtor',
        confidence:
          'high',
        reason:
          'The Contact Category is Realtor.',
        needs_review:
          false,
      };

    case 'lender':
      return {
        audience:
          'lender',
        confidence:
          'high',
        reason:
          'The Contact Category is Lender.',
        needs_review:
          false,
      };

    case 'title escrow':
      return {
        audience:
          'title_escrow',
        confidence:
          'high',
        reason:
          'The Contact Category is Title / Escrow.',
        needs_review:
          false,
      };

    case 'professional':
      return {
        audience:
          'professional',
        confidence:
          'high',
        reason:
          'The Contact Category is Professional.',
        needs_review:
          false,
      };

    case 'buyer':
    case 'seller':
    case 'buyer seller':
      return {
        audience:
          'active_client',
        confidence:
          'high',
        reason:
          'The Contact Category identifies an active Buyer, Seller or Buyer & Seller client.',
        needs_review:
          false,
      };

    case 'past client':
      return {
        audience:
          'past_client',
        confidence:
          'high',
        reason:
          'The Contact Category is Past or Closed Client.',
        needs_review:
          false,
      };

    case 'sphere':
      return {
        audience:
          'sphere',
        confidence:
          'high',
        reason:
          'The Contact Category is Sphere of Influence.',
        needs_review:
          false,
      };

    case 'vendor partner':
    case 'vendor':
      return {
        audience:
          'vendor_partner',
        confidence:
          'high',
        reason:
          'The Contact Category is Vendor or Partner.',
        needs_review:
          false,
      };

    case 'prospect':
      return {
        audience:
          'prospect',
        confidence:
          'high',
        reason:
          'The Contact Category identifies a prospective consumer.',
        needs_review:
          false,
      };

    case 'other':
      return {
        audience:
          'unknown',
        confidence:
          'high',
        reason:
          'The Contact Category is Other / General Contact, so safe general wording will be used.',
        needs_review:
          false,
      };

    case 'builder':
      return {
        audience:
          'unknown',
        confidence:
          'low',
        reason:
          'Builder contacts are excluded from the listing Personal Follow-up audience model.',
        needs_review:
          true,
      };
  }

  if (
    includesAny(
      combined,
      [
        'title escrow',
        'title company',
        'escrow officer',
        'closing officer',
      ]
    )
  ) {
    return {
      audience:
        'title_escrow',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a Title or Escrow relationship.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      combined,
      [
        'lender',
        'loan officer',
        'mortgage',
        'financing partner',
      ]
    )
  ) {
    return {
      audience:
        'lender',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a lender or mortgage professional.',
      needs_review:
        false,
    };
  }

  if (realtorRelationship) {
    return {
      audience:
        'realtor',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a real-estate professional.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      lifecycleStage,
      [
        'closed',
        'past client',
        'former client',
      ]
    ) ||
    includesAny(
      combined,
      [
        'past client',
        'closed client',
        'previous client',
      ]
    )
  ) {
    return {
      audience:
        'past_client',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a past or closed client.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      combined,
      [
        'active client',
        'current client',
        'buyer client',
        'seller client',
        'active buyer',
        'active seller',
        'under contract',
      ]
    ) ||
    contactType ===
      'client'
  ) {
    return {
      audience:
        'active_client',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a current consumer client.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      combined,
      [
        'sphere',
        'soi',
        'friend',
        'family',
        'neighbor',
        'personal contact',
      ]
    )
  ) {
    return {
      audience:
        'sphere',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a sphere-of-influence relationship.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      combined,
      [
        'attorney',
        'accountant',
        'financial advisor',
        'financial planner',
        'professional contact',
      ]
    )
  ) {
    return {
      audience:
        'professional',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a professional relationship.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      combined,
      [
        'vendor',
        'partner',
        'inspector',
        'contractor',
        'photographer',
        'insurance',
      ]
    )
  ) {
    return {
      audience:
        'vendor_partner',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a vendor or professional partner.',
      needs_review:
        false,
    };
  }

  if (
    includesAny(
      combined,
      [
        'prospect',
        'lead',
        'buyer lead',
        'seller lead',
      ]
    )
  ) {
    return {
      audience:
        'prospect',
      confidence:
        'medium',
      reason:
        'Legacy contact data identifies a prospective consumer or lead.',
      needs_review:
        false,
    };
  }

  return {
    audience:
      'unknown',
    confidence:
      'low',
    reason:
      'The available contact fields do not support a reliable relationship classification.',
    needs_review:
      true,
  };
}
function openingForAudience(
  audience: QuickNoteAudience,
  propertyName: string
): string {
  switch (audience) {
    case 'reverse_prospecting_realtor':
      return `I saw you may have a client whose search could line up with ${propertyName}, so I wanted to reach out personally.`;

    case 'realtor':
      return `I wanted to personally share ${propertyName} in case you have a buyer who may be a fit.`;

    case 'lender':
      return `I wanted to share ${propertyName} in case one of your clients or an agent you work with may know someone who is a fit.`;

    case 'title_escrow':
      return `I wanted to put ${propertyName} on your radar in case a client, agent or contact you work with may be a fit.`;

    case 'professional':
      return `I wanted to share ${propertyName} in case someone in your professional network may be a fit.`;

    case 'active_client':
      return `I wanted to personally share ${propertyName} because it may fit what you are looking for.`;

    case 'past_client':
      return `I wanted to share ${propertyName} in case someone in your circle may be a great fit.`;

    case 'sphere':
      return `I wanted to share ${propertyName} with you personally in case someone you know may be a great fit.`;

    case 'vendor_partner':
      return `I wanted to put ${propertyName} on your radar in case someone in your network may be a fit.`;

    case 'prospect':
      return `I wanted to personally share ${propertyName} because it may be worth considering for you.`;

    default:
      return `I wanted to send you a quick personal note about ${propertyName} in case someone you know may be a fit.`;
  }
}
function replyQuestionForAudience(
  audience: QuickNoteAudience
): string {
  switch (audience) {
    case 'reverse_prospecting_realtor':
    case 'realtor':
      return 'Do you have anyone who may be a fit?';

    case 'lender':
      return 'Does anyone in your client or agent network come to mind?';

    case 'title_escrow':
      return 'Does a client, agent or contact you work with come to mind?';

    case 'professional':
      return 'Does anyone in your professional network come to mind?';

    case 'active_client':
      return 'Could this property fit what you are looking for?';

    case 'prospect':
      return 'Could this be worth a closer look for you?';

    default:
      return 'Does anyone you know come to mind?';
  }
}
function subjectForAudience(
  audience: QuickNoteAudience,
  propertyName: string
): string {
  switch (audience) {
    case 'reverse_prospecting_realtor':
      return `Quick note about ${propertyName}`;

    case 'realtor':
      return `Any buyers for ${propertyName}?`;

    case 'lender':
    case 'title_escrow':
      return `A property to keep on your radar`;

    case 'professional':
      return `A property for your professional network`;

    case 'active_client':
      return `Could ${propertyName} fit your search?`;

    case 'past_client':
    case 'sphere':
    case 'vendor_partner':
      return `Know someone for ${propertyName}?`;

    case 'prospect':
      return `Is ${propertyName} worth a closer look?`;

    default:
      return `Quick note about ${propertyName}`;
  }
}
function formatUsPhone(
  value: unknown
): string {
  const raw =
    clean(value);

  const digits =
    raw.replace(
      /\D/g,
      ''
    );

  const normalized =
    digits.length === 11 &&
    digits.startsWith('1')
      ? digits.slice(1)
      : digits;

  if (
    normalized.length !== 10
  ) {
    return raw;
  }

  return `(${normalized.slice(
    0,
    3
  )}) ${normalized.slice(
    3,
    6
  )}-${normalized.slice(
    6
  )}`;
}

function buildTypedSignature(
  profile: Profile
): string[] {
  const senderName =
    clean(
      profile.marketing_from_name
    ) ||
    clean(
      profile.email
    ) ||
    'Your real estate professional';

  const roleLine = [
    clean(
      profile.marketing_title
    ),
    clean(
      profile.marketing_brokerage
    ),
  ]
    .filter(Boolean)
    .join(' | ');

  return [
    senderName,
    roleLine,
    formatUsPhone(
      profile.marketing_phone
    ),
    clean(
      profile.marketing_website_url
    ),
  ].filter(Boolean);
}

export type RecipientSpecificQuickNoteContact = {
  first_name?:
    | string
    | null;

  contact_type?:
    | string
    | null;

  verified_listing_buyer_match?:
    boolean;

  unsubscribe_url?:
    | string
    | null;

  preferences_url?:
    | string
    | null;
};

type BuildRecipientSpecificQuickNoteInput =
  Omit<
    BuildQuickNoteInput,
    | 'contact'
    | 'audience'
    | 'unsubscribe_url'
    | 'preferences_url'
  > & {
    recipient:
      RecipientSpecificQuickNoteContact;
  };

export function buildRecipientSpecificQuickNoteEmail(
  input:
    BuildRecipientSpecificQuickNoteInput
): QuickNoteDraft {
  const {
    recipient,
    ...draftInput
  } = input;

  return buildQuickNoteEmail({
    ...draftInput,

    contact: {
      first_name:
        recipient.first_name,

      contact_type:
        recipient.contact_type,

      reverse_prospecting_match:
        recipient
          .verified_listing_buyer_match ===
        true,
    },

    unsubscribe_url:
      recipient.unsubscribe_url,

    preferences_url:
      recipient.preferences_url,
  });
}

export function buildQuickNoteEmail(
  input: BuildQuickNoteInput
): QuickNoteDraft {
  const {
    listing,
    profile,
    contact,
    luxury_edition,
    edition_headline,
    edition_body,
    edition_message_override,
    subject_override,
    preview_text_override,
    unsubscribe_url,
    preferences_url,
  } = input;

  const classification =
    input.audience
      ? {
          audience:
            input.audience,
          confidence:
            'high' as const,
          reason:
            'The audience was selected explicitly.',
          needs_review:
            false,
        }
      : classifyQuickNoteAudience(
          contact
        );

  const audience =
    classification.audience;

  const propertyName =
    buildPropertyName(
      listing
    );

  const luxuryEdition =
    luxury_edition ||
    'launch';

  const editionLabel =
    QUICK_NOTE_EDITION_LABELS[
      luxuryEdition
    ];

  const editionMessageOverride =
    clean(
      edition_message_override
    );

  const editionFollowUp =
    editionMessageOverride ||
    editionFollowUpForAudience(
      luxuryEdition,
      audience
    );

  const sentEmailDescription =
    (
      {
        launch:
          'full property email',

        views_lifestyle:
          'property email focused on the views and lifestyle',

        design_interiors:
          'property email focused on the design and interiors',

        property_in_motion:
          'property-in-motion email',

        closer_look:
          'closer-look property email',

        agent_spotlight:
          'property email highlighting the most relevant buyer-fit features',

        fresh_opportunity:
          'fresh-opportunity property email',
      } as
        Record<
          LuxuryEmailEditionKey,
          string
        >
    )[
      luxuryEdition
    ];

  const fullAddress =
    buildFullAddress(
      listing
    );

  const recipientName =
    clean(
      contact?.first_name
    )
      .split(/\s+/)
      .filter(Boolean)[0] ||
    '';

  const greeting =
    recipientName
      ? `Hi ${recipientName}! \u{1F60A}`
      : 'Hi there! \u{1F60A}';

  const opening =
    openingForAudience(
      audience,
      propertyName
    ).replace(
      /\.$/,
      '!'
    );

  const listingSummary =
    firstSentence(
      edition_body ||
      edition_headline ||
      listing
        .short_marketing_description ||
      listing
        .campaign_headline ||
      listing
        .public_remarks ||
      listing
        .description
    );

  const propertySummary =
    [
      editionFollowUp,

      editionMessageOverride
        ? ''
        : listingSummary,
    ]
      .filter(Boolean)
      .join(' ');

  const publicUrl =
    clean(
      listing.public_url
    );

  const fullEmailReminder =
    publicUrl
      ? `I also sent the ${sentEmailDescription}. The photos and additional details make it much easier to see whether the property deserves a closer look. If you do not see it, it may be hiding in Promotions or Spam. You can also view the full property details here: ${publicUrl}`
      : `I also sent the ${sentEmailDescription}. The photos and additional details make it much easier to see whether the property deserves a closer look. If you do not see it, it may be hiding in Promotions or Spam. Reply to this note and I will resend it.`;

  const replyQuestion =
    replyQuestionForAudience(
      audience
    );

  const signatureMessage =
    clean(
      profile.marketing_signature_text
    ) ||
    'Make it a great day! \u{1F601}';

  const typedSignature =
    buildTypedSignature(
      profile
    );

  const fallbackSubject =
    subjectForAudience(
      audience,
      propertyName
    );

  const directConsumerAudience =
    audience ===
      'active_client' ||
    audience ===
      'prospect';

  const subject =
    clean(
      subject_override
    ) ||
    (
      luxuryEdition ===
        'launch' ||
      directConsumerAudience
        ? fallbackSubject
        : `${editionLabel}: ${fallbackSubject}`
    );

  const previewText =
    clean(
      preview_text_override
    ) ||
    opening;

  const textParts = [
    greeting,
    '',
    opening,
    propertySummary
      ? `\n${propertySummary}`
      : '',
    '',
    fullEmailReminder,
    '',
    replyQuestion,
    '',
    signatureMessage,
    ...typedSignature,
  ];

  if (
    clean(
      profile.marketing_physical_address
    )
  ) {
    textParts.push(
      '',
      `Business address: ${clean(
        profile.marketing_physical_address
      )}`
    );
  }

  if (
    clean(
      preferences_url
    )
  ) {
    textParts.push(
      `Email preferences: ${clean(
        preferences_url
      )}`
    );
  }

  if (
    clean(
      unsubscribe_url
    )
  ) {
    textParts.push(
      `Unsubscribe: ${clean(
        unsubscribe_url
      )}`
    );
  }

  const senderName =
    typedSignature[0] ||
    'Your real estate professional';

  const signatureImageUrl =
    clean(
      profile.marketing_signature_image_url
    );

  const typedSignatureHtml =
    typedSignature
      .map(
        (line, index) =>
          index === 0
            ? `<strong>${escapeHtml(
                line
              )}</strong>`
            : escapeHtml(
                line
              )
      )
      .join('<br />');

  const signatureHtml =
    signatureImageUrl
      ? `
        <img
          src="${escapeHtml(
            signatureImageUrl
          )}"
          alt="${escapeHtml(
            senderName
          )} personal email signature"
          style="display:block;max-width:320px;max-height:140px;width:auto;height:auto;margin:10px 0 8px;"
        />
      `
      : `
        <div style="font-size:15px;line-height:1.7;color:#0f172a;">
          ${typedSignatureHtml}
        </div>
      `;

  const fullEmailHtml =
    publicUrl
      ? `
        <p style="margin:0 0 25px;">
          I also sent the
          ${escapeHtml(
            sentEmailDescription
          )}.
          The photos and additional details make it much easier to see whether the property deserves a closer look.
          If you do not see it, it may be hiding in Promotions or Spam.
          You can also
          <a
            href="${escapeHtml(
              publicUrl
            )}"
            style="color:#1d4ed8;text-decoration:underline;"
          >view the full property details here</a>.
        </p>
      `
      : `
        <p style="margin:0 0 25px;">
          I also sent the
          ${escapeHtml(
            sentEmailDescription
          )}.
          The photos and additional details make it much easier to see whether the property deserves a closer look.
          If you do not see it, it may be hiding in Promotions or Spam.
          Reply to this note and I will resend it.
        </p>
      `;

  const socialLinksHtml =
    buildMarketingSocialLinksHtml(
      profile,
      'light'
    );

  const complianceFooterHtml =
    buildMarketingComplianceFooterHtml(
      profile,
      {
        preferences_url,
        unsubscribe_url,
      }
    );

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#ffffff;">
    <div style="max-width:660px;margin:0 auto;padding:46px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.78;color:#0f172a;">
      <p style="margin:0 0 25px;">
        ${escapeHtml(
          greeting
        )}
      </p>

      <p style="margin:0 0 25px;">
        ${escapeHtml(
          opening
        )}
      </p>

      ${
        propertySummary
          ? `
            <p style="margin:0 0 25px;">
              ${escapeHtml(
                propertySummary
              )}
            </p>
          `
          : ''
      }

      ${
        fullAddress &&
        fullAddress !==
          propertyName
          ? `
            <p style="margin:0 0 25px;color:#334155;">
              ${escapeHtml(
                fullAddress
              )}
            </p>
          `
          : ''
      }

      ${fullEmailHtml}

      <p style="margin:0 0 30px;">
        ${escapeHtml(
          replyQuestion
        )}
      </p>

      <p style="margin:0 0 10px;">
        ${escapeHtml(
          signatureMessage
        )}
      </p>

      ${signatureHtml}

      ${socialLinksHtml}

      ${complianceFooterHtml}
    </div>
  </body>
</html>`;

  return {
    audience,
    audience_label:
      AUDIENCE_LABELS[
        audience
      ],

    luxury_edition:
      luxuryEdition,

    edition_label:
      editionLabel,
    classification_confidence:
      classification.confidence,
    classification_reason:
      classification.reason,
    needs_classification_review:
      classification.needs_review,
    subject,
    preview_text:
      previewText,
    follow_up_paragraph:
      editionFollowUp,
    text:
      textParts
        .filter(
          (part) =>
            part !==
            undefined
        )
        .join('\n')
        .replace(
          /\n{3,}/g,
          '\n\n'
        )
        .trim(),
    html,
    stop_after_reply:
      true,
  };
}