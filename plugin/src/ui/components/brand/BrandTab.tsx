import React, { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { t } = useTranslation();
  const guideline = usePluginStore((s) => s.brandGuideline);
  const colors = usePluginStore((s) => s.selectedColors);
  const logos = usePluginStore((s) => s.logos);
  const typography = usePluginStore((s) => s.typography);
  const designSystem = usePluginStore((s) => s.designSystem);

  const steps = [
    { label: t('plugin.brand.tab.stepGuideline'), done: !!guideline },
    { label: t('plugin.brand.tab.stepColors'), done: colors.size > 0 },
    { label: t('plugin.brand.tab.stepLogos'), done: logos.some((l) => l.src || l.url) },
    { label: t('plugin.brand.tab.stepTypography'), done: typography.some((tp) => tp.fontFamily) },
    {
      label: t('plugin.brand.tab.stepTokens'),
      done: !!(designSystem?.tokens && Object.keys(designSystem.tokens).length > 0),
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t('plugin.brand.tab.setup')}
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
  const { t } = useTranslation();
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
          title={t('plugin.brand.tab.logosTitle')}
          icon={ImageIcon}
          description={t('plugin.brand.tab.logosDescription')}
          collapsible
          defaultOpen={false}
        >
          <BrandLogoSection />
        </BrandSection>

        <BrandSection
          title={t('plugin.brand.tab.colorsTitle')}
          icon={Palette}
          description={t('plugin.brand.tab.colorsDescription')}
          collapsible
          defaultOpen={false}
        >
          <BrandColorGrid />
        </BrandSection>

        <BrandSection
          title={t('plugin.brand.tab.typographyTitle')}
          icon={Type}
          description={t('plugin.brand.tab.typographyDescription')}
          collapsible
          defaultOpen={false}
        >
          <BrandTypographySection />
        </BrandSection>

        <BrandSection
          title={t('plugin.brand.tab.designSystemTitle')}
          icon={Settings2}
          description={t('plugin.brand.tab.designSystemDescription')}
          collapsible
          defaultOpen={false}
        >
          <DesignSystemSection />
        </BrandSection>

        <BrandSection
          title={t('plugin.brand.tab.componentsTitle')}
          icon={Library}
          description={t('plugin.brand.tab.componentsDescription')}
          collapsible
          defaultOpen={false}
        >
          <ComponentLibrarySection />
        </BrandSection>
      </div>
    </div>
  );
}
