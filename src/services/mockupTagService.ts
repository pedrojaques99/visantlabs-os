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

const API_BASE = '/api/mockup-tags';

export const mockupTagService = {
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
