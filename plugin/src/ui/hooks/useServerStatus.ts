import { useEffect, useState } from 'react';
import { apiUrl } from '../config';

export function useServerStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        // Use /auth/status endpoint instead of /health to avoid CORS preflight issues
        const response = await fetch(apiUrl('/plugin/auth/status'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        // Server is connected if we get any response (even 401 is fine - means server is running)
        setIsConnected(response.status !== 0);
      } catch (err) {
        setIsConnected(false);
      }
    };

    // Check immediately
    checkServer();

    // Check every 10 seconds (less aggressive)
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected };
}
