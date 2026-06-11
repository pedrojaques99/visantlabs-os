import { useCallback, useEffect, useRef } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import { apiUrl } from '../config';

function applyUserInfo(data: any) {
  if (!data) return;
  const { setUserInfo, setAuthEmail } = usePluginStore.getState();
  if (data.email) setAuthEmail(data.email);
  if (data.email || data.name || data.avatar || data.photoUrl) {
    setUserInfo({
      id: data.id ?? data.email ?? 'api',
      name: data.name ?? data.email ?? '',
      photoUrl: data.avatar ?? data.photoUrl ?? undefined,
    });
  }
}

export function useAuth() {
  const { authToken, authEmail, setAuthToken, setAuthEmail, updateCredits, showToast } =
    usePluginStore();
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
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          let msg = 'Falha ao entrar';
          try {
            const ct = response.headers.get('content-type');
            if (ct?.includes('application/json')) {
              const err = await response.json();
              msg = err.error || err.message || msg;
            }
          } catch {
            /* use default */
          }
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
          headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((status) => {
            if (
              typeof status?.creditsUsed === 'number' &&
              typeof status?.monthlyCredits === 'number'
            ) {
              updateCredits({ used: status.creditsUsed, limit: status.monthlyCredits });
            }
            applyUserInfo(status);
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
      const response = await fetch(apiUrl('/auth/google?source=plugin'));
      if (!response.ok) {
        showToast('Erro ao iniciar Google OAuth', 'error');
        return;
      }
      const { authUrl, sessionId } = await response.json();
      if (!authUrl || !sessionId) return;

      window.parent.postMessage(
        { pluginMessage: { type: 'OPEN_EXTERNAL_URL', url: authUrl } },
        'https://www.figma.com'
      );
      showToast('Faça login no navegador...', 'info');

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 60) {
          clearInterval(poll);
          showToast('Login expirou', 'error');
          return;
        }
        try {
          const r = await fetch(apiUrl(`/auth/google/poll/${sessionId}`));
          const data = await r.json();
          if (data.status === 'complete' && data.token) {
            clearInterval(poll);
            setAuthToken(data.token);
            setAuthEmail(null);
            send({ type: 'SAVE_AUTH_TOKEN', token: data.token, rememberMe: true } as any);
            fetch(apiUrl('/plugin/auth/status'), {
              headers: {
                Authorization: `Bearer ${data.token}`,
                'Content-Type': 'application/json',
              },
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((status) => {
                if (typeof status?.creditsUsed === 'number')
                  updateCredits({ used: status.creditsUsed, limit: status.monthlyCredits });
                applyUserInfo(status);
              })
              .catch(() => {});
            showToast('Login realizado', 'success');
          } else if (data.status === 'error' || data.status === 'expired') {
            clearInterval(poll);
            showToast('Falha no login Google', 'error');
          }
        } catch {
          /* retry */
        }
      }, 3000);
    } catch {
      showToast('Erro de conexão com OAuth', 'error');
    }
  }, [showToast, setAuthToken, setAuthEmail, send, updateCredits]);

  const logout = useCallback(() => {
    // Clear local state
    setAuthToken(null);
    setAuthEmail(null);

    // Tell sandbox to clear token
    send({
      type: 'SAVE_AUTH_TOKEN',
      token: '',
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
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (typeof data?.creditsUsed === 'number' && typeof data?.monthlyCredits === 'number') {
            updateCredits({ used: data.creditsUsed, limit: data.monthlyCredits });
          }
          applyUserInfo(data);
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
    authToken,
  };
}
