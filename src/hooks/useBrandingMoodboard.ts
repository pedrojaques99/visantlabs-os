import { useState, useEffect, useCallback } from 'react';
import type { BrandingData, SectionLayout } from '../types/types';
import { getStepContent, hasStepContent } from '@/utils/brandingHelpers';

interface UseBrandingMoodboardProps {
  data: BrandingData;
  steps: Array<{ id: number; title: string }>;
}

export const useBrandingMoodboard = ({ data, steps }: UseBrandingMoodboardProps) => {
  const [editableData, setEditableData] = useState<BrandingData>(data);
  const [editingSections, setEditingSections] = useState<Set<number>>(new Set());

  // Initialize UI states from data (persisted) or empty sets
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set(data.collapsedSections || [])
  );
  const [compactSections, setCompactSections] = useState<Set<number>>(
    new Set(data.compactSections || [])
  );

  useEffect(() => {
    setEditableData(data);
    // Load persisted UI states from data
    setCollapsedSections(new Set(data.collapsedSections || []));

    // Update compact sections: sections without content should be compact
    const newCompactSections = new Set<number>(data.compactSections || []);
    steps.forEach(step => {
      const content = getStepContent(step.id, data);
      const hasData = content && (
        (typeof content === 'string' && content.trim().length > 0) ||
        (Array.isArray(content) && content.length > 0) ||
        (typeof content === 'object' && Object.keys(content).length > 0)
      );
      // If section now has data and was compact, remove from compact set
      if (hasData && newCompactSections.has(step.id)) {
        newCompactSections.delete(step.id);
      }
      // If section has no data, add to compact set
      if (!hasData) {
        newCompactSections.add(step.id);
      }
    });
    setCompactSections(newCompactSections);
  }, [data, steps]);

  // Update layout in editableData
  const updateLayout = useCallback((layout: SectionLayout) => {
    setEditableData(prev => ({
      ...prev,
      layout,
    }));
  }, []);

  // Update UI states in editableData when they change
  const updateUIStates = useCallback(() => {
    setEditableData(prev => ({
      ...prev,
      collapsedSections: Array.from(collapsedSections),
      compactSections: Array.from(compactSections),
    }));
  }, [collapsedSections, compactSections]);

  // Get current layout from editableData - memoizado para evitar recriações
  const getLayout = useCallback((): SectionLayout | undefined => {
    return editableData.layout;
  }, [editableData]);

  const toggleSectionCollapse = (stepNumber: number) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      // Update editableData with new collapsed state
      setEditableData(current => ({
        ...current,
        collapsedSections: Array.from(next),
      }));
      return next;
    });
  };

  const toggleSectionCompact = (stepNumber: number) => {
    setCompactSections(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      // Update editableData with new compact state
      setEditableData(current => ({
        ...current,
        compactSections: Array.from(next),
      }));
      return next;
    });
  };

  const toggleSectionEdit = (stepNumber: number) => {
    setEditingSections(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const updateStepContent = (stepNumber: number, value: any) => {
    // Helper to clean and normalize string content
    const cleanString = (text: string): string => {
      if (!text) return '';

      // Convert literal \n to actual newlines
      let cleaned = text.replace(/\\n/g, '\n');

      // Remove leading/trailing whitespace but preserve internal formatting
      cleaned = cleaned.trim();

      // Normalize multiple consecutive newlines to double newlines (paragraph breaks)
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

      return cleaned;
    };

    // Helper to ensure steps 1-4 always store strings
    const ensureString = (val: any): string => {
      if (typeof val === 'string') return cleanString(val);
      if (val === null || val === undefined) return '';
      return cleanString(String(val));
    };

    setEditableData(prev => {
      const updated = { ...prev };
      switch (stepNumber) {
        case 1:
          updated.mercadoNicho = ensureString(value);
          break;
        case 2:
          updated.publicoAlvo = ensureString(value);
          break;
        case 3:
          updated.posicionamento = ensureString(value);
          break;
        case 4:
          updated.insights = ensureString(value);
          break;
        case 5:
          updated.competitors = value;
          break;
        case 6:
          updated.references = value;
          break;
        case 7:
          updated.swot = value;
          break;
        case 8:
          updated.colorPalettes = value;
          break;
        case 9:
          updated.visualElements = value;
          break;
        case 10:
          updated.persona = value;
          break;
        case 11:
          updated.mockupIdeas = value;
          break;
        case 12:
          updated.moodboard = value;
          break;
      }
      return updated;
    });
  };

  const getStepContentForComponent = (stepNumber: number) => {
    return getStepContent(stepNumber, editableData);
  };

  const hasContentForStep = useCallback((stepNumber: number) => {
    return hasStepContent(stepNumber, editableData);
  }, [editableData]);

  return {
    editableData,
    setEditableData,
    editingSections,
    setEditingSections,
    collapsedSections,
    compactSections,
    toggleSectionCollapse,
    toggleSectionCompact,
    toggleSectionEdit,
    updateStepContent,
    getStepContent: getStepContentForComponent,
    hasContent: hasContentForStep,
    updateLayout,
    getLayout,
  };
};

