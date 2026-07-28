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
  organizationDisplay: string;
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
      'New, coming-soon and just-sold property announcements.',
  },
  {
    key: 'allow_open_house',
    label: 'Open-house announcements',
    description:
      'Open houses and property-tour opportunities.',
  },
  {
    key: 'allow_price_changes',
    label: 'Price-change notices',
    description:
      'Price improvements and important listing updates.',
  },
  {
    key: 'allow_market_updates',
    label: 'Market updates',
    description:
      'Local market statistics, trends and client updates.',
  },
  {
    key: 'allow_newsletters',
    label: 'Newsletters',
    description:
      'Real-estate guidance, resources and general newsletters.',
  },
];

export default function EmailPreferencesForm({
  token,
  initial,
  organizationDisplay,
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
        `Unsubscribe this email address from all ${organizationDisplay} marketing emails?`
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-sm font-semibold text-amber-900">
            {marketingStatus ===
            'unsubscribed'
              ? 'Marketing email is turned off'
              : 'These preferences cannot be changed'}
          </h2>

          <p className="mt-1.5 text-xs leading-5 text-amber-800">
            {marketingStatus ===
            'unsubscribed'
              ? `Marketing emails are disabled for ${initial.email_masked}.`
              : 'This email address has a delivery or compliance block and cannot be reactivated from this page.'}
          </p>
        </div>

        {notice ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
            {notice.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        Managing preferences for{' '}
        <strong className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-900 shadow-sm">
          {initial.email_masked}
        </strong>
      </p>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {preferenceOptions.map(
          (option) => (
            <label
              key={option.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-amber-500 hover:shadow-sm sm:last:col-span-2"
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
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-amber-600"
              />

              <span>
                <span className="block text-[13px] font-semibold leading-5 text-slate-900">
                  {option.label}
                </span>

                <span className="block text-[11px] leading-[17px] text-slate-600">
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
              ? 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800'
              : 'mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700'
          }
        >
          {notice.message}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={
            savePreferences
          }
          disabled={
            pendingAction !==
            null
          }
          className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
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
