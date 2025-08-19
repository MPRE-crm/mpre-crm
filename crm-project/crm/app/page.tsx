// crm/app/page.tsx
// Note: No "use client" — this is a simple server component with no auto-redirect.

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 sm:p-12 bg-[var(--color-background)] text-[var(--color-foreground)] font-sans">
      <h1 className="text-2xl font-bold mb-2">Welcome to MPRE CRM</h1>
      <p className="text-sm text-gray-500 mb-6">
        Please choose where you’d like to go.
      </p>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
        >
          Login
        </Link>
        <Link
          href="/dashboard/leads"
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
        >
          Go to Leads
        </Link>
        <Link
          href="/dashboard/call-logs"
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
        >
          Go to Call Logs
        </Link>
      </div>
    </main>
  );
}

