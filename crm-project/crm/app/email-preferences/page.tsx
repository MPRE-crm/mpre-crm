import type {
  Metadata,
} from 'next';

import {
  PublicEmailComplianceShell,
} from '../components/PublicEmailComplianceShell';

import EmailPreferencesForm from './EmailPreferencesForm';

import {
  cleanEmailComplianceToken,
  parseLoadedEmailPreferences,
} from '../../lib/email-compliance-public';

import {
  supabaseAdmin,
} from '../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const metadata:
  Metadata = {
    title:
      'Email Preferences | MPRE Boise',

    robots: {
      index: false,
      follow: false,
    },
  };

type EmailPreferencesPageProps = {
  searchParams: Promise<{
    token?:
      | string
      | string[];
  }>;
};

export default async function EmailPreferencesPage({
  searchParams,
}: EmailPreferencesPageProps) {
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
        eyebrow="Email Preferences"
        title="This preferences link is invalid"
        description="The link is missing required information or is no longer valid."
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
          Please use the email-preferences
          link from the original marketing
          email.
        </div>
      </PublicEmailComplianceShell>
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      'load_email_recipient_preferences',
      {
        p_preferences_token:
          token,
      }
    );

  if (error) {
    console.error(
      'public email preferences load failed',
      {
        code:
          error.code,
      }
    );
  }

  const loaded =
    error
      ? null
      : parseLoadedEmailPreferences(
          data
        );

  if (!loaded) {
    return (
      <PublicEmailComplianceShell
        eyebrow="Email Preferences"
        title="These preferences could not be loaded"
        description="The link may be invalid or no longer available."
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
          Please use the email-preferences
          link from the original marketing
          email.
        </div>
      </PublicEmailComplianceShell>
    );
  }

  return (
    <PublicEmailComplianceShell
      wide
      eyebrow="Email Preferences"
      title="Choose the emails you receive"
      description="Choose the updates that matter to you, or opt out of all marketing email."
    >
      <EmailPreferencesForm
        token={token}
        initial={loaded}
      />
    </PublicEmailComplianceShell>
  );
}
