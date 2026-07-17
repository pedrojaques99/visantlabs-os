import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandSection } from '../brand/BrandSection';
import { ExportSection } from './ExportSection';
import { FontSwapSection } from './FontSwapSection';
import { AutomationSection } from './AutomationSection';
import { Download, Type, Zap, Users, Film, type LucideIcon } from 'lucide-react';
import { BulkCardsSection } from './BulkCardsSection';
import { PhotoSequencerSection } from './PhotoSequencerSection';

const getSections = (
  t: (key: string, params?: Record<string, string | number>) => string
): Array<{
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  component: () => React.JSX.Element;
  defaultOpen: boolean;
  badge?: string;
}> => [
  {
    id: 'bulkcards',
    title: t('plugin.tools.tab.bulkCardsTitle'),
    icon: Users,
    description: t('plugin.tools.tab.bulkCardsDescription'),
    component: BulkCardsSection,
    defaultOpen: true,
  },
  {
    id: 'automation',
    title: t('plugin.tools.tab.automationTitle'),
    icon: Zap,
    description: t('plugin.tools.tab.automationDescription'),
    component: AutomationSection,
    defaultOpen: true,
  },
  {
    id: 'photoseq',
    title: t('plugin.tools.tab.photoSequencerTitle'),
    icon: Film,
    description: t('plugin.tools.tab.photoSequencerDescription'),
    component: PhotoSequencerSection,
    defaultOpen: false,
  },
  {
    id: 'fontswap',
    title: t('plugin.tools.tab.fontSwapTitle'),
    icon: Type,
    description: t('plugin.tools.tab.fontSwapDescription'),
    component: FontSwapSection,
    defaultOpen: false,
  },
  {
    id: 'export',
    title: t('plugin.tools.tab.exportTitle'),
    icon: Download,
    description: t('plugin.tools.tab.exportDescription'),
    component: ExportSection,
    defaultOpen: false,
  },
];

export function ToolsTab() {
  const { t } = useTranslation();
  const SECTIONS = getSections(t);
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
