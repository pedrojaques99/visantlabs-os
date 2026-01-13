// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  // Use relative URL - works in both local (with proxy) and production
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface WaitlistResponse {
  message: string;
  email: string;
}

class WaitlistService {
  /**
   * Add email to waitlist
   * @param email - Email address to add to waitlist
   * @returns Promise with waitlist response
   */
  async joinWaitlist(email: string): Promise<WaitlistResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text or default message
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error joining waitlist:', error);
      throw error;
    }
  }

  /**
   * Get all waitlist entries (for admin use)
   * @returns Promise with waitlist entries
   */
  async getWaitlist(): Promise<{ count: number; entries: Array<{ id: string; email: string; createdAt: string }> }> {
    try {
      const response = await fetch(`${API_BASE_URL}/waitlist`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text or default message
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error fetching waitlist:', error);
      throw error;
    }
  }
}

export const waitlistService = new WaitlistService();











