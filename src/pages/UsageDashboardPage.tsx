import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, TrendingUp, Zap, Clock, Activity } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { SEO } from '../components/SEO';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/config/api';

interface UsageStats {
  totalRecords: number;
  totalCredits: number;
  byFeature: {
    mockupmachine: { count: number; credits: number };
    brandingmachine: { count: number; credits: number };
    canvas: { count: number; credits: number };
  };
  last7Days: { count: number; credits: number };
  last30Days: { count: number; credits: number };
}

interface DailyPoint {
  date: string;
  calls: number;
  credits: number;
}

type ChartMetric = 'calls' | 'credits';
type FeatureFilter = 'all' | 'mockupmachine' | 'brandingmachine' | 'canvas';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  if (!token) return {};
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

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
                fill="rgb(0 210 190 / 0.6)"
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
                  fill="rgb(115 115 115)"
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

const FEATURE_OPTIONS: { value: FeatureFilter; label: string }[] = [
  { value: 'all', label: 'All Features' },
  { value: 'mockupmachine', label: 'Mockup Machine' },
  { value: 'brandingmachine', label: 'Branding Machine' },
  { value: 'canvas', label: 'Canvas' },
];

export const UsageDashboardPage: React.FC = () => {
  const { isAuthenticated, isCheckingAuth } = useLayout();

  const [stats, setStats] = useState<UsageStats | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingDaily, setIsLoadingDaily] = useState(true);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('calls');
  const [featureFilter, setFeatureFilter] = useState<FeatureFilter>('all');

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const res = await fetch(`${API_BASE}/usage/history?limit=1`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch usage stats');
      const data = await res.json();
      setStats(data.stats);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load usage stats');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch daily chart data
  const fetchDaily = useCallback(async (feature: FeatureFilter) => {
    try {
      setIsLoadingDaily(true);
      const params = new URLSearchParams({ days: '30' });
      if (feature !== 'all') params.set('feature', feature);
      const res = await fetch(`${API_BASE}/usage/daily?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch daily usage');
      const data = await res.json();
      setDaily(data.daily || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load chart data');
    } finally {
      setIsLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isCheckingAuth) {
      fetchStats();
      fetchDaily(featureFilter);
    }
  }, [isAuthenticated, isCheckingAuth, fetchStats, fetchDaily, featureFilter]);

  const handleFeatureChange = (f: FeatureFilter) => {
    setFeatureFilter(f);
  };

  if (isCheckingAuth || (isLoadingStats && !stats)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <GlitchLoader size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-mono mb-4">Please sign in to view usage analytics</p>
          <BackButton
            className="px-4 py-2 bg-neutral-800/50 text-neutral-400 rounded-md text-sm font-mono hover:bg-neutral-700/50 transition-colors mb-0"
            to="/"
          />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total API Calls',
      value: stats?.totalRecords ?? 0,
      icon: <Activity size={18} className="text-brand-cyan" />,
    },
    {
      label: 'Total Credits Used',
      value: stats?.totalCredits ?? 0,
      icon: <Zap size={18} className="text-warning" />,
    },
    {
      label: 'Last 7 Days',
      value: stats?.last7Days.count ?? 0,
      icon: <Clock size={18} className="text-purple-400" />,
      sub: `${stats?.last7Days.credits ?? 0} credits`,
    },
    {
      label: 'Last 30 Days',
      value: stats?.last30Days.count ?? 0,
      icon: <TrendingUp size={18} className="text-success" />,
      sub: `${stats?.last30Days.credits ?? 0} credits`,
    },
  ];

  const featureRows = [
    {
      key: 'mockupmachine',
      label: 'Mockup Machine',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    {
      key: 'brandingmachine',
      label: 'Branding Machine',
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    { key: 'canvas', label: 'Canvas', color: 'bg-success/20 text-success border-success/30' },
  ] as const;

  return (
    <>
      <SEO
        title="Usage Dashboard"
        description="Monitor your API consumption, credits, and historical usage trends."
        noindex={true}
      />
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 relative">
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10 space-y-6">
          {/* Header Card */}
          <Card className="bg-neutral-900 border border-white/10 rounded-xl">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4">
                <BreadcrumbWithBack to="/settings/api-keys">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/settings/api-keys">API Keys</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Usage Dashboard</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>

              <div className="flex items-center gap-3">
                <BarChart2 className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-neutral-300">
                    Usage Dashboard
                  </h1>
                  <p className="text-neutral-500 font-mono text-sm mt-0.5">
                    Monitor API calls, credits consumed, and feature breakdown
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <Card key={card.label} className="bg-neutral-900 border border-white/10 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {card.icon}
                    <span className="text-xs text-neutral-500 font-mono">{card.label}</span>
                  </div>
                  <p className="text-2xl font-semibold font-manrope text-neutral-200">
                    {isLoadingStats ? <GlitchLoader size={20} /> : card.value.toLocaleString()}
                  </p>
                  {card.sub && (
                    <p className="text-xs text-neutral-600 font-mono mt-1">{card.sub}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart Section */}
          <Card className="bg-neutral-900 border border-white/10 rounded-xl">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold text-neutral-200 font-manrope">
                  30-Day History
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Feature filter */}
                  <select
                    value={featureFilter}
                    onChange={(e) => handleFeatureChange(e.target.value as FeatureFilter)}
                    className="bg-neutral-800/50 border border-neutral-700/50 text-neutral-400 text-xs font-mono rounded-md px-3 py-1.5 focus:outline-none focus:border-neutral-600"
                  >
                    {FEATURE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Metric toggle */}
                  <div className="flex items-center bg-neutral-800/50 border border-neutral-700/50 rounded-md overflow-hidden text-xs font-mono">
                    <Button
                      variant="ghost"
                      onClick={() => setChartMetric('calls')}
                      className={`px-3 py-1.5 rounded-none transition-colors ${
                        chartMetric === 'calls'
                          ? 'bg-brand-cyan/10 text-brand-cyan'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Calls
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setChartMetric('credits')}
                      className={`px-3 py-1.5 rounded-none transition-colors ${
                        chartMetric === 'credits'
                          ? 'bg-warning/10 text-warning'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Credits
                    </Button>
                  </div>
                </div>
              </div>

              {isLoadingDaily ? (
                <div className="flex items-center justify-center h-[170px]">
                  <GlitchLoader size={24} />
                </div>
              ) : daily.length === 0 ? (
                <div className="flex items-center justify-center h-[170px]">
                  <p className="text-neutral-600 font-mono text-sm">No data for this period</p>
                </div>
              ) : (
                <BarChart data={daily} metric={chartMetric} />
              )}
            </CardContent>
          </Card>

          {/* Feature Breakdown */}
          <Card className="bg-neutral-900 border border-white/10 rounded-xl">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base font-semibold text-neutral-200 font-manrope mb-4">
                Feature Breakdown
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
                      <div
                        key={row.key}
                        className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`text-xs border ${row.color}`}>{row.label}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-500 font-mono text-xs">API Calls</span>
                            <span className="text-neutral-200 font-semibold">
                              {data.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-500 font-mono text-xs">Credits</span>
                            <span className="text-neutral-200 font-semibold">
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
      </div>
    </>
  );
};
