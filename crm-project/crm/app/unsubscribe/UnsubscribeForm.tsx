'use client';

import {
  useState,
} from 'react';

type ApiResponse = {
  ok?: boolean;
  error?: string;
  email_masked?: string;
  already_unsubscribed?: boolean;
};

type UnsubscribeFormProps = {
  token: string;
  organizationDisplay: string;
};

export default function UnsubscribeForm({
  token,
  organizationDisplay,
}: UnsubscribeFormProps) {
  const [
    status,
    setStatus,
  ] = useState<
    'idle' |
    'pending' |
    'success' |
    'error'
  >('idle');

  const [
    result,
    setResult,
  ] = useState<ApiResponse | null>(
    null
  );

  async function unsubscribe() {
    setStatus('pending');
    setResult(null);

    try {
      const response =
        await fetch(
          '/api/marketing/email-compliance/unsubscribe',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              token,
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
          'Your unsubscribe request could not be completed.'
        );
      }

      setResult(payload);
      setStatus('success');
    }
    catch (error: unknown) {
      setResult({
        error:
          error instanceof Error
            ? error.message
            : 'Your unsubscribe request could not be completed.',
      });

      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="text-base font-semibold text-emerald-900">
          {result
            ?.already_unsubscribed
            ? 'Already unsubscribed'
            : 'You are unsubscribed'}
        </h2>

        <p className="mt-2 text-sm leading-6 text-emerald-800">
          Marketing emails have been
          disabled for{' '}
          <strong>
            {result?.email_masked ||
              'your email address'}
          </strong>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-5 text-slate-700">
        Selecting the button below will
        unsubscribe this email address
        from all {organizationDisplay} marketing
        emails.
      </div>

      {status === 'error' ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
          {result?.error ||
            'Your unsubscribe request could not be completed.'}
        </p>
      ) : null}

      <button
        type="button"
        onClick={unsubscribe}
        disabled={status === 'pending'}
        className="mt-3 w-full rounded-lg border border-slate-900 bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'pending'
          ? 'Processing unsubscribe...'
          : 'Unsubscribe from marketing emails'}
      </button>
    </div>
  );
}
