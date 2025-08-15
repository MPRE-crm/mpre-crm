'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Send users straight to the Leads dashboard
    router.replace('/dashboard/leads');
  }, [router]);

  return (
    <main className="min-h-screen p-8 sm:p-12 font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-2xl font-bold mb-2">Redirecting to Leads…</h1>
      <p className="text-sm text-gray-600 mb-6">
        If this page doesn’t redirect automatically, use the links below.
      </p>

      <div className="flex gap-4">
        <Link
          href="/dashboard/leads"
          className="px-4 py-2 rounded-md border hover:bg-gray-50"
        >
          Go to Leads
        </Link>
        <Link
          href="/dashboard/call-logs"
          className="px-4 py-2 rounded-md border hover:bg-gray-50"
        >
          Go to Call Logs
        </Link>
      </div>
    </main>
  );
}
