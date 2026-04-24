import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';

export interface ByokStatus {
  byok: {
    active: boolean;
    gemini: {
      enabled: boolean;
      benefits: string[];
    };
    seedream: {
      enabled: boolean;
      benefits: string[];
    };
    openai: {
      enabled: boolean;
      benefits: string[];
    };
  };
  storage: {
    hasActivePlan: boolean;
    productId: string | null;
    tier: string;
    limitBytes: number | null;
    usedBytes: number;
  };
  recommendation: string | null;
}

interface UseByokStatusResult {
  status: ByokStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isByokActive: boolean;
  needsStoragePlan: boolean;
}

/**
 * Hook to check user's BYOK (Bring Your Own Key) status
 * Returns whether user has their own API keys configured and storage info
 */
export function useByokStatus(): UseByokStatusResult {
  const [status, setStatus] = useState<ByokStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const token = authService.getToken();
    if (!token) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/users/settings/byok-status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch BYOK status');
      }

      const data: ByokStatus = await response.json();
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch BYOK status:', err);
      setError(err.message || 'Failed to fetch BYOK status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isByokActive = status?.byok.active ?? false;
  const needsStoragePlan = isByokActive && !status?.storage.hasActivePlan;

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
    isByokActive,
    needsStoragePlan,
  };
}
