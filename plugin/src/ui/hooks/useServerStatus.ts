import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../config';

export function useServerStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const failCountRef = useRef(0);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const schedule = () => {
      const delay = failCountRef.current === 0
        ? 15_000
        : Math.min(15_000 * Math.pow(2, failCountRef.current), 120_000);
      timerId = setTimeout(checkServer, delay);
    };

    const checkServer = async () => {
      if (cancelled) return;
      try {
        const response = await fetch(apiUrl('/plugin/auth/status'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        setIsConnected(response.status !== 0);
        failCountRef.current = 0;
      } catch {
        setIsConnected(false);
        failCountRef.current = Math.min(failCountRef.current + 1, 6);
      }
      if (!cancelled) schedule();
    };

    checkServer();
    return () => { cancelled = true; clearTimeout(timerId); };
  }, []);

  return { isConnected };
}
