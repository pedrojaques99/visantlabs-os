import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export interface PanelTab {
  id: string;
  icon: React.ReactNode;
  label: string;
  content: React.ReactNode;
  /** Optional control rendered on the right of the section header (e.g. a Reset button). */
  action?: React.ReactNode;
}

interface PanelSectionTabsProps {
  tabs: PanelTab[];
  defaultId?: string;
  className?: string;
  /** Accessible name for the section rail (screen readers). */
  ariaLabel?: string;
}

/**
 * Blender/Photoshop-style sectioned control panel: a vertical icon rail on the
 * left switches which category is shown — only the active section renders, so a
 * long spaghetti-scroll of stacked sections becomes modular and organized.
 *
 * Backed by Radix Tabs (vertical orientation) so keyboard nav (Up/Down/Home/End
 * roving focus), `aria-selected`, and the tablist/tab/tabpanel roles come for
 * free — no hand-rolled a11y. Drop it inside a <ToolPanel> between the preset
 * strip and the export actions; it fills the height and scrolls independently.
 */
export const PanelSectionTabs: React.FC<PanelSectionTabsProps> = ({
  tabs,
  defaultId,
  className,
  ariaLabel = 'Sections',
}) => (
  <TabsPrimitive.Root
    defaultValue={defaultId ?? tabs[0]?.id}
    orientation="vertical"
    className={cn('flex-1 flex flex-row min-h-0', className)}
  >
    <TabsPrimitive.List
      aria-label={ariaLabel}
      className="shrink-0 flex flex-col items-center gap-1 py-3 px-1.5 border-r border-neutral-800 bg-neutral-950/50"
    >
      {tabs.map((t) => (
        <TabsPrimitive.Trigger
          key={t.id}
          value={t.id}
          title={t.label}
          aria-label={t.label}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
            'text-neutral-600 hover:text-neutral-300 hover:bg-white/5',
            'data-[state=active]:bg-white/10 data-[state=active]:text-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60'
          )}
        >
          {t.icon}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>

    {tabs.map((t) => (
      <TabsPrimitive.Content
        key={t.id}
        value={t.id}
        className="flex-1 min-w-0 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent focus-visible:outline-none"
      >
        <div className="px-4 pt-3 pb-2 border-b border-neutral-800/50 flex items-center justify-between gap-2">
          <span className="text-2xs uppercase tracking-widest text-neutral-400">{t.label}</span>
          {t.action}
        </div>
        <div className="px-4 py-4 space-y-4">{t.content}</div>
      </TabsPrimitive.Content>
    ))}
  </TabsPrimitive.Root>
);
