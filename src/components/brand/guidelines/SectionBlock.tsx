import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { GripVertical, Pencil, X, Save, Loader2 } from 'lucide-react';

interface SectionBlockProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  span?: '1' | '2' | '3' | '4' | '5' | '6';
  rowSpan?: '1' | '2';
  isEditing?: boolean;
  isSaving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  actions?: React.ReactNode;
  className?: string;
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
}) => {
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
    <div
      id={id}
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 p-1 transition-all duration-300",
        span === '1' && "md:col-span-1",
        span === '2' && "md:col-span-2",
        span === '3' && "md:col-span-3",
        span === '4' && "md:col-span-4",
        span === '5' && "md:col-span-5",
        span === '6' && "md:col-span-6",
        rowSpan === '1' && "md:row-span-1",
        rowSpan === '2' && "md:row-span-2",
        isDragging && "scale-[1.01] drop-shadow-2xl z-50",
        className
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-1.5 p-1 opacity-0 group-hover:opacity-30 hover:opacity-100 transition-all cursor-grab active:cursor-grabbing text-neutral-400 hover:text-brand-cyan hidden lg:block rounded-md hover:bg-white/[0.03]"
      >
        <GripVertical size={16} />
      </div>

      <div className="flex items-center justify-between px-2 mb-1 min-h-[28px]">
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-neutral-600 group-hover:text-brand-cyan/70 transition-colors">{icon}</div>}
          {title && <MicroTitle className="text-[10px] uppercase tracking-[0.2em] text-neutral-500/80 font-bold">{title}</MicroTitle>}
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
          {actions}
        </div>
      </div>

      <GlassPanel
        padding="md"
        className={cn(
          "flex-1 bg-neutral-900/40 hover:bg-neutral-900/60 border-white/[0.05] hover:border-neutral-900/50 transition-all duration-300 cursor-default",
          isDragging && "border-brand-cyan/40 bg-neutral-800/80"
        )}
        onDoubleClick={() => {
          if (!isEditing && onEdit) onEdit();
        }}
      >
        {children}
      </GlassPanel>
    </div>
  );
};
