import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart2,
  CreditCard,
  Layers,
  Plug,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { authService } from '../../services/authService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FeatureStats {
  total: number;
  allTime: number;
  distinctUsers: number;
  byDay: { date: string; count: number }[];
}

interface AnalyticsPayload {
  days: number;
  generatedAt: string;
  cached: boolean;
  features: Record<string, FeatureStats>;
  mcp: {
    activeApiKeyUsers: number;
    oauthUsers: number;
    activeCallers: number;
    totalEnabled: number;
    enabledAndActive: number;
    byClient: { clientName: string; users: number }[];
  };
  funnel: {
    cohortDays: number;
    steps: { key: string; count: number; pctOfPrev: number; medianHoursToStep: number | null }[];
  };
  icp: {
    tierFeatureMatrix: { tier: string; features: Record<string, number> }[];
    powerUsers: {
      userId: string;
      email: string;
      tier: string;
      featureCount: number;
      features: string[];
    }[];
    userCategories: { category: string; count: number }[];
  };
  retention: {
    dau: number;
    wau: number;
    mau: number;
    weeklyActive: { week: string; users: number }[];
  };
  /** Naming Machine — opcional (backend pode ainda não expor a seção). */
  naming?: {
    batches: number;
    namesGenerated: number;
    tokensSpent: number;
    uniqueUsers: number;
    swipes: { nope: number; like: number; superlike: number };
    likeRate: number;
    byModel: { model: string; batches: number; tokens: number }[];
  };
}

const FEATURE_LABELS: Record<string, string> = {
  brandings: 'Brandings',
  guidelines: 'Brand Guidelines',
  campaigns: 'Campaigns',
  creativeProjects: 'Creative Projects',
  canvasProjects: 'Canvas Projects',
  budgets: 'Budgets',
  mockups: 'Mockups',
};

const FUNNEL_LABELS: Record<string, string> = {
  signedUp: 'Signed Up',
  createdBrand: 'Created First Brand',
  firstGeneration: 'First Generation',
  paying: 'Became Paying',
};

const DAY_OPTIONS = [7, 30, 90];

const chartTooltipStyle = {
  background: '#171717',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
} as const;

export function AdminProductAnalytics() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchAnalytics = async (windowDays = days, refresh = false) => {
    const token = authService.getToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(windowDays) });
      if (refresh) params.set('refresh', '1');
      const resp = await fetch(`/api/admin/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch product analytics');
      setData(await resp.json());
    } catch (err) {
      console.error('[AdminProductAnalytics] error:', err);
      toast.error('Failed to load product analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-neutral-900 border border-white/10">
            <CardContent className="p-6">
              <SkeletonLoader width="80px" height="12px" className="rounded mb-3" />
              <SkeletonLoader width="120px" height="32px" className="rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const maxFunnelCount = Math.max(...data.funnel.steps.map((s) => s.count), 1);
  const featureKeys = Object.keys(FEATURE_LABELS).filter((k) => data.features[k]);

  return (
    <div className="space-y-6 admin-tab-enter">
      {/* Window selector + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <Button
              key={d}
              variant={days === d ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
              className={cn(
                'text-xs border-neutral-800',
                days !== d && 'hover:bg-neutral-800/50'
              )}
            >
              {d}d
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {data.cached && (
            <Badge variant="outline" className="text-[10px] border-neutral-700 text-neutral-500">
              cached
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(days, true)}
            disabled={loading}
            className="border-neutral-800 hover:bg-neutral-800/50 text-xs gap-1.5"
            aria-label="Refresh product analytics"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: `Brandings (${data.days}d)`,
            value: (data.features.brandings?.total ?? 0).toLocaleString(),
            icon: Layers,
          },
          {
            label: 'MCP Enabled Users',
            value: data.mcp.totalEnabled.toLocaleString(),
            icon: Plug,
          },
          {
            label: 'Weekly Active (gen)',
            value: data.retention.wau.toLocaleString(),
            icon: Activity,
          },
          {
            label: 'Signup → Paying',
            value: `${
              data.funnel.steps[0].count > 0
                ? Math.round(
                    (data.funnel.steps[3].count / data.funnel.steps[0].count) * 1000
                  ) / 10
                : 0
            }%`,
            icon: CreditCard,
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-neutral-900 border border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  {kpi.label}
                </span>
                <kpi.icon className="h-3.5 w-3.5 text-neutral-600" />
              </div>
              <span className="text-2xl font-semibold text-neutral-200">{kpi.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activation Funnel */}
      <Card className="bg-neutral-900 border border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-300">
            Activation Funnel
          </CardTitle>
          <CardDescription className="text-xs text-neutral-600 font-mono">
            Users who signed up in the last {data.days} days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.funnel.steps.map((step) => (
            <div key={step.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">{FUNNEL_LABELS[step.key] || step.key}</span>
                <span className="font-mono text-neutral-500">
                  {step.count.toLocaleString()}
                  <span className="text-neutral-600"> · {step.pctOfPrev}% of prev</span>
                  {step.medianHoursToStep != null && (
                    <span className="text-neutral-600"> · ~{step.medianHoursToStep}h</span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded bg-neutral-800/60 overflow-hidden">
                <div
                  className="h-full rounded bg-neutral-500/60"
                  style={{ width: `${(step.count / maxFunnelCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Feature Adoption */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            Feature Adoption
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureKeys.map((key) => {
            const f = data.features[key];
            return (
              <Card key={key} className="bg-neutral-900 border border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-300">{FEATURE_LABELS[key]}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-neutral-700 text-neutral-500"
                    >
                      {f.distinctUsers} users
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-xl font-semibold text-neutral-200">
                      {f.total.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-600">
                      {f.allTime.toLocaleString()} all-time
                    </span>
                  </div>
                  {f.byDay.length > 0 && (
                    <ResponsiveContainer width="100%" height={70}>
                      <AreaChart data={f.byDay}>
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          labelStyle={{ color: '#a3a3a3' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#737373"
                          fill="rgba(115,115,115,0.15)"
                          strokeWidth={1.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Naming Machine */}
      {data.naming && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-neutral-600" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
              Naming Machine
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { label: `Batches (${data.days}d)`, value: data.naming.batches },
              { label: 'Names Generated', value: data.naming.namesGenerated },
              { label: 'Tokens Spent', value: data.naming.tokensSpent },
              { label: 'Unique Users', value: data.naming.uniqueUsers },
            ].map((kpi) => (
              <Card key={kpi.label} className="bg-neutral-900 border border-white/10">
                <CardContent className="p-5">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                    {kpi.label}
                  </span>
                  <span className="text-2xl font-semibold text-neutral-200">
                    {kpi.value.toLocaleString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Swipe breakdown */}
            <Card className="bg-neutral-900 border border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-300">Swipes</CardTitle>
                <CardDescription className="text-xs text-neutral-600 font-mono">
                  Like rate: {Math.round((data.naming.likeRate ?? 0) * 1000) / 10}%
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Nope', value: data.naming.swipes.nope },
                  { label: 'Like', value: data.naming.swipes.like },
                  { label: 'Superlike', value: data.naming.swipes.superlike },
                ].map((s) => (
                  <div key={s.label}>
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                      {s.label}
                    </span>
                    <span className="text-xl font-semibold text-neutral-200">
                      {s.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            {/* Top models */}
            <Card className="bg-neutral-900 border border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-300">Top Models</CardTitle>
                <CardDescription className="text-xs text-neutral-600 font-mono">
                  Batches and tokens per chat model
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {data.naming.byModel.length === 0 ? (
                  <p className="px-6 pb-4 text-xs text-neutral-600">No naming activity in window</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-800 hover:bg-transparent">
                        <TableHead className="text-neutral-500 text-[10px] font-mono">
                          Model
                        </TableHead>
                        <TableHead className="text-neutral-500 text-[10px] font-mono text-right">
                          Batches
                        </TableHead>
                        <TableHead className="text-neutral-500 text-[10px] font-mono text-right">
                          Tokens
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.naming.byModel.map((m) => (
                        <TableRow key={m.model} className="border-neutral-800">
                          <TableCell className="text-xs text-neutral-300">{m.model}</TableCell>
                          <TableCell className="text-xs text-neutral-400 text-right">
                            {m.batches.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-neutral-400 text-right">
                            {m.tokens.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* MCP Adoption */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Plug className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            MCP Adoption
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Active API Keys', value: data.mcp.activeApiKeyUsers },
              { label: 'OAuth Apps', value: data.mcp.oauthUsers },
              { label: `Active Callers (${data.days}d)`, value: data.mcp.activeCallers },
              { label: 'Enabled & Active', value: data.mcp.enabledAndActive },
            ].map((kpi) => (
              <Card key={kpi.label} className="bg-neutral-900 border border-white/10">
                <CardContent className="p-5">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                    {kpi.label}
                  </span>
                  <span className="text-2xl font-semibold text-neutral-200">
                    {kpi.value.toLocaleString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-neutral-900 border border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-300">
                Connected Apps
              </CardTitle>
              <CardDescription className="text-xs text-neutral-600 font-mono">
                Users per OAuth client
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.mcp.byClient.length === 0 ? (
                <p className="px-6 pb-4 text-xs text-neutral-600">No OAuth apps connected yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-neutral-800 hover:bg-transparent">
                      <TableHead className="text-neutral-500 text-[10px] font-mono">App</TableHead>
                      <TableHead className="text-neutral-500 text-[10px] font-mono text-right">
                        Users
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.mcp.byClient.map((c) => (
                      <TableRow key={c.clientName} className="border-neutral-800">
                        <TableCell className="text-xs text-neutral-300">{c.clientName}</TableCell>
                        <TableCell className="text-xs text-neutral-400 text-right">
                          {c.users}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ICP: Power Users + Tier Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-neutral-900 border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-300">Power Users</CardTitle>
            <CardDescription className="text-xs text-neutral-600 font-mono">
              Ranked by feature breadth in the last {data.days} days
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.icp.powerUsers.length === 0 ? (
              <p className="px-6 pb-4 text-xs text-neutral-600">No active users in window</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-transparent">
                    <TableHead className="text-neutral-500 text-[10px] font-mono">User</TableHead>
                    <TableHead className="text-neutral-500 text-[10px] font-mono">Tier</TableHead>
                    <TableHead className="text-neutral-500 text-[10px] font-mono text-right">
                      Features
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.icp.powerUsers.map((u) => (
                    <TableRow key={u.userId} className="border-neutral-800">
                      <TableCell className="text-xs text-neutral-300">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-neutral-700 text-neutral-500"
                        >
                          {u.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-neutral-400 text-right">
                        {u.featureCount}
                        <span
                          className="ml-1 text-neutral-600"
                          title={u.features.map((f) => FEATURE_LABELS[f] || f).join(', ')}
                        >
                          ({u.features.map((f) => (FEATURE_LABELS[f] || f).slice(0, 2)).join('·')})
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-300">
              Tier × Feature Usage
            </CardTitle>
            <CardDescription className="text-xs text-neutral-600 font-mono">
              Distinct users per feature, by subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {data.icp.tierFeatureMatrix.length === 0 ? (
              <p className="px-6 pb-4 text-xs text-neutral-600">No usage in window</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-transparent">
                    <TableHead className="text-neutral-500 text-[10px] font-mono">Tier</TableHead>
                    {featureKeys.map((key) => (
                      <TableHead
                        key={key}
                        className="text-neutral-500 text-[10px] font-mono text-right"
                      >
                        {(FEATURE_LABELS[key] || key).split(' ')[0]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.icp.tierFeatureMatrix.map((row) => (
                    <TableRow key={row.tier} className="border-neutral-800">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-neutral-700 text-neutral-400"
                        >
                          {row.tier}
                        </Badge>
                      </TableCell>
                      {featureKeys.map((key) => (
                        <TableCell key={key} className="text-xs text-neutral-400 text-right">
                          {row.features[key] || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retention */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            Retention (generation activity)
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
            {[
              { label: 'DAU', value: data.retention.dau },
              { label: 'WAU', value: data.retention.wau },
              { label: 'MAU', value: data.retention.mau },
            ].map((kpi) => (
              <Card key={kpi.label} className="bg-neutral-900 border border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                      {kpi.label}
                    </span>
                    <Users className="h-3.5 w-3.5 text-neutral-600" />
                  </div>
                  <span className="text-2xl font-semibold text-neutral-200">
                    {kpi.value.toLocaleString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-neutral-900 border border-white/10 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-300">
                Weekly Active Users
              </CardTitle>
              <CardDescription className="text-xs text-neutral-600 font-mono">
                Users with any generation, per ISO week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.retention.weeklyActive.length === 0 ? (
                <p className="text-xs text-neutral-600">No activity in window</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.retention.weeklyActive}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="week" tick={{ fill: '#525252', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#525252', fontSize: 10 }} width={40} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#a3a3a3' }} />
                    <Area
                      type="monotone"
                      dataKey="users"
                      stroke="#737373"
                      fill="rgba(115,115,115,0.15)"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
