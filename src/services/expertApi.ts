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

export interface ExpertChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const expertApi = {
    /**
     * Ingest multimodal content (text, image, pdf) into the knowledge base
     */
    async ingest(parts: any[], metadata: any, projectId?: string) {
        const response = await fetch(`${API_BASE_URL}/expert/ingest`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ parts, metadata, projectId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to ingest content');
        }

        return await response.json();
    },

    /**
     * Chat with the branding expert
     */
    async chat(query: string, history: ExpertChatMessage[] = [], projectId?: string, model?: string) {
        const response = await fetch(`${API_BASE_URL}/expert/chat`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ query, history, projectId, model }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to chat with expert');
        }

        return await response.json();
    }
};
