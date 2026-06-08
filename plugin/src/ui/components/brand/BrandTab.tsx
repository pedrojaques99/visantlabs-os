import React, { useEffect } from 'react';
import { BrandLogoSection } from './BrandLogoSection';
import { BrandTypographySection } from './BrandTypographySection';
import { BrandColorGrid } from './BrandColorGrid';
import { BrandGuidelineSection } from './BrandGuidelineSection';
import { DesignSystemSection } from './DesignSystemSection';
import { ComponentLibrarySection } from './ComponentLibrarySection';
import { BrandSection } from './BrandSection';
import { useBrandAutoSync } from '../../hooks/useBrandAutoSync';
import { usePluginStore } from '../../store';
import { Palette, Type, ImageIcon, Settings2, Library, CheckCircle2, Circle } from 'lucide-react';

function BrandCompletenessBar() {
  const guideline = usePluginStore((s) => s.brandGuideline);
  const colors = usePluginStore((s) => s.selectedColors);
  const logos = usePluginStore((s) => s.logos);
  const typography = usePluginStore((s) => s.typography);
  const designSystem = usePluginStore((s) => s.designSystem);

  const steps = [
    { label: 'Guideline', done: !!guideline },
    { label: 'Colors', done: colors.size > 0 },
    { label: 'Logos', done: logos.some((l) => l.src || l.url) },
    { label: 'Typography', done: typography.some((t) => t.fontFamily) },
    {
      label: 'Tokens',
      done: !!(designSystem?.tokens && Object.keys(designSystem.tokens).length > 0),
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Brand Setup
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {completed}/{steps.length}
        </span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-brand-cyan rounded-full transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {steps.map((s) => (
          <span
            key={s.label}
            className={`flex items-center gap-1 text-[9px] ${
              s.done ? 'text-brand-cyan' : 'text-muted-foreground/50'
            }`}
          >
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
  const prevLinkedRef = React.useRef(linkedGuideline);

  useEffect(() => {
    // Only re-fetch context when the linked guideline actually changes, not on initial mount
    // (App.tsx already fires GET_CONTEXT on startup)
    if (prevLinkedRef.current !== linkedGuideline && prevLinkedRef.current !== undefined) {
      parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com');
    }
    prevLinkedRef.current = linkedGuideline;
  }, [linkedGuideline]);

  return (
    <div className="flex flex-col h-full -mx-1 px-1">
      <div className="space-y-3 pb-8 flex-1">
        <BrandCompletenessBar />

        <BrandGuidelineSection />

        <BrandSection
          title="Logos"
          icon={ImageIcon}
          description="Logo variants and assets"
          collapsible
          defaultOpen={false}
        >
          <BrandLogoSection />
        </BrandSection>

        <BrandSection
          title="Colors"
          icon={Palette}
          description="Brand color palette"
          collapsible
          defaultOpen={false}
        >
          <BrandColorGrid />
        </BrandSection>

        <BrandSection
          title="Typography"
          icon={Type}
          description="Font families and styles"
          collapsible
          defaultOpen={false}
        >
          <BrandTypographySection />
        </BrandSection>

        <BrandSection
          title="Design System"
          icon={Settings2}
          description="Tokens and variables"
          collapsible
          defaultOpen={false}
        >
          <DesignSystemSection />
        </BrandSection>

        <BrandSection
          title="Components"
          icon={Library}
          description="Reusable component library"
          collapsible
          defaultOpen={false}
        >
          <ComponentLibrarySection />
        </BrandSection>
      </div>
    </div>
  );
}
