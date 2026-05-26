import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface SectionNavSidebarProps {
  items: SectionNavItem[];
  className?: string;
}

export const SectionNavSidebar: React.FC<SectionNavSidebarProps> = ({ items, className }) => {
  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const btn = el.querySelector('button');
      if (btn && el.querySelector('[data-state]') === null) btn.click();
    }
  }, []);

  return (
    <div className={cn('shrink-0 flex flex-col items-center gap-1 py-3 px-1 border-r border-white/[0.06] bg-neutral-950/50', className)}>
      {items.map((s) => (
        <button
          key={s.id}
          onClick={() => scrollToSection(s.id)}
          title={s.label}
          className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-colors"
        >
          {s.icon}
        </button>
      ))}
    </div>
  );
};
