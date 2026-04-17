import { authService } from './authService';

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  _id: string;
  userId: string;
  title: string;
  brandGuidelineId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionListItem extends Omit<ChatSession, 'messages'> {}

export interface SendMessageResult {
  reply: string;
  sessionId: string;
  toolsUsed?: string[];
}

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  return viteApiUrl || '/api';
};

const API_URL = getApiBaseUrl();

export const chatApi = {
  // Create a new chat session
  async createSession(title?: string, brandGuidelineId?: string): Promise<ChatSession> {
    const response = await fetch(`${API_URL}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ title, brandGuidelineId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create session');
    }

    const data = await response.json();
    return data.session;
  },

  // List all sessions for current user
  async listSessions(): Promise<ChatSessionListItem[]> {
    const response = await fetch(`${API_URL}/chat/sessions`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list sessions');
    }

    const data = await response.json();
    return data.sessions;
  },

  // Get a specific session with all messages
  async getSession(sessionId: string): Promise<ChatSession> {
    const response = await fetch(`${API_URL}/chat/sessions/${sessionId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get session');
    }

    const data = await response.json();
    return data.session;
  },

  // Delete a session
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_URL}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete session');
    }
  },

  // Upload/ingest documents to a session
  async uploadToSession(
    sessionId: string,
    parts: any[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ parts, metadata }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload to session');
    }
  },

  // Send a message to a session
  async sendMessage(sessionId: string, message: string): Promise<SendMessageResult> {
    const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return await response.json();
  },

  // Rename a session
  async renameSession(sessionId: string, title: string): Promise<ChatSession> {
    const response = await fetch(`${API_URL}/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rename session');
    }

    const data = await response.json();
    return data.session;
  },
};
