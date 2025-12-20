import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Save user's Gemini API key (encrypted on backend)
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/users/settings/gemini-api-key`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ apiKey }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to save API key' }));
    throw new Error(errorData.error || errorData.message || 'Failed to save API key');
  }
}

/**
 * Delete user's Gemini API key
 */
export async function deleteGeminiApiKey(): Promise<void> {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/users/settings/gemini-api-key`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to delete API key' }));
    throw new Error(errorData.error || errorData.message || 'Failed to delete API key');
  }
}

/**
 * Check if user has a saved API key
 */
export async function hasGeminiApiKey(): Promise<boolean> {
  const token = authService.getToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/settings/gemini-api-key`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.hasApiKey === true;
  } catch (error) {
    console.error('Failed to check API key:', error);
    return false;
  }
}











