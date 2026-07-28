import type {
  Metadata,
} from 'next';

import {
  PublicEmailComplianceShell,
} from '../components/PublicEmailComplianceShell';

import {
  cleanEmailComplianceToken,
} from '../../lib/email-compliance-public';

import UnsubscribeForm from './UnsubscribeForm';

export const dynamic =
  'force-dynamic';

export const metadata:
  Metadata = {
    title:
      'Unsubscribe | MPRE Boise',

    robots: {
      index: false,
      follow: false,
    },
  };

type UnsubscribePageProps = {
  searchParams: Promise<{
    token?:
      | string
      | string[];
  }>;
};

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const params =
    await searchParams;

  const rawToken =
    Array.isArray(params.token)
      ? params.token[0]
      : params.token;

  const token =
    cleanEmailComplianceToken(
      rawToken
    );

  if (!token) {
    return (
      <PublicEmailComplianceShell
        eyebrow="Unsubscribe"
        title="This unsubscribe link is invalid"
        description="The link is missing required information or is no longer valid."
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
          Please use the unsubscribe link
          from the original marketing
          email.
        </div>
      </PublicEmailComplianceShell>
    );
  }

  return (
    <PublicEmailComplianceShell
      eyebrow="Unsubscribe"
      title="Stop marketing emails"
      description="Confirm once to stop all MPRE Boise marketing email for this address."
    >
      <UnsubscribeForm
        token={token}
      />
    </PublicEmailComplianceShell>
  );
}
