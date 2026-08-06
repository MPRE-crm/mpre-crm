import type {
  SocialConnectionOwnerType,
  SocialConnectionRole,
  SocialOrganizationDestinationGrant,
} from './types';

export type SocialOwnershipCapabilities = {
  roleLabel: string;
  ownershipLabel: string;
  explanation: string;
  canManagePersonalConnections: boolean;
  canManageOrganizationConnections: boolean;
  canManagePlatformConnections: boolean;
  canGrantOrganizationDestinationPermissions: boolean;
};

const ROLE_CAPABILITIES: Record<
  SocialConnectionRole,
  SocialOwnershipCapabilities
> = {
  agent: {
    roleLabel: 'Agent access',
    ownershipLabel: 'Personal only',
    explanation:
      'You will be able to manage your own personal connections. Organization destinations will require an explicit administrator grant, and agents will not manage organization connections.',
    canManagePersonalConnections: true,
    canManageOrganizationConnections: false,
    canManagePlatformConnections: false,
    canGrantOrganizationDestinationPermissions: false,
  },
  admin: {
    roleLabel: 'Organization administrator access',
    ownershipLabel: 'Personal or organization',
    explanation:
      'You will be able to manage your own personal connections and organization-owned Pages or accounts for your organization, then grant agents explicit destination access.',
    canManagePersonalConnections: true,
    canManageOrganizationConnections: true,
    canManagePlatformConnections: false,
    canGrantOrganizationDestinationPermissions: true,
  },
  org_admin: {
    roleLabel: 'Organization administrator access',
    ownershipLabel: 'Personal or organization',
    explanation:
      'You will be able to manage your own personal connections and organization-owned Pages or accounts for your organization, then grant agents explicit destination access.',
    canManagePersonalConnections: true,
    canManageOrganizationConnections: true,
    canManagePlatformConnections: false,
    canGrantOrganizationDestinationPermissions: true,
  },
  platform_admin: {
    roleLabel: 'Platform administrator access',
    ownershipLabel: 'Personal or organization; platform scope is future',
    explanation:
      'You will be able to manage personal and authorized organization destinations. A separate platform-owned scope is represented in the contract but remains optional and requires a future security review.',
    canManagePersonalConnections: true,
    canManageOrganizationConnections: true,
    canManagePlatformConnections: true,
    canGrantOrganizationDestinationPermissions: true,
  },
};

const UNAUTHENTICATED_CAPABILITIES: SocialOwnershipCapabilities = {
  roleLabel: 'Account access unavailable',
  ownershipLabel: 'Unavailable',
  explanation:
    'Social connection ownership becomes available after account permissions are loaded.',
  canManagePersonalConnections: false,
  canManageOrganizationConnections: false,
  canManagePlatformConnections: false,
  canGrantOrganizationDestinationPermissions: false,
};

export function socialOwnershipCapabilitiesForRole(
  role: SocialConnectionRole | null
) {
  return role
    ? ROLE_CAPABILITIES[role]
    : UNAUTHENTICATED_CAPABILITIES;
}

export function canManageOwnedSocialConnection(
  role: SocialConnectionRole | null,
  ownerType: SocialConnectionOwnerType
) {
  const capabilities =
    socialOwnershipCapabilitiesForRole(role);

  if (ownerType === 'user') {
    return capabilities.canManagePersonalConnections;
  }

  if (ownerType === 'organization') {
    return capabilities.canManageOrganizationConnections;
  }

  return capabilities.canManagePlatformConnections;
}

export function hasOrganizationDestinationPermission(
  grant: SocialOrganizationDestinationGrant | null,
  permission: 'select' | 'publish'
) {
  return Boolean(
    grant?.permissions.includes(permission)
  );
}
