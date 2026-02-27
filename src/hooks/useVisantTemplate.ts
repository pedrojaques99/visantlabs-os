import { useState, useEffect } from 'react';
import { visantTemplatesApi } from '../services/visantTemplatesApi';
import type { VisantTemplate } from '../types/visant';

export const useVisantTemplate = () => {
  const [activeTemplate, setActiveTemplate] = useState<VisantTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActiveTemplate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const template = await visantTemplatesApi.getActive();
        setActiveTemplate(template);
      } catch (err: any) {
        console.error('Error loading active visant template:', err);
        setError(err.message || 'Failed to load template');
        setActiveTemplate(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveTemplate();
  }, []);

  return { activeTemplate, isLoading, error };
};






