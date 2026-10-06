import React, { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Button } from '@/components/ui/button';
import {
  Download,
  ChevronDown,
  FileJson,
  FileCode,
  Braces,
  FileText,
  Brain,
  Check,
  ClipboardCheck,
} from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { BrandGuideline } from '@/lib/figma-types';
import { downloadBlob } from '@/components/brand/brand-shared-config';
import {
  extractExportData,
  renderCSS,
  renderTailwind,
  renderMarkdown,
  renderDesignMd,
} from '@/lib/guidelineExportRegistry';

interface GuidelineExportBarProps {
  guideline: BrandGuideline;
  onStartReview?: () => void;
}

interface ExportItem {
  id: string;
  label: string;
  group: string;
  icon: React.FC<{ size?: number; className?: string }>;
  action: () => void;
}

export const GuidelineExportBar: React.FC<GuidelineExportBarProps> = ({
  guideline,
  onStartReview,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const safeName = (guideline.identity?.name || guideline.name || 'brand')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
  const data = extractExportData(guideline);

  useClickOutside(menuRef, () => setOpen(false), { enabled: open });

  const items: ExportItem[] = [
    {
      id: 'json',
      label: 'JSON',
      group: 'Devs',
      icon: FileJson,
      action: () => {
        downloadBlob(
          JSON.stringify(guideline, null, 2),
          `${safeName}-guidelines.json`,
          'application/json'
        );
        toast.success(t('guidelineExport.exported', { format: 'JSON' }));
      },
    },
    {
      id: 'css',
      label: 'CSS Variables',
      group: 'Devs',
      icon: FileCode,
      action: () => {
        downloadBlob(renderCSS(data), `${safeName}-variables.css`, 'text/css');
        toast.success(t('guidelineExport.exported', { format: 'CSS' }));
      },
    },
    {
      id: 'tailwind',
      label: 'Tailwind Config',
      group: 'Devs',
      icon: Braces,
      action: () => {
        downloadBlob(renderTailwind(data), `${safeName}.tailwind.config.js`, 'text/javascript');
        toast.success(t('guidelineExport.exported', { format: 'Tailwind' }));
      },
    },
    {
      id: 'markdown',
      label: 'Markdown',
      group: 'Docs',
      icon: FileText,
      action: () => {
        downloadBlob(renderMarkdown(data), `${safeName}-guidelines.md`, 'text/markdown');
        toast.success(t('guidelineExport.exported', { format: 'Markdown' }));
      },
    },
    {
      id: 'design-md',
      label: 'DESIGN.md',
      group: 'AI',
      icon: Brain,
      action: () => {
        downloadBlob(renderDesignMd(data), 'DESIGN.md', 'text/markdown');
        toast.success(t('guidelineExport.exported', { format: 'DESIGN.md' }));
      },
    },
  ];

  const groups = ['Devs', 'Docs', 'AI'] as const;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-12 border-t border-border bg-background/90 backdrop-blur-xl">
        {/* Left: saved status */}
        <div className="flex items-center gap-2">
          <Check size={12} className="text-success" />
          <span className="text-xs text-muted-foreground">{t('guidelineExport.saved')}</span>
        </div>

        {/* Right: Review + Export */}
        <div className="flex items-center gap-2">
          {onStartReview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStartReview}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <ClipboardCheck size={12} />
              {t('guidelineExport.review')}
            </Button>
          )}

          <div ref={menuRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              className="h-8 px-3 text-xs gap-1.5 border border-border"
            >
              <Download size={12} />
              {t('common.export')}
              <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
            </Button>

            {open && (
              <div className="absolute right-0 bottom-full mb-2 z-50 w-52 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                {groups.map((group, gi) => (
                  <React.Fragment key={group}>
                    {gi > 0 && <div className="h-px bg-border" />}
                    <div className="px-3 pt-2 pb-1">
                      <span className="text-2xs font-medium text-muted-foreground">
                        {t(`guidelineExport.group.${group}`)}
                      </span>
                    </div>
                    {items
                      .filter((i) => i.group === group)
                      .map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              item.action();
                              setOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-foreground hover:bg-muted"
                          >
                            <Icon size={13} className="shrink-0" />
                            <span className="text-xs">{item.label}</span>
                          </button>
                        );
                      })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
