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

interface CreatePixCheckoutResponse {
  sessionId: string;
  url: string;
}

interface PixQrCodeResponse {
  sessionId: string;
  status: string;
  pixCode: string | null;
  qrCode: string | null;
  checkoutUrl: string | null;
  amount: number | null;
  currency: string | null;
  expiresAt: string | null;
  metadata: Record<string, string> | null;
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const pixService = {
  async createPixCheckout(credits: number, currency: string): Promise<CreatePixCheckoutResponse> {
    const response = await fetch(`${API_BASE_URL}/payments/create-pix-checkout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ credits, currency }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create PIX checkout' }));
      const errorMessage = errorData.error || errorData.message || 'Failed to create PIX checkout';
      const error = new Error(errorMessage);
      (error as any).code = errorData.code;
      (error as any).type = errorData.type;
      throw error;
    }

    return response.json();
  },

  async getPixQrCode(sessionId: string): Promise<PixQrCodeResponse> {
    const response = await fetch(`${API_BASE_URL}/payments/pix-qrcode/${sessionId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get PIX QR code');
    }

    return response.json();
  },

  async pollPaymentStatus(
    sessionId: string,
    onStatusChange: (status: string) => void,
    interval: number = 5000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const data = await pixService.getPixQrCode(sessionId);
          onStatusChange(data.status);

          if (data.status === 'paid') {
            resolve('paid');
          } else if (data.status === 'expired' || data.status === 'canceled') {
            resolve(data.status);
          } else {
            // Continue polling
            setTimeout(poll, interval);
          }
        } catch (error: any) {
          reject(error);
        }
      };

      poll();
    });
  },
};

