import type {
  ReactNode,
} from 'react';

type PublicEmailComplianceShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function PublicEmailComplianceShell({
  eyebrow,
  title,
  description,
  children,
}: PublicEmailComplianceShellProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-950">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-10">
        <header className="mb-8 border-b border-slate-200 pb-7 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-700">
            MPRE Boise
          </p>

          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Homes of Idaho &middot; EasyRealtor.homes
          </p>
        </header>

        <section>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">
            {eyebrow}
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-4 text-base leading-7 text-slate-600">
              {description}
            </p>
          ) : null}

          <div className="mt-8">
            {children}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-500">
          This page controls marketing-email preferences only.
          Transactional or legally required messages may still
          be delivered when applicable.
        </footer>
      </div>
    </main>
  );
}
