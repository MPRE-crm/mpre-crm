'use client';

import {
  useState,
} from 'react';

import {
  Monitor,
  Smartphone,
} from 'lucide-react';

type PreviewMode =
  | 'desktop'
  | 'mobile';

type Props = {
  title: string;
  publicUrl:
    | string
    | null;
};

export default function PropertyWebsitePreviewPanel({
  title,
  publicUrl,
}: Props) {
  const [
    previewMode,
    setPreviewMode,
  ] = useState<PreviewMode>(
    'desktop'
  );

  const previewUrl =
    publicUrl
      ? (() => {
          try {
            const parsedUrl =
              new URL(
                publicUrl
              );

            return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
          } catch {
            return publicUrl;
          }
        })()
      : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Property Website Preview
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Review the published property website in desktop and mobile sizes without leaving Marketing Studio.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            aria-pressed={
              previewMode ===
              'desktop'
            }
            onClick={() =>
              setPreviewMode(
                'desktop'
              )
            }
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              previewMode ===
              'desktop'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Monitor className="h-4 w-4" />

            Desktop Preview
          </button>

          <button
            type="button"
            aria-pressed={
              previewMode ===
              'mobile'
            }
            onClick={() =>
              setPreviewMode(
                'mobile'
              )
            }
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              previewMode ===
              'mobile'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Smartphone className="h-4 w-4" />

            Mobile Preview
          </button>
        </div>
      </div>

      {previewUrl ? (
        <div className="mt-5 overflow-auto rounded-2xl border border-slate-300 bg-slate-100 p-4">
          <div
            className={
              previewMode ===
              'mobile'
                ? 'mx-auto w-[390px] max-w-full'
                : 'mx-auto min-w-[1180px] max-w-[1180px]'
            }
          >
            <iframe
              key={`${previewMode}-${previewUrl}`}
              src={previewUrl}
              title={`${title} ${previewMode} property website preview`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className={`w-full rounded-xl border border-slate-300 bg-white shadow-xl ${
                previewMode ===
                'mobile'
                  ? 'h-[780px]'
                  : 'h-[760px]'
              }`}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Publish the property website before reviewing its desktop and mobile previews.
        </div>
      )}
    </section>
  );
}
