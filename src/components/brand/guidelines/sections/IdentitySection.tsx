import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Trash2, Globe, Instagram, Linkedin, Briefcase, Twitter } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';

interface IdentitySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  onReIngest?: () => void;
  onOpenWizard?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  span?: string;
  rowSpan?: string;
}

type IdentityFields = {
  name: string; tagline: string; description: string;
  website: string; portfolio: string; instagram: string; linkedin: string; x: string;
};

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  guideline, onUpdate, onReIngest, onDelete, isDeleting, span, rowSpan,
}) => {
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const local: IdentityFields = {
    name: guideline.identity?.name || guideline.name || '',
    tagline: guideline.identity?.tagline || guideline.tagline || '',
    description: guideline.identity?.description || guideline.description || '',
    website: guideline.identity?.website || '',
    portfolio: guideline.identity?.portfolio || '',
    instagram: guideline.identity?.instagram || '',
    linkedin: guideline.identity?.linkedin || '',
    x: guideline.identity?.x || '',
  };

  const persist = useCallback((fields: IdentityFields) => {
    onUpdate({ identity: { ...guideline.identity, ...fields }, name: fields.name, tagline: fields.tagline, description: fields.description });
  }, [onUpdate, guideline.identity]);

  const update = (patch: Partial<IdentityFields>) => {
    const next = { ...local, ...patch };
    persist(next);
  };

  const primaryLogo = guideline.logos?.find(l => l.variant === 'primary') || guideline.logos?.[0];

  return (
    <SectionBlock
      id="identity"
      icon={<FileText size={14} />}
      title="Identity"
      span={span as any}
      rowSpan={rowSpan as any}
      actions={(
        <div className="flex items-center gap-1">
          {onReIngest && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={onReIngest} title="Re-ingest from website" aria-label="Re-ingest">
              <RefreshCw size={11} />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-600 hover:text-red-400" onClick={onDelete} disabled={isDeleting} aria-label="Delete guideline">
              <Trash2 size={11} />
            </Button>
          )}
        </div>
      )}
    >
      <div className="space-y-3 py-1">
        {/* Logo + Name */}
        <div className="flex items-center gap-3 pb-2 border-b border-white/[0.04]">
          {primaryLogo && (
            <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded overflow-hidden bg-neutral-900/60">
              <img src={primaryLogo.url} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <Input
            value={local.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-7 text-sm font-semibold bg-transparent border-none px-0 text-neutral-100 focus-visible:ring-0 placeholder:text-neutral-700"
            placeholder="Brand name"
          />
        </div>

        <Input
          value={local.tagline}
          onChange={(e) => update({ tagline: e.target.value })}
          className="h-6 bg-transparent border-none px-0 text-xs text-neutral-400 focus-visible:ring-0 placeholder:text-neutral-700"
          placeholder="Tagline"
        />

        <Textarea
          value={local.description}
          onChange={(e) => update({ description: e.target.value })}
          className="border-white/[0.06] text-xs min-h-[70px] resize-none text-neutral-400 placeholder:text-neutral-700 bg-transparent"
          placeholder="Brand description..."
        />

        <div className="pt-1 border-t border-white/[0.04] flex flex-wrap gap-x-3 gap-y-0">
          {[
            { key: 'website' as const, icon: <Globe size={10} />, placeholder: 'Website' },
            { key: 'portfolio' as const, icon: <Briefcase size={10} />, placeholder: 'Portfolio' },
            { key: 'instagram' as const, icon: <Instagram size={10} />, placeholder: 'Instagram' },
            { key: 'linkedin' as const, icon: <Linkedin size={10} />, placeholder: 'LinkedIn' },
            { key: 'x' as const, icon: <Twitter size={10} />, placeholder: 'X / Twitter' },
          ].map(({ key, icon, placeholder }) => {
            const isEmpty = !local[key];
            return (
              <div key={key} className={cn(
                'flex items-center gap-1.5 group/link transition-all',
                isEmpty ? 'w-fit py-0.5' : 'w-full py-1 border-b border-white/[0.04] last:border-0'
              )}>
                <span className={cn('shrink-0 transition-colors', isEmpty ? 'text-neutral-800 group-hover/link:text-neutral-600' : 'text-neutral-600')}>{icon}</span>
                <Input
                  value={local[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                  className={cn(
                    'bg-transparent border-none px-0 text-xs font-mono focus-visible:ring-0 transition-all',
                    isEmpty
                      ? 'auto-input h-5 text-neutral-700 placeholder:text-neutral-800 hover:placeholder:text-neutral-600 cursor-text'
                      : 'h-7 flex-1 text-neutral-400 placeholder:text-neutral-700'
                  )}
                  placeholder={isEmpty ? `+ ${placeholder}` : placeholder}
                />
              </div>
            );
          })}
        </div>
      </div>
    </SectionBlock>
  );
};
