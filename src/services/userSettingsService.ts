import { authService } from './authService';

const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL : '/api';

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

/**
 * Get user's canvas settings
 */
export async function getCanvasSettings(): Promise<any> {
  const token = authService.getToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/settings/canvas`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get canvas settings:', error);
    return null;
  }
}

/**
 * Update user's canvas settings
 */
export async function updateCanvasSettings(settings: any): Promise<void> {
  const token = authService.getToken();
  if (!token) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/users/settings/canvas`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to update settings' }));
    throw new Error(errorData.error || errorData.message || 'Failed to update settings');
  }
}











/**
 * Save user's Seedream API key (encrypted on backend)
 */
export async function saveSeedreamApiKey(apiKey: string): Promise<void> {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/users/settings/seedream-api-key`, {
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
 * Delete user's Seedream API key
 */
export async function deleteSeedreamApiKey(): Promise<void> {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/users/settings/seedream-api-key`, {
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
 * Check if user has a saved Seedream API key
 */
export async function hasSeedreamApiKey(): Promise<boolean> {
  const token = authService.getToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/settings/seedream-api-key`, {
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

// ═══ LLM Preferences (Gemini vs Ollama) ═══

export interface LlmPreferences {
  llmProvider: 'gemini' | 'ollama';
  ollamaUrl: string;
  ollamaModel: string;
}

export async function getLlmPreferences(): Promise<LlmPreferences> {
  const token = authService.getToken();
  if (!token) return { llmProvider: 'gemini', ollamaUrl: '', ollamaModel: '' };

  try {
    const response = await fetch(`${API_BASE_URL}/users/settings/llm-preferences`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { llmProvider: 'gemini', ollamaUrl: '', ollamaModel: '' };
    const data = await response.json();
    return {
      llmProvider: data.llmProvider === 'ollama' ? 'ollama' : 'gemini',
      ollamaUrl: data.ollamaUrl || '',
      ollamaModel: data.ollamaModel || '',
    };
  } catch {
    return { llmProvider: 'gemini', ollamaUrl: '', ollamaModel: '' };
  }
}

export async function saveLlmPreferences(prefs: Partial<LlmPreferences>): Promise<LlmPreferences> {
  const token = authService.getToken();
  if (!token) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/users/settings/llm-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to save LLM preferences' }));
    throw new Error(errorData.error || errorData.message || 'Failed to save LLM preferences');
  }

  const data = await response.json();
  return {
    llmProvider: data.llmProvider === 'ollama' ? 'ollama' : 'gemini',
    ollamaUrl: data.ollamaUrl || '',
    ollamaModel: data.ollamaModel || '',
  };
}

// ═══ Figma Token ═══

export async function saveFigmaToken(figmaToken: string): Promise<{ figmaUser: { id: string; email: string; handle: string } }> {
  const authToken = authService.getToken();
  if (!authToken) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/users/settings/figma-token`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token: figmaToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to save Figma token' }));
    throw new Error(errorData.error || 'Failed to save Figma token');
  }
  return response.json();
}

export async function deleteFigmaToken(): Promise<void> {
  const token = authService.getToken();
  if (!token) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/users/settings/figma-token`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to delete Figma token' }));
    throw new Error(errorData.error || 'Failed to delete Figma token');
  }
}

export async function hasFigmaToken(): Promise<boolean> {
  const token = authService.getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/users/settings/figma-token`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return false;
    const data = await response.json();
    return data.hasToken === true;
  } catch {
    return false;
  }
}
