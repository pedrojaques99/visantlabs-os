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

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  username?: string;
  taxId?: string;
  isAdmin?: boolean;
  userCategory?: string;
  googleId?: string;
}

class AuthService {
  private token: string | null = null;
  private verifyPromise: Promise<User | null> | null = null;
  private lastVerifyTime: number = 0;
  private lastValidResult: User | null = null; // Cache do último resultado válido
  private readonly VERIFY_THROTTLE_MS = 5000; // 5 segundos de throttle
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 500; // 500ms delay inicial para retry

  constructor() {
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      // Dispatch custom event to notify Layout.tsx in the same tab
      window.dispatchEvent(new CustomEvent('auth_token_changed', { detail: { token } }));
    }
    // Invalida cache quando token muda
    this.invalidateCache();
  }

  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      // Dispatch custom event to notify Layout.tsx in the same tab
      window.dispatchEvent(new CustomEvent('auth_token_changed', { detail: { token: null } }));
    }
    // Limpa cache quando token é removido
    this.invalidateCache();
  }

  invalidateCache(): void {
    this.lastValidResult = null;
    this.lastVerifyTime = 0;
  }

  async getAuthUrl(referralCode?: string): Promise<string> {
    try {
      console.log('Fetching auth URL from:', API_BASE_URL);
      const url = new URL(`${API_BASE_URL}/auth/google`, window.location.origin);
      if (referralCode) {
        url.searchParams.set('ref', referralCode);
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Backend retornou resposta inválida. Verifique se a URL da API está correta: ${API_BASE_URL}`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth URL error:', response.status, errorText);
        throw new Error(`Failed to get auth URL: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.authUrl;
    } catch (error: any) {
      console.error('getAuthUrl error:', error);
      // Handle JSON parse errors (when server returns HTML instead of JSON)
      if (error.message?.includes('JSON') || error.message?.includes('Unexpected token')) {
        throw new Error(`Backend não está acessível em ${API_BASE_URL}. Verifique a configuração da URL da API.`);
      }
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error(`Não foi possível conectar ao backend em ${API_BASE_URL}. Verifique se o servidor está rodando e acessível.`);
      }
      throw error;
    }
  }

  async signUp(email: string, password: string, name?: string, referralCode?: string, captchaToken?: string): Promise<{ token: string; user: User }> {
    try {
      const body: { email: string; password: string; name?: string; referralCode?: string; captchaToken?: string } = { email, password };
      if (name) body.name = name;
      if (referralCode) body.referralCode = referralCode;
      if (captchaToken) body.captchaToken = captchaToken;

      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Try to parse error response
        let errorData: any = { error: 'Failed to sign up' };
        let errorMessage = 'Failed to sign up';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await response.text();
            console.error('[authService] Non-JSON error response:', {
              status: response.status,
              statusText: response.statusText,
              body: text.substring(0, 200),
            });
          }
        } catch (parseError) {
          console.error('[authService] Error parsing error response:', parseError);
        }

        // Create error with full context
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        (error as any).response = errorData;
        
        console.error('[authService] Signup error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          response: errorData,
        });
        
        throw error;
      }

      const data = await response.json();
      this.setToken(data.token);
      return data;
    } catch (error: any) {
      // Handle Event objects (from script loading errors, etc.) vs Error objects
      const isEventObject = error && typeof error === 'object' && 'type' in error && 'target' in error;
      
      // Check if this is a BotID script loading error (404 on c.js with UUID pattern)
      const errorMessage = error?.message || String(error || '');
      const uuidPattern = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
      const isBotId404Error = 
        (errorMessage.includes('404') || errorMessage.includes('ERR_ABORTED')) &&
        (errorMessage.includes('/c.js') || uuidPattern.test(errorMessage) || 
         errorMessage.match(uuidPattern)?.length >= 2);
      
      if (isEventObject || isBotId404Error) {
        // This is likely a script loading error from BotID or similar - suppress it
        const target = isEventObject ? (error as Event).target as HTMLElement | null : null;
        const scriptSrc = target && target.tagName === 'SCRIPT' ? (target as HTMLScriptElement).src : '';
        console.debug('[authService] Suppressed BotID script loading error during signup:', scriptSrc || errorMessage || 'unknown script');
        // Don't throw error - BotID script loading failures shouldn't block auth
        // Return a user-friendly error instead
        throw new Error('Erro de conexão. Por favor, tente novamente.');
      }
      
      // Enhanced error logging with full context
      const isNetworkError = 
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError' ||
        !error.status;
      
      if (isNetworkError) {
        console.error('[authService] Signup network error:', {
          message: error?.message || 'Unknown network error',
          name: error?.name || 'Error',
          stack: error?.stack,
          apiBaseUrl: API_BASE_URL,
        });
      } else {
        console.error('[authService] Signup error:', {
          message: error?.message || 'Unknown error',
          status: error?.status,
          statusText: error?.statusText,
          response: error?.response,
        });
      }
      
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        // Try to parse error response
        let errorData: any = { error: 'Failed to sign in' };
        let errorMessage = 'Failed to sign in';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await response.text();
            console.error('[authService] Non-JSON error response:', {
              status: response.status,
              statusText: response.statusText,
              body: text.substring(0, 200),
            });
          }
        } catch (parseError) {
          console.error('[authService] Error parsing error response:', parseError);
        }

        // Create error with full context
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        (error as any).response = errorData;
        
        console.error('[authService] Signin error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          response: errorData,
        });
        
        throw error;
      }

      const data = await response.json();
      this.setToken(data.token);
      return data;
    } catch (error: any) {
      // Handle Event objects (from script loading errors, etc.) vs Error objects
      const isEventObject = error && typeof error === 'object' && 'type' in error && 'target' in error;
      
      // Check if this is a BotID script loading error (404 on c.js with UUID pattern)
      const errorMessage = error?.message || String(error || '');
      const uuidPattern = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
      const isBotId404Error = 
        (errorMessage.includes('404') || errorMessage.includes('ERR_ABORTED')) &&
        (errorMessage.includes('/c.js') || uuidPattern.test(errorMessage) || 
         errorMessage.match(uuidPattern)?.length >= 2);
      
      if (isEventObject || isBotId404Error) {
        // This is likely a script loading error from BotID or similar - suppress it
        const target = isEventObject ? (error as Event).target as HTMLElement | null : null;
        const scriptSrc = target && target.tagName === 'SCRIPT' ? (target as HTMLScriptElement).src : '';
        console.debug('[authService] Suppressed BotID script loading error during signin:', scriptSrc || errorMessage || 'unknown script');
        // Don't throw error - BotID script loading failures shouldn't block auth
        // Return a user-friendly error instead
        throw new Error('Erro de conexão. Por favor, tente novamente.');
      }
      
      // Enhanced error logging with full context
      const isNetworkError = 
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError' ||
        !error.status;
      
      if (isNetworkError) {
        console.error('[authService] Signin network error:', {
          message: error?.message || 'Unknown network error',
          name: error?.name || 'Error',
          stack: error?.stack,
          apiBaseUrl: API_BASE_URL,
        });
      } else {
        console.error('[authService] Signin error:', {
          message: error?.message || 'Unknown error',
          status: error?.status,
          statusText: error?.statusText,
          response: error?.response,
        });
      }
      
      throw error;
    }
  }

  async verifyToken(): Promise<User | null> {
    if (!this.token) {
      this.lastValidResult = null;
      return null;
    }

    // Throttle: se houver uma requisição em andamento, retorna a mesma promise
    if (this.verifyPromise) {
      return this.verifyPromise;
    }

    // Throttle: se a última verificação foi há menos de VERIFY_THROTTLE_MS, retorna resultado cacheado
    const now = Date.now();
    if (now - this.lastVerifyTime < this.VERIFY_THROTTLE_MS) {
      // Retorna resultado cacheado se existir, senão retorna a promise pendente ou null
      if (this.lastValidResult !== null) {
        return Promise.resolve(this.lastValidResult);
      }
      // Se não há cache válido, aguarda a promise pendente se existir
      if (this.verifyPromise) {
        return this.verifyPromise;
      }
      // Se não há promise pendente, retorna null (caso raro)
      return null;
    }

    // Cria a promise e marca o tempo
    this.lastVerifyTime = now;
    this.verifyPromise = this._performVerify();

    try {
      const result = await this.verifyPromise;
      // Atualiza cache com resultado válido (ou null se inválido)
      this.lastValidResult = result;
      return result;
    } finally {
      // Limpa a promise após completar
      this.verifyPromise = null;
    }
  }

  async ensureAuthenticated(): Promise<User | null> {
    // Se não há token, retorna null imediatamente
    if (!this.token) {
      return null;
    }

    // Se há uma verificação em andamento, aguarda ela
    if (this.verifyPromise) {
      const result = await this.verifyPromise;
      return result;
    }

    // Se há resultado cacheado válido e está dentro do throttle, retorna cache
    const now = Date.now();
    const timeSinceLastVerify = now - this.lastVerifyTime;
    
    if (timeSinceLastVerify < this.VERIFY_THROTTLE_MS && this.lastValidResult !== null) {
      // Retorna resultado cacheado se ainda está dentro do throttle
      return this.lastValidResult;
    }

    // Se a última verificação foi recente (dentro do throttle) mas não há cache válido,
    // aguarda um pouco e força nova verificação
    if (timeSinceLastVerify < this.VERIFY_THROTTLE_MS) {
      // Aguarda o tempo restante do throttle mais um pequeno delay
      const waitTime = this.VERIFY_THROTTLE_MS - timeSinceLastVerify + 100;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Aguarda um micro delay adicional para garantir que verificações pendentes sejam concluídas
    await new Promise(resolve => setTimeout(resolve, 100));

    // Força nova verificação (ignorando throttle para garantir resultado atualizado)
    this.lastVerifyTime = Date.now();
    this.verifyPromise = this._performVerify();

    try {
      const result = await this.verifyPromise;
      // Cache já é atualizado em _performVerify
      return result;
    } finally {
      this.verifyPromise = null;
    }
  }

  private async _performVerify(): Promise<User | null> {
    if (!this.token) {
      this.lastValidResult = null;
      this.retryCount = 0;
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      // Only clear token on 401 (Unauthorized) - token is invalid or expired
      // Don't clear on network errors or server errors (500, 503, etc.)
      if (response.status === 401) {
        this.clearToken();
        this.lastValidResult = null;
        this.retryCount = 0;
        return null;
      }

      if (!response.ok) {
        // Server error (500, 503, etc.) - pode ser cold start do MongoDB
        // Tenta retry com backoff exponencial
        if (this.retryCount < this.MAX_RETRIES) {
          this.retryCount++;
          const delay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1);
          console.warn(`Token verification failed (${response.status}), retry ${this.retryCount}/${this.MAX_RETRIES} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this._performVerify();
        }
        
        // Esgotou retries - retorna cache se existir
        console.warn('Token verification failed with status:', response.status, '- keeping token for retry');
        this.retryCount = 0;
        return this.lastValidResult;
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Non-JSON response but not 401 - might be server issue, don't clear token
        console.warn('Token verification returned non-JSON response - keeping token for retry');
        return this.lastValidResult; // Retorna cache se existir, senão null
      }

      const data = await response.json();
      // Sucesso - reseta retry count e atualiza cache
      this.retryCount = 0;
      this.lastValidResult = data.user;
      return data.user;
    } catch (error: any) {
      // Network error or fetch failed - pode ser cold start
      // Tenta retry com backoff exponencial
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        const delay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1);
        console.warn(`Token verification network error, retry ${this.retryCount}/${this.MAX_RETRIES} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._performVerify();
      }
      
      // Esgotou retries - retorna cache se existir
      if (error?.name !== 'TypeError' && !error?.message?.includes('Failed to fetch')) {
        console.warn('Token verification error:', error);
      }
      this.retryCount = 0;
      return this.lastValidResult;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async updateProfile(data: { name?: string; email?: string; picture?: string }): Promise<User> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const result = await response.json();
      return result.user;
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send password reset email' }));
        throw new Error(errorData.error || 'Failed to send password reset email');
      }

      // Success - email sent (or would be sent if user exists)
      await response.json();
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token, password: newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to reset password' }));
        throw new Error(errorData.error || 'Failed to reset password');
      }

      await response.json();
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  async getGoogleLinkUrl(): Promise<string> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/auth/google/link`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get link URL' }));
        throw new Error(errorData.error || 'Failed to get link URL');
      }

      const data = await response.json();
      return data.authUrl;
    } catch (error: any) {
      console.error('getGoogleLinkUrl error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();

