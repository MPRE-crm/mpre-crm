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
};

export default function UnsubscribeForm({
  token,
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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-xl font-black text-emerald-900">
          {result
            ?.already_unsubscribed
            ? 'Already unsubscribed'
            : 'You are unsubscribed'}
        </h2>

        <p className="mt-3 leading-7 text-emerald-800">
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
        Selecting the button below will
        unsubscribe this email address
        from all MPRE Boise marketing
        emails.
      </div>

      {status === 'error' ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {result?.error ||
            'Your unsubscribe request could not be completed.'}
        </p>
      ) : null}

      <button
        type="button"
        onClick={unsubscribe}
        disabled={status === 'pending'}
        className="mt-6 w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'pending'
          ? 'Processing unsubscribe...'
          : 'Unsubscribe from marketing emails'}
      </button>
    </div>
  );
}
