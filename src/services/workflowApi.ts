import { authService } from './authService';
import type { Node, Edge } from '@xyflow/react';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
    const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
    if (viteApiUrl) {
        return viteApiUrl;
    }
    return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = () => {
    const token = authService.getToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

export interface CanvasWorkflow {
    _id: string;
    userId: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    nodes: Node[];
    edges: Edge[];
    thumbnailUrl?: string;
    isPublic: boolean;
    isApproved: boolean;
    likesCount: number;
    usageCount: number;
    isLikedByUser?: boolean;
    createdAt: string;
    updatedAt: string;
}

export const workflowApi = {
    async getAll(): Promise<CanvasWorkflow[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch workflows');
            }

            const data = await response.json();
            return data.workflows || [];
        } catch (error: any) {
            console.error('Error fetching workflows:', error);
            throw error;
        }
    },

    async getPublic(category?: string): Promise<CanvasWorkflow[]> {
        try {
            const url = category && category !== 'all'
                ? `${API_BASE_URL}/workflows/public?category=${category}&_t=${Date.now()}`
                : `${API_BASE_URL}/workflows/public?_t=${Date.now()}`;

            const response = await fetch(url, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch public workflows');
            }

            const data = await response.json();
            return data.workflows || [];
        } catch (error: any) {
            console.error('Error fetching public workflows:', error);
            throw error;
        }
    },

    async getById(id: string): Promise<CanvasWorkflow> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch workflow');
            }

            const data = await response.json();
            return data.workflow;
        } catch (error: any) {
            console.error('Error fetching workflow:', error);
            throw error;
        }
    },

    async create(workflow: Partial<CanvasWorkflow>): Promise<CanvasWorkflow> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create workflow');
            }

            const data = await response.json();
            return data.workflow;
        } catch (error: any) {
            console.error('Error creating workflow:', error);
            throw error;
        }
    },

    async update(id: string, workflow: Partial<CanvasWorkflow>): Promise<CanvasWorkflow> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update workflow');
            }

            const data = await response.json();
            return data.workflow;
        } catch (error: any) {
            console.error('Error updating workflow:', error);
            throw error;
        }
    },

    async delete(id: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete workflow');
            }
        } catch (error: any) {
            console.error('Error deleting workflow:', error);
            throw error;
        }
    },

    async toggleLike(id: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows/${id}/like`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle like');
            }

            const data = await response.json();
            return data.liked;
        } catch (error: any) {
            console.error('Error toggling like:', error);
            throw error;
        }
    },

    async duplicate(id: string): Promise<CanvasWorkflow> {
        try {
            const response = await fetch(`${API_BASE_URL}/workflows/${id}/duplicate`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to duplicate workflow');
            }

            const data = await response.json();
            return data.workflow;
        } catch (error: any) {
            console.error('Error duplicating workflow:', error);
            throw error;
        }
    },

    async incrementUsage(id: string): Promise<void> {
        try {
            await fetch(`${API_BASE_URL}/workflows/${id}/use`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
        } catch (error: any) {
            // Silently fail - usage tracking is not critical
            console.warn('Failed to increment usage count:', error);
        }
    },
};
