import { Suspense } from 'react';
import NextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Client component is loaded only on the client
const LoginClient = NextDynamic(() => import('./LoginClient'), { ssr: false });

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}


