import { chatApiRequest } from '@/lib/chat/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  generationId?: string;
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
  generationId?: string;
}

export const chatApi = {
  async createSession(title?: string, brandGuidelineId?: string): Promise<ChatSession> {
    const { session } = await chatApiRequest<{ session: ChatSession }>('/chat/sessions', {
      method: 'POST',
      body: { title, brandGuidelineId },
      errorMessage: 'Failed to create session',
    });
    return session;
  },

  async listSessions(): Promise<ChatSessionListItem[]> {
    const { sessions } = await chatApiRequest<{ sessions: ChatSessionListItem[] }>('/chat/sessions', {
      errorMessage: 'Failed to list sessions',
    });
    return sessions;
  },

  async getSession(sessionId: string): Promise<ChatSession> {
    const { session } = await chatApiRequest<{ session: ChatSession }>(`/chat/sessions/${sessionId}`, {
      errorMessage: 'Failed to get session',
    });
    return session;
  },

  async deleteSession(sessionId: string): Promise<void> {
    await chatApiRequest<void>(`/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      errorMessage: 'Failed to delete session',
    });
  },

  async uploadToSession(sessionId: string, parts: any[], metadata?: Record<string, any>): Promise<void> {
    await chatApiRequest<void>(`/chat/sessions/${sessionId}/upload`, {
      method: 'POST',
      body: { parts, metadata },
      errorMessage: 'Failed to upload to session',
    });
  },

  async sendMessage(sessionId: string, message: string): Promise<SendMessageResult> {
    return chatApiRequest<SendMessageResult>(`/chat/sessions/${sessionId}/message`, {
      method: 'POST',
      body: { message },
      errorMessage: 'Failed to send message',
    });
  },

  async renameSession(sessionId: string, title: string): Promise<ChatSession> {
    const { session } = await chatApiRequest<{ session: ChatSession }>(`/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: { title },
      errorMessage: 'Failed to rename session',
    });
    return session;
  },
};
