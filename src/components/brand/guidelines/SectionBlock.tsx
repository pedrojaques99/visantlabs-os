import React, { useState, useContext, createContext } from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Pencil, X, Save, Loader2, Maximize2, Minus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

/** Context provided by GuidelineDetail — lets any SectionBlock hide itself without prop drilling */
export const SectionHideContext = createContext<((id: string) => void) | null>(null);

interface SectionBlockProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  span?: '1' | '2' | 'full';
  rowSpan?: '1' | '2';
  isEditing?: boolean;
  isSaving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  actions?: React.ReactNode;
  className?: string;
  expandedContent?: React.ReactNode;
}

export const SectionBlock: React.FC<SectionBlockProps> = ({
  id, title, icon, children,
  span = '2', rowSpan = '1',
  isEditing, isSaving, onEdit, onSave, onCancel,
  actions, className, expandedContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hideSection = useContext(SectionHideContext);

  return (
    <>
      <div
        id={id}
        className={cn(
          "group flex flex-col gap-2 p-1 transition-all duration-300",
          span === '1' && "col-span-1",
          (span === '2' || span === 'full') && "col-span-full",
          rowSpan === '2' && "md:row-span-2",
          className
        )}
      >
        <div className="flex items-center justify-between px-2 mb-1">
          <div className="flex items-center gap-2.5">
            {icon && <div className="text-neutral-500">{icon}</div>}
            {title && <MicroTitle className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold">{title}</MicroTitle>}
          </div>
          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1.5 items-center">
            {isSaving && <Loader2 size={12} className="text-neutral-500 animate-spin mr-1" />}
            {isEditing ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" aria-label="Cancel" onClick={onCancel}>
                  <X size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-400 hover:text-white" aria-label="Save" onClick={onSave}>
                  <Save size={12} />
                </Button>
              </div>
            ) : onEdit ? (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" aria-label="Edit" onClick={onEdit}>
                <Pencil size={12} />
              </Button>
            ) : null}
            {expandedContent && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" aria-label="Expand" onClick={() => setIsExpanded(true)}>
                <Maximize2 size={12} />
              </Button>
            )}
            {actions}
            {hideSection && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-700 hover:text-neutral-400" aria-label="Hide section" onClick={() => hideSection(id)}>
                <Minus size={11} />
              </Button>
            )}
          </div>
        </div>

        <GlassPanel padding="sm" className="flex-1 flex flex-col border-white/[0.06] transition-all duration-200">
          <div className="flex-1 flex flex-col h-full w-full">
            {children}
          </div>
        </GlassPanel>
      </div>

      {expandedContent && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                {icon && <div className="text-neutral-500">{icon}</div>}
                <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">{title}</DialogTitle>
              </div>
              <DialogDescription className="sr-only">{title} details</DialogDescription>
            </DialogHeader>
            <DialogBody>{expandedContent}</DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
