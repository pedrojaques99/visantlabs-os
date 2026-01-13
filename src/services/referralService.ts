// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface ReferralStats {
  referralCode: string | null;
  referralCount: number;
  referredUsersCount: number;
  totalCreditsEarned: number;
}

class ReferralService {
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  async getReferralCode(): Promise<string | null> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/referral/code`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get referral code' }));
        throw new Error(errorData.error || 'Failed to get referral code');
      }

      const data = await response.json();
      return data.referralCode;
    } catch (error: any) {
      console.error('Get referral code error:', error);
      throw error;
    }
  }

  async getReferralStats(): Promise<ReferralStats> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/referral/stats`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get referral stats' }));
        throw new Error(errorData.error || 'Failed to get referral stats');
      }

      const data = await response.json();
      return {
        referralCode: data.referralCode,
        referralCount: data.referralCount || 0,
        referredUsersCount: data.referredUsersCount || 0,
        totalCreditsEarned: data.totalCreditsEarned || 0,
      };
    } catch (error: any) {
      console.error('Get referral stats error:', error);
      throw error;
    }
  }

  async generateReferralCode(): Promise<string> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/referral/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate referral code' }));
        throw new Error(errorData.error || 'Failed to generate referral code');
      }

      const data = await response.json();
      return data.referralCode;
    } catch (error: any) {
      console.error('Generate referral code error:', error);
      throw error;
    }
  }

  getReferralLink(referralCode: string | null): string {
    if (!referralCode) {
      return '';
    }
    // Use VITE_SITE_URL from environment, fallback to current origin
    const siteUrl = (import.meta as any).env?.VITE_SITE_URL || 
                    (typeof window !== 'undefined' ? window.location.origin : '');
    return `${siteUrl}/?ref=${referralCode}`;
  }
}

export const referralService = new ReferralService();

