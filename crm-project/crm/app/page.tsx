// crm/app/page.tsx
// Immediately redirect root to the login page (server component).

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
  return null;
}
