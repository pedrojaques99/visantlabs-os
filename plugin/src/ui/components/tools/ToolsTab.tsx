import React from 'react';
import { BrandSection } from '../brand/BrandSection';
import { ExportSection } from './ExportSection';
import { AutomationSection } from './AutomationSection';
import { LintingSection } from './LintingSection';
import { IntelligenceSection } from './IntelligenceSection';
import { DevRunnerSection } from './DevRunnerSection';
import { 
  Wand2, 
  ShieldCheck, 
  Download, 
  Terminal,
  Sparkles
} from 'lucide-react';

export function ToolsTab() {
  const sections = [
    { id: 'intelligence', title: 'Intelligence', icon: Sparkles, component: IntelligenceSection, badge: 'AI', defaultOpen: true },
    { id: 'automation', title: 'Automation', icon: Wand2, component: AutomationSection, badge: 'AUTO', defaultOpen: true },
    { id: 'dev', title: 'Dev Operations', icon: Terminal, component: DevRunnerSection, badge: 'DEV', defaultOpen: true },
    { id: 'export', title: 'Export & Layout', icon: Download, component: ExportSection, defaultOpen: false },
    { id: 'linting', title: 'Brand Audit', icon: ShieldCheck, component: LintingSection, defaultOpen: false },
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

