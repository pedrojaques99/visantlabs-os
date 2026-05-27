import { API_BASE } from '@/config/api';
import { authService } from './authService';

export interface SessionRecord {
  id: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  lastUsed: string;
  createdAt: string;
}

const getHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const sessionService = {
  async listSessions(): Promise<SessionRecord[]> {
    const response = await fetch(`${API_BASE}/sessions`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await response.json();
    return data.sessions;
  },

  async revokeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to revoke session');
  },
};
