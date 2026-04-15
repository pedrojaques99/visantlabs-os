import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ChevronDown } from 'lucide-react';

interface BrandSectionProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  badge?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function BrandSection({ title, icon: Icon, children, className, badge, collapsible = false, defaultOpen = true }: BrandSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn(
      "bg-neutral-900/40 border border-white/5 rounded-xl flex flex-col relative z-20 backdrop-blur-sm overflow-hidden transition-all duration-300",
      className
    )}>
      <div 
        className={cn(
          "px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/[0.02]",
          collapsible && "cursor-pointer hover:bg-white/[0.05]"
        )}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-brand-cyan" />}
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
              {badge}
            </span>
          )}
          {collapsible && (
            <ChevronDown 
              size={14} 
              className={cn(
                "text-neutral-600 transition-transform duration-300",
                isOpen && "rotate-180"
              )} 
            />
          )}
        </div>
      </div>
      
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        !isOpen ? "max-h-0 opacity-0 pointer-events-none" : "max-h-[2000px] opacity-100"
      )}>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
