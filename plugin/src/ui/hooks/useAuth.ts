import { useCallback, useEffect } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';

export function useAuth() {
  const { authToken, authEmail, setAuthToken, setAuthEmail, updateCredits, showToast } = usePluginStore();
  const { send } = useFigmaMessages();

  // Load auth token from sandbox on init
  useEffect(() => {
    send({ type: 'GET_AUTH_TOKEN' } as any);
  }, [send]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      try {
        // Call API endpoint para login
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          showToast('Login failed', 'error');
          return false;
        }

        const data = await response.json();
        if (data?.token) {
          setAuthToken(data.token);
          setAuthEmail(email);

          // Save token to sandbox (SAVE_AUTH_TOKEN message)
          send({
            type: 'SAVE_AUTH_TOKEN',
            token: data.token,
            rememberMe
          } as any);

          // Fetch credits
          try {
            const creditsResponse = await fetch('/api/auth/status', {
              headers: {
                Authorization: `Bearer ${data.token}`,
                'Content-Type': 'application/json'
              }
            });
            if (creditsResponse.ok) {
              const credits = await creditsResponse.json();
              if (credits?.credits) {
                updateCredits(credits.credits);
              }
            }
          } catch (err) {
            console.error('Failed to fetch credits:', err);
          }

          showToast('Login successful', 'success');
          return true;
        }
        return false;
      } catch (err) {
        console.error('Login error:', err);
        showToast('Login error: ' + (err as Error).message, 'error');
        return false;
      }
    },
    [setAuthToken, setAuthEmail, updateCredits, send, showToast]
  );

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

    try {
      const response = await fetch('/api/auth/status', {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.credits) {
          updateCredits(data.credits);
        }
        return true;
      }
      if (response.status === 401) {
        logout();
        return false;
      }
      return false;
    } catch (err) {
      console.error('Status check failed:', err);
      return false;
    }
  }, [authToken, updateCredits, logout]);

  return {
    login,
    logout,
    checkStatus,
    isAuthenticated: !!authToken,
    email: authEmail,
    authToken
  };
}
