import { authService } from './authService';

export interface MockupTag {
    id: string;
    name: string;
    categoryId: string;
}

export interface MockupTagCategory {
    id: string;
    name: string;
    displayOrder: number;
    tags: MockupTag[];
}

export interface AvailableTags {
    branding: string[];
    categories: string[];
    locations: string[];
    angles: string[];
    lighting: string[];
    effects: string[];
    materials: string[];
}

const API_BASE = '/api/mockup-tags';

export const mockupTagService = {
    /**
     * Get all available tags from all collections (unified endpoint)
     * Replaces multiple individual service calls with a single request
     */
    async getAvailableTagsAsync(): Promise<AvailableTags> {
        const response = await fetch(`${API_BASE}/available`);
        if (!response.ok) {
            throw new Error('Failed to fetch available tags');
        }
        return response.json();
    },

    async getCategoriesAsync(): Promise<MockupTagCategory[]> {
        const response = await fetch(`${API_BASE}/categories`);
        if (!response.ok) {
            throw new Error('Failed to fetch mockup tag categories');
        }
        return response.json();
    },

    async createCategoryAsync(name: string, displayOrder?: number): Promise<MockupTagCategory> {
        const token = authService.getToken();
        const response = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, displayOrder })
        });
        if (!response.ok) {
            throw new Error('Failed to create category');
        }
        return response.json();
    },

    async createTagAsync(name: string, categoryId: string): Promise<MockupTag> {
        const token = authService.getToken();
        const response = await fetch(`${API_BASE}/tags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, categoryId })
        });
        if (!response.ok) {
            throw new Error('Failed to create tag');
        }
        return response.json();
    }
};
