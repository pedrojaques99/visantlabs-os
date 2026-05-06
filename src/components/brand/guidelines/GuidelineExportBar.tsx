import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { FileText, FileJson, FileCode, Braces, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { downloadBlob } from '@/components/brand/brand-shared-config';
import { extractExportData, renderCSS, renderTailwind, renderMarkdown, renderDesignMd } from '@/lib/guidelineExportRegistry';

interface GuidelineExportBarProps {
  guideline: BrandGuideline;
}

export const GuidelineExportBar: React.FC<GuidelineExportBarProps> = ({ guideline }) => {
  const { t } = useTranslation();
  const safeName = (guideline.identity?.name || guideline.name || 'brand').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  const data = extractExportData(guideline);

  const exportJSON = () => {
    downloadBlob(JSON.stringify(guideline, null, 2), `${safeName}-guidelines.json`, 'application/json');
    toast.success('Exported as JSON');
  };

  const exportMarkdown = () => {
    downloadBlob(renderMarkdown(data), `${safeName}-guidelines.md`, 'text/markdown');
    toast.success('Exported as Markdown');
  };

  const exportCSS = () => {
    downloadBlob(renderCSS(data), `${safeName}-variables.css`, 'text/css');
    toast.success('Exported as CSS Variables');
  };

  const exportTailwind = () => {
    downloadBlob(renderTailwind(data), `${safeName}.tailwind.config.js`, 'text/javascript');
    toast.success('Exported as Tailwind Config');
  };

  const exportDesignMd = () => {
    downloadBlob(renderDesignMd(data), 'DESIGN.md', 'text/markdown');
    toast.success('Exported as DESIGN.md — LLM-ready spec');
  };

  const groupBtn =
    'h-8 px-3 text-[10px] font-mono text-neutral-500 hover:text-brand-cyan hover:bg-brand-cyan/5 gap-2';
  const groupLabel =
    'text-[9px] font-mono text-neutral-700 uppercase tracking-widest mr-1 shrink-0';
  const divider = 'h-4 w-px bg-white/[0.06] mx-1';

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-6 border-t border-white/[0.03]">
      <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest mr-2">
        Export
      </span>

      {/* Devs */}
      <span className={groupLabel}>Devs</span>
      <Button variant="ghost" size="sm" onClick={exportJSON} className={groupBtn}>
        <FileJson size={12} /> JSON
      </Button>
      <Button variant="ghost" size="sm" onClick={exportCSS} className={groupBtn}>
        <FileCode size={12} /> CSS
      </Button>
      <Button variant="ghost" size="sm" onClick={exportTailwind} className={groupBtn}>
        <Braces size={12} /> Tailwind
      </Button>

      <span className={divider} aria-hidden />

      {/* Docs */}
      <span className={groupLabel}>Docs</span>
      <Button variant="ghost" size="sm" onClick={exportMarkdown} className={groupBtn}>
        <FileText size={12} /> Markdown
      </Button>

      <span className={divider} aria-hidden />

      {/* Para IA */}
      <span className={cn(groupLabel, 'text-brand-cyan/60')}>Para IA</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportDesignMd}
        className="h-8 px-3 text-[10px] font-mono gap-2 text-brand-cyan/90 hover:text-brand-cyan bg-brand-cyan/[0.04] hover:bg-brand-cyan/[0.08] border border-brand-cyan/20 hover:border-brand-cyan/40 transition-all"
        title="LLM-ready spec — copia direto pra prompts ou IDE assistants"
      >
        <Brain size={12} />
        DESIGN.md
      </Button>
    </div>
  );
};
