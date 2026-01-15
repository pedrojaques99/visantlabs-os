import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, Users, Settings, ChevronUp, ChevronDown, Search, TrendingUp, TrendingDown, User, Image, CreditCard, HardDrive, UserPlus, Link2, Database, DollarSign, Palette, Type, ShoppingCart, History, RotateCcw, X } from 'lucide-react';
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
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { SEO } from '../components/SEO';

import { DataTable } from '../components/ui/data-table';
import { DataTableEditableCell } from '../components/ui/data-table-editable-cell';
import { ColumnDef } from '@tanstack/react-table';
import { getImagePricing } from '@/utils/pricing';
import { cn } from '@/lib/utils';

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
  totalGenerations?: number; // Total images generated (from User model)
  totalTokensUsed?: number;  // Total tokens used (from User model)
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
    totalCost?: number;
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
    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
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
        <Card key={i} className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
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
    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
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
    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
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
        <Card key={i} className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
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
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Usage History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });

  const fetchUserHistory = async (userId: string, offset = 0) => {
    const token = authService.getToken();
    if (!token) return;

    setIsHistoryLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/history?limit=50&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch history');
      const result = await response.json();

      if (offset === 0) {
        setHistoryRecords(result.records);
      } else {
        setHistoryRecords(prev => [...prev, ...result.records]);
      }
      setHistoryPagination(result.pagination);
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Failed to load usage history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleViewHistory = (user: AdminUser) => {
    setSelectedUser(user);
    setIsHistoryModalOpen(true);
    setHistoryRecords([]);
    fetchUserHistory(user.id, 0);
  };

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

  const handleSaveUser = async (user: AdminUser, field: string, value: string) => {
    // Optimistic check
    if ((user as any)[field] === value) return;

    const token = authService.getToken();
    if (!token) {
      toast.error(t('admin.authRequired') || 'Authentication required');
      return;
    }

    try {
      // Assuming generic update endpoint /api/admin/users/:id
      // We might need to send the whole object or just the patch.
      // Based on typical patterns, let's try sending the updated field in a body.
      // If the backend expects a specific structure, we might need to adjust.
      // For now, mimicking the preset logic but for users.

      const body = {
        ...user,
        [field]: value
      };

      const response = await fetch(`${ADMIN_API}/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(t('admin.saveError') || 'Failed to update user');
      }

      toast.success(t('admin.saveSuccess') || 'User updated successfully');

      // Update local state to avoid full refetch if preferred, or just refetch
      // For simplicity/consistency, let's refetch or update the specific row in data
      // Refetching is safer to ensure sync
      handleFetch();

    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(t('admin.saveError') || 'Failed to update user');
    }
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

  const totalTransactions = useMemo(() => {
    if (!data) return 0;
    return data.users.reduce((sum, user) => sum + (user.transactionCount || 0), 0);
  }, [data]);

  const totalEstimatedCost = useMemo(() => {
    if (!data?.generationStats?.imagesByModel) return 0;

    let cost = 0;
    const stats = data.generationStats.imagesByModel;

    // Calculate Gemini 2.5 Flash cost
    if (stats['gemini-2.5-flash-image']) {
      const price = getImagePricing('gemini-2.5-flash-image');
      cost += stats['gemini-2.5-flash-image'].total * price;
    }

    // Calculate Gemini 3 Pro cost
    if (stats['gemini-3-pro-image-preview']) {
      const resolutions = stats['gemini-3-pro-image-preview'].byResolution;

      Object.entries(resolutions).forEach(([res, count]) => {
        // Normalize resolution string to 1K, 2K, or 4K
        let normalizedRes: string | undefined = undefined;
        const resLower = res.toLowerCase();
        if (resLower.includes('1k') || resLower === '1k') {
          normalizedRes = '1K';
        } else if (resLower.includes('2k') || resLower === '2k') {
          normalizedRes = '2K';
        } else if (resLower.includes('4k') || resLower === '4k' || resLower.includes('4096')) {
          normalizedRes = '4K';
        }

        const price = getImagePricing('gemini-3-pro-image-preview', normalizedRes);
        cost += count * price;
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
      fill: "#52ddeb"
    }));

    const videoStats = data.generationStats.videos ? Object.entries(data.generationStats.videos.byModel).map(([model, count]) => ({
      model: model,
      count: count,
      type: 'Vídeo',
      fill: "#52ddeb"
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

  // Daily Cost Stats
  const dailyCostStats = useMemo(() => {
    if (!data?.costTimeSeries || data.costTimeSeries.length === 0) {
      return {
        averageCost: 0,
        maxCost: 0,
        last7DaysCost: 0,
        last30DaysCost: 0,
      };
    }

    const costs = data.costTimeSeries.map(item => item.cost);
    const averageCost = costs.reduce((a, b) => a + b, 0) / costs.length;
    const maxCost = Math.max(...costs, 0);
    const last7Days = data.costTimeSeries.slice(-7);
    const last7DaysCost = last7Days.reduce((sum, item) => sum + item.cost, 0);
    const last30Days = data.costTimeSeries.slice(-30);
    const last30DaysCost = last30Days.reduce((sum, item) => sum + item.cost, 0);

    return {
      averageCost,
      maxCost,
      last7DaysCost,
      last30DaysCost,
    };
  }, [data]);

  // Profit Calculation
  const profitStats = useMemo(() => {
    if (!data) {
      return {
        profitUSD: 0,
        profitBRL: 0,
        isPositive: true,
      };
    }

    // Revenue is in cents, convert to dollars/reais
    const revenueUSD = data.totalRevenueUSD / 100;
    const revenueBRL = data.totalRevenueBRL / 100;

    // If USD revenue is 0 but BRL revenue exists, convert BRL to USD (approximate rate: 1 USD = 6 BRL)
    const effectiveRevenueUSD = revenueUSD > 0 ? revenueUSD : revenueBRL / 6;

    const costUSD = data.totalApiCostUSD;
    const profitUSD = effectiveRevenueUSD - costUSD;

    // Calculate profit in BRL: use BRL revenue directly, or convert USD profit
    const profitBRL = revenueBRL - (costUSD * 6);

    return {
      profitUSD,
      profitBRL,
      isPositive: profitUSD >= 0,
    };
  }, [data]);

  const columns = useMemo<ColumnDef<AdminUser>[]>(() => [
    {
      accessorKey: 'name',
      header: t('admin.user'),
      cell: ({ row }) => (
        <DataTableEditableCell
          row={row}
          field="name"
          className="font-medium text-neutral-200"
          placeholder={t('admin.noName')}
          onSave={handleSaveUser}
        />
      ),
      size: 150,
      enableSorting: true,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="text-xs text-neutral-500 font-mono select-all">{row.original.email}</span>,
      size: 200,
      enableSorting: true,
    },
    {
      accessorKey: 'subscriptionTier',
      header: t('admin.subscription'),
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/30 font-mono w-fit">
          {row.original.subscriptionTier}
        </Badge>
      ),
      size: 120,
      enableSorting: true,
    },
    {
      accessorKey: 'subscriptionStatus',
      header: 'Status',
      cell: ({ row }) => <span className="text-xs text-neutral-500 font-mono capitalize">{row.original.subscriptionStatus}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'monthlyCredits',
      header: t('admin.monthly'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.monthlyCredits ?? 0}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'creditsUsed',
      header: t('admin.used'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.creditsUsed ?? 0}</span>,
      size: 80,
      enableSorting: true,
    },
    {
      accessorKey: 'creditsRemaining',
      header: t('admin.remaining'),
      cell: ({ row }) => <span className="text-xs font-mono text-brand-cyan">{row.original.creditsRemaining}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'manualCredits',
      header: t('admin.manual'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.manualCredits}</span>,
      size: 80,
      enableSorting: true,
    },
    {
      accessorKey: 'referralCount',
      header: t('admin.referrals'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.referralCount ?? 0}</span>,
      size: 80,
      enableSorting: true,
    },
    {
      accessorKey: 'referralCode',
      header: t('admin.code'),
      cell: ({ row }) => <span className="text-xs font-mono select-all">{row.original.referralCode || '—'}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      id: 'referredBy',
      accessorKey: 'referredBy',
      header: t('admin.referredBy'),
      cell: ({ row }) => (
        <span className="text-[11px] text-neutral-500 truncate max-w-[150px] inline-block" title={row.original.referredBy || ''}>
          {row.original.referredBy
            ? (userLookup[row.original.referredBy]?.name || userLookup[row.original.referredBy]?.email || t('admin.unknown'))
            : t('admin.directOrigin')}
        </span>
      ),
      size: 150,
      enableSorting: true,
    },
    {
      accessorKey: 'mockupCount',
      header: 'Mockups',
      cell: ({ row }) => <span className="font-mono">{row.original.mockupCount}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'transactionCount',
      header: t('admin.transactions'),
      cell: ({ row }) => <span className="font-mono">{row.original.transactionCount}</span>,
      size: 120,
      enableSorting: true,
    },
    {
      accessorKey: 'totalSpentBRL',
      header: 'BRL',
      cell: ({ row }) => (
        <span className={cn("text-xs font-mono", row.original.totalSpentBRL > 0 ? "text-green-500" : "text-neutral-500")}>
          {row.original.totalSpentBRL > 0 ? formatCurrency(row.original.totalSpentBRL, 'BRL') : '—'}
        </span>
      ),
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'totalSpentUSD',
      header: 'USD',
      cell: ({ row }) => (
        <span className={cn("text-xs font-mono", row.original.totalSpentUSD > 0 ? "text-green-400" : "text-neutral-500")}>
          {row.original.totalSpentUSD > 0 ? formatCurrency(row.original.totalSpentUSD, 'USD') : '—'}
        </span>
      ),
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'apiCostUSD',
      header: t('admin.apiCostColumn'),
      cell: ({ row }) => (
        <div className="text-xs font-mono">
          {row.original.apiCostUSD > 0 ? (
            <>
              <p className="text-neutral-300">$ {row.original.apiCostUSD.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-neutral-400 text-[10px]">{(row.original.apiCostUSD * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </>
          ) : (
            <p className="text-neutral-500">—</p>
          )}
        </div>
      ),
      size: 130,
      enableSorting: true,
    },
    {
      accessorKey: 'createdAt',
      header: t('admin.createdAt'),
      cell: ({ row }) => <span className="text-xs font-mono text-neutral-400 text-center block">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
      size: 120,
      enableSorting: true,
    },
    {
      accessorKey: 'totalGenerations',
      header: 'Imagens',
      cell: ({ row }) => <span className="font-mono text-brand-cyan text-center block">{row.original.totalGenerations ?? 0}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: 'totalTokensUsed',
      header: 'Tokens',
      cell: ({ row }) => <span className="text-[10px] font-mono text-neutral-400 text-center block">{(row.original.totalTokensUsed ?? 0).toLocaleString()}</span>,
      size: 100,
      enableSorting: true,
    },
    {
      id: 'actions',
      header: 'Histórico',
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-neutral-800 hover:bg-neutral-800 text-[10px] font-mono"
            onClick={() => handleViewHistory(row.original)}
          >
            <History className="h-3 w-3 mr-1" />
            LOG
          </Button>
        </div>
      ),
      size: 100,
    },
  ], [t, userLookup, handleViewHistory]);

  return (
    <>
      <SEO
        title={t('admin.title')}
        description={t('admin.description')}
        noindex={true}
      />
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
          {/* Skeleton Loading States */}
          {(isCheckingAuth || (isUserAuthenticated && isAdmin === null) || (!isCheckingAuth && isUserAuthenticated && isAdmin === true && isLoading && !data)) && (
            <AdminDashboardSkeleton />
          )}

          {/* Access Denied States */}
          {!isCheckingAuth && !isAuthenticated && !isLoading && (
            <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl max-w-md mx-auto">
              <CardContent className="p-6 md:p-8 space-y-4 text-center">
                {isUserAuthenticated === false ? (
                  <>
                    <p className="text-neutral-400 font-mono mb-4">
                      {t('admin.loginRequired')}
                    </p>
                    <Button
                      onClick={() => navigate('/')}
                      className="bg-brand-cyan/80 hover:bg-brand-cyan text-black"
                    >
                      {t('admin.doLogin')}
                    </Button>
                  </>
                ) : isAdmin === false ? (
                  <>
                    <p className="text-neutral-400 font-mono mb-4">
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
            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                if (val === 'presets') {
                  navigate('/admin/presets');
                } else if (val === 'products') {
                  navigate('/admin/products');
                } else if (val === 'design-system') {
                  navigate('/design-system');
                } else {
                  setActiveTab(val);
                }
              }}
              className="space-y-6"
            >
              {/* Unified Header */}
              <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl mb-6">
                <CardContent className="p-4 md:p-6">
                  {/* Breadcrumb */}
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

                  {/* Separator */}
                  <div className="border-t border-neutral-800/50 mb-4"></div>

                  {/* Icon | Title | Description */}
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
                    <div>
                      <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-neutral-300">
                        {t('admin.panelTitle')}
                      </h1>
                      <p className="text-neutral-500 font-mono text-xs md:text-sm">
                        {t('admin.panelSubtitle')}
                      </p>
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-neutral-800/50 mb-4"></div>

                  {/* Navbar abas | Botão atualizar (somente icon) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4">
                    <TabsList className="bg-neutral-900/50 border border-neutral-800/50 p-1 h-auto flex-wrap">
                      <TabsTrigger value="overview" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                        {t('admin.dashboard')}
                      </TabsTrigger>
                      {data.generationStats && (
                        <TabsTrigger value="generations" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                          {t('admin.generations')}
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="users" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                        {t('admin.users')}
                      </TabsTrigger>
                      <TabsTrigger value="financial" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                        {t('admin.financial')}
                      </TabsTrigger>
                      <TabsTrigger value="presets" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                        <Settings className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                        {t('admin.presets')}
                      </TabsTrigger>
                      <TabsTrigger value="products" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                        <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                        {t('admin.products') || 'Produtos'}
                      </TabsTrigger>
                      <TabsTrigger value="design-system" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/30 transition-all py-1.5 px-3 text-xs md:text-sm">
                        <Palette className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                        {t('admin.designSystem')}
                      </TabsTrigger>
                    </TabsList>

                    <Button
                      onClick={handleRefresh}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="flex items-center justify-center border-neutral-800/50 hover:bg-neutral-800/50 h-9 w-9 p-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <TabsContent value="overview" className={`space-y-6 ${activeTab === 'overview' ? 'admin-tab-enter' : ''}`}>

                {/* KPI Grid - Top Level Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {/* Total Users */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <User className="h-6 w-6 text-brand-cyan" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-neutral-500 font-mono">
                          <TrendingUp className="h-3 w-3 text-brand-cyan" />
                          <span>+12.5%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-neutral-300 mb-2 font-mono">
                          {data.totalUsers}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.totalUsers')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.registeredInSystem')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Subscriptions */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {data.users.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing').length}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.activeSubscriptions')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.recurringPlans')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Transactions */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <ShoppingCart className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-neutral-300 mb-2 font-mono">
                          {totalTransactions}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.transactions')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.completedTransactions')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* New Users (Last 30 Days) */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <UserPlus className="h-6 w-6 text-brand-cyan" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-neutral-500 font-mono">
                          <TrendingUp className="h-3 w-3 text-brand-cyan" />
                          <span>30d</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-neutral-300 mb-2 font-mono">
                          {data.users.filter(u => {
                            const createdAt = new Date(u.createdAt);
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return createdAt >= thirtyDaysAgo;
                          }).length}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">Novos Usuários</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">Últimos 30 dias</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Total Mockups */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <Image className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {data.totalMockupsGenerated}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.mockupsCreated')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.totalMockupsGenerated')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Credits Used */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {data.totalCreditsUsed}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.creditsDistributed')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.totalCreditsAssigned')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Storage Used */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <HardDrive className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {data.totalStorageUsed !== undefined ? formatBytes(data.totalStorageUsed) : '—'}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.storage')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.totalDiskUsage')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* User Growth Chart */}
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-neutral-300">{t('admin.userGrowth')}</CardTitle>
                    <CardDescription className="text-neutral-500">{t('admin.newUsersLast30Days')}</CardDescription>
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
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#3b3b3bff" />
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
                            fillOpacity={0.05}
                            stroke="#64f2ffff"
                            stackId="a"
                          />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

              </TabsContent>

              {data.generationStats && (
                <TabsContent value="generations" className={`space-y-6 ${activeTab === 'generations' ? 'admin-tab-enter' : ''}`}>
                  {/* Summary KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <Image className="h-6 w-6 text-brand-cyan" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                            {Object.values(data.generationStats.imagesByModel).reduce((sum, stats) => sum + stats.total, 0)}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">{t('admin.images')}</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">Total gerado</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <Image className="h-6 w-6 text-brand-cyan" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                            {data.generationStats.videos.total}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">{t('admin.videos')}</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">Total gerado</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <Type className="h-6 w-6 text-brand-cyan" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                            {data.generationStats.textTokens.totalSteps}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">Passos de Texto</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">Processamento de IA</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <Type className="h-6 w-6 text-brand-cyan" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                            {(data.generationStats.textTokens.inputTokens + data.generationStats.textTokens.outputTokens).toLocaleString()}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">Total Tokens</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">Input + Output</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* By Feature - Enhanced Grid */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-neutral-300 font-mono">{t('admin.byFeature')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      {(['mockupmachine', 'canvas', 'brandingmachine'] as const).map((feature) => {
                        const stats = data.generationStats.byFeature[feature];
                        const total = stats.images + stats.videos + stats.textSteps + stats.promptGenerations;
                        return (
                          <Card key={feature} className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-brand-cyan/10 rounded-lg">
                                  {feature === 'mockupmachine' ? <Image className="h-6 w-6 text-brand-cyan" /> :
                                    feature === 'brandingmachine' ? <Type className="h-6 w-6 text-brand-cyan" /> :
                                      <Palette className="h-6 w-6 text-brand-cyan" />}
                                </div>
                                <Badge variant="outline" className="text-[10px] bg-black/40 border-[brand-cyan]/30 text-brand-cyan">
                                  {total} total
                                </Badge>
                              </div>
                              <div className="mb-4">
                                <p className="text-sm font-semibold text-brand-cyan font-mono mb-4 uppercase">{feature}</p>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-neutral-400 font-mono">{t('admin.images')}</span>
                                    <span className="text-sm font-bold text-brand-cyan font-mono">{stats.images}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-neutral-400 font-mono">{t('admin.videos')}</span>
                                    <span className="text-sm font-bold text-brand-cyan font-mono">{stats.videos}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-neutral-400 font-mono">{t('admin.textSteps')}</span>
                                    <span className="text-sm font-bold text-brand-cyan font-mono">{stats.textSteps}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-neutral-400 font-mono">{t('admin.promptsGenerated')}</span>
                                    <span className="text-sm font-bold text-brand-cyan font-mono">{stats.promptGenerations}</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Model Usage Chart */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="text-neutral-300 flex items-center gap-2">
                        <Image className="h-5 w-5 text-brand-cyan" />
                        {t('admin.generationsByModel')}
                      </CardTitle>
                      <CardDescription className="text-neutral-500">
                        Distribuição de gerações por modelo de IA
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[350px] w-full">
                        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                          <BarChart accessibilityLayer data={modelUsageData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#333" />
                            <XAxis
                              dataKey="model"
                              tickLine={false}
                              tickMargin={10}
                              axisLine={false}
                              tickFormatter={(value) => value.slice(0, 15)}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                              {modelUsageData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detailed Breakdowns Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Images by Model */}
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-neutral-300 flex items-center gap-2">
                          <Image className="h-5 w-5 text-brand-cyan" />
                          {t('admin.imagesByModel')}
                        </CardTitle>
                        <CardDescription className="text-neutral-500">
                          Detalhamento por modelo e resolução
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Object.entries(data.generationStats.imagesByModel).map(([model, stats]) => (
                            <Card key={model} className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                              <CardContent className="p-4">
                                <p className="text-xs font-semibold text-brand-cyan font-mono mb-2 truncate" title={model}>{model}</p>
                                <p className="text-2xl font-bold text-neutral-300 font-mono mb-3">{stats.total}</p>
                                {Object.keys(stats.byResolution).length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-neutral-800/50">
                                    <p className="text-[10px] text-neutral-500 font-mono mb-2 uppercase">Resoluções:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(stats.byResolution).map(([resolution, count]) => (
                                        <Badge key={resolution} variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-black/40 border-neutral-700/50 text-neutral-400">
                                          {resolution}: {count}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Videos by Model */}
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-neutral-300 flex items-center gap-2">
                          <Image className="h-5 w-5 text-brand-cyan" />
                          {t('admin.videosByModel')}
                        </CardTitle>
                        <CardDescription className="text-neutral-500">
                          Detalhamento por modelo
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4">
                          <p className="text-3xl font-bold text-neutral-300 font-mono mb-2">{data.generationStats.videos.total}</p>
                          <p className="text-sm text-neutral-500 font-mono">{t('admin.totalVideos')}</p>
                        </div>
                        {Object.keys(data.generationStats.videos.byModel).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-neutral-800/50">
                            <p className="text-xs text-neutral-500 font-mono mb-3 uppercase">{t('admin.byModel')}:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(data.generationStats.videos.byModel).map(([model, count]) => (
                                <Badge key={model} variant="outline" className="text-xs bg-black/10 border-neutral-700/50 text-neutral-300 px-3 py-1">
                                  {model}: {count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Text Tokens Section */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="text-neutral-300 flex items-center gap-2">
                        <Type className="h-5 w-5 text-brand-cyan" />
                        {t('admin.textProcessing')}
                      </CardTitle>
                      <CardDescription className="text-neutral-500">
                        Estatísticas de processamento de texto e tokens
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Branding Steps */}
                        <Card className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                          <CardContent className="p-4">
                            <p className="text-xs text-neutral-500 font-mono mb-2">{t('admin.brandingSteps')}</p>
                            <p className="text-2xl font-bold text-neutral-300 font-mono">{data.generationStats.textTokens.totalSteps}</p>
                          </CardContent>
                        </Card>

                        {/* Input Tokens */}
                        <Card className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                          <CardContent className="p-4">
                            <p className="text-xs text-neutral-500 font-mono mb-2">{t('admin.inputTokens')}</p>
                            <p className="text-2xl font-bold text-brand-cyan font-mono">{data.generationStats.textTokens.inputTokens.toLocaleString()}</p>
                          </CardContent>
                        </Card>

                        {/* Output Tokens */}
                        <Card className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                          <CardContent className="p-4">
                            <p className="text-xs text-neutral-500 font-mono mb-2">{t('admin.outputTokens')}</p>
                            <p className="text-2xl font-bold text-brand-cyan font-mono">{data.generationStats.textTokens.outputTokens.toLocaleString()}</p>
                          </CardContent>
                        </Card>

                        {/* Analysis Cost */}
                        <Card className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                          <CardContent className="p-4">
                            <p className="text-xs text-neutral-500 font-mono mb-2">{t('admin.analysisCost')}</p>
                            <p className="text-2xl font-bold text-green-400 font-mono">
                              ${(data.generationStats.textTokens.totalCost || 0).toFixed(4)}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Prompt Gen Total */}
                        <Card className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                          <CardContent className="p-4">
                            <p className="text-xs text-neutral-500 font-mono mb-2">{t('admin.promptGenTotal')}</p>
                            <p className="text-2xl font-bold text-neutral-300 font-mono">{data.generationStats.byFeature['prompt-generation'].total}</p>
                          </CardContent>
                        </Card>

                        {/* Prompt Input Tokens */}
                        <Card className="bg-neutral-900/50 border border-neutral-800/30 rounded-lg hover:border-[brand-cyan]/20 transition-all">
                          <CardContent className="p-4">
                            <p className="text-xs text-neutral-500 font-mono mb-2">{t('admin.promptInput')}</p>
                            <p className="text-2xl font-bold text-brand-cyan font-mono">{data.generationStats.byFeature['prompt-generation'].inputTokens.toLocaleString()}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="users" className={`space-y-6 ${activeTab === 'users' ? 'admin-tab-enter' : ''}`}>
                {/* Summary Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <Users className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-neutral-300 mb-2 font-mono">
                          {data.users.length}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.totalUsers')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.registeredInSystem')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {data.users.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing').length}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.activeSubscriptions')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.usersWithActivePlan')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {totals.monthlyCredits + totals.manualCredits}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.creditsDistributed')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.totalCreditsAssigned')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-cyan/10 rounded-lg">
                          <Image className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {data.users.reduce((sum, u) => sum + (u.mockupCount || 0), 0)}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.mockupsCreated')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.totalMockupsGenerated')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Referral Stats */}
                {data.referralStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <Link2 className="h-6 w-6 text-brand-cyan" />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-neutral-500 font-mono">
                            <TrendingUp className="h-3 w-3 text-brand-cyan" />
                            <span>+10.2%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                            {data.referralStats.totalReferralCount}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">{t('admin.referrals')}</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.totalInvitesSent')}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <UserPlus className="h-6 w-6 text-brand-cyan" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-neutral-300 mb-2 font-mono">
                            {data.referralStats.totalReferredUsers}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">{t('admin.referredUsers')}</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.newAccountsViaInvite')}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-brand-cyan/10 rounded-lg">
                            <Link2 className="h-6 w-6 text-brand-cyan" />
                          </div>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-neutral-300 mb-2 font-mono">
                            {data.referralStats.usersWithReferralCode}
                          </p>
                          <p className="text-sm text-neutral-500 font-mono">{t('admin.activeLinks')}</p>
                          <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.referralCodesInUse')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Table Card */}
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-[brand-cyan]/30 transition-all duration-300 shadow-lg">
                  <CardContent className="p-6">
                    <DataTable
                      columns={columns}
                      data={data.users}
                      searchKey="name"
                      searchPlaceholder={t('admin.searchPlaceholder')}
                      title={t('admin.userList')}
                      icon={<Users className="h-5 w-5 text-brand-cyan" />}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financial Tab */}
              <TabsContent value="financial" className={`space-y-6 ${activeTab === 'financial' ? 'admin-tab-enter' : ''}`}>
                {/* Financial Overview - Revenue, Cost, Profit */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  {/* Revenue Total Card */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-green-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl ring-1 ring-green-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                          <DollarSign className="h-6 w-6 text-green-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-green-500 mb-1 font-mono">
                          {formatCurrency(data.totalRevenueBRL, 'BRL')}
                        </p>
                        <p className="text-sm font-semibold text-green-400 mb-2 font-mono">
                          {formatCurrency(data.totalRevenueUSD, 'USD')}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.totalRevenue')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.completedTransactions')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Cost Card */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-orange-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-orange-500/10 rounded-lg">
                          <Database className="h-6 w-6 text-orange-500" />
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-black/40 border-orange-500/30 text-orange-500">
                          {t('admin.estimated')}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-orange-500 mb-1 font-mono">
                          {(data.totalApiCostUSD * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-sm font-semibold text-orange-400 mb-2 font-mono">
                          $ {data.totalApiCostUSD.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.estimatedCost')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.basedOnUsage')}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Profit Card */}
                  <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl ring-1 ring-blue-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-lg ${profitStats.isPositive ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                          <TrendingUp className={`h-6 w-6 ${profitStats.isPositive ? 'text-blue-500' : 'text-red-500'}`} />
                        </div>
                        <Badge variant="outline" className={`text-[10px] bg-black/40 ${profitStats.isPositive ? 'border-blue-500/30 text-blue-500' : 'border-red-500/30 text-red-500'}`}>
                          {profitStats.isPositive ? 'POSITIVO' : 'NEGATIVO'}
                        </Badge>
                      </div>
                      <div>
                        <p className={`text-3xl font-bold mb-1 font-mono ${profitStats.isPositive ? 'text-blue-500' : 'text-red-500'}`}>
                          {profitStats.isPositive ? '+' : ''}{profitStats.profitBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className={`text-sm font-semibold mb-2 font-mono ${profitStats.isPositive ? 'text-blue-400' : 'text-red-400'}`}>
                          {profitStats.isPositive ? '+' : ''}{profitStats.profitUSD.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-neutral-500 font-mono">{t('admin.totalProfit')}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.revenueMinusCost')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue & Cost Charts Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                  {/* Revenue Chart */}
                  {data.revenueTimeSeries && data.revenueTimeSeries.length > 0 && (
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-green-500/30 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-neutral-300 flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-500" />
                          {t('admin.revenueOverTime') || 'Receita ao Longo do Tempo'}
                        </CardTitle>
                        <CardDescription className="text-neutral-500">
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
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-neutral-700/50 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-neutral-300 flex items-center gap-2">
                          <Database className="h-5 w-5 text-orange-500" />
                          {t('admin.costOverTime') || 'Custo Estimado ao Longo do Tempo'}
                        </CardTitle>
                        <CardDescription className="text-neutral-500">
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
                                        const brl = ((value as number) * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                        const usd = (value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        return [`${brl} ($ ${usd})`, 'Total'];
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

                {/* Daily Cost Stats & Chart */}
                {data.costTimeSeries && data.costTimeSeries.length > 0 && (
                  <>
                    {/* Daily Cost Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                      <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-orange-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-lg">
                              <TrendingUp className="h-6 w-6 text-orange-500" />
                            </div>
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-orange-500 mb-1 font-mono">
                              {(dailyCostStats.averageCost * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm font-semibold text-orange-400 mb-2 font-mono">
                              $ {dailyCostStats.averageCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm text-neutral-500 font-mono">{t('admin.averageDailyCost')}</p>
                            <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.dailyCost')}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-orange-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-lg">
                              <TrendingUp className="h-6 w-6 text-orange-500" />
                            </div>
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-orange-500 mb-1 font-mono">
                              {(dailyCostStats.maxCost * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm font-semibold text-orange-400 mb-2 font-mono">
                              $ {dailyCostStats.maxCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm text-neutral-500 font-mono">{t('admin.maxDailyCost')}</p>
                            <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.dailyCost')}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-orange-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-lg">
                              <Database className="h-6 w-6 text-orange-500" />
                            </div>
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-orange-500 mb-1 font-mono">
                              {(dailyCostStats.last7DaysCost * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm font-semibold text-orange-400 mb-2 font-mono">
                              $ {dailyCostStats.last7DaysCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm text-neutral-500 font-mono">{t('admin.last7DaysCost')}</p>
                            <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.dailyCost')}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-orange-500/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-lg">
                              <Database className="h-6 w-6 text-orange-500" />
                            </div>
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-orange-500 mb-1 font-mono">
                              {(dailyCostStats.last30DaysCost * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm font-semibold text-orange-400 mb-2 font-mono">
                              $ {dailyCostStats.last30DaysCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm text-neutral-500 font-mono">{t('admin.last30DaysCost')}</p>
                            <p className="text-xs text-neutral-400 font-mono mt-1">{t('admin.dailyCost')}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Daily Cost Chart */}
                    <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl hover:border-neutral-700/50 transition-all duration-300">
                      <CardHeader>
                        <CardTitle className="text-neutral-300 flex items-center gap-2">
                          <Database className="h-5 w-5 text-orange-500" />
                          {t('admin.dailyCostChart') || 'Custo Diário (USD)'}
                        </CardTitle>
                        <CardDescription className="text-neutral-500">
                          {t('admin.dailyCost') || 'Custo por dia'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                            <BarChart
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
                                    indicator="line"
                                    formatter={(value, name) => {
                                      if (name === 'cost') {
                                        const brl = ((value as number) * 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                        const usd = (value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        return [`${brl} ($ ${usd})`, t('admin.dailyCost')];
                                      }
                                      return [value, name];
                                    }}
                                  />
                                }
                              />
                              <Bar dataKey="cost" radius={[8, 8, 0, 0]} fill="#f97316" />
                            </BarChart>
                          </ChartContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Usage History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl bg-neutral-900 border-neutral-800 shadow-2xl max-h-[85vh] flex flex-col">
            <CardHeader className="border-b border-neutral-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2 text-neutral-200">
                    <History className="h-5 w-5 text-brand-cyan" />
                    Histórico de Uso
                  </CardTitle>
                  <CardDescription className="text-neutral-500 font-mono text-xs">
                    Logs de geração para {selectedUser?.name || selectedUser?.email}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="hover:bg-neutral-800 text-neutral-500"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              {isHistoryLoading && historyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <RotateCcw className="h-8 w-8 text-brand-cyan animate-spin" />
                  <p className="text-neutral-500 font-mono text-sm">Carregando registros...</p>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                  <p className="font-mono text-sm">Nenhum registro encontrado para este usuário.</p>
                </div>
              ) : (
                <div className="p-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-800 hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase font-mono text-neutral-500">Data</TableHead>
                        <TableHead className="text-[10px] uppercase font-mono text-neutral-500">Feature</TableHead>
                        <TableHead className="text-[10px] uppercase font-mono text-neutral-500">Modelo</TableHead>
                        <TableHead className="text-[10px] uppercase font-mono text-neutral-500">Tipo</TableHead>
                        <TableHead className="text-[10px] uppercase font-mono text-neutral-500">Stats</TableHead>
                        <TableHead className="text-[10px] uppercase font-mono text-neutral-500 text-right">Créditos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map((record) => (
                        <TableRow key={record.id} className="border-neutral-800/50 hover:bg-white/5">
                          <TableCell className="py-3 text-[11px] font-mono text-neutral-400">
                            {new Date(record.timestamp).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="text-[10px] bg-neutral-800/50 border-neutral-700/50 text-neutral-400 capitalize">
                              {record.feature}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-[11px] font-mono text-neutral-300">{record.model || '—'}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn(
                              "text-[10px] border-none",
                              record.imagesGenerated > 0 ? "bg-brand-cyan/20 text-brand-cyan" : "bg-purple-500/20 text-purple-400"
                            )}>
                              {record.imagesGenerated > 0 ? 'Imagem' : 'Texto/Branding'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col gap-0.5">
                              {record.imagesGenerated > 0 && (
                                <span className="text-[10px] font-mono text-neutral-300">{record.imagesGenerated} img {record.resolution && `(${record.resolution})`}</span>
                              )}
                              {(record.inputTokens > 0 || record.outputTokens > 0) && (
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {record.inputTokens + record.outputTokens} tokens
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <span className={cn(
                              "text-[11px] font-mono font-bold",
                              record.creditsDeducted > 0 ? "text-brand-cyan" : "text-neutral-600"
                            )}>
                              {record.creditsDeducted > 0 ? `-${record.creditsDeducted}` : '0'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {historyPagination.hasMore && (
                    <div className="flex justify-center mt-6 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchUserHistory(selectedUser!.id, historyPagination.offset + historyPagination.limit)}
                        disabled={isHistoryLoading}
                        className="bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700"
                      >
                        {isHistoryLoading ? (
                          <RotateCcw className="h-3 w-3 mr-2 animate-spin" />
                        ) : null}
                        Carregar mais
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-neutral-800 py-3 bg-black/20 flex justify-between text-[10px] font-mono text-neutral-500">
              <span>Total de registros: {historyPagination.total}</span>
              <span>Todos os tipos de geração incluídos</span>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
};

export default AdminPage;

