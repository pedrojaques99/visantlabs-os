import type { SectionLayout, SectionPosition } from '../types/types';

/**
 * Cria um layout padrão com todas as sections em 2 colunas
 */
export const createDefaultLayout = (stepIds: number[]): SectionLayout => {
  const sections: SectionPosition[] = stepIds.map((stepNumber, index) => ({
    stepNumber,
    columnIndex: index % 2, // Alterna entre colunas 0 e 1
    order: Math.floor(index / 2),
  }));

  return {
    columns: 2,
    sections,
  };
};

/**
 * Obtém a posição de uma section no layout
 */
export const getSectionPosition = (
  layout: SectionLayout,
  stepNumber: number
): SectionPosition | undefined => {
  return layout.sections.find(s => s.stepNumber === stepNumber);
};

/**
 * Obtém todas as sections de uma coluna em ordem
 */
export const getSectionsInColumn = (
  layout: SectionLayout,
  columnIndex: number
): SectionPosition[] => {
  return layout.sections
    .filter(s => s.columnIndex === columnIndex)
    .sort((a, b) => a.order - b.order);
};

/**
 * Obtém todas as sections full-width em ordem
 */
export const getFullWidthSections = (
  layout: SectionLayout
): SectionPosition[] => {
  return layout.sections
    .filter(s => s.fullWidth === true || s.columnIndex === -1)
    .sort((a, b) => a.order - b.order);
};

/**
 * Calcula a próxima ordem disponível em uma coluna
 */
export const getNextOrderInColumn = (
  layout: SectionLayout,
  columnIndex: number
): number => {
  const sectionsInColumn = getSectionsInColumn(layout, columnIndex);
  if (sectionsInColumn.length === 0) return 0;
  return Math.max(...sectionsInColumn.map(s => s.order)) + 1;
};

/**
 * Reorganiza as ordens de todas as sections em uma coluna
 */
export const reorderSectionsInColumn = (
  layout: SectionLayout,
  columnIndex: number
): SectionLayout => {
  const sectionsInColumn = getSectionsInColumn(layout, columnIndex);
  const reordered = sectionsInColumn.map((section, index) => ({
    ...section,
    order: index,
  }));

  const otherSections = layout.sections.filter(
    s => s.columnIndex !== columnIndex
  );

  return {
    ...layout,
    sections: [...otherSections, ...reordered],
  };
};

/**
 * Move uma section para uma nova posição
 */
export const moveSection = (
  layout: SectionLayout,
  stepNumber: number,
  targetColumnIndex: number,
  targetOrder: number,
  fullWidth?: boolean,
  span?: number
): SectionLayout => {
  // Remove a section da posição atual
  const otherSections = layout.sections.filter(
    s => s.stepNumber !== stepNumber
  );

  const isFullWidth = fullWidth === true || targetColumnIndex === -1;

  // Se for full-width, trata diferente
  if (isFullWidth) {
    // Atualiza as ordens das sections full-width que estão após a posição de destino
    const fullWidthSections = getFullWidthSections({ ...layout, sections: otherSections });
    const sectionsAfter = fullWidthSections
      .filter(s => s.order >= targetOrder)
      .map(s => ({ ...s, order: s.order + 1 }));

    const unaffectedSections = otherSections.filter(
      s => !(s.fullWidth === true || s.columnIndex === -1) || s.order < targetOrder
    );

    // Adiciona a section full-width na nova posição
    const movedSection: SectionPosition = {
      stepNumber,
      columnIndex: -1,
      order: targetOrder,
      fullWidth: true,
      span: layout.columns, // Span todas as colunas
    };

    return {
      ...layout,
      sections: [...unaffectedSections, ...sectionsAfter, movedSection],
    };
  }

  // Comportamento normal para colunas
  // Atualiza as ordens das sections na coluna de destino que estão após a posição de destino
  const sectionsInTargetColumn = otherSections
    .filter(s => s.columnIndex === targetColumnIndex && s.order >= targetOrder)
    .map(s => ({ ...s, order: s.order + 1 }));

  // Mantém as sections que não precisam ser movidas
  const unaffectedSections = otherSections.filter(
    s => !(s.columnIndex === targetColumnIndex && s.order >= targetOrder)
  );

  // Adiciona a section na nova posição
  const movedSection: SectionPosition = {
    stepNumber,
    columnIndex: targetColumnIndex,
    order: targetOrder,
    span: span || 1, // Span padrão de 1 coluna
  };

  // Reorganiza ambas as colunas afetadas
  const updatedLayout: SectionLayout = {
    ...layout,
    sections: [...unaffectedSections, ...sectionsInTargetColumn, movedSection],
  };

  // Reorganiza a coluna de origem
  const sourceSection = layout.sections.find(s => s.stepNumber === stepNumber);
  if (sourceSection && sourceSection.columnIndex !== targetColumnIndex) {
    const sourceIsFullWidth = sourceSection.fullWidth === true || sourceSection.columnIndex === -1;
    if (sourceIsFullWidth) {
      // Reorganizar full-width sections
      return reorderFullWidthSections(updatedLayout);
    }
    return reorderSectionsInColumn(
      reorderSectionsInColumn(updatedLayout, sourceSection.columnIndex),
      targetColumnIndex
    );
  }

  return reorderSectionsInColumn(updatedLayout, targetColumnIndex);
};

/**
 * Reorganiza as ordens de todas as sections full-width
 */
export const reorderFullWidthSections = (
  layout: SectionLayout
): SectionLayout => {
  const fullWidthSections = getFullWidthSections(layout);
  const reordered = fullWidthSections.map((section, index) => ({
    ...section,
    order: index,
  }));

  const otherSections = layout.sections.filter(
    s => !(s.fullWidth === true || s.columnIndex === -1)
  );

  return {
    ...layout,
    sections: [...otherSections, ...reordered],
  };
};

/**
 * Atualiza o tamanho de uma section
 */
export const resizeSection = (
  layout: SectionLayout,
  stepNumber: number,
  height?: number,
  width?: number,
  span?: number
): SectionLayout => {
  return {
    ...layout,
    sections: layout.sections.map(section =>
      section.stepNumber === stepNumber
        ? { ...section, height, width, span: span !== undefined ? span : section.span }
        : section
    ),
  };
};

/**
 * Torna uma section full-width ou retorna para coluna normal
 */
export const toggleFullWidth = (
  layout: SectionLayout,
  stepNumber: number,
  makeFullWidth: boolean
): SectionLayout => {
  const section = layout.sections.find(s => s.stepNumber === stepNumber);
  if (!section) return layout;

  if (makeFullWidth) {
    // Mover para full-width
    const otherSections = layout.sections.filter(s => s.stepNumber !== stepNumber);
    const fullWidthSections = getFullWidthSections({ ...layout, sections: otherSections });
    const nextOrder = fullWidthSections.length;

    return {
      ...layout,
      sections: [
        ...otherSections.filter(s => !(s.fullWidth === true || s.columnIndex === -1)),
        ...fullWidthSections,
        {
          ...section,
          columnIndex: -1,
          fullWidth: true,
          span: layout.columns,
          order: nextOrder,
        },
      ],
    };
  } else {
    // Retornar para primeira coluna
    const otherSections = layout.sections.filter(s => s.stepNumber !== stepNumber);
    const firstColumnSections = getSectionsInColumn({ ...layout, sections: otherSections }, 0);
    const nextOrder = firstColumnSections.length;

    return {
      ...layout,
      sections: [
        ...otherSections.filter(s => s.columnIndex !== 0),
        ...firstColumnSections,
        {
          ...section,
          columnIndex: 0,
          fullWidth: false,
          span: 1,
          order: nextOrder,
        },
      ],
    };
  }
};

/**
 * Adiciona uma nova coluna
 */
export const addColumn = (layout: SectionLayout): SectionLayout => {
  if (layout.columns >= 3) return layout; // Máximo de 3 colunas
  return {
    ...layout,
    columns: layout.columns + 1,
  };
};

/**
 * Remove uma coluna e move suas sections para a coluna anterior
 */
export const removeColumn = (layout: SectionLayout): SectionLayout => {
  if (layout.columns <= 1) return layout; // Mínimo de 1 coluna

  const targetColumnIndex = layout.columns - 1;
  const sectionsToMove = getSectionsInColumn(layout, targetColumnIndex);

  // Move todas as sections da coluna removida para a coluna anterior
  let updatedLayout = layout;
  sectionsToMove.forEach(section => {
    const nextOrder = getNextOrderInColumn(updatedLayout, targetColumnIndex - 1);
    updatedLayout = moveSection(
      updatedLayout,
      section.stepNumber,
      targetColumnIndex - 1,
      nextOrder
    );
  });

  return {
    ...updatedLayout,
    columns: layout.columns - 1,
  };
};

/**
 * Define o número de colunas e redistribui as sections
 */
export const setColumnCount = (
  layout: SectionLayout,
  targetColumns: number
): SectionLayout => {
  // Validar range (1-3)
  const clampedColumns = Math.max(1, Math.min(3, targetColumns));
  if (clampedColumns === layout.columns) return layout;

  // Separar sections full-width das normais
  const fullWidthSections = getFullWidthSections(layout);
  const normalSections = layout.sections.filter(
    s => !(s.fullWidth === true || s.columnIndex === -1)
  );

  // Se está aumentando colunas
  if (clampedColumns > layout.columns) {
    // Apenas atualizar o número de colunas, sections permanecem nas mesmas posições
    // Atualizar span das sections full-width para o novo número de colunas
    const updatedFullWidthSections = fullWidthSections.map(section => ({
      ...section,
      span: clampedColumns,
    }));

    return {
      columns: clampedColumns,
      sections: [...normalSections, ...updatedFullWidthSections],
    };
  }

  // Se está diminuindo colunas
  // Mover sections das colunas que serão removidas para as colunas restantes
  const sectionsToRedistribute: SectionPosition[] = [];
  const sectionsToKeep: SectionPosition[] = [];

  normalSections.forEach(section => {
    if (section.columnIndex < clampedColumns) {
      // Manter na mesma coluna
      sectionsToKeep.push(section);
    } else {
      // Precisa ser redistribuída
      sectionsToRedistribute.push(section);
    }
  });

  // Redistribuir sections das colunas removidas
  // Ordenar por coluna e ordem para manter ordem lógica
  sectionsToRedistribute.sort((a, b) => {
    if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
    return a.order - b.order;
  });

  // Redistribuir para as colunas restantes de forma circular
  const redistributedSections = sectionsToRedistribute.map((section, index) => {
    const targetColumn = index % clampedColumns;
    const sectionsInTargetColumn = sectionsToKeep.filter(
      s => s.columnIndex === targetColumn
    );
    const maxOrder = sectionsInTargetColumn.length > 0
      ? Math.max(...sectionsInTargetColumn.map(s => s.order))
      : -1;

    return {
      ...section,
      columnIndex: targetColumn,
      order: maxOrder + 1,
    };
  });

  // Atualizar span das sections full-width para o novo número de colunas
  const updatedFullWidthSections = fullWidthSections.map(section => ({
    ...section,
    span: clampedColumns,
  }));

  // Reorganizar todas as colunas para garantir ordens corretas
  let updatedLayout: SectionLayout = {
    columns: clampedColumns,
    sections: [...sectionsToKeep, ...redistributedSections, ...updatedFullWidthSections],
  };

  // Reorganizar cada coluna para garantir ordens sequenciais
  for (let i = 0; i < clampedColumns; i++) {
    updatedLayout = reorderSectionsInColumn(updatedLayout, i);
  }

  return updatedLayout;
};

/**
 * Restaura um layout para o padrão
 */
export const resetLayout = (stepIds: number[]): SectionLayout => {
  return createDefaultLayout(stepIds);
};

/**
 * Verifica se um layout é válido (todas as sections estão presentes)
 */
export const isLayoutValid = (
  layout: SectionLayout,
  stepIds: number[]
): boolean => {
  const layoutStepNumbers = new Set(layout.sections.map(s => s.stepNumber));
  const requiredStepNumbers = new Set(stepIds);

  // Todas as sections devem estar no layout
  for (const stepId of requiredStepNumbers) {
    if (!layoutStepNumbers.has(stepId)) return false;
  }

  // Todas as sections no layout devem ser válidas
  for (const stepId of layoutStepNumbers) {
    if (!requiredStepNumbers.has(stepId)) return false;
  }

  // Verificar se os índices de coluna são válidos (permite -1 para full-width)
  for (const section of layout.sections) {
    if (section.fullWidth === true || section.columnIndex === -1) {
      // Full-width sections são válidas
      continue;
    }
    if (section.columnIndex < 0 || section.columnIndex >= layout.columns) {
      return false;
    }
  }

  return true;
};

