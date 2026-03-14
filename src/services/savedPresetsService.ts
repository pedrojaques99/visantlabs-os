import { authService } from './authService';

const getApiBaseUrl = () => {
    const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
    return viteApiUrl || '/api';
};
const API_BASE_URL = getApiBaseUrl();

export interface SavedPreset {
    id: string;
    name: string;
    config: any;
    isDefault?: boolean;
    createdAt?: string;
}

export const savedPresetsService = {
    async getAll(): Promise<SavedPreset[]> {
        const token = authService.getToken();
        if (!token) return [];

        const response = await fetch(`${API_BASE_URL}/surprise-me`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch presets');
        }

        const data = await response.json();
        return data.presets || [];
    },

    async save(name: string, config: any, isDefault: boolean = false): Promise<SavedPreset> {
        const token = authService.getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/surprise-me`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name, config, isDefault }),
        });

        if (!response.ok) {
            throw new Error('Failed to save preset');
        }

        const data = await response.json();
        return data.preset;
    },

    async delete(id: string): Promise<void> {
        const token = authService.getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/surprise-me/${id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to delete preset');
        }
    }
};
