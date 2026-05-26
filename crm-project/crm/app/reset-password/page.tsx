'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase-browser';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });

        if (event === 'PASSWORD_RECOVERY' || session) {
          setReady(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);

    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message || 'Could not update password.');
      return;
    }

    setNotice('Password updated. Sending you to login...');

    await supabase.auth.signOut();

    setTimeout(() => {
      router.replace('/login');
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white p-6 rounded-xl shadow-sm border"
      >
        <h1 className="text-xl font-semibold mb-2">Reset password</h1>

        <p className="text-sm text-neutral-600 mb-4">
          Enter a new password for your CRM account.
        </p>

        {!ready && (
          <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm mb-4">
            If you opened this page without using the reset email, go back to
            login and request a new password reset link.
          </div>
        )}

        <label className="block text-sm mb-1">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="New password"
          autoComplete="new-password"
          disabled={loading}
        />

        <label className="block text-sm mb-1">Confirm password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
          placeholder="Confirm password"
          autoComplete="new-password"
          disabled={loading}
        />

        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
        {notice && <div className="text-green-700 text-sm mb-3">{notice}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border px-3 py-2 disabled:opacity-60 bg-blue-600 text-white"
        >
          {loading ? 'Updating password…' : 'Update password'}
        </button>

        <button
          type="button"
          onClick={() => router.replace('/login')}
          className="w-full text-sm text-neutral-600 hover:underline mt-4"
        >
          Back to login
        </button>
      </form>
    </div>
  );
}