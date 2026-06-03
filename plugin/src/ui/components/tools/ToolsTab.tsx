import React from 'react';
import { BrandSection } from '../brand/BrandSection';
import { ExportSection } from './ExportSection';
import { IntelligenceSection } from './IntelligenceSection';
import { FontSwapSection } from './FontSwapSection';
import { LintingSection } from './LintingSection';
import { AutomationSection } from './AutomationSection';
import { Cpu, Download, ShieldCheck, Type, Zap } from 'lucide-react';

const SECTIONS = [
  {
    id: 'intelligence',
    title: 'Intelligence',
    icon: Cpu,
    description: 'Scan, analyze, and extract design context',
    component: IntelligenceSection,
    badge: 'AI',
    defaultOpen: true,
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: Zap,
    description: 'Color variations and social frames',
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
    id: 'audit',
    title: 'Brand Audit',
    icon: ShieldCheck,
    description: 'Lint design against brand rules',
    component: LintingSection,
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
