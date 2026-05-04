import { useCallback, useEffect, useRef } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import { apiUrl } from '../config';

export function useAuth() {
  const { authToken, authEmail, setAuthToken, setAuthEmail, updateCredits, showToast } = usePluginStore();
  const { send } = useFigmaMessages();
  const checkInFlightRef = useRef<Promise<boolean> | null>(null);

  // Load auth token from sandbox on init
  useEffect(() => {
    send({ type: 'GET_AUTH_TOKEN' } as any);
  }, [send]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      try {
        const response = await fetch(apiUrl('/auth/signin'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          let msg = 'Falha ao entrar';
          try {
            const ct = response.headers.get('content-type');
            if (ct?.includes('application/json')) {
              const err = await response.json();
              msg = err.error || err.message || msg;
            }
          } catch { /* use default */ }
          showToast(msg, 'error');
          return false;
        }

        const data = await response.json();
        if (!data?.token) return false;

        setAuthToken(data.token);
        setAuthEmail(data.user?.email || email);

        send({ type: 'SAVE_AUTH_TOKEN', token: data.token, rememberMe } as any);

        // Fetch credits in background — don't block login success
        fetch(apiUrl('/plugin/auth/status'), {
          headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' }
        })
          .then(r => r.ok ? r.json() : null)
          .then(status => {
            if (typeof status?.creditsUsed === 'number' && typeof status?.monthlyCredits === 'number') {
              updateCredits({ used: status.creditsUsed, limit: status.monthlyCredits });
            }
          })
          .catch(() => {});

        showToast('Login realizado', 'success');
        return true;
      } catch (err) {
        const msg = (err as Error).message?.includes('Failed to fetch')
          ? 'Erro de conexão. Verifique sua internet.'
          : `Erro: ${(err as Error).message}`;
        showToast(msg, 'error');
        return false;
      }
    },
    [setAuthToken, setAuthEmail, updateCredits, send, showToast]
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/auth/google'));
      if (!response.ok) {
        showToast('Erro ao iniciar Google OAuth', 'error');
        return;
      }
      const { authUrl } = await response.json();
      if (authUrl) {
        window.parent.postMessage({ pluginMessage: { type: 'OPEN_EXTERNAL_URL', url: authUrl } }, 'https://www.figma.com');
        showToast('Janela de login aberta no navegador', 'info');
      }
    } catch {
      showToast('Erro de conexão com OAuth', 'error');
    }
  }, [showToast]);

  const logout = useCallback(() => {
    // Clear local state
    setAuthToken(null);
    setAuthEmail(null);

    // Tell sandbox to clear token
    send({
      type: 'SAVE_AUTH_TOKEN',
      token: ''
    } as any);

    showToast('Logged out', 'success');
  }, [setAuthToken, setAuthEmail, send, showToast]);

  const checkStatus = useCallback(async () => {
    if (!authToken) return false;
    if (checkInFlightRef.current) return checkInFlightRef.current;

    const promise = (async () => {
      try {
        const response = await fetch(apiUrl('/plugin/auth/status'), {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (typeof data?.creditsUsed === 'number' && typeof data?.monthlyCredits === 'number') {
            updateCredits({ used: data.creditsUsed, limit: data.monthlyCredits });
          }
          return !!data?.authenticated;
        }
        if (response.status === 401) {
          logout();
          return false;
        }
        return false;
      } catch (err) {
        console.error('Status check failed:', err);
        return false;
      } finally {
        checkInFlightRef.current = null;
      }
    })();

    checkInFlightRef.current = promise;
    return promise;
  }, [authToken, updateCredits, logout]);

  return {
    login,
    loginWithGoogle,
    logout,
    checkStatus,
    isAuthenticated: !!authToken,
    email: authEmail,
    authToken
  };
}
