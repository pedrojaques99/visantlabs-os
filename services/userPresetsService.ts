
import { authService } from './authService';


let presetsPromise: Promise<Record<string, any[]>> | null = null;


/**
 * Get all user presets (My Presets)
 */
export function getAllUserPresets(): Promise<Record<string, any[]>> {
    if (presetsPromise) {
        return presetsPromise;
    }

    presetsPromise = (async () => {
        try {
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

            const response = await fetch(`/api/users/${user.id}/presets`, {
                headers: {
                    Authorization: `Bearer ${authService.getToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Ensure all expected keys exist
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
                    ...data
                };
            }
            throw new Error('Failed to fetch user presets');
        } catch (error) {
            console.error('Failed to load user presets:', error);
            // On error, clear the promise to allow retries
            presetsPromise = null;
            // Return empty structure on error to prevent app crash, 
            // consistent with previous behavior but now handled in catch
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
    })();

    return presetsPromise;
}

/**
 * Clear user presets cache
 */
export function clearUserPresetsCache(): void {
    presetsPromise = null;
}

