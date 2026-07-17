import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ChevronDown } from 'lucide-react';

interface BrandSectionProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  badge?: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function BrandSection({
  title,
  icon: Icon,
  children,
  className,
  badge,
  description,
  collapsible = false,
  defaultOpen = true,
}: BrandSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasOpened, setHasOpened] = useState(defaultOpen);

  const toggle = () => {
    if (!collapsible) return;
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasOpened) setHasOpened(true);
  };

  const shouldMount = !collapsible || hasOpened;

  return (
    <div
      className={cn(
        'bg-muted/40 border border-border/50 rounded-xl flex flex-col relative z-20 backdrop-blur-sm overflow-hidden transition-all duration-300',
        className
      )}
    >
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between border-b border-border/50 bg-muted/30 group/section',
          collapsible && 'cursor-pointer hover:bg-foreground/[0.05]'
        )}
        onClick={toggle}
        title={description}
      >
        {/* min-w-0 lets the row shrink so the description can clip instead of wrapping —
            without it, flex children refuse to go below their content width. */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && <Icon size={14} className="text-muted-foreground shrink-0" />}
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground shrink-0">
            {title}
          </h3>
          {description && (
            /* Always present and clipped to one line. It used to be hidden until hover and
               then injected into this row, so hovering re-wrapped the header and grew the
               card — layout that moves under the cursor. The full text stays in the
               native tooltip on the header. */
            <span className="text-[9px] text-muted-foreground/50 font-normal normal-case tracking-normal truncate">
              {description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          {badge && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-foreground/[0.05] text-muted-foreground border border-foreground/[0.08]">
              {badge}
            </span>
          )}
          {collapsible && (
            <ChevronDown
              size={14}
              className={cn(
                'text-muted-foreground/70 transition-transform duration-300',
                isOpen && 'rotate-180'
              )}
            />
          )}
        </div>
      </div>

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          !isOpen ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[2000px] opacity-100'
        )}
      >
        {shouldMount && <div className="p-4">{children}</div>}
      </div>
    </div>
  );
}
