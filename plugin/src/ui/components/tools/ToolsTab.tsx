import React from 'react';
import { BrandSection } from '../brand/BrandSection';
import { ExportSection } from './ExportSection';
import { AutomationSection } from './AutomationSection';
import { IntelligenceSection } from './IntelligenceSection';
import { FontSwapSection } from './FontSwapSection';
import { LintingSection } from './LintingSection';
import {
  Cpu,
  Download,
  ShieldCheck,
  Type,
  Zap
} from 'lucide-react';

export function ToolsTab() {
  const sections = [
    { id: 'intelligence', title: 'Intelligence', icon: Cpu, component: IntelligenceSection, badge: 'AI', defaultOpen: true },
    { id: 'fontswap', title: 'Font Swap', icon: Type, component: FontSwapSection, badge: 'TXT', defaultOpen: true },
    { id: 'automation', title: 'Automation', icon: Zap, component: AutomationSection, badge: 'AUTO', defaultOpen: true },
    { id: 'audit', title: 'Brand Audit', icon: ShieldCheck, component: LintingSection, defaultOpen: false },
    { id: 'export', title: 'Export & Layout', icon: Download, component: ExportSection, defaultOpen: false },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 pb-8 flex-1">
        {sections.map((s) => {
          const Component = s.component;
          return (
            <BrandSection
              key={s.id}
              title={s.title}
              icon={s.icon}
              badge={s.badge}
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
