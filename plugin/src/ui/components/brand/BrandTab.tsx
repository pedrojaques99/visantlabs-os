import React, { useEffect } from 'react';
import { BrandLogoSection } from './BrandLogoSection';
import { BrandTypographySection } from './BrandTypographySection';
import { BrandColorGrid } from './BrandColorGrid';
import { BrandGuidelineSection } from './BrandGuidelineSection';
import { DesignSystemSection } from './DesignSystemSection';
import { ComponentLibrarySection } from './ComponentLibrarySection';
import { BrandIntelligenceSection } from './BrandIntelligenceSection';
import { BrandSection } from './BrandSection';
import { BrandOperationsSection } from './BrandOperationsSection';
import { useBrandAutoSync } from '../../hooks/useBrandAutoSync';
import { usePluginStore } from '../../store';
import {
  Palette,
  Type,
  ImageIcon,
  BrainCircuit,
  Settings2,
  Library,
  Box,
  Zap
} from 'lucide-react';

export function BrandTab() {
  useBrandAutoSync();
  const linkedGuideline = usePluginStore((s) => s.linkedGuideline);

  // Auto-sync context from Figma when tab mounts or brand changes
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com');
  }, [linkedGuideline]);

  const sections = [
    { id: 'operations', title: 'Operations', icon: Zap, component: BrandOperationsSection, badge: 'AUTO', defaultOpen: true },
    { id: 'guidelines', title: 'Contexto', icon: Box, component: BrandGuidelineSection, defaultOpen: true },
    { id: 'intelligence', title: 'Intelligence', icon: BrainCircuit, component: BrandIntelligenceSection, badge: 'AI', defaultOpen: true },
    { id: 'logos', title: 'Asset Logos', icon: ImageIcon, component: BrandLogoSection, defaultOpen: false },
    { id: 'colors', title: 'Color Palette', icon: Palette, component: BrandColorGrid, defaultOpen: false },
    { id: 'typography', title: 'Typography', icon: Type, component: BrandTypographySection, defaultOpen: false },
    { id: 'design-system', title: 'Design System', icon: Settings2, component: DesignSystemSection, defaultOpen: false },
    { id: 'library', title: 'Component Library', icon: Library, component: ComponentLibrarySection, defaultOpen: false },
  ];

  return (
    <div className="flex flex-col h-full -mx-1 px-1">
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
