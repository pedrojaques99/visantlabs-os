import { useEffect, useState } from 'react';

export interface MediaSessionData {
  userId: string;
  session: {
    lastActivity: number;
    extractionModes: string[];
    recentQueries: Array<{ query: string; mode: string; timestamp: number }>;
    preferences: {
      defaultLimit?: number;
      preferredImageFormat?: string;
      autoDownload?: boolean;
    };
  } | null;
  history: Array<{
    type: string;
    query: string;
    mode: string;
    resultCount: number;
    timestamp: number;
  }>;
}

/**
 * Hook to fetch and manage user's media extraction session
 */
export const useMediaSession = () => {
  const [sessionData, setSessionData] = useState<MediaSessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async (limit = 20) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/images/session?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      const data = await response.json();
      setSessionData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch session on mount
  useEffect(() => {
    fetchSession();
  }, []);

  return { sessionData, loading, error, refetch: fetchSession };
};
