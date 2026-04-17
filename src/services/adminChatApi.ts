import { authService } from './authService';

const getApiBaseUrl = () => {
    const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
    return viteApiUrl || '/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = () => {
    const token = authService.getToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

export interface AdminChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    action?: string;
    actionResult?: any;
}

export interface AdminChatSession {
    _id: string;
    userId: string;
    title: string;
    brandGuidelineId?: string;
    attachments: any[];
    messages: AdminChatMessage[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminChatSendMessageResult {
    reply: string;
    action?: string;
    actionResult?: any;
    sessionId: string;
}

export const adminChatApi = {
    /**
     * List all admin chat sessions
     */
    async listSessions(): Promise<AdminChatSession[]> {
        const response = await fetch(`${API_BASE_URL}/admin-chat/sessions`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to list admin chat sessions');
        }

        const data = await response.json();
        return data.sessions;
    },

    /**
     * Create a new admin chat session
     */
    async createSession(brandGuidelineId?: string): Promise<AdminChatSession> {
        const response = await fetch(`${API_BASE_URL}/admin-chat/sessions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ brandGuidelineId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create admin chat session');
        }

        const data = await response.json();
        return data.session;
    },

    /**
     * Get a specific admin chat session
     */
    async getSession(sessionId: string): Promise<AdminChatSession> {
        const response = await fetch(`${API_BASE_URL}/admin-chat/sessions/${sessionId}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get admin chat session');
        }

        const data = await response.json();
        return data.session;
    },

    /**
     * Delete an admin chat session
     */
    async deleteSession(sessionId: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/admin-chat/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete admin chat session');
        }
    },

    /**
     * Send a message to an admin chat session
     */
    async sendMessage(sessionId: string, message: string): Promise<AdminChatSendMessageResult> {
        const response = await fetch(`${API_BASE_URL}/admin-chat/sessions/${sessionId}/message`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send message to admin chat');
        }

        return await response.json();
    },

    /**
     * Ingest/Upload document to an admin chat session
     */
    async uploadToSession(
        sessionId: string,
        source: 'pdf' | 'image' | 'url' | 'text',
        data?: string,
        url?: string,
        filename?: string
    ): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/admin-chat/sessions/${sessionId}/upload`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ source, url, data, filename }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload document to admin chat');
        }

        return await response.json();
    }
};
