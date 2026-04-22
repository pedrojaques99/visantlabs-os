import React, { useEffect, useState } from 'react';
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
  Zap,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';

export function BrandTab() {
  useBrandAutoSync();
  const linkedGuideline = usePluginStore((s) => s.linkedGuideline);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com');
  }, [linkedGuideline]);

  const advancedSections = [
    { id: 'logos', title: 'Asset Logos', icon: ImageIcon, component: BrandLogoSection },
    { id: 'colors', title: 'Color Palette', icon: Palette, component: BrandColorGrid },
    { id: 'typography', title: 'Typography', icon: Type, component: BrandTypographySection },
    { id: 'design-system', title: 'Design System', icon: Settings2, component: DesignSystemSection },
    { id: 'library', title: 'Component Library', icon: Library, component: ComponentLibrarySection },
  ];

  return (
    <div className="flex flex-col h-full -mx-1 px-1">
      <div className="space-y-3 pb-8 flex-1">

        {/* ── CORE: Contexto ── */}
        <div className="rounded-xl border-2 border-brand-cyan/20 bg-brand-cyan/[0.03] overflow-hidden">
          <BrandSection
            title="Contexto"
            icon={Box}
            collapsible
            defaultOpen={true}
          >
            <BrandGuidelineSection />
          </BrandSection>
        </div>

        {/* ── Operations ── */}
        <BrandSection title="Operations" icon={Zap} badge="AUTO" collapsible defaultOpen={true}>
          <BrandOperationsSection />
        </BrandSection>

        {/* ── Intelligence ── */}
        <BrandSection title="Intelligence" icon={BrainCircuit} badge="AI" collapsible defaultOpen={true}>
          <BrandIntelligenceSection />
        </BrandSection>

        {/* ── Advanced (collapsed by default) ── */}
        <div className="border border-border/30 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers size={10} />
              Brand Assets &amp; System
            </span>
            {showAdvanced ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>

          {showAdvanced && (
            <div className="border-t border-border/30 space-y-3 p-1 pt-3">
              {advancedSections.map((s) => {
                const Component = s.component;
                return (
                  <BrandSection
                    key={s.id}
                    title={s.title}
                    icon={s.icon}
                    collapsible
                    defaultOpen={false}
                  >
                    <Component />
                  </BrandSection>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
