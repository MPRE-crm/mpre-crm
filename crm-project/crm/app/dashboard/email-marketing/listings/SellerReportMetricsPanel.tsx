'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  BarChart3,
  Loader2,
  Mail,
  Monitor,
  QrCode,
  RefreshCw,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

const supabase =
  getSupabaseBrowser();

type JsonRecord =
  Record<string, unknown>;

type SellerReportMetricsPanelProps = {
  listingId: string;
};

function asRecord(
  value: unknown
): JsonRecord {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}

function numberValue(
  value: unknown
) {
  const result =
    Number(value ?? 0);

  return Number.isFinite(result)
    ? result
    : 0;
}

function textValue(
  value: unknown
) {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const result =
    value.trim();

  return result ||
    null;
}

function formatNumber(
  value: unknown
) {
  return Math.round(
    numberValue(value)
  ).toLocaleString();
}

function formatPercent(
  value: unknown
) {
  return `${numberValue(value).toFixed(2)}%`;
}

function formatDateTime(
  value: unknown
) {
  const normalized =
    textValue(value);

  if (!normalized) {
    return 'No activity yet';
  }

  const date =
    new Date(normalized);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'No activity yet';
  }

  return date.toLocaleString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
}

function labelForKey(
  value: string
) {
  return value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {value}
      </div>

      {detail && (
        <div className="mt-2 text-xs text-slate-500">
          {detail}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <div className="text-sm text-slate-600">
        {label}
      </div>

      <div className="text-right text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function SellerReportMetricsPanel({
  listingId,
}: SellerReportMetricsPanelProps) {
  const [
    periodDays,
    setPeriodDays,
  ] = useState(7);

  const [
    metrics,
    setMetrics,
  ] = useState<JsonRecord | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const loadMetrics =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const periodEnd =
          new Date();

        const periodStart =
          new Date(
            periodEnd.getTime() -
              periodDays *
                24 *
                60 *
                60 *
                1000
          );

        const {
          data,
          error: metricsError,
        } = await supabase.rpc(
          'get_listing_seller_report_metrics',
          {
            p_listing_id:
              listingId,

            p_period_start:
              periodStart.toISOString(),

            p_period_end:
              periodEnd.toISOString(),
          }
        );

        if (metricsError) {
          throw new Error(
            metricsError.message
          );
        }

        setMetrics(
          asRecord(data)
        );
      }
      catch (
        metricsLoadError: unknown
      ) {
        setError(
          metricsLoadError instanceof Error
            ? metricsLoadError.message
            : 'Could not load the Seller Report metrics.'
        );
      }
      finally {
        setLoading(false);
      }
    }, [
      listingId,
      periodDays,
    ]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const root =
    asRecord(metrics);

  const period =
    asRecord(root.period);

  const email =
    asRecord(root.email);

  const emailPeriod =
    asRecord(email.period);

  const emailPrevious =
    asRecord(
      email.previous_period
    );

  const emailLifetime =
    asRecord(email.lifetime);

  const actionClicks =
    asRecord(
      emailPeriod.action_clicks
    );

  const website =
    asRecord(
      root.property_website
    );

  const websitePeriod =
    asRecord(website.period);

  const websitePrevious =
    asRecord(
      website.previous_period
    );

  const websiteLifetime =
    asRecord(website.lifetime);

  const qr =
    asRecord(root.qr);

  const actionClickEntries =
    Object.entries(actionClicks)
      .filter(
        ([, value]) =>
          numberValue(value) > 0
      );

  if (
    loading &&
    !metrics
  ) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />

          Loading live Seller Report metrics...
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />

              <h2 className="text-2xl font-bold text-slate-950">
                Seller Report
              </h2>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Live listing activity from production email campaigns,
              the property website, property video, contact actions,
              and assigned flyer QR codes.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Test activity, probable bots, delivery failures,
              complaints, bounces, and internal-only listing events
              are excluded from seller-facing totals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[7, 14, 30].map(
              (days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    setPeriodDays(days)
                  }
                  disabled={loading}
                  className={
                    periodDays === days
                      ? 'rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white'
                      : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                  }
                >
                  {days} days
                </button>
              )
            )}

            <button
              type="button"
              onClick={() =>
                void loadMetrics()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                className={
                  loading
                    ? 'h-4 w-4 animate-spin'
                    : 'h-4 w-4'
                }
              />

              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Reporting period:{' '}
          {formatDateTime(
            period.start
          )}{' '}
          through{' '}
          {formatDateTime(
            period.end
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />

          <h3 className="text-lg font-bold text-slate-950">
            Email Marketing
          </h3>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Emails Sent"
            value={formatNumber(
              emailPeriod.sent
            )}
            detail={`Previous period: ${formatNumber(
              emailPrevious.sent
            )}`}
          />

          <MetricCard
            label="Delivered"
            value={formatNumber(
              emailPeriod.delivered
            )}
            detail={`Lifetime: ${formatNumber(
              emailLifetime.delivered
            )}`}
          />

          <MetricCard
            label="Unique Opens"
            value={formatNumber(
              emailPeriod.unique_opens
            )}
            detail={`Open rate: ${formatPercent(
              emailPeriod.open_rate
            )}`}
          />

          <MetricCard
            label="Unique Clicks"
            value={formatNumber(
              emailPeriod.unique_clicks
            )}
            detail={`Click rate: ${formatPercent(
              emailPeriod.click_rate
            )}`}
          />

          <MetricCard
            label="Unique Replies"
            value={formatNumber(
              emailPeriod.unique_replies
            )}
          />

          <MetricCard
            label="Campaigns"
            value={formatNumber(
              emailLifetime.campaign_count
            )}
            detail="Production campaigns only"
          />
        </div>

        {actionClickEntries.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-900">
              Email Link Engagement
            </div>

            <div className="mt-2">
              {actionClickEntries.map(
                ([key, value]) => (
                  <DetailRow
                    key={key}
                    label={labelForKey(key)}
                    value={formatNumber(
                      value
                    )}
                  />
                )
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-emerald-600" />

          <h3 className="text-lg font-bold text-slate-950">
            Property Website and Video
          </h3>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Page Views"
            value={formatNumber(
              websitePeriod.page_views
            )}
            detail={`Previous period: ${formatNumber(
              websitePrevious.page_views
            )}`}
          />

          <MetricCard
            label="Unique Visitors"
            value={formatNumber(
              websitePeriod.estimated_unique_visitors
            )}
            detail={`Lifetime: ${formatNumber(
              websiteLifetime.estimated_unique_visitors
            )}`}
          />

          <MetricCard
            label="Unique Sessions"
            value={formatNumber(
              websitePeriod.estimated_unique_sessions
            )}
          />

          <MetricCard
            label="Engagement Actions"
            value={formatNumber(
              websitePeriod.engagement_actions
            )}
          />

          <MetricCard
            label="Video Plays"
            value={formatNumber(
              websitePeriod.video_plays
            )}
          />

          <MetricCard
            label="Video Completions"
            value={formatNumber(
              websitePeriod.video_completions
            )}
          />

          <MetricCard
            label="Virtual Tour Clicks"
            value={formatNumber(
              websitePeriod.virtual_tour_clicks
            )}
          />

          <MetricCard
            label="Showing Requests"
            value={formatNumber(
              websitePeriod.showing_request_clicks
            )}
          />

          <MetricCard
            label="Phone Clicks"
            value={formatNumber(
              websitePeriod.phone_clicks
            )}
          />

          <MetricCard
            label="Email Clicks"
            value={formatNumber(
              websitePeriod.email_clicks
            )}
          />

          <MetricCard
            label="External Video Clicks"
            value={formatNumber(
              websitePeriod.video_external_clicks
            )}
          />

          <MetricCard
            label="75% Video Views"
            value={formatNumber(
              websitePeriod.video_progress_75
            )}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-900">
              Audience Summary
            </div>

            <div className="mt-2">
              <DetailRow
                label="Top source"
                value={
                  textValue(
                    websitePeriod.top_marketing_source
                  ) ||
                  'Not available'
                }
              />

              <DetailRow
                label="Top device"
                value={
                  textValue(
                    websitePeriod.top_device_category
                  ) ||
                  'Not available'
                }
              />

              <DetailRow
                label="Top location"
                value={
                  [
                    textValue(
                      websitePeriod.top_city
                    ),
                    textValue(
                      websitePeriod.top_region
                    ),
                    textValue(
                      websitePeriod.top_country_code
                    ),
                  ]
                    .filter(Boolean)
                    .join(', ') ||
                  'Not available'
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-900">
              Video Progress
            </div>

            <div className="mt-2">
              <DetailRow
                label="25% watched"
                value={formatNumber(
                  websitePeriod.video_progress_25
                )}
              />

              <DetailRow
                label="50% watched"
                value={formatNumber(
                  websitePeriod.video_progress_50
                )}
              />

              <DetailRow
                label="75% watched"
                value={formatNumber(
                  websitePeriod.video_progress_75
                )}
              />

              <DetailRow
                label="Completed"
                value={formatNumber(
                  websitePeriod.video_completions
                )}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-violet-600" />

          <h3 className="text-lg font-bold text-slate-950">
            Flyer and QR Activity
          </h3>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="QR Scans"
            value={formatNumber(
              qr.period_human_scans
            )}
            detail={`Lifetime: ${formatNumber(
              qr.total_human_scans
            )}`}
          />

          <MetricCard
            label="Unique Scanners"
            value={formatNumber(
              qr.estimated_unique_scanners
            )}
          />

          <MetricCard
            label="Repeat Scans"
            value={formatNumber(
              qr.estimated_repeat_scans
            )}
          />

          <MetricCard
            label="Assigned Codes"
            value={formatNumber(
              qr.assignment_count
            )}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-bold text-slate-900">
            QR Audience Summary
          </div>

          <div className="mt-2">
            <DetailRow
              label="Top source"
              value={
                textValue(
                  qr.top_marketing_source
                ) ||
                'Not available'
              }
            />

            <DetailRow
              label="Top device"
              value={
                textValue(
                  qr.top_device_category
                ) ||
                'Not available'
              }
            />

            <DetailRow
              label="Top location"
              value={
                [
                  textValue(
                    qr.top_city
                  ),
                  textValue(
                    qr.top_region
                  ),
                  textValue(
                    qr.top_country_code
                  ),
                ]
                  .filter(Boolean)
                  .join(', ') ||
                'Not available'
              }
            />

            <DetailRow
              label="First scan"
              value={formatDateTime(
                qr.first_scan_at
              )}
            />

            <DetailRow
              label="Most recent scan"
              value={formatDateTime(
                qr.last_scan_at
              )}
            />
          </div>
        </div>
      </section>
    </section>
  );
}