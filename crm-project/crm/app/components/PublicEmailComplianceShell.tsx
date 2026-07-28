import type {
  ReactNode,
} from 'react';

type PublicEmailComplianceShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
};

export function PublicEmailComplianceShell({
  eyebrow,
  title,
  description,
  children,
  wide = false,
}: PublicEmailComplianceShellProps) {
  const widthClass =
    wide
      ? 'max-w-5xl'
      : 'max-w-xl';

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-3 text-slate-950 sm:px-5 sm:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full items-center justify-center sm:min-h-[calc(100vh-2.5rem)]">
        <div
          className={`w-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.34)] sm:rounded-3xl ${widthClass}`}
        >
          <header className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:gap-4 sm:px-6">
            <img
              src="/MPREcrm.png"
              alt="MPRE"
              className="h-auto w-[108px] shrink-0 sm:w-[144px]"
            />

            <span className="min-w-0 max-w-[132px] rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-center text-[9px] font-semibold uppercase leading-4 tracking-[0.11em] text-amber-800 sm:max-w-none sm:px-3 sm:text-[10px]">
              {eyebrow}
            </span>
          </header>

          <section className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="max-w-3xl">
              <h1 className="text-[25px] font-semibold leading-[1.18] tracking-tight text-slate-950 sm:text-[30px]">
                {title}
              </h1>

              {description ? (
                <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-600 sm:text-sm">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="mt-4">
              {children}
            </div>
          </section>

          <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-[10px] leading-[15px] text-slate-500 sm:px-6">
            This page controls marketing-email preferences only.
            Transactional or legally required messages may still
            be delivered when applicable.
          </footer>
        </div>
      </div>
    </main>
  );
}
