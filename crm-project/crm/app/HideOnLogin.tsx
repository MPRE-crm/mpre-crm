'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function HideOnLogin({ children }: { children: ReactNode }) {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw ?? '/';

  if (pathname === '/login' || pathname.startsWith('/auth')) return null;
  return <>{children}</>;
}

