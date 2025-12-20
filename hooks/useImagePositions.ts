import { useState, useEffect, useCallback } from 'react';

export interface ImagePosition {
  x: number;
  y: number;
}

const SPACING = 350;

export const useImagePositions = (
  mockups: any[],
  storageKey: string
) => {
  const [imagePositions, setImagePositions] = useState<Record<string, ImagePosition>>({});

  // Load positions from localStorage
  const loadPositions = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, ImagePosition>;
        }
      }
    } catch {
      // Ignore errors
    }
    return {};
  }, [storageKey]);

  // Save positions to localStorage
  const savePositions = useCallback((positions: Record<string, ImagePosition>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(positions));
    } catch {
      // Ignore errors
    }
  }, [storageKey]);

  // Load saved positions on mount
  useEffect(() => {
    const saved = loadPositions();
    if (Object.keys(saved).length > 0) {
      setImagePositions(saved);
    }
  }, [loadPositions]);

  // Initialize positions when mockups change
  useEffect(() => {
    if (Array.isArray(mockups) && mockups.length > 0) {
      try {
        setImagePositions(prev => {
          const saved = loadPositions();
          const newPositions: Record<string, ImagePosition> = {};
          let hasNew = false;
          
          const cols = Math.ceil(Math.sqrt(mockups.length)) || 1;
          const startX = 100;
          const startY = 100;
          
          let existingCount = 0;
          mockups.forEach((mockup) => {
            const mockupId = mockup?._id ? String(mockup._id) : null;
            if (mockupId && (prev[mockupId] || saved[mockupId])) {
              existingCount++;
            }
          });
          
          let newIndex = 0;
          mockups.forEach((mockup) => {
            const mockupId = mockup?._id ? String(mockup._id) : null;
            if (mockupId && !prev[mockupId] && !saved[mockupId]) {
              const totalIndex = existingCount + newIndex;
              const row = Math.floor(totalIndex / cols);
              const col = totalIndex % cols;
              
              const baseX = startX + col * SPACING;
              const baseY = startY + row * SPACING;
              
              const seed = mockupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const randomX = (seed * 9301 + 49297) % 60;
              const randomY = (seed * 9301 + 49297) * 7 % 60;
              
              newPositions[mockupId] = { 
                x: baseX + randomX - 30,
                y: baseY + randomY - 30
              };
              hasNew = true;
              newIndex++;
            }
          });
          
          if (hasNew) {
            const updated = { ...prev, ...newPositions };
            savePositions(updated);
            return updated;
          }
          return prev;
        });
      } catch {
        // Silently handle errors
      }
    }
  }, [mockups, loadPositions, savePositions]);

  return {
    imagePositions,
    setImagePositions,
    savePositions,
  };
};

