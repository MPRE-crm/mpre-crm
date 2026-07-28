'use client';

import {
  useState,
} from 'react';

import type {
  EmailPreferenceValues,
  LoadedEmailPreferences,
} from '../../lib/email-compliance-public';

type EmailPreferencesFormProps = {
  token: string;
  initial: LoadedEmailPreferences;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  email_masked?: string;
  already_unsubscribed?: boolean;
  preferences?: EmailPreferenceValues;
};

const preferenceOptions: Array<{
  key: keyof EmailPreferenceValues;
  label: string;
  description: string;
}> = [
  {
    key: 'allow_listing_ads',
    label: 'Listing announcements',
    description:
      'New listings, coming-soon properties, just-sold announcements and similar property marketing.',
  },
  {
    key: 'allow_open_house',
    label: 'Open-house announcements',
    description:
      'Upcoming open houses and property-tour opportunities.',
  },
  {
    key: 'allow_price_changes',
    label: 'Price-change notices',
    description:
      'Listing price improvements and related property updates.',
  },
  {
    key: 'allow_market_updates',
    label: 'Market updates',
    description:
      'Real-estate market information, statistics and client updates.',
  },
  {
    key: 'allow_newsletters',
    label: 'Newsletters',
    description:
      'General real-estate newsletters and educational content.',
  },
];

export default function EmailPreferencesForm({
  token,
  initial,
}: EmailPreferencesFormProps) {
  const [
    preferences,
    setPreferences,
  ] = useState<EmailPreferenceValues>(
    initial.preferences
  );

  const [
    canUpdate,
    setCanUpdate,
  ] = useState(
    initial.can_update
  );

  const [
    marketingStatus,
    setMarketingStatus,
  ] = useState(
    initial.marketing_status
  );

  const [
    pendingAction,
    setPendingAction,
  ] = useState<
    'save' |
    'unsubscribe' |
    null
  >(null);

  const [
    notice,
    setNotice,
  ] = useState<{
    kind:
      | 'success'
      | 'error';
    message: string;
  } | null>(null);

  function toggle(
    key: keyof EmailPreferenceValues
  ) {
    if (!canUpdate) {
      return;
    }

    setPreferences(
      (current) => ({
        ...current,
        [key]:
          !current[key],
      })
    );

    setNotice(null);
  }

  async function postAction(
    action:
      | 'save'
      | 'unsubscribe'
  ) {
    const response =
      await fetch(
        '/api/marketing/email-compliance/preferences',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            token,
            action,
            preferences,
          }),
        }
      );

    const payload =
      await response.json() as
        ApiResponse;

    if (
      !response.ok ||
      payload.ok !== true
    ) {
      throw new Error(
        payload.error ||
        'Your email preferences could not be updated.'
      );
    }

    return payload;
  }

  async function savePreferences() {
    if (
      !Object
        .values(preferences)
        .some(Boolean)
    ) {
      setNotice({
        kind: 'error',
        message:
          'Use the unsubscribe button to turn off all marketing email.',
      });

      return;
    }

    setPendingAction('save');
    setNotice(null);

    try {
      const payload =
        await postAction('save');

      if (payload.preferences) {
        setPreferences(
          payload.preferences
        );
      }

      setNotice({
        kind: 'success',
        message:
          'Your email preferences were saved.',
      });
    }
    catch (error: unknown) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Your email preferences could not be updated.',
      });
    }
    finally {
      setPendingAction(null);
    }
  }

  async function unsubscribe() {
    const confirmed =
      window.confirm(
        'Unsubscribe this email address from all MPRE Boise marketing emails?'
      );

    if (!confirmed) {
      return;
    }

    setPendingAction(
      'unsubscribe'
    );

    setNotice(null);

    try {
      const payload =
        await postAction(
          'unsubscribe'
        );

      setPreferences({
        allow_listing_ads: false,
        allow_open_house: false,
        allow_price_changes: false,
        allow_market_updates: false,
        allow_newsletters: false,
      });

      setCanUpdate(false);
      setMarketingStatus(
        'unsubscribed'
      );

      setNotice({
        kind: 'success',
        message:
          payload
            .already_unsubscribed
            ? 'This email address was already unsubscribed.'
            : 'This email address has been unsubscribed from all marketing email.',
      });
    }
    catch (error: unknown) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Your unsubscribe request could not be completed.',
      });
    }
    finally {
      setPendingAction(null);
    }
  }

  if (!canUpdate) {
    return (
      <div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-black text-amber-900">
            {marketingStatus ===
            'unsubscribed'
              ? 'Marketing email is turned off'
              : 'These preferences cannot be changed'}
          </h2>

          <p className="mt-3 text-sm leading-6 text-amber-800">
            {marketingStatus ===
            'unsubscribed'
              ? `Marketing emails are disabled for ${initial.email_masked}.`
              : 'This email address has a delivery or compliance block and cannot be reactivated from this page.'}
          </p>
        </div>

        {notice ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {notice.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-5 text-sm leading-6 text-slate-600">
        Managing preferences for{' '}
        <strong className="text-slate-900">
          {initial.email_masked}
        </strong>
      </p>

      <div className="space-y-3">
        {preferenceOptions.map(
          (option) => (
            <label
              key={option.key}
              className="flex cursor-pointer gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-400"
            >
              <input
                type="checkbox"
                checked={
                  preferences[
                    option.key
                  ]
                }
                onChange={() =>
                  toggle(
                    option.key
                  )
                }
                disabled={
                  pendingAction !==
                  null
                }
                className="mt-1 h-5 w-5 rounded border-slate-300"
              />

              <span>
                <span className="block font-black text-slate-900">
                  {option.label}
                </span>

                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  {option.description}
                </span>
              </span>
            </label>
          )
        )}
      </div>

      {notice ? (
        <p
          className={
            notice.kind ===
            'success'
              ? 'mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800'
              : 'mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700'
          }
        >
          {notice.message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={
            savePreferences
          }
          disabled={
            pendingAction !==
            null
          }
          className="rounded-xl bg-slate-950 px-6 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction ===
          'save'
            ? 'Saving...'
            : 'Save preferences'}
        </button>

        <button
          type="button"
          onClick={
            unsubscribe
          }
          disabled={
            pendingAction !==
            null
          }
          className="rounded-xl border border-red-300 bg-white px-6 py-4 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction ===
          'unsubscribe'
            ? 'Unsubscribing...'
            : 'Unsubscribe from all'}
        </button>
      </div>
    </div>
  );
}
