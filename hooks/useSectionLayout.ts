import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SectionLayout, SectionPosition } from '../types';
import {
  createDefaultLayout,
  moveSection as moveSectionHelper,
  resizeSection as resizeSectionHelper,
  addColumn as addColumnHelper,
  removeColumn as removeColumnHelper,
  resetLayout as resetLayoutHelper,
  isLayoutValid,
  toggleFullWidth as toggleFullWidthHelper,
  setColumnCount as setColumnCountHelper,
} from '../utils/sectionLayoutHelpers';

interface UseSectionLayoutProps {
  stepIds: number[];
  initialLayout?: SectionLayout;
  onLayoutChange?: (layout: SectionLayout) => void;
}

// Helper para comparar layouts (deep equality simples)
const areLayoutsEqual = (a: SectionLayout, b: SectionLayout): boolean => {
  if (a.columns !== b.columns) return false;
  if (a.sections.length !== b.sections.length) return false;
  
  for (let i = 0; i < a.sections.length; i++) {
    const sectionA = a.sections[i];
    const sectionB = b.sections[i];
    if (
      sectionA.stepNumber !== sectionB.stepNumber ||
      sectionA.columnIndex !== sectionB.columnIndex ||
      sectionA.order !== sectionB.order
    ) {
      return false;
    }
  }
  return true;
};

export const useSectionLayout = ({
  stepIds,
  initialLayout,
  onLayoutChange,
}: UseSectionLayoutProps) => {
  // Cria layout inicial (padrão ou do initialLayout se fornecido)
  const getInitialLayout = useCallback((): SectionLayout => {
    if (initialLayout && isLayoutValid(initialLayout, stepIds)) {
      return initialLayout;
    }
    return createDefaultLayout(stepIds);
  }, [initialLayout, stepIds]);

  const [layout, setLayout] = useState<SectionLayout>(() => {
    if (initialLayout && isLayoutValid(initialLayout, stepIds)) {
      return initialLayout;
    }
    return createDefaultLayout(stepIds);
  });
  
  const previousLayoutRef = useRef<SectionLayout>(layout);
  const onLayoutChangeRef = useRef(onLayoutChange);
  const initialLayoutRef = useRef(initialLayout);
  const stepIdsRef = useRef(stepIds);
  // Track if layout change is internal (from user actions) to prevent circular updates
  const isInternalChangeRef = useRef(false);

  // Atualizar refs quando mudarem
  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange;
  }, [onLayoutChange]);

  // Atualizar layout apenas quando stepIds mudar (não quando initialLayout mudar)
  useEffect(() => {
    // Comparar stepIds usando JSON para detectar mudanças
    const stepIdsChanged = JSON.stringify(stepIdsRef.current) !== JSON.stringify(stepIds);
    
    if (stepIdsChanged) {
      stepIdsRef.current = stepIds;
      // Se stepIds mudou, recriar layout padrão
      const defaultLayout = createDefaultLayout(stepIds);
      setLayout(defaultLayout);
    }
  }, [stepIds]);

  // Sincronizar com initialLayout apenas se for uma mudança externa real
  useEffect(() => {
    // Skip sync if the change originated from our own internal state updates
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    // Só sincronizar se initialLayout mudou e é válido
    if (
      initialLayout &&
      isLayoutValid(initialLayout, stepIds) &&
      (initialLayoutRef.current === undefined || 
       !areLayoutsEqual(initialLayoutRef.current, initialLayout))
    ) {
      // Só atualizar se o layout atual é diferente do initialLayout
      setLayout(prevLayout => {
        if (!areLayoutsEqual(prevLayout, initialLayout)) {
          initialLayoutRef.current = initialLayout;
          return initialLayout;
        }
        return prevLayout;
      });
    } else if (!initialLayout) {
      initialLayoutRef.current = undefined;
    }
  }, [initialLayout, stepIds]);

  // Notifica mudanças no layout apenas se realmente mudou
  useEffect(() => {
    if (!areLayoutsEqual(previousLayoutRef.current, layout)) {
      // Mark as internal change before calling onLayoutChange
      // This prevents the sync useEffect from running when the parent updates initialLayout
      isInternalChangeRef.current = true;
      
      if (onLayoutChangeRef.current) {
        onLayoutChangeRef.current(layout);
      }
      previousLayoutRef.current = layout;
    }
  }, [layout]);

  const moveSection = useCallback(
    (stepNumber: number, targetColumnIndex: number, targetOrder: number, fullWidth?: boolean, span?: number) => {
      // Mark as internal change before updating layout
      isInternalChangeRef.current = true;
      setLayout(prevLayout => {
        const newLayout = moveSectionHelper(
          prevLayout,
          stepNumber,
          targetColumnIndex,
          targetOrder,
          fullWidth,
          span
        );
        return newLayout;
      });
    },
    []
  );

  const resizeSection = useCallback(
    (stepNumber: number, height?: number, width?: number, span?: number) => {
      // Mark as internal change before updating layout
      isInternalChangeRef.current = true;
      setLayout(prevLayout => {
        const newLayout = resizeSectionHelper(
          prevLayout,
          stepNumber,
          height,
          width,
          span
        );
        return newLayout;
      });
    },
    []
  );

  const addColumn = useCallback(() => {
    // Mark as internal change before updating layout
    isInternalChangeRef.current = true;
    setLayout(prevLayout => addColumnHelper(prevLayout));
  }, []);

  const removeColumn = useCallback(() => {
    // Mark as internal change before updating layout
    isInternalChangeRef.current = true;
    setLayout(prevLayout => removeColumnHelper(prevLayout));
  }, []);

  const resetLayout = useCallback(() => {
    // Mark as internal change before updating layout
    isInternalChangeRef.current = true;
    setLayout(resetLayoutHelper(stepIds));
  }, [stepIds]);

  const getSectionPosition = useCallback(
    (stepNumber: number): SectionPosition | undefined => {
      return layout.sections.find(s => s.stepNumber === stepNumber);
    },
    [layout]
  );

  // Memoiza seções por coluna para performance
  const sectionsByColumn = useMemo(() => {
    const result: Record<number, SectionPosition[]> = {};
    for (let i = 0; i < layout.columns; i++) {
      result[i] = layout.sections
        .filter(s => s.columnIndex === i)
        .sort((a, b) => a.order - b.order);
    }
    return result;
  }, [layout]);

  const toggleFullWidth = useCallback(
    (stepNumber: number, makeFullWidth: boolean) => {
      isInternalChangeRef.current = true;
      setLayout(prevLayout => toggleFullWidthHelper(prevLayout, stepNumber, makeFullWidth));
    },
    []
  );

  const setColumnCount = useCallback(
    (columns: number) => {
      // Mark as internal change before updating layout
      isInternalChangeRef.current = true;
      setLayout(prevLayout => setColumnCountHelper(prevLayout, columns));
    },
    []
  );

  return {
    layout,
    setLayout,
    moveSection,
    resizeSection,
    addColumn,
    removeColumn,
    resetLayout,
    getSectionPosition,
    sectionsByColumn,
    toggleFullWidth,
    setColumnCount,
  };
};

