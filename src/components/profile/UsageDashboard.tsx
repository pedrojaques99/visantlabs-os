import React, { useState } from 'react';
import { GlitchLoader } from '../ui/GlitchLoader';
import { ErrorState } from '../ui/ErrorState';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useUsageStats, useDailyUsage } from '@/hooks/queries/useUsage';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface DailyPoint {
  date: string;
  calls: number;
  credits: number;
}

type ChartMetric = 'calls' | 'credits';
type FeatureFilter = 'all' | 'mockupmachine' | 'brandingmachine' | 'canvas';

// Simple inline SVG bar chart
function BarChart({ data, metric }: { data: DailyPoint[]; metric: ChartMetric }) {
  const values = data.map((d) => d[metric]);
  const maxValue = Math.max(...values, 1);
  const chartHeight = 140;
  const barWidth = Math.max(4, Math.floor(560 / Math.max(data.length, 1)) - 2);
  const gap = 2;

  return (
    <div className="overflow-x-auto">
      <svg
        width={Math.max(data.length * (barWidth + gap), 560)}
        height={chartHeight + 30}
        className="block"
      >
        {data.map((point, i) => {
          const barHeight = (values[i] / maxValue) * chartHeight;
          const x = i * (barWidth + gap);
          const y = chartHeight - barHeight;
          const showLabel = data.length <= 14 || i % Math.ceil(data.length / 14) === 0;
          return (
            <g key={point.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className="fill-foreground/60"
                rx={2}
              >
                <title>{`${point.date}: ${values[i]} ${metric}`}</title>
              </rect>
              {showLabel && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  fontSize="9"
                  className="fill-muted-foreground"
                  fontFamily="monospace"
                >
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Product names stay as-is; only "all" is copy.
const FEATURE_OPTIONS: { value: FeatureFilter; label: string | null }[] = [
  { value: 'all', label: null },
  { value: 'mockupmachine', label: 'Mockup Machine' },
  { value: 'brandingmachine', label: 'Branding Machine' },
  { value: 'canvas', label: 'Canvas' },
];

/**
 * Usage analytics body — KPI tiles, 30-day chart, and feature breakdown.
 * Extracted from UsageDashboardPage so it can also live in the profile overview.
 * Renders only the content; callers own the page/section chrome.
 */
export const UsageDashboard: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const { t } = useTranslation();
  const [chartMetric, setChartMetric] = useState<ChartMetric>('calls');
  const [featureFilter, setFeatureFilter] = useState<FeatureFilter>('all');

  const statsQuery = useUsageStats(enabled);
  const dailyQuery = useDailyUsage(featureFilter, enabled);

  const stats = statsQuery.data ?? null;
  const daily: DailyPoint[] = dailyQuery.data ?? [];
  const isLoadingStats = statsQuery.isLoading;
  const isLoadingDaily = dailyQuery.isLoading;

  const statCards: { label: string; value: number; sub?: string }[] = [
    { label: t('profile.usage.totalCalls'), value: stats?.totalRecords ?? 0 },
    { label: t('profile.usage.totalCredits'), value: stats?.totalCredits ?? 0 },
    {
      label: t('profile.usage.last7'),
      value: stats?.last7Days.count ?? 0,
      sub: t('profile.usage.creditsCount', { count: stats?.last7Days.credits ?? 0 }),
    },
    {
      label: t('profile.usage.last30'),
      value: stats?.last30Days.count ?? 0,
      sub: t('profile.usage.creditsCount', { count: stats?.last30Days.credits ?? 0 }),
    },
  ];

  const featureRows = [
    { key: 'mockupmachine', label: 'Mockup Machine' },
    { key: 'brandingmachine', label: 'Branding Machine' },
    { key: 'canvas', label: 'Canvas' },
  ] as const;

  // A failed stats load must not read as "0 calls, 0 credits".
  if (statsQuery.isError) {
    return (
      <ErrorState title={t('profile.usage.loadFailed')} onRetry={() => statsQuery.refetch()} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="bg-card border border-border rounded-xl">
            <CardContent className="p-4">
              <span className="block text-xs text-muted-foreground mb-2">{card.label}</span>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {isLoadingStats ? <GlitchLoader size={20} /> : card.value.toLocaleString()}
              </p>
              {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Section */}
      <Card className="bg-card border border-border rounded-xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-medium text-foreground">
              {t('profile.usage.history30')}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Feature filter */}
              <select
                value={featureFilter}
                onChange={(e) => setFeatureFilter(e.target.value as FeatureFilter)}
                aria-label={t('profile.usage.filterLabel')}
                className="bg-muted border border-border text-muted-foreground text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-ring"
              >
                {FEATURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label ?? t('profile.usage.allFeatures')}
                  </option>
                ))}
              </select>

              {/* Metric toggle */}
              <div className="flex items-center bg-muted border border-border rounded-md overflow-hidden text-xs">
                {(['calls', 'credits'] as const).map((m) => (
                  <Button
                    key={m}
                    variant="ghost"
                    size="xs"
                    aria-pressed={chartMetric === m}
                    onClick={() => setChartMetric(m)}
                    className={cn(
                      'px-3 rounded-none',
                      chartMetric === m
                        ? 'bg-brand-cyan/10 text-brand-cyan'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m === 'calls' ? t('profile.usage.calls') : t('profile.usage.credits')}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {isLoadingDaily ? (
            <div className="flex items-center justify-center h-[170px]">
              <GlitchLoader size={24} />
            </div>
          ) : dailyQuery.isError ? (
            <ErrorState
              title={t('profile.usage.loadFailed')}
              onRetry={() => dailyQuery.refetch()}
              className="py-8"
            />
          ) : daily.length === 0 ? (
            <div className="flex items-center justify-center h-[170px]">
              <p className="text-muted-foreground text-sm">{t('profile.usage.noData')}</p>
            </div>
          ) : (
            <BarChart data={daily} metric={chartMetric} />
          )}
        </CardContent>
      </Card>

      {/* Feature Breakdown */}
      <Card className="bg-card border border-border rounded-xl">
        <CardContent className="p-4 md:p-6">
          <h2 className="text-base font-medium text-foreground mb-4">
            {t('profile.usage.byFeature')}
          </h2>
          {isLoadingStats ? (
            <div className="flex items-center justify-center py-6">
              <GlitchLoader size={24} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featureRows.map((row) => {
                const data = stats?.byFeature[row.key] ?? { count: 0, credits: 0 };
                return (
                  <div key={row.key} className="bg-muted/40 border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="neutral">{row.label}</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">
                          {t('profile.usage.calls')}
                        </span>
                        <span className="text-foreground font-medium tabular-nums">
                          {data.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">
                          {t('profile.usage.credits')}
                        </span>
                        <span className="text-foreground font-medium tabular-nums">
                          {data.credits.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
