import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandSection } from '../brand/BrandSection';
import { ExportSection } from './ExportSection';
import { FontSwapSection } from './FontSwapSection';
import { AutomationSection } from './AutomationSection';
import { BulkCardsSection } from './BulkCardsSection';
import { PhotoSequencerSection } from './PhotoSequencerSection';
import { BrandIntelligenceSection } from '../brand/BrandIntelligenceSection';
import { ColorCleanupSection } from '../brand/ColorCleanupSection';
import { BrandMatrixSection } from '../brand/BrandMatrixSection';
import { ConnectorsSection } from './ConnectorsSection';
import { IntelligenceSection } from './IntelligenceSection';
import { ReferencesSection } from './ReferencesSection';
import {
  Download,
  Type,
  Zap,
  Users,
  Film,
  ScanSearch,
  Droplet,
  Grid3x3,
  ArrowRightLeft,
  Lightbulb,
  Images,
  type LucideIcon,
} from 'lucide-react';

interface Tool {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  component: () => React.JSX.Element;
}

interface ToolGroup {
  id: string;
  /** What you end up with — the group's whole reason to exist. */
  label: string;
  tools: Tool[];
}

/**
 * Tools grouped by what you end up with, not by which section built them.
 *
 * The old grouping ("Automation", "Brand operations", "Intelligence") described the codebase,
 * not the job. These four are MECE from the designer's side: something new on the canvas /
 * what's already there, on brand / what's already there, different / something outside the
 * canvas entirely.
 */
const getGroups = (
  t: (key: string, params?: Record<string, string | number>) => string
): ToolGroup[] => [
  {
    id: 'create',
    label: t('plugin.tools.group.create'),
    tools: [
      {
        id: 'bulkcards',
        title: t('plugin.tools.tab.bulkCardsTitle'),
        icon: Users,
        description: t('plugin.tools.tab.bulkCardsDescription'),
        component: BulkCardsSection,
      },
      // A finished Linear→Figma pipeline (handlers/linearBridge.ts) that had no route into
      // the UI: issues become Story/Feed frames. Creating frames is what this shelf is for.
      {
        id: 'connectors',
        title: t('plugin.tools.tab.connectorsTitle'),
        icon: ArrowRightLeft,
        description: t('plugin.tools.tab.connectorsDescription'),
        component: ConnectorsSection,
      },
    ],
  },
  {
    id: 'onbrand',
    label: t('plugin.tools.group.onBrand'),
    tools: [
      // These three kept their strings from the old AUTO tab — same tools, new shelf.
      {
        id: 'brandintel',
        title: t('plugin.brand.operations.intelligenceTitle'),
        icon: ScanSearch,
        description: t('plugin.brand.operations.intelligenceDescription'),
        component: BrandIntelligenceSection,
      },
      {
        id: 'colorcleanup',
        title: t('plugin.brand.operations.colorCleanupTitle'),
        icon: Droplet,
        description: t('plugin.brand.operations.colorCleanupDescription'),
        component: ColorCleanupSection,
      },
      {
        id: 'brandmatrix',
        title: t('plugin.brand.matrix.logoMatrix'),
        icon: Grid3x3,
        description: t('plugin.tools.group.brandMatrixDescription'),
        component: BrandMatrixSection,
      },
    ],
  },
  {
    id: 'refine',
    label: t('plugin.tools.group.refine'),
    tools: [
      {
        id: 'automation',
        title: t('plugin.tools.tab.automationTitle'),
        icon: Zap,
        description: t('plugin.tools.tab.automationDescription'),
        component: AutomationSection,
      },
      {
        id: 'fontswap',
        title: t('plugin.tools.tab.fontSwapTitle'),
        icon: Type,
        description: t('plugin.tools.tab.fontSwapDescription'),
        component: FontSwapSection,
      },
      {
        id: 'photoseq',
        title: t('plugin.tools.tab.photoSequencerTitle'),
        icon: Film,
        description: t('plugin.tools.tab.photoSequencerDescription'),
        component: PhotoSequencerSection,
      },
    ],
  },
  {
    id: 'extract',
    label: t('plugin.tools.group.extract'),
    tools: [
      // Reads the canvas and hands back something you take elsewhere: a categorised scan,
      // a JSON, an image prompt, a naming guide. It owns the smart-scan result modal.
      {
        id: 'intelligence',
        title: t('plugin.tools.tab.intelligenceTitle'),
        icon: Lightbulb,
        description: t('plugin.tools.tab.intelligenceDescription'),
        component: IntelligenceSection,
      },
      // Canvas work leaves as a tagged reference in the library (the server does
      // the tagging), and the library is browsable back from here.
      {
        id: 'references',
        title: t('plugin.tools.tab.referencesTitle'),
        icon: Images,
        description: t('plugin.tools.tab.referencesDescription'),
        component: ReferencesSection,
      },
      {
        id: 'export',
        title: t('plugin.tools.tab.exportTitle'),
        icon: Download,
        description: t('plugin.tools.tab.exportDescription'),
        component: ExportSection,
      },
    ],
  },
];

export function ToolsView() {
  const { t } = useTranslation();
  const groups = getGroups(t);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5 pb-8">
      {groups.map((group) => (
        <section key={group.id} className="space-y-2">
          <h2 className="text-[11px] font-semibold text-muted-foreground px-0.5">{group.label}</h2>
          <div className="space-y-2">
            {group.tools.map((tool) => {
              const Component = tool.component;
              return (
                <BrandSection
                  key={tool.id}
                  title={tool.title}
                  icon={tool.icon}
                  description={tool.description}
                  collapsible
                  defaultOpen={false}
                >
                  <Component />
                </BrandSection>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
