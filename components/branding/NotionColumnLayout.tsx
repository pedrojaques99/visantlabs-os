import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { SectionLayout } from '../../types';

interface DragProps {
  isDraggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  customHeight?: number;
  onResize: (height: number) => void;
}

interface NotionColumnLayoutProps {
  layout: SectionLayout;
  sectionsByColumn: Record<number, Array<{ stepNumber: number; columnIndex: number; order: number }>>;
  stepIds: number[];
  steps: Array<{ id: number; title: string }>;
  // Render props for each section - receives stepNumber and drag props, returns React element
  renderSection: (stepNumber: number, dragProps: DragProps) => React.ReactElement | null;
  // Callbacks
  onMoveSection: (stepNumber: number, targetColumnIndex: number, targetOrder: number, fullWidth?: boolean, span?: number) => void;
  onResizeSection: (stepNumber: number, height: number, width?: number, span?: number) => void;
  onAddColumn?: () => void;
  onToggleFullWidth?: (stepNumber: number, makeFullWidth: boolean) => void;
  // Get custom height for a section
  getSectionHeight?: (stepNumber: number) => number | undefined;
  // Set column count callback
  onSetColumnCount?: (columns: number) => void;
}

export const NotionColumnLayout: React.FC<NotionColumnLayoutProps> = ({
  layout,
  sectionsByColumn,
  stepIds,
  steps,
  renderSection,
  onMoveSection,
  onResizeSection,
  onAddColumn,
  onToggleFullWidth,
  getSectionHeight,
  onSetColumnCount,
}) => {
  const { theme } = useTheme();
  const [draggedStepNumber, setDraggedStepNumber] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [dragOverOrder, setDragOverOrder] = useState<number | null>(null);
  const [showNewColumnPreview, setShowNewColumnPreview] = useState(false);
  const [isDraggingToFullWidth, setIsDraggingToFullWidth] = useState(false);
  const columnRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const autoColumnTimeoutRef = useRef<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  
  // Column count state initialized from localStorage
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('notionColumnLayoutColumns');
    return saved ? parseInt(saved, 10) : layout.columns;
  });
  
  // Sync columns with layout.columns when layout changes externally
  useEffect(() => {
    setColumns(layout.columns);
  }, [layout.columns]);
  
  // Handler for column count change
  const handleColumnsChange = useCallback((newColumns: number) => {
    const clamped = Math.max(1, Math.min(3, newColumns));
    setColumns(clamped);
    localStorage.setItem('notionColumnLayoutColumns', clamped.toString());
    if (onSetColumnCount) {
      onSetColumnCount(clamped);
    }
  }, [onSetColumnCount]);
  
  // Detectar se estamos em desktop (md breakpoint ou maior)
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  // Separar sections full-width das normais
  const fullWidthSections = layout.sections
    .filter(s => s.fullWidth === true || s.columnIndex === -1)
    .sort((a, b) => a.order - b.order);
  
  const normalSections = layout.sections
    .filter(s => !(s.fullWidth === true || s.columnIndex === -1));

  const handleDragStart = useCallback((e: React.DragEvent, stepNumber: number) => {
    setDraggedStepNumber(stepNumber);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', stepNumber.toString());
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedStepNumber(null);
    setDragOverColumn(null);
    setDragOverOrder(null);
    setShowNewColumnPreview(false);
    setIsDraggingToFullWidth(false);
    
    // Limpar timeout ao finalizar drag
    if (autoColumnTimeoutRef.current) {
      clearTimeout(autoColumnTimeoutRef.current);
      autoColumnTimeoutRef.current = null;
    }
  }, []);


  const handleDragOver = useCallback(
    (e: React.DragEvent, columnIndex: number, order: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      setDragOverColumn(columnIndex);
      setDragOverOrder(order);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnIndex: number, targetOrder: number) => {
      e.preventDefault();
      e.stopPropagation();

      const stepNumber = draggedStepNumber;
      if (stepNumber === null) return;

      // Não fazer nada se a section já está nessa posição
      const currentSection = layout.sections.find(s => s.stepNumber === stepNumber);
      if (
        currentSection &&
        currentSection.columnIndex === targetColumnIndex &&
        currentSection.order === targetOrder
      ) {
        handleDragEnd();
        return;
      }

      onMoveSection(stepNumber, targetColumnIndex, targetOrder);
      handleDragEnd();
    },
    [draggedStepNumber, layout, onMoveSection, handleDragEnd]
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent, columnIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const stepNumber = draggedStepNumber;
      if (stepNumber === null) return;

      const sectionsInColumn = sectionsByColumn[columnIndex] || [];
      const nextOrder = sectionsInColumn.length;

      onMoveSection(stepNumber, columnIndex, nextOrder);
      handleDragEnd();
    },
    [draggedStepNumber, sectionsByColumn, onMoveSection, handleDragEnd]
  );

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, columnIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const sectionsInColumn = sectionsByColumn[columnIndex] || [];
      
      // Throttle state updates para evitar muitos re-renders
      setDragOverColumn(prev => prev !== columnIndex ? columnIndex : prev);
      setDragOverOrder(prev => prev !== sectionsInColumn.length ? sectionsInColumn.length : prev);
      setIsDraggingToFullWidth(false);

      // Detectar se está próximo à borda direita da última coluna
      if (columnIndex === layout.columns - 1 && layout.columns < 3 && onAddColumn && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX;
        const rightEdge = containerRect.right;
        const threshold = 120; // 120px da borda direita para ativar

        // Se estiver próximo à borda direita (dentro do threshold)
        if (mouseX > rightEdge - threshold) {
          // Limpar timeout anterior
          if (autoColumnTimeoutRef.current) {
            clearTimeout(autoColumnTimeoutRef.current);
          }

          // Mostrar preview da nova coluna
          setShowNewColumnPreview(true);

          // Adicionar coluna após um pequeno delay (para evitar adicionar acidentalmente)
          autoColumnTimeoutRef.current = window.setTimeout(() => {
            if (onAddColumn && layout.columns < 3) {
              onAddColumn();
              // Manter preview por um momento para feedback visual
              setTimeout(() => setShowNewColumnPreview(false), 200);
            }
          }, 400); // 400ms de delay para evitar criação acidental
        } else {
          // Limpar preview se saiu da área
          if (autoColumnTimeoutRef.current) {
            clearTimeout(autoColumnTimeoutRef.current);
            autoColumnTimeoutRef.current = null;
          }
          setShowNewColumnPreview(false);
        }
      } else {
        // Limpar preview se não está na última coluna
        if (autoColumnTimeoutRef.current) {
          clearTimeout(autoColumnTimeoutRef.current);
          autoColumnTimeoutRef.current = null;
        }
        setShowNewColumnPreview(false);
      }
    },
    [sectionsByColumn, layout.columns, onAddColumn]
  );
  
  // Detectar drag para fora das colunas (full-width) com snap magnético melhorado
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    if (!containerRef.current || draggedStepNumber === null) return;
    
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseY = e.clientY;
    const mouseX = e.clientX;
    
    // Threshold maior e mais intuitivo para snap magnético
    const snapThreshold = 120; // 120px de área de snap
    const isAboveColumns = mouseY < containerRect.top + snapThreshold;
    const isBelowColumns = mouseY > containerRect.bottom - snapThreshold;
    const isOutsideColumns = mouseX < containerRect.left - snapThreshold || mouseX > containerRect.right + snapThreshold;
    
    // Verificar se está na área de full-width sections (acima do grid)
    const fullWidthContainer = document.querySelector('[data-full-width-container]');
    let isInFullWidthArea = false;
    let targetFullWidthOrder = fullWidthSections.length;
    
    if (fullWidthContainer) {
      const fullWidthRect = fullWidthContainer.getBoundingClientRect();
      // Área expandida para snap - inclui um pouco acima e abaixo para facilitar
      const expandedTop = fullWidthRect.top - 100;
      const expandedBottom = fullWidthRect.bottom + 100;
      
      if (mouseY >= expandedTop && mouseY <= expandedBottom) {
        isInFullWidthArea = true;
        
        // Calcular ordem baseado na posição Y (snap magnético entre sections)
        // Buscar todas as sections full-width e seus drop zones
        const allDropZones: Array<{ element: HTMLElement; order: number }> = [];
        
        // Adicionar drop zone no início (antes da primeira section)
        if (fullWidthSections.length > 0) {
          allDropZones.push({ element: fullWidthContainer as HTMLElement, order: 0 });
        }
        
        // Adicionar drop zones entre sections
        fullWidthSections.forEach((_, index) => {
          const dropZone = fullWidthContainer.querySelector(`[data-drop-zone-order="${index}"]`) as HTMLElement;
          if (dropZone) {
            allDropZones.push({ element: dropZone, order: index });
          }
        });
        
        // Adicionar drop zone no final (após a última section)
        const lastDropZone = fullWidthContainer.querySelector(`[data-drop-zone-order="${fullWidthSections.length}"]`) as HTMLElement;
        if (lastDropZone) {
          allDropZones.push({ element: lastDropZone, order: fullWidthSections.length });
        }
        
        // Encontrar o drop zone mais próximo do mouse
        let closestZone = allDropZones[0];
        let minDistance = Infinity;
        
        for (const zone of allDropZones) {
          const rect = zone.element.getBoundingClientRect();
          const zoneCenter = rect.top + rect.height / 2;
          const distance = Math.abs(mouseY - zoneCenter);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestZone = zone;
          }
        }
        
        // Se está dentro de um drop zone (com margem de erro), usar sua ordem
        if (closestZone) {
          const rect = closestZone.element.getBoundingClientRect();
          if (mouseY >= rect.top - 40 && mouseY <= rect.bottom + 40) {
            targetFullWidthOrder = closestZone.order;
          }
        }
      }
    }
    
    // Ativar full-width se estiver em qualquer área válida
    if (isInFullWidthArea || isAboveColumns || isBelowColumns || isOutsideColumns) {
      setIsDraggingToFullWidth(true);
      setDragOverColumn(null);
      setDragOverOrder(targetFullWidthOrder);
    } else {
      setIsDraggingToFullWidth(false);
    }
  }, [draggedStepNumber, fullWidthSections.length]);
  
  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    if (!isDraggingToFullWidth || draggedStepNumber === null) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const targetOrder = dragOverOrder !== null ? dragOverOrder : fullWidthSections.length;
    onMoveSection(draggedStepNumber, -1, targetOrder, true);
    handleDragEnd();
  }, [isDraggingToFullWidth, draggedStepNumber, dragOverOrder, fullWidthSections.length, onMoveSection, handleDragEnd]);

  const renderDropIndicator = (columnIndex: number, order: number) => {
    if (dragOverColumn !== columnIndex || dragOverOrder !== order) return null;

    return (
      <div
        className="h-2 bg-brand-cyan rounded-md mx-2 my-1 transition-all duration-300"
        style={{
          boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}
      />
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Full-width sections acima das colunas */}
      <div 
        data-full-width-container
        className="w-full space-y-4 md:space-y-6 relative"
        onDragOver={handleContainerDragOver}
        onDrop={handleContainerDrop}
      >
        {/* Drop zone inicial quando não há sections full-width */}
        {fullWidthSections.length === 0 && isDraggingToFullWidth && draggedStepNumber !== null && (
          <div
            data-drop-zone-order={0}
            className="relative h-[10px] flex items-center bg-gradient-to-r from-[#52ddeb]/15 via-[#52ddeb]/20 to-[#52ddeb]/15 rounded-xl border-2 border-[#52ddeb] border-dashed transition-all duration-200"
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-3 w-full px-4">
                <div className="h-1 flex-1 bg-brand-cyan rounded-md" style={{
                  boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }} />
                <div className="px-4 py-2 bg-brand-cyan/20 border border-[#52ddeb]/50 rounded-md text-brand-cyan text-sm font-mono font-semibold whitespace-nowrap">
                  DROP FOR FULL WIDTH
                </div>
                <div className="h-1 flex-1 bg-brand-cyan rounded-md" style={{
                  boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }} />
              </div>
            </div>
            <div className="absolute inset-0 bg-brand-cyan/5 rounded-xl animate-pulse" />
          </div>
        )}
        
        {fullWidthSections.length > 0 && (
          <>
            {fullWidthSections.map((section, index) => {
            const stepNumber = section.stepNumber;
            const step = steps.find(s => s.id === stepNumber);
            if (!step) return null;

            const dragProps: DragProps = {
              isDraggable: true,
              onDragStart: (e: React.DragEvent) => handleDragStart(e, stepNumber),
              onDragEnd: handleDragEnd,
              customHeight: getSectionHeight?.(stepNumber),
              onResize: (height: number) => onResizeSection(stepNumber, height),
            };

            const sectionElement = renderSection(stepNumber, dragProps);
            if (!sectionElement) return null;

            const isDragged = draggedStepNumber === stepNumber;
            const isDropTargetBefore = isDraggingToFullWidth && dragOverOrder === index && !isDragged;
            const isDropTargetAfter = isDraggingToFullWidth && dragOverOrder === index + 1 && !isDragged;

            return (
              <React.Fragment key={stepNumber}>
                {/* Drop zone antes da section */}
                <div
                  data-drop-zone-order={index}
                  className={`relative transition-all duration-200 h-[10px] flex items-center ${
                    isDropTargetBefore
                      ? 'bg-gradient-to-r from-[#52ddeb]/15 via-[#52ddeb]/20 to-[#52ddeb]/15 rounded-xl border-2 border-[#52ddeb] border-dashed'
                      : 'hover:bg-brand-cyan/5'
                  }`}
                  onDragOver={handleContainerDragOver}
                  onDrop={handleContainerDrop}
                >
                  {isDropTargetBefore && (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-3 w-full px-4">
                          <div className="h-1 flex-1 bg-brand-cyan rounded-md" style={{
                            boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
                            animation: 'pulse 1.2s ease-in-out infinite',
                          }} />
                          <div className="px-3 py-1 bg-brand-cyan/20 border border-[#52ddeb]/50 rounded-md text-brand-cyan text-xs font-mono font-semibold whitespace-nowrap">
                            DROP HERE
                          </div>
                          <div className="h-1 flex-1 bg-brand-cyan rounded-md" style={{
                            boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
                            animation: 'pulse 1.2s ease-in-out infinite',
                          }} />
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-brand-cyan/5 rounded-xl animate-pulse" />
                    </>
                  )}
                  {!isDropTargetBefore && isDraggingToFullWidth && draggedStepNumber !== null && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                      <div className="h-0.5 w-full bg-brand-cyan/30 rounded-md mx-4" />
                    </div>
                  )}
                </div>

                {/* Section card */}
                <div
                  className={`transition-all duration-300 ${
                    isDragged
                      ? 'opacity-40 scale-95'
                      : isDropTargetBefore || isDropTargetAfter
                      ? 'ring-2 ring-[#52ddeb]/60 rounded-xl shadow-lg shadow-[#52ddeb]/20'
                      : ''
                  }`}
                >
                  {sectionElement}
                </div>

                {/* Drop zone após a última section */}
                {index === fullWidthSections.length - 1 && (
                  <div
                    data-drop-zone-order={index + 1}
                    className={`relative transition-all duration-200 h-[10px] flex items-center ${
                      isDropTargetAfter
                        ? 'bg-gradient-to-r from-[#52ddeb]/15 via-[#52ddeb]/20 to-[#52ddeb]/15 rounded-xl border-2 border-[#52ddeb] border-dashed'
                        : 'hover:bg-brand-cyan/5'
                    }`}
                    onDragOver={handleContainerDragOver}
                    onDrop={handleContainerDrop}
                  >
                    {isDropTargetAfter && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex items-center gap-3 w-full px-4">
                            <div className="h-1 flex-1 bg-brand-cyan rounded-md" style={{
                              boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
                              animation: 'pulse 1.2s ease-in-out infinite',
                            }} />
                            <div className="px-3 py-1 bg-brand-cyan/20 border border-[#52ddeb]/50 rounded-md text-brand-cyan text-xs font-mono font-semibold whitespace-nowrap">
                              DROP HERE
                            </div>
                            <div className="h-1 flex-1 bg-brand-cyan rounded-md" style={{
                              boxShadow: '0 0 12px rgba(82, 221, 235, 0.8), 0 0 20px rgba(82, 221, 235, 0.4)',
                              animation: 'pulse 1.2s ease-in-out infinite',
                            }} />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-brand-cyan/5 rounded-xl animate-pulse" />
                      </>
                    )}
                    {!isDropTargetAfter && isDraggingToFullWidth && draggedStepNumber !== null && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                        <div className="h-0.5 w-full bg-brand-cyan/30 rounded-md mx-4" />
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
            })}
          </>
        )}
      </div>
      
      {/* Preview de drop full-width - só mostra se não houver sections full-width ou se estiver arrastando para área vazia */}
      {isDraggingToFullWidth && draggedStepNumber !== null && fullWidthSections.length === 0 && (
        <div
          className="w-full border-2 border-dashed border-[#52ddeb] rounded-xl p-12 text-center bg-gradient-to-b from-[#52ddeb]/10 to-[#52ddeb]/5 transition-all duration-300 relative overflow-hidden"
          style={{
            boxShadow: '0 0 30px rgba(82, 221, 235, 0.4), inset 0 0 20px rgba(82, 221, 235, 0.1)',
            animation: 'fadeInScale 0.3s ease-out',
          }}
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
        >
          {/* Efeito de brilho animado */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#52ddeb]/20 to-transparent animate-shimmer" />
          
          <div className={`relative z-10 ${
            theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'
          }`}>
            <div className="text-brand-cyan text-2xl font-semibold mb-3 flex items-center justify-center gap-2">
              <div className="w-8 h-8 border-2 border-[#52ddeb] rounded flex items-center justify-center">
                <div className="w-4 h-4 bg-brand-cyan rounded-md" />
              </div>
              Full Width Panel
            </div>
            <div className="text-sm opacity-80 font-mono">Solte aqui para ocupar toda a largura</div>
            <div className="mt-4 text-xs opacity-60">O panel ocupará 100% da largura disponível</div>
          </div>
        </div>
      )}
      
      {/* Indicador visual quando arrastando sobre área de full-width existente */}
      {isDraggingToFullWidth && draggedStepNumber !== null && fullWidthSections.length > 0 && (
        <div
          className="w-full h-2 bg-gradient-to-r from-transparent via-[#52ddeb]/50 to-transparent rounded-md transition-all duration-300"
          style={{
            boxShadow: '0 0 20px rgba(82, 221, 235, 0.6)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Column Control - Only show on desktop and when onSetColumnCount is provided */}
      {isDesktop && onSetColumnCount && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm border border-zinc-800/40 rounded-md p-1">
            <button
              onClick={() => handleColumnsChange(columns - 1)}
              disabled={columns <= 1}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Decrease columns"
            >
              <Minus size={14} />
            </button>
            <div className="px-2">
              <span className="text-xs font-mono text-zinc-400 min-w-[1.5rem] text-center">
                {columns}
              </span>
            </div>
            <button
              onClick={() => handleColumnsChange(columns + 1)}
              disabled={columns >= 3}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Increase columns"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Grid de colunas normais */}
      <div
        ref={containerRef}
        className="grid grid-cols-1 gap-4 md:gap-6 w-full relative"
        style={{
          // Mobile: sempre 1 coluna (definido pela classe grid-cols-1)
          // Desktop: múltiplas colunas baseadas no layout
          ...(isDesktop ? {
            gridTemplateColumns: `repeat(${layout.columns + (showNewColumnPreview ? 1 : 0)}, 1fr)`,
            transition: 'grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          } : {}),
        }}
        onDragOver={handleContainerDragOver}
        role="region"
        aria-label="Column layout for sections"
      >
        {/* Renderizar sections com span > 1 diretamente no grid */}
        {normalSections
          .filter(s => {
            const sectionPosition = layout.sections.find(sec => sec.stepNumber === s.stepNumber);
            return (sectionPosition?.span || 1) > 1;
          })
          .sort((a, b) => {
            // Ordenar por coluna e depois por ordem
            if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
            return a.order - b.order;
          })
          .map((section) => {
            const stepNumber = section.stepNumber;
            const step = steps.find(s => s.id === stepNumber);
            if (!step) return null;

            const sectionPosition = layout.sections.find(s => s.stepNumber === stepNumber);
            const span = sectionPosition?.span || 1;

            const dragProps: DragProps = {
              isDraggable: true,
              onDragStart: (e: React.DragEvent) => handleDragStart(e, stepNumber),
              onDragEnd: handleDragEnd,
              customHeight: getSectionHeight?.(stepNumber),
              onResize: (height: number) => onResizeSection(stepNumber, height, undefined, span),
            };

            const sectionElement = renderSection(stepNumber, dragProps);
            if (!sectionElement) return null;

            const isDragged = draggedStepNumber === stepNumber;

            return (
              <div
                key={stepNumber}
                className={`transition-all duration-300 ${
                  isDragged ? 'opacity-40 scale-95' : ''
                }`}
                style={{
                  // Mobile: sempre span 1 (1 coluna)
                  // Desktop: usa o span definido no layout
                  gridColumn: isDesktop ? `span ${span}` : 'span 1',
                }}
              >
                {sectionElement}
              </div>
            );
          })}

        {/* Renderizar colunas normais com sections de span 1 */}
        {Array.from({ length: layout.columns }).map((_, columnIndex) => {
        // Filtrar sections que não são full-width, não têm span > 1, e estão nesta coluna
        const sectionsInColumn = normalSections
          .filter(s => {
            const sectionPosition = layout.sections.find(sec => sec.stepNumber === s.stepNumber);
            const span = sectionPosition?.span || 1;
            return s.columnIndex === columnIndex && span === 1;
          })
          .sort((a, b) => a.order - b.order);
        const isColumnHighlighted = draggedStepNumber !== null && dragOverColumn === columnIndex;
        const isEmptyColumn = sectionsInColumn.length === 0;

        return (
          <div
            key={columnIndex}
            ref={el => {
              columnRefs.current[columnIndex] = el;
            }}
            className={`flex flex-col gap-4 md:gap-6 min-h-[200px] relative rounded-md transition-all duration-300 ${
              isColumnHighlighted
                ? 'bg-brand-cyan/5 border-2 border-[#52ddeb]/40'
                : isEmptyColumn
                ? 'bg-transparent'
                : ''
            }`}
            onDragOver={e => handleColumnDragOver(e, columnIndex)}
            onDrop={e => handleColumnDrop(e, columnIndex)}
            role="group"
            aria-label={`Column ${columnIndex + 1} with ${sectionsInColumn.length} section${sectionsInColumn.length !== 1 ? 's' : ''}`}
          >
            {sectionsInColumn.length === 0 && dragOverColumn === columnIndex && (
              <div className="border-2 border-dashed border-[#52ddeb]/60 rounded-xl p-8 text-center text-zinc-400 text-sm bg-brand-cyan/5 transition-all duration-300">
                {draggedStepNumber !== null ? 'Drop here' : ''}
              </div>
            )}

            {sectionsInColumn.map((section, index) => {
              const stepNumber = section.stepNumber;
              const step = steps.find(s => s.id === stepNumber);
              
              if (!step) return null;

              const sectionPosition = layout.sections.find(s => s.stepNumber === stepNumber);
              const span = sectionPosition?.span || 1;

              const dragProps: DragProps = {
                isDraggable: true,
                onDragStart: (e: React.DragEvent) => handleDragStart(e, stepNumber),
                onDragEnd: handleDragEnd,
                customHeight: getSectionHeight?.(stepNumber),
                onResize: (height: number) => onResizeSection(stepNumber, height, undefined, span),
              };

              const sectionElement = renderSection(stepNumber, dragProps);
              
              if (!sectionElement) return null;

              const isDragged = draggedStepNumber === stepNumber;
              const isDropTarget = dragOverColumn === columnIndex &&
                (dragOverOrder === index || dragOverOrder === index + 1) &&
                !isDragged;

              return (
                <React.Fragment key={stepNumber}>
                  {/* Drop indicator antes da section - área expandida para snap magnético */}
                  <div
                    className={`relative -my-3 py-3 transition-all duration-200 ${
                      dragOverColumn === columnIndex && dragOverOrder === index
                        ? 'bg-brand-cyan/5 rounded-md'
                        : ''
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'move';
                      }
                      
                      // Snap magnético: detectar posição baseado na posição Y do mouse
                      const rect = e.currentTarget.getBoundingClientRect();
                      const mouseY = e.clientY;
                      const centerY = rect.top + rect.height / 2;
                      
                      // Área de snap expandida - se mouse está na metade superior, snap antes; se na inferior, snap depois
                      if (mouseY < centerY) {
                        setDragOverColumn(columnIndex);
                        setDragOverOrder(index);
                      } else {
                        setDragOverColumn(columnIndex);
                        setDragOverOrder(index + 1);
                      }
                    }}
                    onDrop={(e) => {
                      const finalOrder = dragOverOrder !== null && dragOverColumn === columnIndex 
                        ? dragOverOrder 
                        : index;
                      handleDrop(e, columnIndex, finalOrder);
                    }}
                    role="button"
                    aria-label={`Drop zone before section ${index + 1}`}
                  >
                    {renderDropIndicator(columnIndex, index)}
                  </div>
                  
                  {/* Section card */}
                  <div
                    draggable={false}
                    className={`transition-all duration-300 ${
                      isDragged
                        ? 'opacity-40 scale-95'
                        : isDropTarget
                        ? 'ring-2 ring-[#52ddeb]/60 rounded-xl shadow-lg shadow-[#52ddeb]/20'
                        : ''
                    }`}
                  >
                    {sectionElement}
                  </div>

                  {/* Drop indicator após a última section - área expandida para snap */}
                  {index === sectionsInColumn.length - 1 && (
                    <div
                      className={`relative -my-3 py-3 transition-all duration-200 ${
                        dragOverColumn === columnIndex && dragOverOrder === index + 1
                          ? 'bg-brand-cyan/5 rounded-md'
                          : ''
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer) {
                          e.dataTransfer.dropEffect = 'move';
                        }
                        setDragOverColumn(columnIndex);
                        setDragOverOrder(index + 1);
                      }}
                      onDrop={(e) => handleDrop(e, columnIndex, index + 1)}
                      role="button"
                      aria-label={`Drop zone after section ${index + 1}`}
                    >
                      {renderDropIndicator(columnIndex, index + 1)}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Empty column indicator */}
            {sectionsInColumn.length === 0 && dragOverColumn !== columnIndex && (
              <div className={`border border-dashed rounded-xl p-8 text-center text-xs opacity-60 transition-opacity duration-300 ${
                theme === 'dark'
                  ? 'border-zinc-800/40 text-zinc-500'
                  : 'border-zinc-300 text-zinc-400'
              }`}>
                Empty column
              </div>
            )}

          </div>
        );
        })}
        
        {/* Preview de nova coluna - aparece quando arrasta próximo à borda direita */}
      {showNewColumnPreview && layout.columns < 3 && draggedStepNumber !== null && (
        <div
          className="flex flex-col gap-4 md:gap-6 min-h-[200px] border-2 border-dashed border-[#52ddeb] rounded-xl bg-gradient-to-b from-[#52ddeb]/10 to-[#52ddeb]/5 transition-all duration-300"
          style={{
            boxShadow: '0 0 30px rgba(82, 221, 235, 0.4), inset 0 0 20px rgba(82, 221, 235, 0.1)',
            animation: 'fadeInScale 0.3s ease-out',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Mover section para a nova coluna
            if (draggedStepNumber !== null && onAddColumn && layout.columns < 3) {
              // Primeiro adicionar a coluna se ainda não foi criada automaticamente
              if (autoColumnTimeoutRef.current) {
                clearTimeout(autoColumnTimeoutRef.current);
                autoColumnTimeoutRef.current = null;
              }
              onAddColumn();
              const newColumnIndex = layout.columns;
              // Mover a section para a nova coluna após um pequeno delay
              setTimeout(() => {
                onMoveSection(draggedStepNumber, newColumnIndex, 0);
              }, 50);
              handleDragEnd();
            }
          }}
          onDragLeave={(e) => {
            // Verificar se realmente saiu da área do preview
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
              if (autoColumnTimeoutRef.current) {
                clearTimeout(autoColumnTimeoutRef.current);
                autoColumnTimeoutRef.current = null;
              }
              setShowNewColumnPreview(false);
            }
          }}
          role="group"
          aria-label="New column preview - drop here to create"
        >
          <div className={`flex-1 flex items-center justify-center text-sm font-mono ${
            theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'
          }`}>
            <div className="text-center space-y-3">
              <div className="text-brand-cyan text-2xl font-semibold animate-pulse">+</div>
              <div className="text-sm font-medium text-brand-cyan">Nova coluna</div>
              <div className="text-xs opacity-70">Solte aqui para criar</div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

