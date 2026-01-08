
import { authService } from './authService';

let cachedUserPresets: Record<string, any[]> | null = null;
let isLoadingPresets = false;

/**
 * Get all user presets (My Presets)
 */
export async function getAllUserPresets(): Promise<Record<string, any[]>> {
    if (isLoadingPresets && cachedUserPresets) {
        return cachedUserPresets;
    }

    const user = await authService.verifyToken();
    if (!user) {
        return {
            mockup: [],
            angle: [],
            texture: [],
            ambience: [],
            luminance: [],
            '3d': [],
            presets: [],
            aesthetics: [],
            themes: [],
        };
    }

    isLoadingPresets = true;
    try {
        const response = await fetch(`/api/users/${user.id}/presets`, {
            headers: {
                Authorization: `Bearer ${authService.getToken()}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Ensure all expected keys exist
            cachedUserPresets = {
                mockup: [],
                angle: [],
                texture: [],
                ambience: [],
                luminance: [],
                '3d': [],
                presets: [],
                aesthetics: [],
                themes: [],
                ...data
            };
            return cachedUserPresets!;
        }
    } catch (error) {
        console.error('Failed to load user presets:', error);
    } finally {
        isLoadingPresets = false;
    }

    return {
        mockup: [],
        angle: [],
        texture: [],
        ambience: [],
        luminance: [],
        '3d': [],
        presets: [],
        aesthetics: [],
        themes: [],
    };
}

/**
 * Clear user presets cache
 */
export function clearUserPresetsCache(): void {
    cachedUserPresets = null;
}
