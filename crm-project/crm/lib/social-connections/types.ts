export const SOCIAL_CONNECTION_PROVIDERS = [
  'facebook',
  'instagram',
  'linkedin',
  'x',
] as const;

export type SocialConnectionProvider =
  (typeof SOCIAL_CONNECTION_PROVIDERS)[number];

export type SocialOAuthProvider =
  | 'meta'
  | 'linkedin'
  | 'x';

export type SocialConnectionRole =
  | 'agent'
  | 'admin'
  | 'org_admin'
  | 'platform_admin';

export type SocialConnectionOwnerType =
  | 'user'
  | 'organization'
  | 'platform';

export type SocialConnectionStatus =
  | 'not_connected'
  | 'pending'
  | 'connected'
  | 'needs_reconnect'
  | 'revoked'
  | 'disconnected'
  | 'error';

export type SocialDestinationType =
  | 'facebook_page'
  | 'instagram_professional'
  | 'linkedin_profile'
  | 'linkedin_organization'
  | 'x_account';

export type SocialDestinationPermission =
  | 'select'
  | 'publish';

export type SocialConnectionOwner =
  | {
      type: 'user';
      profileId: string;
      organizationId: null;
      platformKey: null;
      label: string;
    }
  | {
      type: 'organization';
      profileId: null;
      organizationId: string;
      platformKey: null;
      label: string;
    }
  | {
      type: 'platform';
      profileId: null;
      organizationId: null;
      platformKey: string;
      label: string;
    };

export type SocialDestinationSummary = {
  id: string;
  provider: SocialConnectionProvider;
  destinationType: SocialDestinationType;
  name: string;
  handle: string | null;
};

export type SocialOrganizationDestinationGrant = {
  destinationId: string;
  profileId: string;
  permissions: readonly SocialDestinationPermission[];
};

export type SocialDefaultDestination = {
  provider: SocialConnectionProvider;
  owner: SocialConnectionOwner;
  destinationId: string;
};

export type SocialConnectionView = {
  id: string;
  oauthProvider: SocialOAuthProvider;
  provider: SocialConnectionProvider;
  providerLabel: string;
  destinationDescription: string;
  accountName: string | null;
  owner: SocialConnectionOwner | null;
  status: SocialConnectionStatus;
  grantedScopes: readonly string[];
  lastVerifiedAt: string | null;
  defaultDestination: SocialDestinationSummary | null;
};
