import { chatApiRequest } from '@/lib/chat/client';
import { API_BASE } from '@/config/api';

export interface CreativeProjectRef {
    creativeProjectId: string;
    imageUrl: string;
    editUrl: string;
    prompt: string;
    creditsDeducted: number;
    creditsRemaining: number;
}

export interface ToolCallRecord {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    args?: any;
    startedAt: string;
    endedAt?: string;
    errorMessage?: string;
    summary?: string;
}

export interface PendingBrandKnowledgeApproval {
    id: string;
    sessionId: string;
    brandGuidelineId: string;
    title: string;
    content: string;
    reason?: string;
    requestedByUserId: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    resolvedByUserId?: string;
    resolvedAt?: string;
}

export interface CreativePlanProposal {
    title: string;
    prompt: string;
    aspectRatio?: string;
}

export interface PendingCreativePlan {
    id: string;
    summary: string;
    proposals: CreativePlanProposal[];
    questions: string[];
}

export interface AdminChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    action?: string;
    actionResult?: any;
    attachments?: Array<{ type: 'image' | 'pdf'; dataUrl: string; name: string; }>;
    creativeProjects?: CreativeProjectRef[];
    toolCalls?: ToolCallRecord[];
    generationId?: string;
}

export interface AdminChatSession {
    _id: string;
    userId: string;
    title: string;
    brandGuidelineId?: string;
    attachments: any[];
    messages: AdminChatMessage[];
    pendingApprovals?: PendingBrandKnowledgeApproval[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminChatSendMessageResult {
    reply: string;
    action?: string;
    actionResult?: any;
    sessionId: string;
    generationId?: string;
    toolsUsed?: string[];
    toolCalls?: ToolCallRecord[];
    creativeProjects?: CreativeProjectRef[];
}

export const adminChatApi = {
    async listSessions(): Promise<AdminChatSession[]> {
        const { sessions } = await chatApiRequest<{ sessions: AdminChatSession[] }>('/admin-chat/sessions', {
            errorMessage: 'Failed to list admin chat sessions',
        });
        return sessions;
    },

    async createSession(brandGuidelineId?: string): Promise<AdminChatSession> {
        const { session } = await chatApiRequest<{ session: AdminChatSession }>('/admin-chat/sessions', {
            method: 'POST',
            body: { brandGuidelineId },
            errorMessage: 'Failed to create admin chat session',
        });
        return session;
    },

    async getSession(sessionId: string): Promise<AdminChatSession> {
        const { session } = await chatApiRequest<{ session: AdminChatSession }>(`/admin-chat/sessions/${sessionId}`, {
            errorMessage: 'Failed to get admin chat session',
        });
        return session;
    },

    async updateBrand(sessionId: string, brandGuidelineId: string | undefined): Promise<AdminChatSession> {
        const { session } = await chatApiRequest<{ session: AdminChatSession }>(`/admin-chat/sessions/${sessionId}/brand`, {
            method: 'PATCH',
            body: { brandGuidelineId: brandGuidelineId || null },
            errorMessage: 'Failed to update session brand',
        });
        return session;
    },

    async deleteSession(sessionId: string): Promise<void> {
        await chatApiRequest<void>(`/admin-chat/sessions/${sessionId}`, {
            method: 'DELETE',
            errorMessage: 'Failed to delete admin chat session',
        });
    },

    async sendMessage(sessionId: string, message: string, planMode?: boolean, textMode?: string): Promise<AdminChatSendMessageResult> {
        return chatApiRequest<AdminChatSendMessageResult>(`/admin-chat/sessions/${sessionId}/message`, {
            method: 'POST',
            body: {
                message,
                ...(planMode ? { planMode: true } : {}),
                ...(textMode && textMode !== 'layers' ? { textMode } : {}),
            },
            errorMessage: 'Failed to send message to admin chat',
        });
    },

    /**
     * SSE streaming version. Calls onThinking each time the server sends a
     * progress event, then resolves with the final result.
     */
    async sendMessageStream(
        sessionId: string,
        message: string,
        callbacks?: {
            onThinking?: (msg: string) => void;
            onToolStart?: (name: string) => void;
        }
    ): Promise<AdminChatSendMessageResult> {
        const token = (await import('@/services/authService')).authService.getToken();

        const response = await fetch(`${API_BASE}/admin-chat/sessions/${sessionId}/message/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';

            for (const part of parts) {
                const eventLine = part.match(/^event: (\w+)/m)?.[1];
                const dataLine = part.match(/^data: (.+)/m)?.[1];
                if (!eventLine || !dataLine) continue;

                try {
                    const payload = JSON.parse(dataLine);
                    if (eventLine === 'thinking') callbacks?.onThinking?.(payload.message);
                    if (eventLine === 'tool_start') callbacks?.onToolStart?.(payload.name);
                    if (eventLine === 'done') return payload as AdminChatSendMessageResult;
                    if (eventLine === 'error') throw new Error(payload.message);
                } catch (e) {
                    if ((e as Error).message?.startsWith('Stream')) throw e;
                }
            }
        }

        throw new Error('Stream ended without done event');
    },

    async approvePending(
        sessionId: string,
        pendingId: string
    ): Promise<{ pending: PendingBrandKnowledgeApproval; knowledgeFile?: any }> {
        return chatApiRequest(`/admin-chat/sessions/${sessionId}/pendings/${pendingId}/approve`, {
            method: 'POST',
            errorMessage: 'Failed to approve pending',
        });
    },

    async rejectPending(
        sessionId: string,
        pendingId: string
    ): Promise<{ pending: PendingBrandKnowledgeApproval }> {
        return chatApiRequest(`/admin-chat/sessions/${sessionId}/pendings/${pendingId}/reject`, {
            method: 'POST',
            errorMessage: 'Failed to reject pending',
        });
    },

    async uploadToSession(
        sessionId: string,
        source: 'pdf' | 'image' | 'url' | 'text',
        data?: string,
        url?: string,
        filename?: string
    ): Promise<any> {
        return chatApiRequest(`/admin-chat/sessions/${sessionId}/upload`, {
            method: 'POST',
            body: { source, url, data, filename },
            errorMessage: 'Failed to upload document to admin chat',
        });
    },
};
