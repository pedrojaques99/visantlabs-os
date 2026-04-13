import { useEffect, useState } from 'react';
import { apiUrl } from '../config';

export function useServerStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(apiUrl('/health'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        setIsConnected(response.ok);
      } catch (err) {
        setIsConnected(false);
      }
    };

    // Check immediately
    checkServer();

    // Check every 5 seconds
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected };
}
