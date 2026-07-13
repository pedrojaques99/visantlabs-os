import { authService } from './authService';
import { API_BASE } from '@/config/api';

// ---------------------------------------------------------------------------
// Admin dashboard types (single source of truth — imported by AdminPage and
// the useAdminDashboard query hooks).
// ---------------------------------------------------------------------------

export interface AdminUser {
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
  totalGenerations?: number;
  totalTokensUsed?: number;
  byok?: { gemini: boolean; seedream: boolean; openai: boolean };
}

export interface GenerationStats {
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
    brandingmachine: {
      images: number;
      videos: number;
      textSteps: number;
      promptGenerations: number;
    };
    'prompt-generation': { total: number; inputTokens: number; outputTokens: number };
  };
}

export interface RevenueTimeSeriesItem {
  date: string;
  revenueBRL: number;
  revenueUSD: number;
  cumulativeBRL: number;
  cumulativeUSD: number;
}

export interface CostTimeSeriesItem {
  date: string;
  cost: number;
  cumulative: number;
}

export interface GenerationsTimeSeriesItem {
  date: string;
  [model: string]: any; // Allow dynamic model names as keys
}

/** `GET /admin/summary` — cheap global KPI aggregations. */
export interface AdminSummary {
  totalUsers: number;
  activeSubscriptions: number;
  newUsers30d: number;
  totalMockupsGenerated: number;
  totalMockupsSaved: number;
  totalCreditsUsed: number;
  totalMonthlyCredits: number;
  totalManualCredits: number;
  totalStorageUsed?: number;
  totalTransactions: number;
  totalRevenueBRL: number;
  totalRevenueUSD: number;
  totalApiCostUSD: number;
  referralStats?: {
    totalReferralCount: number;
    totalReferredUsers: number;
    usersWithReferralCode: number;
  };
}

/** `GET /admin/charts` — heavy $facet + time-series aggregations. */
export interface AdminChartsData {
  generationStats?: GenerationStats;
  revenueTimeSeries?: RevenueTimeSeriesItem[];
  costTimeSeries?: CostTimeSeriesItem[];
  generationsTimeSeries?: GenerationsTimeSeriesItem[];
}

/** The merged shape the dashboard renders from (assembled client-side). */
export type AdminResponse = AdminSummary & { users: AdminUser[] } & AdminChartsData;

function headers() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export const adminApi = {
  getSummary: (): Promise<AdminSummary> => request<AdminSummary>('/admin/summary'),
  getUsers: (): Promise<AdminUser[]> =>
    request<{ users: AdminUser[] }>('/admin/users').then((r) => r.users),
  getCharts: (): Promise<AdminChartsData> => request<AdminChartsData>('/admin/charts'),
};
