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
import { ColorCleanupSection } from './ColorCleanupSection';
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
  Paintbrush,
  ChevronDown,
  ChevronRight,
  Layers,
  CheckCircle2,
  Circle
} from 'lucide-react';

function BrandCompletenessBar() {
  const guideline = usePluginStore((s) => s.brandGuideline);
  const colors = usePluginStore((s) => s.selectedColors);
  const logos = usePluginStore((s) => s.logos);
  const typography = usePluginStore((s) => s.typography);
  const designSystem = usePluginStore((s) => s.designSystem);

  const steps = [
    { label: 'Guideline', done: !!guideline },
    { label: 'Colors', done: colors.size > 0 },
    { label: 'Logos', done: logos.some(l => l.src || l.url) },
    { label: 'Typography', done: typography.some(t => t.fontFamily) },
    { label: 'Tokens', done: !!(designSystem?.tokens && Object.keys(designSystem.tokens).length > 0) },
  ];

  const completed = steps.filter(s => s.done).length;
  if (completed === steps.length) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Brand Setup</span>
        <span className="text-[10px] font-mono text-muted-foreground">{completed}/{steps.length}</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-brand-cyan rounded-full transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {steps.map(s => (
          <span key={s.label} className={`flex items-center gap-1 text-[9px] ${s.done ? 'text-brand-cyan' : 'text-muted-foreground/50'}`}>
            {s.done ? <CheckCircle2 size={8} /> : <Circle size={8} />}
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

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

        <BrandCompletenessBar />

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

        {/* ── Color Cleanup ── */}
        <BrandSection title="Color Cleanup" icon={Paintbrush} collapsible defaultOpen={false}>
          <ColorCleanupSection />
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
