'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase-browser';

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = useMemo(
    () => search?.get('redirect') || '/dashboard/leads',
    [search]
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });
      }
    );

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    setLoading(false);

    if (error) {
      setErr(error.message || 'Invalid email or password');
      return;
    }

    document.cookie = `app-session=1; path=/; SameSite=Lax; Secure`;

    router.replace(redirect);
  };

  const onForgotPassword = async () => {
    setErr(null);
    setNotice(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErr('Enter your email first, then click Forgot password.');
      return;
    }

    setResetLoading(true);

    const response = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const result = await response.json().catch(() => null);

    setResetLoading(false);

    if (!response.ok || !result?.ok) {
      setErr(result?.error || 'Could not send password reset email.');
      return;
    }

    setNotice(result?.message || 'Password reset email sent. Check your inbox.');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 -translate-y-20">
      <div className="-mb-40 flex justify-center">
        <img
          src="/easyrealtor-logo.png"
          alt="EasyRealtor"
          className="h-[24rem] md:h-[30rem] w-auto object-contain"
        />
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white p-6 rounded-xl shadow-sm border"
      >
        <h1 className="text-xl font-semibold mb-4 text-center">Sign in</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="you@example.com"
          autoComplete="username"
          disabled={loading || resetLoading}
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-2"
          placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
          autoComplete="current-password"
          disabled={loading || resetLoading}
        />

        <button
          type="button"
          onClick={onForgotPassword}
          disabled={loading || resetLoading}
          className="text-sm text-blue-700 hover:underline mb-4 disabled:opacity-60"
        >
          {resetLoading ? 'Sending reset emailâ€¦' : 'Forgot password?'}
        </button>

        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
        {notice && <div className="text-green-700 text-sm mb-3">{notice}</div>}

        <button
          type="submit"
          disabled={loading || resetLoading}
          className="w-full rounded-md border px-3 py-2 disabled:opacity-60 mb-3 bg-blue-600 text-white"
        >
          {loading ? 'Logging inâ€¦' : 'Sign in'}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          Forgot your email? Contact your CRM admin.
        </p>
      </form>
    </div>
  );
}

