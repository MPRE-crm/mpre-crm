'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase-browser';

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = useMemo(() => search?.get('redirect') || '/dashboard/leads', [search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session }),
      });
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    setLoading(false);
    if (error) return setErr(error.message || 'Invalid email or password');

    router.replace(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-xl shadow-sm border">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          type="email" required value={email} onChange={e=>setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-3" placeholder="you@example.com"
          autoComplete="username" disabled={loading}
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password" required value={password} onChange={e=>setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4" placeholder="••••••••"
          autoComplete="current-password" disabled={loading}
        />

        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-md border px-3 py-2 disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
