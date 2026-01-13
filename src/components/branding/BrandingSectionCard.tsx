import React, { useRef, useState, useCallback } from 'react';
import { X, GripVertical, Minus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { SectionHeader } from './SectionHeader';
import { SectionActions } from './SectionActions';
import { SectionContentRenderer } from './SectionContentRenderer';
import { getSectionColSpan } from '@/utils/brandingHelpers';

interface BrandingSectionCardProps {
  stepNumber: number;
  stepTitle: string;
  emoji: string;
  content: any;
  hasData: boolean;
  isGenerating: boolean;
  isEditing: boolean;
  canEdit: boolean;
  isCollapsed: boolean;
  steps: Array<{ id: number; title: string }>;
  hasContent: (stepNumber: number) => boolean;
  onToggleCompact: () => void;
  onEdit: () => void;
  onRegenerate?: () => void;
  onSave: () => void;
  onGenerate?: () => void;
  onContentChange?: (value: any) => void;
  isSaving: boolean;
  // Drag and drop props
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, stepNumber: number) => void;
  onDragEnd?: () => void;
  // Resize props
  customHeight?: number;
  onResize?: (height: number) => void;
  // Feedback props
  prompt?: string;
  onFeedback?: (stepNumber: number, type: 'up' | 'down') => void;
}

export const BrandingSectionCard: React.FC<BrandingSectionCardProps> = ({
  stepNumber,
  stepTitle,
  emoji,
  content,
  hasData,
  isGenerating,
  isEditing,
  canEdit,
  isCollapsed,
  steps,
  hasContent,
  onToggleCompact,
  onEdit,
  onRegenerate,
  onSave,
  onGenerate,
  onContentChange,
  isSaving,
  isDraggable = false,
  onDragStart,
  onDragEnd,
  customHeight,
  onResize,
  prompt,
  onFeedback,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const colSpan = getSectionColSpan(stepNumber);
  const cardRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Verificar se o drag foi iniciado em um botão ou elemento interativo
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('[role="button"]') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('a')
      ) {
        e.preventDefault();
        return;
      }

      setIsDragging(true);
      if (onDragStart) {
        onDragStart(e, stepNumber);
      }
      // Opacidade reduzida durante drag
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', stepNumber.toString());
      }
    },
    [stepNumber, onDragStart]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd();
    }
  }, [onDragEnd]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = cardRef.current?.offsetHeight || 0;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const diff = moveEvent.clientY - startY;
        const newHeight = Math.max(200, startHeight + diff); // Mínimo de 200px
        if (onResize && cardRef.current) {
          cardRef.current.style.height = `${newHeight}px`;
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        if (onResize && cardRef.current) {
          const finalHeight = cardRef.current.offsetHeight;
          onResize(finalHeight);
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [stepNumber, onResize]
  );

  return (
    <div
      ref={cardRef}
      className={`${colSpan} border rounded-2xl p-6 md:p-8 transition-all duration-200 group relative animate-fade-in-down ${theme === 'dark' ? 'bg-[#141414]' : 'bg-white'
        } ${isEditing
          ? 'border-[brand-cyan]/50 shadow-[0_0_0_1px_rgba(82,221,235,0.1)]'
          : theme === 'dark'
            ? 'border-zinc-800/60 hover:border-zinc-700/60'
            : 'border-zinc-300 hover:border-zinc-400'
        } ${isDragging ? 'opacity-50' : ''} ${isResizing ? 'cursor-ns-resize' : ''}`}
      style={{
        animation: 'expandSection 0.25s ease-out',
        height: customHeight ? `${customHeight}px` : undefined,
        minHeight: customHeight ? undefined : '200px',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          draggable={isDraggable}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className={`flex-1 ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'cursor-grabbing' : ''} select-none`}
          style={{
            WebkitUserSelect: 'none',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {isDraggable && (
              <div
                className={`transition-colors opacity-60 group-hover:opacity-100 pointer-events-none ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-400' : 'text-zinc-400 hover:text-zinc-500'
                  }`}
                title={t('branding.dragToReorder') || 'Drag to reorder'}
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <SectionHeader
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              emoji={emoji}
              steps={steps}
              hasContent={hasContent}
              isCollapsed={isCollapsed}
              hasData={hasData}
            />
          </div>
        </div>
        <div
          className="flex items-center gap-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <SectionActions
            hasData={hasData}
            canEdit={canEdit}
            isEditing={isEditing}
            isGenerating={isGenerating}
            isSaving={isSaving}
            content={content}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onSave={onSave}
            prompt={prompt}
            stepNumber={stepNumber}
            onFeedback={onFeedback ? (type) => onFeedback(stepNumber, type) : undefined}
          />
          {!isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompact();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`p-1 rounded transition-colors cursor-pointer ${theme === 'dark' ? 'hover:bg-black/40' : 'hover:bg-zinc-200'
                }`}
              title={t('branding.collapse') || 'Collapse to compact'}
            >
              <X className={`h-4 w-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`} />
            </button>
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className={`relative ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'
          }`} style={{ height: customHeight ? 'calc(100% - 80px)' : undefined }}>
          <SectionContentRenderer
            stepNumber={stepNumber}
            content={content}
            isGenerating={isGenerating}
            isEditing={isEditing}
            hasData={hasData}
            stepTitle={stepTitle}
            onGenerate={onGenerate}
            onContentChange={onContentChange}
          />
        </div>
      )}
      {onResize && !isCollapsed && (
        <div
          ref={resizeRef}
          onMouseDown={handleResizeStart}
          className={`absolute bottom-0 right-0 w-8 h-8 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-tl-lg ${theme === 'dark' ? 'hover:bg-black/20' : 'hover:bg-zinc-200'
            }`}
          title={t('branding.resize') || 'Resize'}
        >
          <Minus className={`h-4 w-4 rotate-90 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            }`} />
        </div>
      )}
    </div>
  );
};

