import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, Users, Settings, ChevronUp, ChevronDown, Search, TrendingUp, TrendingDown, User, Image, CreditCard, HardDrive, UserPlus, Link2, Database, DollarSign, Palette, Type } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"

import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../components/ui/chart"
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../services/authService';
import { SEO } from '../components/SEO';

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  subscriptionStatus: string;
  subscriptionTier: string;
  monthlyCredits: number | null;
  creditsUsed: number | null;
  totalCreditsEarned: number | null;
  createdAt: string;
  updatedAt: string;
  creditsRemaining: number;
  manualCredits: number;
  mockupCount: number;
  transactionCount: number;
  referralCode?: string | null;
  referralCount?: number | null;
  referredBy?: string | null;
  totalSpentBRL: number;
  totalSpentUSD: number;
  apiCostUSD: number;
}

interface GenerationStats {
  imagesByModel: {
    [model: string]: {
      total: number;
      byResolution: { [resolution: string]: number };
    };
  };
  videos: {
    total: number;
    byModel: { [model: string]: number };
  };
  textTokens: {
    totalSteps: number;
    estimatedTokens: number;
    totalPromptLength: number;
    inputTokens: number;
    outputTokens: number;
  };
  byFeature: {
    mockupmachine: { images: number; videos: number; textSteps: number; promptGenerations: number };
    canvas: { images: number; videos: number; textSteps: number; promptGenerations: number };
    brandingmachine: { images: number; videos: number; textSteps: number; promptGenerations: number };
    'prompt-generation': { total: number; inputTokens: number; outputTokens: number };
  };
}

interface RevenueTimeSeriesItem {
  date: string;
  revenueBRL: number;
  revenueUSD: number;
  cumulativeBRL: number;
  cumulativeUSD: number;
}

interface CostTimeSeriesItem {
  date: string;
  cost: number;
  cumulative: number;
}

interface AdminResponse {
  totalUsers: number;
  totalMockupsGenerated: number;
  totalMockupsSaved: number;
  totalCreditsUsed: number;
  totalStorageUsed?: number;
  totalRevenueBRL: number;
  totalRevenueUSD: number;
  totalApiCostUSD: number;
  referralStats?: {
    totalReferralCount: number;
    totalReferredUsers: number;
    usersWithReferralCode: number;
  };
  users: AdminUser[];
  generationStats?: GenerationStats;
  revenueTimeSeries?: RevenueTimeSeriesItem[];
  costTimeSeries?: CostTimeSeriesItem[];
}

const ADMIN_API = '/api/admin/users';

// Pricing constants based on Gemini pricing
// Flash: $0.039 per image
// Pro Standard (< 4K): $0.134 per image
// Pro High Res (>= 4K): $0.24 per image
const PRICING: Record<string, number | { standard: number; highRes: number }> = {
  'gemini-2.5-flash-image': 0.039,
  'gemini-3-pro-image-preview': {
    standard: 0.134,
    highRes: 0.24,
  },
};

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${value} ${sizes[i]}`;
}

// Helper function to format currency (cents to display)
function formatCurrency(cents: number, currency: 'BRL' | 'USD'): string {
  const value = cents / 100;
  return currency === 'BRL'
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Admin Dashboard Skeleton Component
const AdminDashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    {/* Tabs Skeleton */}
    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <SkeletonLoader width="100px" height="36px" className="rounded-md" />
            <SkeletonLoader width="100px" height="36px" className="rounded-md" />
            <SkeletonLoader width="100px" height="36px" className="rounded-md" />
          </div>
          <SkeletonLoader width="100px" height="36px" className="rounded-md" />
        </div>
      </CardContent>
    </Card>

    {/* KPI Cards Grid Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <SkeletonLoader width="48px" height="48px" className="rounded-lg" />
              <SkeletonLoader width="60px" height="20px" className="rounded-full" />
            </div>
            <div className="space-y-2">
              <SkeletonLoader width="80px" height="36px" className="rounded" />
              <SkeletonLoader width="120px" height="16px" className="rounded" />
              <SkeletonLoader width="100px" height="12px" className="rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Revenue Card Skeleton */}
    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <SkeletonLoader width="56px" height="56px" className="rounded-lg" />
            <div className="space-y-2">
              <SkeletonLoader width="100px" height="16px" className="rounded" />
              <SkeletonLoader width="140px" height="12px" className="rounded" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 md:gap-8">
            <div className="space-y-2">
              <SkeletonLoader width="140px" height="32px" className="rounded" />
              <SkeletonLoader width="100px" height="12px" className="rounded" />
            </div>
            <div className="space-y-2">
              <SkeletonLoader width="120px" height="32px" className="rounded" />
              <SkeletonLoader width="100px" height="12px" className="rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Chart Skeleton */}
    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
      <CardHeader>
        <SkeletonLoader width="200px" height="24px" className="rounded mb-2" />
        <SkeletonLoader width="280px" height="16px" className="rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full flex items-end justify-between gap-2 px-4">
          {[40, 65, 55, 80, 45, 70, 60, 75, 50, 85, 55, 90].map((height, i) => (
            <SkeletonLoader
              key={i}
              width="100%"
              height={`${height}%`}
              className="rounded-t flex-1"
            />
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Referral Stats Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <SkeletonLoader width="48px" height="48px" className="rounded-lg" />
              <SkeletonLoader width="50px" height="16px" className="rounded" />
            </div>
            <div className="space-y-2">
              <SkeletonLoader width="60px" height="36px" className="rounded" />
              <SkeletonLoader width="100px" height="16px" className="rounded" />
              <SkeletonLoader width="140px" height="12px" className="rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AdminResponse | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof AdminUser | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleFetch = async () => {
    const token = authService.getToken();
    if (!token) {
      setError(t('admin.authRequired'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(ADMIN_API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(t('admin.accessDenied'));
        }
        throw new Error(t('admin.failedToLoadData'));
      }

      const result = (await response.json()) as AdminResponse;
      setData(result);
    } catch (fetchError: any) {
      console.error('Erro ao carregar dados do admin:', fetchError);
      setData(null);
      setError(fetchError.message || t('admin.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    handleFetch();
  };

  // Check if user is admin and load data
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isCheckingAuth) return;

      if (isUserAuthenticated === true) {
        try {
          const user = await authService.verifyToken();
          const userIsAdmin = user?.isAdmin || false;
          setIsAdmin(userIsAdmin);

          // Load data if user is admin
          if (userIsAdmin) {
            handleFetch();
          }
        } catch (error) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserAuthenticated, isCheckingAuth]);

  const isAuthenticated = isUserAuthenticated === true && isAdmin === true && data !== null;

  const totals = useMemo(() => {
    if (!data) {
      return {
        manualCredits: 0,
        monthlyCredits: 0,
        creditsUsed: 0,
      };
    }

    return data.users.reduce(
      (acc, user) => {
        acc.manualCredits += user.manualCredits || 0;
        acc.monthlyCredits += user.monthlyCredits || 0;
        acc.creditsUsed += user.creditsUsed || 0;
        return acc;
      },
      { manualCredits: 0, monthlyCredits: 0, creditsUsed: 0 }
    );
  }, [data]);

  const totalEstimatedCost = useMemo(() => {
    if (!data?.generationStats?.imagesByModel) return 0;

    let cost = 0;
    const stats = data.generationStats.imagesByModel;

    // Calculate Gemini 2.5 Flash cost
    if (stats['gemini-2.5-flash-image']) {
      cost += stats['gemini-2.5-flash-image'].total * (PRICING['gemini-2.5-flash-image'] as number);
    }

    // Calculate Gemini 3 Pro cost
    if (stats['gemini-3-pro-image-preview']) {
      const proPreco = PRICING['gemini-3-pro-image-preview'] as { standard: number; highRes: number };
      const resolutions = stats['gemini-3-pro-image-preview'].byResolution;

      Object.entries(resolutions).forEach(([res, count]) => {
        // Simple check for 4K (assuming "4096" in resolution string means high res)
        // Adjust logic if resolution string format differs
        if (res.includes('4096') || res.includes('4k')) {
          cost += count * proPreco.highRes;
        } else {
          cost += count * proPreco.standard;
        }
      });
    }

    return cost;
  }, [data]);

  // --- CHART DATA PREPARATION ---

  // User Growth Data
  const userGrowthData = useMemo(() => {
    if (!data?.users) return [];

    const usersByDate = data.users.reduce((acc, user) => {
      const date = new Date(user.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort by date and calculate cumulative
    const sortedDates = Object.keys(usersByDate).sort();
    let cumulative = 0;

    return sortedDates.map(date => {
      cumulative += usersByDate[date];
      return {
        date,
        users: cumulative,
        newUsers: usersByDate[date]
      };
    });
  }, [data]);

  // Model Usage Data (Bar Chart)
  const modelUsageData = useMemo(() => {
    if (!data?.generationStats) return [];

    const imageStats = Object.entries(data.generationStats.imagesByModel).map(([model, stats]) => ({
      model: model.replace('gemini-', '').replace('-image', '').replace('-preview', ''), // Simplify name
      count: stats.total,
      type: 'Imagem',
      fill: "hsl(var(--chart-1))"
    }));

    const videoStats = data.generationStats.videos ? Object.entries(data.generationStats.videos.byModel).map(([model, count]) => ({
      model: model,
      count: count,
      type: 'Vídeo',
      fill: "hsl(var(--chart-2))"
    })) : [];

    return [...imageStats, ...videoStats].sort((a, b) => b.count - a.count);
  }, [data]);

  // Chart Config
  const chartConfig = {
    users: {
      label: "Total Users",
      color: "hsl(var(--chart-1))",
    },
    newUsers: {
      label: "New Users",
      color: "hsl(var(--chart-2))",
    },
    count: {
      label: "Generations",
      color: "hsl(var(--chart-1))",
    },
    revenue: {
      label: "Revenue (BRL)",
      color: "#22c55e", // green-500
    },
    cost: {
      label: "Cost (USD)",
      color: "#f97316", // orange-500
    }
  } satisfies ChartConfig

  const userLookup = useMemo(() => {
    if (!data) return {};
    return data.users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, AdminUser>);
  }, [data]);

  const filteredAndSortedUsers = useMemo(() => {
    if (!data) return [];

    let filtered = data.users;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, sortField, sortDirection]);

  const handleSort = (field: keyof AdminUser) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <>
      <SEO
        title={t('admin.title')}
        description={t('admin.description')}
        noindex={true}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
          {/* Header Compacto */}
          <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl mb-6">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4">
                <BreadcrumbWithBack to="/">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">{t('apps.home')}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{t('admin.title') || 'Admin'}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-[#52ddeb]" />
                    <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-zinc-300">
                      {t('admin.panelTitle')}
                    </h1>
                  </div>
                  <p className="text-zinc-500 font-mono text-sm md:text-base ml-9 md:ml-11">
                    {t('admin.panelSubtitle')}
                  </p>
                </div>

                {isAuthenticated && data && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={location.pathname === '/admin' ? 'default' : 'outline'}
                      onClick={() => navigate('/admin')}
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      {t('admin.users')}
                    </Button>
                    <Button
                      variant={location.pathname === '/admin/presets' ? 'default' : 'outline'}
                      onClick={() => navigate('/admin/presets')}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      {t('admin.presets')}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skeleton Loading States */}
          {(isCheckingAuth || (isUserAuthenticated && isAdmin === null) || (!isCheckingAuth && isUserAuthenticated && isAdmin === true && isLoading && !data)) && (
            <AdminDashboardSkeleton />
          )}

          {/* Access Denied States */}
          {!isCheckingAuth && !isAuthenticated && !isLoading && (
            <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl max-w-md mx-auto">
              <CardContent className="p-6 md:p-8 space-y-4 text-center">
                {isUserAuthenticated === false ? (
                  <>
                    <p className="text-zinc-400 font-mono mb-4">
                      {t('admin.loginRequired')}
                    </p>
                    <Button
                      onClick={() => navigate('/')}
                      className="bg-[#52ddeb]/80 hover:bg-[#52ddeb] text-black"
                    >
                      {t('admin.doLogin')}
                    </Button>
                  </>
                ) : isAdmin === false ? (
                  <>
                    <p className="text-zinc-400 font-mono mb-4">
                      {t('admin.accessDeniedFull')}
                    </p>
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono">
                        {error}
                      </div>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}

          {isAuthenticated && data && (
            <Tabs defaultValue="overview" className="space-y-6">
              <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <TabsList className="bg-transparent border-0">
                      <TabsTrigger value="overview" className="data-[state=active]:bg-[#52ddeb]/80 data-[state=active]:text-black">
                        {t('admin.dashboard')}
                      </TabsTrigger>
                      {data.generationStats && (
                        <TabsTrigger value="generations" className="data-[state=active]:bg-[#52ddeb]/80 data-[state=active]:text-black">
                          {t('admin.generations')}
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="users" className="data-[state=active]:bg-[#52ddeb]/80 data-[state=active]:text-black">
                        {t('admin.users')}
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      onClick={handleRefresh}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      {t('admin.refresh')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <TabsContent value="overview" className="space-y-6">

                {/* KPI Grid - Top Level Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {/* Total Estimated Cost */}
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl ring-1 ring-[#52ddeb]/20">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <DollarSign className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-black/40 border-[#52ddeb]/30 text-[#52ddeb]">
                          {t('admin.estimated')}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                          $ {totalEstimatedCost.toFixed(3)}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.estimatedCost')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.basedOnUsage')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Users */}
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <User className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                          <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                          <span>+12.5%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                          {data.totalUsers}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.totalUsers')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.registeredInSystem')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Subscriptions */}
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {data.users.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing').length}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.activeSubscriptions')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.recurringPlans')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Storage Used */}
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <HardDrive className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {data.totalStorageUsed !== undefined ? formatBytes(data.totalStorageUsed) : '—'}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.storage')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.totalDiskUsage')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Total Card */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-green-500/30 transition-all duration-300 shadow-lg ring-1 ring-green-500/20">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                          <DollarSign className="h-8 w-8 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500 font-mono mb-1">{t('admin.totalRevenue')}</p>
                          <p className="text-xs text-zinc-400 font-mono">{t('admin.completedTransactions')}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-6 md:gap-8">
                        <div className="text-right">
                          <p className="text-2xl md:text-3xl font-bold text-green-500 font-mono">
                            {formatCurrency(data.totalRevenueBRL, 'BRL')}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono mt-1">{t('admin.brazilianReal')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl md:text-3xl font-bold text-green-400 font-mono">
                            {formatCurrency(data.totalRevenueUSD, 'USD')}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono mt-1">{t('admin.usDollar')}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User Growth Chart */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-zinc-300">{t('admin.userGrowth')}</CardTitle>
                    <CardDescription className="text-zinc-500">{t('admin.newUsersLast30Days')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                        <AreaChart
                          accessibilityLayer
                          data={userGrowthData}
                          margin={{
                            left: 12,
                            right: 12,
                          }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#333" />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                              const date = new Date(value)
                              return date.toLocaleDateString("pt-BR", {
                                month: "short",
                                day: "numeric",
                              })
                            }}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                          />
                          <Area
                            dataKey="users"
                            type="natural"
                            fill="#52ddeb"
                            fillOpacity={0.1}
                            stroke="#52ddeb"
                            stackId="a"
                          />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue & Cost Charts Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                  {/* Revenue Chart */}
                  {data.revenueTimeSeries && data.revenueTimeSeries.length > 0 && (
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-green-500/30 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-zinc-300 flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-500" />
                          {t('admin.revenueOverTime') || 'Receita ao Longo do Tempo'}
                        </CardTitle>
                        <CardDescription className="text-zinc-500">
                          {t('admin.cumulativeRevenue') || 'Receita acumulada (BRL)'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] w-full">
                          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                            <AreaChart
                              accessibilityLayer
                              data={data.revenueTimeSeries}
                              margin={{ left: 12, right: 12 }}
                            >
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#333" />
                              <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                minTickGap={32}
                                tickFormatter={(value) => {
                                  const date = new Date(value)
                                  return date.toLocaleDateString("pt-BR", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                }}
                              />
                              <ChartTooltip
                                cursor={false}
                                content={
                                  <ChartTooltipContent
                                    indicator="dot"
                                    formatter={(value, name) => {
                                      if (name === 'cumulativeBRL') {
                                        return [formatCurrency(value as number, 'BRL'), 'Total BRL'];
                                      }
                                      return [value, name];
                                    }}
                                  />
                                }
                              />
                              <Area
                                dataKey="cumulativeBRL"
                                type="natural"
                                fill="#22c55e"
                                fillOpacity={0.1}
                                stroke="#22c55e"
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ChartContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Cost Chart */}
                  {data.costTimeSeries && data.costTimeSeries.length > 0 && (
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-orange-500/30 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-zinc-300 flex items-center gap-2">
                          <Database className="h-5 w-5 text-orange-500" />
                          {t('admin.costOverTime') || 'Custo Estimado ao Longo do Tempo'}
                        </CardTitle>
                        <CardDescription className="text-zinc-500">
                          {t('admin.cumulativeCost') || 'Custo API acumulado (USD)'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] w-full">
                          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                            <AreaChart
                              accessibilityLayer
                              data={data.costTimeSeries}
                              margin={{ left: 12, right: 12 }}
                            >
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#333" />
                              <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                minTickGap={32}
                                tickFormatter={(value) => {
                                  const date = new Date(value)
                                  return date.toLocaleDateString("pt-BR", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                }}
                              />
                              <ChartTooltip
                                cursor={false}
                                content={
                                  <ChartTooltipContent
                                    indicator="dot"
                                    formatter={(value, name) => {
                                      if (name === 'cumulative') {
                                        return [`$ ${(value as number).toFixed(3)}`, 'Total USD'];
                                      }
                                      return [value, name];
                                    }}
                                  />
                                }
                              />
                              <Area
                                dataKey="cumulative"
                                type="natural"
                                fill="#f97316"
                                fillOpacity={0.1}
                                stroke="#f97316"
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ChartContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Referral Stats */}
                {data.referralStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                            <Link2 className="h-6 w-6 text-[#52ddeb]" />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                            <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                            <span>+10.2%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                            {data.referralStats.totalReferralCount}
                          </p>
                          <p className="text-sm text-zinc-500 font-mono">{t('admin.referrals')}</p>
                          <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.totalInvitesSent')}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                            <UserPlus className="h-6 w-6 text-[#52ddeb]" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                            {data.referralStats.totalReferredUsers}
                          </p>
                          <p className="text-sm text-zinc-500 font-mono">{t('admin.referredUsers')}</p>
                          <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.newAccountsViaInvite')}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                            <Link2 className="h-6 w-6 text-[#52ddeb]" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                            {data.referralStats.usersWithReferralCode}
                          </p>
                          <p className="text-sm text-zinc-500 font-mono">{t('admin.activeLinks')}</p>
                          <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.referralCodesInUse')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {data.generationStats && (
                <TabsContent value="generations" className="space-y-6">
                  {/* Model Usage Chart */}
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-zinc-300">{t('admin.generationsByModel')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                          <BarChart accessibilityLayer data={modelUsageData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#333" />
                            <XAxis
                              dataKey="model"
                              tickLine={false}
                              tickMargin={10}
                              axisLine={false}
                              tickFormatter={(value) => value.slice(0, 10)}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="count" radius={8}>
                              {modelUsageData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* By Feature - Grid */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-zinc-300 font-mono">{t('admin.byFeature')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      {(['mockupmachine', 'canvas', 'brandingmachine'] as const).map((feature) => {
                        const stats = data.generationStats.byFeature[feature];
                        return (
                          <Card key={feature} className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                                  {feature === 'mockupmachine' ? <Image className="h-6 w-6 text-[#52ddeb]" /> :
                                    feature === 'brandingmachine' ? <Type className="h-6 w-6 text-[#52ddeb]" /> :
                                      <Palette className="h-6 w-6 text-[#52ddeb]" />}
                                </div>
                              </div>
                              <div className="mb-4">
                                <p className="text-sm font-semibold text-[#52ddeb] font-mono mb-3 uppercase">{feature}</p>
                                <div className="space-y-2 text-xs font-mono">
                                  <p className="text-zinc-300">{t('admin.images')}: <span className="text-[#52ddeb] font-bold">{stats.images}</span></p>
                                  <p className="text-zinc-300">{t('admin.videos')}: <span className="text-[#52ddeb] font-bold">{stats.videos}</span></p>
                                  <p className="text-zinc-300">{t('admin.textSteps')}: <span className="text-[#52ddeb] font-bold">{stats.textSteps}</span></p>
                                  <p className="text-zinc-300">{t('admin.promptsGenerated')}: <span className="text-[#52ddeb] font-bold">{stats.promptGenerations}</span></p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed Breakdowns Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Images by Model */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-zinc-300 font-mono">{t('admin.imagesByModel')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(data.generationStats.imagesByModel).map(([model, stats]) => (
                          <Card key={model} className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 transition-all duration-300 shadow-lg">
                            <CardContent className="p-4">
                              <p className="text-xs font-semibold text-[#52ddeb] font-mono mb-2 truncate" title={model}>{model}</p>
                              <p className="text-2xl font-bold text-zinc-300 font-mono">{stats.total}</p>
                              {Object.keys(stats.byResolution).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-zinc-800/50 flex flex-wrap gap-1">
                                  {Object.entries(stats.byResolution).map(([resolution, count]) => (
                                    <Badge key={resolution} variant="outline" className="text-[10px] px-1 py-0 h-5 bg-black/40 border-zinc-700/50">
                                      {resolution}: {count}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Videos by Model */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-zinc-300 font-mono">{t('admin.videosByModel')}</h3>
                      <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 transition-all duration-300 shadow-lg">
                        <CardContent className="p-6">
                          <div className="mb-4">
                            <p className="text-3xl font-bold text-zinc-300 font-mono mb-2">{data.generationStats.videos.total}</p>
                            <p className="text-sm text-zinc-500 font-mono">{t('admin.totalVideos')}</p>
                          </div>
                          {Object.keys(data.generationStats.videos.byModel).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                              <p className="text-xs text-zinc-500 font-mono mb-2 uppercase">{t('admin.byModel')}:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(data.generationStats.videos.byModel).map(([model, count]) => (
                                  <Badge key={model} variant="outline" className="text-xs bg-black/40 border-zinc-700/50">
                                    {model}: {count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Text Tokens Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-zinc-300 font-mono">{t('admin.textProcessing')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {/* Branding Tokens */}
                      <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl col-span-2 md:col-span-2 lg:col-span-1">
                        <CardContent className="p-4">
                          <p className="text-xs text-zinc-500 font-mono mb-1">{t('admin.brandingSteps')}</p>
                          <p className="text-xl font-bold text-zinc-300 font-mono">{data.generationStats.textTokens.totalSteps}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                        <CardContent className="p-4">
                          <p className="text-xs text-zinc-500 font-mono mb-1">{t('admin.inputTokens')}</p>
                          <p className="text-xl font-bold text-[#52ddeb] font-mono">{data.generationStats.textTokens.inputTokens.toLocaleString()}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                        <CardContent className="p-4">
                          <p className="text-xs text-zinc-500 font-mono mb-1">{t('admin.outputTokens')}</p>
                          <p className="text-xl font-bold text-[#52ddeb] font-mono">{data.generationStats.textTokens.outputTokens.toLocaleString()}</p>
                        </CardContent>
                      </Card>

                      {/* Prompt Gen Tokens */}
                      <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl col-span-2 md:col-span-2 lg:col-span-1">
                        <CardContent className="p-4">
                          <p className="text-xs text-zinc-500 font-mono mb-1">{t('admin.promptGenTotal')}</p>
                          <p className="text-xl font-bold text-zinc-300 font-mono">{data.generationStats.byFeature['prompt-generation'].total}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                        <CardContent className="p-4">
                          <p className="text-xs text-zinc-500 font-mono mb-1">{t('admin.promptInput')}</p>
                          <p className="text-xl font-bold text-[#52ddeb] font-mono">{data.generationStats.byFeature['prompt-generation'].inputTokens.toLocaleString()}</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="users" className="space-y-6">
                {/* Summary Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Users className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                          {data.users.length}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.totalUsers')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.registeredInSystem')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {data.users.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing').length}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.activeSubscriptions')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.usersWithActivePlan')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {totals.monthlyCredits + totals.manualCredits}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.creditsDistributed')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.totalCreditsAssigned')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Image className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {data.users.reduce((sum, u) => sum + (u.mockupCount || 0), 0)}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">{t('admin.mockupsCreated')}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{t('admin.totalMockupsGenerated')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Search Card */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 transition-all duration-300 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3 text-zinc-300 font-mono mb-2">
                          <Search className="h-5 w-5 text-[#52ddeb]" />
                          {t('admin.searchUsers')}
                        </CardTitle>
                        <CardDescription className="text-zinc-500 font-mono">
                          {searchQuery
                            ? t('admin.usersFound', { found: filteredAndSortedUsers.length, total: data.users.length })
                            : t('admin.usersRegistered', { count: data.users.length })}
                        </CardDescription>
                      </div>
                      <div className="relative w-full md:w-auto md:min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                          type="text"
                          placeholder={t('admin.searchPlaceholder')}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-black/40 border-zinc-800/50 text-zinc-300 placeholder:text-zinc-500"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Table Card */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 transition-all duration-300 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-zinc-300 font-mono">
                      <Users className="h-5 w-5 text-[#52ddeb]" />
                      {t('admin.userList')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800/50 hover:bg-transparent">
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('name')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.user')}
                              {sortField === 'name' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('subscriptionTier')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.subscription')}
                              {sortField === 'subscriptionTier' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('creditsRemaining')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.credits')}
                              {sortField === 'creditsRemaining' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('referralCount')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.referrals')}
                              {sortField === 'referralCount' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('mockupCount')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              Mockups
                              {sortField === 'mockupCount' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('transactionCount')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.transactions')}
                              {sortField === 'transactionCount' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('totalSpentBRL')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.spent')}
                              {sortField === 'totalSpentBRL' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('apiCostUSD')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.apiCostColumn')}
                              {sortField === 'apiCostUSD' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('createdAt')}
                              className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                            >
                              {t('admin.createdAt')}
                              {sortField === 'createdAt' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-zinc-500 font-mono py-8">
                              {t('admin.noUserFound')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAndSortedUsers.map((user) => (
                            <TableRow key={user.id} className="border-zinc-800/30 text-zinc-300 hover:bg-black/20 transition-colors">
                              <TableCell className="px-4 py-4">
                                <p className="font-medium text-zinc-200">{user.name || t('admin.noName')}</p>
                                <p className="text-xs text-zinc-500 font-mono">{user.email}</p>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <Badge variant="outline" className="bg-[#52ddeb]/10 text-[#52ddeb] border-[#52ddeb]/30 font-mono mb-1">
                                  {user.subscriptionTier}
                                </Badge>
                                <p className="text-xs text-zinc-500 font-mono mt-1">{user.subscriptionStatus}</p>
                              </TableCell>
                              <TableCell className="px-4 py-4 text-xs font-mono space-y-1">
                                <p>{t('admin.monthly')}: {user.monthlyCredits ?? 0}</p>
                                <p>{t('admin.used')}: {user.creditsUsed ?? 0}</p>
                                <p className="text-[#52ddeb]">{t('admin.remaining')}: {user.creditsRemaining}</p>
                                <p>{t('admin.manual')}: {user.manualCredits}</p>
                              </TableCell>
                              <TableCell className="px-4 py-4 text-xs font-mono space-y-1">
                                <p>{t('admin.made')}: {user.referralCount ?? 0}</p>
                                <p>{t('admin.code')}: {user.referralCode || '—'}</p>
                                <p className="text-[11px] text-zinc-500">
                                  {user.referredBy
                                    ? `${t('admin.referredBy')}: ${userLookup[user.referredBy]?.name || userLookup[user.referredBy]?.email || t('admin.unknown')}`
                                    : t('admin.directOrigin')}
                                </p>
                              </TableCell>
                              <TableCell className="px-4 py-4 font-mono">{user.mockupCount}</TableCell>
                              <TableCell className="px-4 py-4 font-mono">{user.transactionCount}</TableCell>
                              <TableCell className="px-4 py-4 text-xs font-mono space-y-1">
                                {user.totalSpentBRL > 0 && (
                                  <p className="text-green-500">{formatCurrency(user.totalSpentBRL, 'BRL')}</p>
                                )}
                                {user.totalSpentUSD > 0 && (
                                  <p className="text-green-400">{formatCurrency(user.totalSpentUSD, 'USD')}</p>
                                )}
                                {user.totalSpentBRL === 0 && user.totalSpentUSD === 0 && (
                                  <p className="text-zinc-500">—</p>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-4 text-xs font-mono">
                                {user.apiCostUSD > 0 ? (
                                  <>
                                    <p className="text-orange-500">{user.apiCostUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}</p>
                                    <p className="text-orange-400/60 text-[10px]">{(user.apiCostUSD * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                  </>
                                ) : (
                                  <p className="text-zinc-500">—</p>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-4 text-xs font-mono text-zinc-400">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminPage;

