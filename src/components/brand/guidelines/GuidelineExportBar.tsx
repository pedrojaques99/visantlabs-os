import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  highlight?: boolean;
}

export const GuidelineExportBar: React.FC<GuidelineExportBarProps> = ({
  guideline,
  onStartReview,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const safeName = (guideline.identity?.name || guideline.name || 'brand')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
  const data = extractExportData(guideline);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

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
        toast.success('Exported as JSON');
      },
    },
    {
      id: 'css',
      label: 'CSS Variables',
      group: 'Devs',
      icon: FileCode,
      action: () => {
        downloadBlob(renderCSS(data), `${safeName}-variables.css`, 'text/css');
        toast.success('Exported as CSS');
      },
    },
    {
      id: 'tailwind',
      label: 'Tailwind Config',
      group: 'Devs',
      icon: Braces,
      action: () => {
        downloadBlob(renderTailwind(data), `${safeName}.tailwind.config.js`, 'text/javascript');
        toast.success('Exported as Tailwind');
      },
    },
    {
      id: 'markdown',
      label: 'Markdown',
      group: 'Docs',
      icon: FileText,
      action: () => {
        downloadBlob(renderMarkdown(data), `${safeName}-guidelines.md`, 'text/markdown');
        toast.success('Exported as Markdown');
      },
    },
    {
      id: 'design-md',
      label: 'DESIGN.md',
      group: 'AI',
      icon: Brain,
      action: () => {
        downloadBlob(renderDesignMd(data), 'DESIGN.md', 'text/markdown');
        toast.success('Exported as DESIGN.md');
      },
      highlight: true,
    },
  ];

  const groups = ['Devs', 'Docs', 'AI'] as const;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-12 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur-xl">
        {/* Left: saved status */}
        <div className="flex items-center gap-2">
          <Check size={12} className="text-success/60" />
          <span className="text-[11px] text-neutral-600">Saved</span>
        </div>

        {/* Right: Review + Export */}
        <div className="flex items-center gap-2">
          {onStartReview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStartReview}
              className="h-8 px-3 text-xs text-neutral-500 hover:text-neutral-300 gap-1.5"
            >
              <ClipboardCheck size={12} />
              Review
            </Button>
          )}

          <div ref={menuRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              className="h-8 px-3 text-xs text-neutral-400 hover:text-neutral-200 gap-1.5 border border-neutral-800 hover:border-white/10"
            >
              <Download size={12} />
              Export
              <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
            </Button>

            {open && (
              <div className="absolute right-0 bottom-full mb-2 z-50 w-52 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                {groups.map((group, gi) => (
                  <React.Fragment key={group}>
                    {gi > 0 && <div className="h-px bg-white/5" />}
                    <div className="px-3 pt-2 pb-1">
                      <span
                        className={cn(
                          'text-[10px] font-medium',
                          group === 'AI' ? 'text-brand-cyan/60' : 'text-neutral-600'
                        )}
                      >
                        {group === 'AI' ? 'For AI' : `For ${group}`}
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
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                              item.highlight
                                ? 'text-brand-cyan/90 hover:bg-brand-cyan/[0.08]'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Icon size={13} className="shrink-0" />
                            <span className="text-[11px] font-medium">{item.label}</span>
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
