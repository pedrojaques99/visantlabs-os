import React from 'react';
import { BrandSection } from '../brand/BrandSection';
import { ExportSection } from './ExportSection';
import { FontSwapSection } from './FontSwapSection';
import { AutomationSection } from './AutomationSection';
import { Download, Type, Zap, Users } from 'lucide-react';
import { BulkCardsSection } from './BulkCardsSection';

const SECTIONS = [
  {
    id: 'bulkcards',
    title: 'Bulk Cards',
    icon: Users,
    description: 'Gerar cards a partir de JSON',
    component: BulkCardsSection,
    defaultOpen: true,
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: Zap,
    description: 'Color variations, presets, and social frames',
    component: AutomationSection,
    defaultOpen: true,
  },
  {
    id: 'fontswap',
    title: 'Font Swap',
    icon: Type,
    description: 'Scan and batch-replace fonts',
    component: FontSwapSection,
    defaultOpen: false,
  },
  {
    id: 'export',
    title: 'Export',
    icon: Download,
    description: 'Assets, slices, responsive, and text export',
    component: ExportSection,
    defaultOpen: false,
  },
];

export function ToolsTab() {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3 pb-8 flex-1">
        {SECTIONS.map((s) => {
          const Component = s.component;
          return (
            <BrandSection
              key={s.id}
              title={s.title}
              icon={s.icon}
              badge={s.badge}
              description={s.description}
              collapsible
              defaultOpen={s.defaultOpen}
            >
              <Component />
            </BrandSection>
          );
        })}
      </div>
    </div>
  );
}
