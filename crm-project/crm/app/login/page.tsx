'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // DEBUG: confirm the Supabase project your build is using
  useEffect(() => {
    // Remove after verifying in DevTools console
    // Example: https://wfjwkssqvifwatquhvti.supabase.co
    // eslint-disable-next-line no-console
    console.log('Auth project:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, []);

  // Keep middleware cookies in sync when auth state changes
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session }),
      });
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const loginEmail = email.trim().toLowerCase();
    const loginPassword = password.trim();

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    setLoading(false);
    if (error) {
      setErr(error.message || 'Invalid email or password');
      return;
    }

    const redirect = search?.get('redirect') || '/dashboard/leads';
    router.replace(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-xl shadow-sm border">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="you@example.com"
          autoComplete="username"
          disabled={loading}
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />

        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-md border px-3 py-2 disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
