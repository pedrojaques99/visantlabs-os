import { useCallback } from 'react';
import { usePluginStore } from '../store';

export function useDesignSystem() {
  const store = usePluginStore();

  const importFromJson = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);

      // Detect format
      let designSystem = parsed;
      if (parsed.tokens && !parsed.format) {
        designSystem = { ...parsed, format: 'visant' };
      } else if (parsed.$theme) {
        designSystem = { ...parsed, format: 'w3c' };
      }

      store.setDesignSystem(designSystem);
      store.showToast('Design system imported', 'success');
      return true;
    } catch (err) {
      console.error('Failed to import design system:', err);
      store.showToast('Invalid JSON format', 'error');
      return false;
    }
  }, [store]);

  const clearDesignSystem = useCallback(() => {
    store.setDesignSystem(null);
  }, [store]);

  return { importFromJson, clearDesignSystem, designSystem: store.designSystem };
}
