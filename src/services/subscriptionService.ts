import { authService } from './authService';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  // Use relative URL - works in both local (with proxy) and production
  // In production on Vercel: /api redirects to serverless function
  // In local dev: vite.config.ts proxy redirects /api to http://localhost:3001
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout for API requests

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Helper function to add timeout to fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = REQUEST_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

export interface SubscriptionStatus {
  subscriptionStatus: 'free' | 'active' | 'canceled' | 'past_due';
  subscriptionTier: 'free' | 'premium' | 'pro';
  hasActiveSubscription: boolean;
  freeGenerationsUsed: number;
  freeGenerationsRemaining: number;
  monthlyCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
  creditsResetDate: string | null;
  canGenerate: boolean;
  totalCreditsEarned: number;
  totalCredits: number;
}

export interface UsageInfo {
  freeGenerationsUsed: number;
  freeGenerationsRemaining: number;
  hasActiveSubscription: boolean;
  monthlyCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
  creditsResetDate: string | null;
  canGenerate: boolean;
}

export interface TransactionRecord {
  id: string;
  type: 'purchase' | 'subscription';
  credits: number | null;
  amount: number;
  currency: string;
  status: string;
  description: string;
  createdAt: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}

export const subscriptionService = {
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/subscription-status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch subscription status');
    return response.json();
  },

  async getTransactions(): Promise<TransactionRecord[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/transactions`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }
    return response.json();
  },

  async getUsage(): Promise<UsageInfo> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/usage`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch usage');
    return response.json();
  },

  async createCheckoutSession(locale?: string, currency?: string): Promise<{ sessionId: string; url: string }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/create-checkout-session`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ locale, currency }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout session');
    }
    return response.json();
  },

  async createCreditCheckout(credits: number, currency: string): Promise<{ sessionId: string; url: string }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/create-credit-checkout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ credits, currency }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create credit checkout session');
    }
    return response.json();
  },

  async createPortalSession(): Promise<{ url: string }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/create-portal-session`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create portal session');
    }
    return response.json();
  },

  async getPlans(currency?: string): Promise<{
    priceId: string;
    tier: string;
    monthlyCredits: number;
    amount: number;
    currency: string;
    interval: string;
    productName: string;
    description: string;
  }> {
    const url = new URL(`${API_BASE_URL}/payments/plans`, window.location.origin);
    if (currency) {
      url.searchParams.append('currency', currency);
    }
    try {
      const response = await fetchWithTimeout(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch plans: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.warn('Could not load plan info from Stripe, using defaults:', error);

      const defaultPlans: Record<string, any> = {
        USD: {
          amount: 9,
          currency: 'USD',
          monthlyCredits: 100,
          interval: 'month',
          productName: 'Premium',
          tier: 'premium',
          description: 'Acesso completo a todas as ferramentas do Visant',
        },
        BRL: {
          amount: 19.90,
          currency: 'BRL',
          monthlyCredits: 100,
          interval: 'month',
          productName: 'Premium',
          tier: 'premium',
          description: 'Acesso completo a todas as ferramentas do Visant',
        },
      };

      const targetCurrency = currency || 'USD';
      const defaultPlan = defaultPlans[targetCurrency] || defaultPlans.USD;

      return {
        priceId: '',
        tier: defaultPlan.tier,
        monthlyCredits: defaultPlan.monthlyCredits,
        amount: defaultPlan.amount,
        currency: defaultPlan.currency,
        interval: defaultPlan.interval,
        productName: defaultPlan.productName,
        description: defaultPlan.description,
      };
    }
  },

  async verifySubscription(): Promise<{
    success: boolean;
    message: string;
    subscriptionStatus?: string;
    subscriptionTier?: string;
    monthlyCredits?: number;
    creditsResetDate?: string;
  }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/payments/verify-subscription`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify subscription');
    }
    return response.json();
  },

  async trackUsage(
    success: boolean,
    imagesCount: number = 1,
    model: string = 'gemini-2.5-flash-image',
    hasInputImage: boolean = false,
    promptLength?: number,
    resolution?: '1K' | '2K' | '4K',
    feature?: 'mockupmachine' | 'canvas'
  ): Promise<{ imagesGenerated: number; cost: number } | void> {
    // SECURITY: Removed isLocalDevelopment from request body - backend detects via process.env only
    const response = await fetchWithTimeout(`${API_BASE_URL}/mockups/track-usage`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        success,
        imagesCount,
        model,
        hasInputImage,
        promptLength,
        resolution,
        feature
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      if (error.requiresSubscription) {
        throw new Error('SUBSCRIPTION_REQUIRED');
      }
      throw new Error(error.error || 'Failed to track usage');
    }
    const data = await response.json();
    return { imagesGenerated: data.imagesGenerated, cost: data.cost };
  },

  async trackBrandingUsage(
    success: boolean,
    stepNumber: number,
    promptLength?: number
  ): Promise<{ creditsDeducted: number; creditsRemaining: number; totalCredits: number } | void> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/branding/track-usage`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        success,
        stepNumber,
        promptLength
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      if (error.requiresSubscription) {
        throw new Error('SUBSCRIPTION_REQUIRED');
      }
      throw new Error(error.error || 'Failed to track branding usage');
    }
    const data = await response.json();
    return {
      creditsDeducted: data.creditsDeducted || 0,
      creditsRemaining: data.creditsRemaining || 0,
      totalCredits: data.totalCredits || 0
    };
  },
};

