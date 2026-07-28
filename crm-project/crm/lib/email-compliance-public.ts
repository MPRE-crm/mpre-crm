export type EmailPreferenceValues = {
  allow_listing_ads: boolean;
  allow_open_house: boolean;
  allow_price_changes: boolean;
  allow_market_updates: boolean;
  allow_newsletters: boolean;
};

export type LoadedEmailPreferences = {
  email_masked: string;
  marketing_status:
    | 'active'
    | 'unsubscribed'
    | 'blocked';
  status_reason: string;
  can_update: boolean;
  preferences: EmailPreferenceValues;
};

export const DEFAULT_EMAIL_PREFERENCES:
  EmailPreferenceValues = {
    allow_listing_ads: true,
    allow_open_house: true,
    allow_price_changes: true,
    allow_market_updates: true,
    allow_newsletters: true,
  };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanEmailComplianceToken(
  value: unknown
) {
  const token =
    typeof value === 'string'
      ? value.trim()
      : '';

  return UUID_PATTERN.test(token)
    ? token
    : '';
}

export function isEmailComplianceRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function parseLoadedEmailPreferences(
  value: unknown
): LoadedEmailPreferences | null {
  if (
    !isEmailComplianceRecord(value) ||
    value.ok !== true ||
    !isEmailComplianceRecord(
      value.preferences
    )
  ) {
    return null;
  }

  const status =
    value.marketing_status;

  if (
    status !== 'active' &&
    status !== 'unsubscribed' &&
    status !== 'blocked'
  ) {
    return null;
  }

  const preferences =
    value.preferences;

  const preferenceValues:
    EmailPreferenceValues = {
      allow_listing_ads:
        preferences
          .allow_listing_ads === true,

      allow_open_house:
        preferences
          .allow_open_house === true,

      allow_price_changes:
        preferences
          .allow_price_changes === true,

      allow_market_updates:
        preferences
          .allow_market_updates === true,

      allow_newsletters:
        preferences
          .allow_newsletters === true,
    };

  return {
    email_masked:
      typeof value.email_masked ===
      'string'
        ? value.email_masked
        : 'your email address',

    marketing_status:
      status,

    status_reason:
      typeof value.status_reason ===
      'string'
        ? value.status_reason
        : status,

    can_update:
      value.can_update === true,

    preferences:
      preferenceValues,
  };
}
