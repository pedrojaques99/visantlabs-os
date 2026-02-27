import { authService } from './authService';

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

interface CreateAbacatePaymentResponse {
  billId: string;
  sessionId: string;
  url: string;
  qrCode?: string | null;
  pixCode?: string | null;
  status: string;
  expiresAt?: string | null;
  provider: string;
}

interface AbacatePaymentStatusResponse {
  billId: string;
  sessionId: string;
  status: string;
  pixCode?: string | null;
  qrCode?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  amount: number;
  provider: string;
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const abacatepayService = {
  async createPayment(credits: number, currency: string, taxId?: string): Promise<CreateAbacatePaymentResponse> {
    const response = await fetch(`${API_BASE_URL}/payments/create-abacate-pix`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ credits, currency, taxId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create AbacatePay payment');
    }

    return response.json();
  },

  async getPaymentStatus(billId: string): Promise<AbacatePaymentStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/payments/abacate-pix-status/${billId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get payment status');
    }

    return response.json();
  },

  async pollPaymentStatus(
    billId: string,
    onStatusChange: (status: string) => void,
    interval: number = 5000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const data = await abacatepayService.getPaymentStatus(billId);
          onStatusChange(data.status);

          if (data.status === 'PAID' || data.status === 'CONFIRMED') {
            resolve('paid');
          } else if (data.status === 'EXPIRED' || data.status === 'CANCELED') {
            resolve(data.status.toLowerCase());
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


