import { authService } from './authService';
import { SurpriseMeSelectedTags } from '@/utils/surpriseMeSettings';

export interface SurpriseMePreset {
    id: string;
    name: string;
    config: SurpriseMeSelectedTags;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    userId: string;
}

const API_BASE_URL = '/api/surprise-me';

export const surpriseMeService = {
    /**
     * Fetch all presets for the current user
     */
    async getPresets(): Promise<SurpriseMePreset[]> {
        const token = authService.getToken();
        if (!token) return [];

        try {
            const response = await fetch(API_BASE_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch presets');
            }

            const data = await response.json();
            return data.presets || [];
        } catch (error) {
            console.error('Error fetching Surprise Me presets:', error);
            return [];
        }
    },

    /**
     * Save a new preset
     */
    async savePreset(name: string, config: SurpriseMeSelectedTags): Promise<SurpriseMePreset | null> {
        const token = authService.getToken();
        if (!token) throw new Error('Not authenticated');

        try {
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name, config }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save preset');
            }

            const data = await response.json();
            return data.preset;
        } catch (error) {
            console.error('Error saving Surprise Me preset:', error);
            throw error;
        }
    },

    /**
     * Delete a preset
     */
    async deletePreset(id: string): Promise<boolean> {
        const token = authService.getToken();
        if (!token) throw new Error('Not authenticated');

        try {
            const response = await fetch(`${API_BASE_URL}/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            return response.ok;
        } catch (error) {
            console.error('Error deleting Surprise Me preset:', error);
            return false;
        }
    },
};
