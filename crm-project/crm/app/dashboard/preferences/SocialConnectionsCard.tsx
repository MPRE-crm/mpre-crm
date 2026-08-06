'use client';

import type { ReactNode } from 'react';
import {
  Building2,
  LockKeyhole,
  Share2,
  UserRound,
} from 'lucide-react';

import {
  socialOwnershipCapabilitiesForRole,
} from '../../../lib/social-connections/permissions';
import type {
  SocialConnectionRole,
  SocialConnectionView,
} from '../../../lib/social-connections/types';

const SYNTHETIC_CONNECTIONS: readonly SocialConnectionView[] = [
  {
    id: 'phase-one-facebook-pages',
    oauthProvider: 'meta',
    provider: 'facebook',
    providerLabel: 'Facebook Pages',
    destinationDescription:
      'Pages eligible for future publishing through a secure Meta connection.',
    accountName: null,
    owner: null,
    status: 'not_connected',
    grantedScopes: [],
    lastVerifiedAt: null,
    defaultDestination: null,
  },
  {
    id: 'phase-one-instagram-professional',
    oauthProvider: 'meta',
    provider: 'instagram',
    providerLabel: 'Instagram professional accounts',
    destinationDescription:
      'Business or creator accounts eligible for future publishing.',
    accountName: null,
    owner: null,
    status: 'not_connected',
    grantedScopes: [],
    lastVerifiedAt: null,
    defaultDestination: null,
  },
  {
    id: 'phase-one-linkedin',
    oauthProvider: 'linkedin',
    provider: 'linkedin',
    providerLabel: 'LinkedIn',
    destinationDescription:
      'Personal profiles and authorized organization Pages.',
    accountName: null,
    owner: null,
    status: 'not_connected',
    grantedScopes: [],
    lastVerifiedAt: null,
    defaultDestination: null,
  },
  {
    id: 'phase-one-x',
    oauthProvider: 'x',
    provider: 'x',
    providerLabel: 'X accounts',
    destinationDescription:
      'Personal or organization-authorized X publishing accounts.',
    accountName: null,
    owner: null,
    status: 'not_connected',
    grantedScopes: [],
    lastVerifiedAt: null,
    defaultDestination: null,
  },
];

const STATUS_LABELS = {
  not_connected: 'Not connected',
  pending: 'Pending',
  connected: 'Connected',
  needs_reconnect: 'Reconnect required',
  revoked: 'Revoked',
  disconnected: 'Disconnected',
  error: 'Connection error',
} satisfies Record<SocialConnectionView['status'], string>;

function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-800">
        {children}
      </div>
    </div>
  );
}

export default function SocialConnectionsCard({
  role,
}: {
  role: SocialConnectionRole | null;
}) {
  const capabilities =
    socialOwnershipCapabilitiesForRole(role);

  return (
    <section
      aria-labelledby="social-connections-title"
      className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
            <Share2 aria-hidden="true" className="h-5 w-5" />
            Secure publishing destinations
          </div>
          <h2
            id="social-connections-title"
            className="mt-2 text-xl font-bold text-slate-950"
          >
            Social Connections
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Review the account ownership, permission and destination fields
            that will support future Listing Social Studio publishing.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700">
          Local UI contract only
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {role === 'agent' ? (
              <UserRound aria-hidden="true" className="h-5 w-5 text-sky-700" />
            ) : (
              <Building2 aria-hidden="true" className="h-5 w-5 text-sky-700" />
            )}
            {capabilities.roleLabel}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {capabilities.explanation}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            Secure OAuth setup is required before connection actions become
            available.
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            This phase uses typed synthetic rows only. It makes no social
            connection request, stores no credentials and does not simulate a
            successful account connection.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {SYNTHETIC_CONNECTIONS.map((connection) => (
          <article
            key={connection.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-950">
                  {connection.providerLabel}
                </h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {connection.destinationDescription}
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {STATUS_LABELS[connection.status]}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Detail label="Provider">
                {connection.providerLabel}
              </Detail>
              <Detail label="Connected account or Page">
                {connection.accountName || 'No account connected'}
              </Detail>
              <Detail label="Ownership">
                {connection.owner?.label || capabilities.ownershipLabel}
              </Detail>
              <Detail label="Permissions / scopes">
                {connection.grantedScopes.length > 0
                  ? connection.grantedScopes.join(', ')
                  : 'None granted'}
              </Detail>
              <Detail label="Last verified">
                {connection.lastVerifiedAt || 'Never'}
              </Detail>
              <div>
                <label
                  htmlFor={`${connection.id}-default`}
                  className="text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  Default publishing destination
                </label>
                <select
                  id={`${connection.id}-default`}
                  disabled
                  value={connection.defaultDestination?.id || ''}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value={connection.defaultDestination?.id || ''}>
                    {connection.defaultDestination?.name ||
                      'No destination available'}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['Connect', 'Reconnect', 'Disconnect'].map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled
                  title="Available after secure OAuth setup"
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {action}
                </button>
              ))}
              <span className="self-center text-xs font-medium text-slate-500">
                Available after secure OAuth setup
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
