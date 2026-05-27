import { API_BASE } from '@/config/api';
import { authService } from './authService';

const getHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const totpService = {
  async setup(): Promise<{ secret: string; otpauthUrl: string }> {
    const response = await fetch(`${API_BASE}/totp/setup`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to setup 2FA');
    return response.json();
  },

  async enable(code: string): Promise<{ backupCodes: string[] }> {
    const response = await fetch(`${API_BASE}/totp/enable`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to enable 2FA');
    return data;
  },

  async disable(code: string): Promise<void> {
    const response = await fetch(`${API_BASE}/totp/disable`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to disable 2FA');
  },
};
