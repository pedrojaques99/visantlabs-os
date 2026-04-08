import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { GripVertical, Pencil, X, Save, Loader2, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface SectionBlockProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** '1' = 1 col (default), '2' = 2 cols on md+, 'full' = full width */
  span?: '1' | '2' | 'full';
  rowSpan?: '1' | '2';
  isEditing?: boolean;
  isSaving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  actions?: React.ReactNode;
  className?: string;
  /** Content to render inside the expanded modal. If provided, shows expand button. */
  expandedContent?: React.ReactNode;
}

export const SectionBlock: React.FC<SectionBlockProps> = ({
  id,
  title,
  icon,
  children,
  span = '2',
  rowSpan = '1',
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  actions,
  className,
  expandedContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <>
      <div
        id={id}
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative flex flex-col gap-2 p-1 transition-all duration-300",
          span === '1' && "col-span-1",
          (span === '2' || span === 'full') && "lg:col-span-2",
          rowSpan === '2' && "md:row-span-2",
          isDragging && "scale-[1.01] drop-shadow-2xl z-50",
          className
        )}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-6 top-1.5 p-1 opacity-0 group-hover:opacity-30 hover:opacity-300 transition-all cursor-grab active:cursor-grabbing text-neutral-400 hover:text-brand-cyan hidden lg:block rounded-md hover:bg-white/[0.03]"
        >
          <GripVertical size={16} />
        </div>

        <div className="flex items-center justify-between px-2 mb-1 min-h-[28px]">
          <div className="flex items-center gap-2.5">
            {icon && <div className="text-neutral-500 group-hover:text-brand-cyan transition-colors">{icon}</div>}
            {title && <MicroTitle className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold">{title}</MicroTitle>}
          </div>
          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1.5 items-center">
            {isSaving && <Loader2 size={12} className="text-brand-cyan animate-spin mr-2" />}
            {isEditing ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={onCancel}>
                  <X size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={onSave}>
                  <Save size={12} />
                </Button>
              </div>
            ) : onEdit ? (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={onEdit}>
                <Pencil size={12} />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-500 hover:text-white"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
            {expandedContent && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-neutral-500 hover:text-white"
                onClick={() => setIsExpanded(true)}
              >
                <Maximize2 size={12} />
              </Button>
            )}
            {actions}
          </div>
        </div>

        <GlassPanel
          padding="md"
          className={cn(
            "flex-1 flex flex-col bg-neutral-900/40 hover:bg-neutral-900/60 border-white/[0.05] hover:border-neutral-900/50 transition-all duration-300 cursor-default",
            isDragging && "border-brand-cyan/40 bg-neutral-800/80",
            isCollapsed && "hidden"
          )}
          onDoubleClick={() => {
            if (!isEditing && onEdit) onEdit();
          }}
        >
          <div className="flex-1 flex flex-col h-full w-full">
            {children}
          </div>
        </GlassPanel>
      </div>

      {/* Expanded Detail Modal */}
      {expandedContent && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                {icon && <div className="text-brand-cyan/70">{icon}</div>}
                <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">{title}</DialogTitle>
              </div>
              <DialogDescription className="sr-only">
                {title} details
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              {expandedContent}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
