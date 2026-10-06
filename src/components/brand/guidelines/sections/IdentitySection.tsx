import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import {
  FileText,
  RefreshCw,
  Trash2,
  Globe,
  Instagram,
  Linkedin,
  Briefcase,
  Twitter,
} from '@/lib/ui/icons';
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
  name: string;
  tagline: string;
  description: string;
  website: string;
  portfolio: string;
  instagram: string;
  linkedin: string;
  x: string;
};

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  guideline,
  onUpdate,
  onReIngest,
  onDelete,
  isDeleting,
  span,
  rowSpan,
}) => {
  const { t } = useTranslation();
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

  const persist = useCallback(
    (fields: IdentityFields) => {
      onUpdate({
        identity: { ...guideline.identity, ...fields },
        name: fields.name,
        tagline: fields.tagline,
        description: fields.description,
      });
    },
    [onUpdate, guideline.identity]
  );

  const update = (patch: Partial<IdentityFields>) => {
    const next = { ...local, ...patch };
    persist(next);
  };

  const primaryLogo = guideline.logos?.find((l) => l.variant === 'primary') || guideline.logos?.[0];

  return (
    <SectionBlock
      id="identity"
      icon={<FileText size={14} />}
      title={t('brandView.identity')}
      span={span as any}
      rowSpan={rowSpan as any}
      actions={
        <div className="flex items-center gap-1">
          {onReIngest && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onReIngest}
              title={t('brandEditor.reingestTitle')}
              aria-label={t('brandEditor.reingest')}
            >
              <RefreshCw size={11} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/70 hover:text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
              aria-label={t('brandEditor.deleteGuideline')}
            >
              <Trash2 size={11} />
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3 py-1">
        {/* Logo + Name */}
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          {primaryLogo && (
            <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded overflow-hidden bg-card/60">
              <img
                src={primaryLogo.url}
                alt="Logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
          <Input
            value={local.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-7 text-sm font-medium bg-transparent border-none px-0 text-foreground focus-visible:ring-0 placeholder:text-muted-foreground"
            placeholder={t('brandEditor.namePlaceholder')}
          />
        </div>

        <Input
          value={local.tagline}
          onChange={(e) => update({ tagline: e.target.value })}
          className="h-6 bg-transparent border-none px-0 text-xs text-muted-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
          placeholder={t('brandView.tagline')}
        />

        <Textarea
          value={local.description}
          onChange={(e) => update({ description: e.target.value })}
          className="border-border text-xs min-h-[70px] resize-none text-muted-foreground placeholder:text-muted-foreground/50 bg-transparent"
          placeholder={t('brandEditor.identityDescPlaceholder')}
        />

        <div className="pt-1 border-t border-border flex flex-wrap gap-x-3 gap-y-0">
          {[
            { key: 'website' as const, icon: <Globe size={10} />, placeholder: 'Website' },
            { key: 'portfolio' as const, icon: <Briefcase size={10} />, placeholder: 'Portfolio' },
            { key: 'instagram' as const, icon: <Instagram size={10} />, placeholder: 'Instagram' },
            { key: 'linkedin' as const, icon: <Linkedin size={10} />, placeholder: 'LinkedIn' },
            { key: 'x' as const, icon: <Twitter size={10} />, placeholder: 'X / Twitter' },
          ].map(({ key, icon, placeholder }) => {
            const isEmpty = !local[key];
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-1.5 group/link',
                  isEmpty ? 'w-fit py-0.5' : 'w-full py-1 border-b border-border last:border-0'
                )}
              >
                <span
                  className={cn(
                    'shrink-0 transition-colors',
                    isEmpty
                      ? 'text-muted-foreground/50 group-hover/link:text-muted-foreground/70'
                      : 'text-muted-foreground/70'
                  )}
                >
                  {icon}
                </span>
                <Input
                  value={local[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                  className={cn(
                    'bg-transparent border-none px-0 text-xs font-mono focus-visible:ring-0',
                    isEmpty
                      ? 'auto-input h-5 text-muted-foreground/50 placeholder:text-muted-foreground/50 hover:placeholder:text-muted-foreground/70 cursor-text'
                      : 'h-7 flex-1 text-muted-foreground placeholder:text-muted-foreground/50'
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
