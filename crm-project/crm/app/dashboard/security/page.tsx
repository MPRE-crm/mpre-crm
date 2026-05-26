'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

const supabase = getSupabaseBrowser();

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
  created_at?: string;
};

type ProfileRole = 'agent' | 'admin' | 'platform_admin';

export default function SecurityPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [verifiedFactors, setVerifiedFactors] = useState<MfaFactor[]>([]);
  const [unverifiedFactors, setUnverifiedFactors] = useState<MfaFactor[]>([]);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    loadSecurityPage();
  }, []);

  async function loadSecurityPage() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setAccessDenied(false);

    const { data: userRes, error: userError } = await supabase.auth.getUser();

    if (userError || !userRes?.user) {
      router.replace('/login');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userRes.user.id)
      .single();

    if (profileError || !profile?.role) {
      setError(profileError?.message || 'Profile not found.');
      setLoading(false);
      return;
    }

    const profileRole = profile.role as ProfileRole;
    setRole(profileRole);

    if (profileRole !== 'admin' && profileRole !== 'platform_admin') {
      setAccessDenied(true);
      setLoading(false);

      setTimeout(() => {
        router.replace('/dashboard/home');
      }, 1000);

      return;
    }

    await loadFactors(false);
  }

  async function loadFactors(resetMessages = true) {
    setLoading(true);

    if (resetMessages) {
      setError(null);
      setMessage(null);
    }

    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();

    if (factorsError) {
      setError(factorsError.message || 'Failed to load MFA settings.');
      setLoading(false);
      return;
    }

    const totpFactors = ((data?.totp || []) as MfaFactor[]) || [];

    setVerifiedFactors(totpFactors.filter((factor) => factor.status === 'verified'));
    setUnverifiedFactors(totpFactors.filter((factor) => factor.status !== 'verified'));
    setLoading(false);
  }

  async function startEnrollment() {
    setError(null);
    setMessage(null);
    setCode('');
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setChallengeId(null);
    setEnrolling(true);

    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'EasyRealtor CRM',
      issuer: 'EasyRealtor',
    });

    if (enrollError || !enrollData?.id) {
      setError(enrollError?.message || 'Failed to start MFA setup.');
      setEnrolling(false);
      return;
    }

    const newFactorId = enrollData.id;
    setFactorId(newFactorId);
    setQrCode(enrollData.totp?.qr_code || null);
    setSecret(enrollData.totp?.secret || null);

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({
        factorId: newFactorId,
      });

    setEnrolling(false);

    if (challengeError || !challengeData?.id) {
      setError(challengeError?.message || 'Failed to create MFA challenge.');
      return;
    }

    setChallengeId(challengeData.id);
    setMessage('Scan the QR code with your authenticator app, then enter the 6-digit code.');
    await loadFactors(false);
  }

  async function verifyEnrollment(e: React.FormEvent) {
    e.preventDefault();

    if (!factorId || !challengeId) {
      setError('Start MFA setup first.');
      return;
    }

    if (!code.trim()) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setError(null);
    setMessage(null);
    setVerifying(true);

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });

    setVerifying(false);

    if (verifyError) {
      setError(verifyError.message || 'Invalid MFA code.');
      return;
    }

    setMessage('MFA is now enabled for this account.');
    setCode('');
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setChallengeId(null);

    await loadFactors(false);
  }

  async function removeFactor(removeFactorId: string) {
    const confirmRemove = window.confirm(
      'Remove this MFA authenticator from your account?'
    );

    if (!confirmRemove) return;

    setError(null);
    setMessage(null);
    setRemoving(removeFactorId);

    const { error: removeError } = await supabase.auth.mfa.unenroll({
      factorId: removeFactorId,
    });

    setRemoving(null);

    if (removeError) {
      setError(removeError.message || 'Failed to remove MFA factor.');
      return;
    }

    setMessage('MFA factor removed.');
    await loadFactors(false);
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="mt-2 text-sm">
            Security settings are only available to admins and platform admins.
            Sending you back to the dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage multi-factor authentication for your EasyRealtor CRM account.
        </p>

        {role && (
          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
            Role: {role.replace('_', ' ')}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Authenticator App MFA</h2>

        <p className="mt-2 text-sm text-gray-600">
          Use an authenticator app like Aegis, 1Password, Bitwarden, Authy,
          Google Authenticator, or Microsoft Authenticator to generate a
          6-digit login code.
        </p>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading security settings...</div>
        ) : (
          <>
            <div className="mt-5 rounded-lg border bg-gray-50 p-4">
              <div className="text-sm font-medium">Current status</div>

              {verifiedFactors.length > 0 ? (
                <div className="mt-2 text-sm text-green-700">
                  MFA is enabled on this account.
                </div>
              ) : (
                <div className="mt-2 text-sm text-amber-700">
                  MFA is not enabled yet.
                </div>
              )}
            </div>

            {verifiedFactors.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Active MFA factors</h3>

                <div className="mt-2 space-y-2">
                  {verifiedFactors.map((factor) => (
                    <div
                      key={factor.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {factor.friendly_name || 'Authenticator app'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Status: {factor.status || 'verified'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFactor(factor.id)}
                        disabled={removing === factor.id}
                        className="rounded-md border px-3 py-1.5 text-sm text-red-700 disabled:opacity-60"
                      >
                        {removing === factor.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={startEnrollment}
                disabled={enrolling || verifying}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {enrolling ? 'Starting setup...' : 'Set up authenticator app'}
              </button>
            </div>

            {qrCode && (
              <form onSubmit={verifyEnrollment} className="mt-6 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Finish MFA setup</h3>

                <p className="mt-2 text-sm text-gray-600">
                  Scan this QR code with your authenticator app, then enter the
                  6-digit code it generates.
                </p>

                <div className="mt-4 flex justify-center rounded-lg bg-white p-4">
                  <img
                    src={qrCode}
                    alt="MFA QR code"
                    className="h-48 w-48 object-contain"
                  />
                </div>

                {secret && (
                  <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                    Manual setup key:
                    <div className="mt-1 break-all font-mono text-gray-800">
                      {secret}
                    </div>
                  </div>
                )}

                <label className="mt-4 block text-sm font-medium">
                  6-digit code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  maxLength={6}
                  disabled={verifying}
                />

                <button
                  type="submit"
                  disabled={verifying}
                  className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {verifying ? 'Verifying...' : 'Verify and enable MFA'}
                </button>
              </form>
            )}

            {unverifiedFactors.length > 0 && (
              <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                You have unfinished MFA setup attempts. Starting setup again is okay.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}