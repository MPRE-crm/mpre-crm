'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

export type GeneratedMarketingAsset = {
  id: string;
  listing_id: string;

  campaign_id:
    | string
    | null;

  asset_format: string;
  template_key: string;
  generation_status: string;
  model: string;

  width:
    | number
    | null;

  height:
    | number
    | null;

  quality:
    | string
    | null;

  mime_type:
    | string
    | null;

  public_url: string;

  is_selected: boolean;
  created_at: string;
};

type GeneratedArtworkPanelProps = {
  listingId: string;

  campaignId:
    | string
    | null;

  templateKey: string;

  selectedAssetId: string;

  onSelectedAssetChange: (
    asset:
      | GeneratedMarketingAsset
      | null
  ) => void;
};

export default function GeneratedArtworkPanel({
  listingId,
  campaignId,
  templateKey,
  selectedAssetId,
  onSelectedAssetChange,
}: GeneratedArtworkPanelProps) {
  const [
    assets,
    setAssets,
  ] = useState<
    GeneratedMarketingAsset[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    notice,
    setNotice,
  ] = useState<
    string | null
  >(null);

  const loadAssets =
    useCallback(
      async () => {
        if (!listingId) {
          setAssets([]);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const {
            data,
            error: loadError,
          } = await supabase
            .from(
              'generated_marketing_assets'
            )
            .select(`
              id,
              listing_id,
              campaign_id,
              asset_format,
              template_key,
              generation_status,
              model,
              width,
              height,
              quality,
              mime_type,
              public_url,
              is_selected,
              created_at
            `)
            .eq(
              'listing_id',
              listingId
            )
            .eq(
              'asset_format',
              'email_banner'
            )
            .eq(
              'generation_status',
              'ready'
            )
            .not(
              'public_url',
              'is',
              null
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            )
            .limit(12);

          if (loadError) {
            throw loadError;
          }

          setAssets(
            (data ||
              []) as GeneratedMarketingAsset[]
          );
        } catch (err: any) {
          setError(
            err?.message ||
              'Could not load generated artwork.'
          );

          setAssets([]);
        } finally {
          setLoading(false);
        }
      },
      [listingId]
    );

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  async function generateArtwork() {
    if (!listingId) {
      setError(
        'Choose a listing before generating artwork.'
      );

      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setNotice(null);

      const {
        data: sessionResult,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionResult.session
      ) {
        throw new Error(
          sessionError?.message ||
            'Your CRM session expired.'
        );
      }

      const response =
        await fetch(
          '/api/marketing/generated-assets/generate',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${sessionResult.session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              listing_id:
                listingId,

              campaign_id:
                campaignId ||
                null,

              template_key:
                templateKey,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok ||
        !result.asset
      ) {
        throw new Error(
          result.error ||
            'GPT Image 2 artwork generation failed.'
        );
      }

      const generatedAsset =
        result.asset as GeneratedMarketingAsset;

      setAssets(
        (current) => [
          generatedAsset,

          ...current.filter(
            (asset) =>
              asset.id !==
              generatedAsset.id
          ),
        ]
      );

      onSelectedAssetChange(
        generatedAsset
      );

      setNotice(
        'New GPT Image 2 banner generated and selected for the email preview.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not generate the artwork.'
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-700" />

            <h2 className="text-lg font-semibold text-slate-900">
              GPT Image 2 Visual Layer
            </h2>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Generate decorative, professionally art-directed artwork.
            The actual property photos and accurate listing facts remain
            separate and unchanged.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAssets}
          disabled={
            loading ||
            generating ||
            !listingId
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}

          Refresh
        </button>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={generateArtwork}
        disabled={
          generating ||
          !listingId
        }
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}

        {generating
          ? 'Generating Artwork...'
          : assets.length
          ? 'Generate Another Version'
          : 'Generate GPT Image 2 Banner'}
      </button>

      {generating && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Image generation may take close to a minute. Keep this page open.
        </p>
      )}

      {selectedAssetId && (
        <button
          type="button"
          onClick={() =>
            onSelectedAssetChange(
              null
            )
          }
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
        >
          Use Listing Photo Only
        </button>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading generated versions...
        </div>
      ) : assets.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assets.map(
            (asset) => {
              const selected =
                asset.id ===
                selectedAssetId;

              return (
                <button
                  type="button"
                  key={asset.id}
                  onClick={() =>
                    onSelectedAssetChange(
                      asset
                    )
                  }
                  className={
                    selected
                      ? 'overflow-hidden rounded-2xl border-2 border-violet-600 bg-white text-left shadow-md'
                      : 'overflow-hidden rounded-2xl border border-slate-200 bg-white text-left'
                  }
                >
                  <div className="relative aspect-[3/2] overflow-hidden bg-slate-100">
                    <img
                      src={
                        asset.public_url
                      }
                      alt="Generated decorative email artwork"
                      className="h-full w-full object-cover"
                    />

                    {selected && (
                      <div className="absolute right-2 top-2 rounded-full bg-violet-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                        Selected
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <ImageIcon className="h-4 w-4 text-violet-600" />
                      {asset.template_key}
                      {' · '}
                      {asset.width}
                      ×
                      {asset.height}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      {new Date(
                        asset.created_at
                      ).toLocaleString()}
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-white/70 p-5 text-center text-sm text-slate-500">
          No generated artwork exists for this listing yet.
        </div>
      )}
    </section>
  );
}
