import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp, FileText, Palette } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { BrandingSection } from '../branding/BrandingSection';
import { MicroTitle } from '../ui/MicroTitle';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export const InstructionsIdentityPanel: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [isEditingCustomBranding, setIsEditingCustomBranding] = useState(false);
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false);
  const [isInstructionsTextareaVisible, setIsInstructionsTextareaVisible] = useState(false);

  const {
    selectedBrandingTags: ctxSelectedBrandingTags,
    suggestedBrandingTags,
    customBrandingInput,
    setCustomBrandingInput,
    instructions,
    setInstructions,
  } = useMockup();

  const {
    handleBrandingTagToggle,
    handleAddCustomBrandingTag,
    availableBrandingTags,
  } = useMockupTags();

  const displayBrandingTags = useMemo(
    () => [...new Set([...availableBrandingTags, ...ctxSelectedBrandingTags])],
    [availableBrandingTags, ctxSelectedBrandingTags]
  );

  useEffect(() => {
    const handler = () => setIsEditingCustomBranding(true);
    if (typeof window === 'undefined') return;
    window.addEventListener('mockup:openIdentity', handler as EventListener);
    return () => window.removeEventListener('mockup:openIdentity', handler as EventListener);
  }, []);

  return (
    <GlassPanel
        className="group overflow-hidden"
    >
      <Button variant="ghost" 
        onClick={() => setIsInstructionsExpanded(!isInstructionsExpanded)}
        className={cn(
          'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
          theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText
            size={14}
            className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}
          />
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <MicroTitle as="span">
              {t('mockup.instructions')} / {t('mockup.identity')}
            </MicroTitle>
            {!isInstructionsExpanded &&
              (instructions || ctxSelectedBrandingTags.length > 0) && (
                <span className="text-[10px] font-mono truncate max-w-[200px]">
                  {instructions && (
                    <span className="text-brand-cyan">
                      {instructions.substring(0, 30)}
                      {instructions.length > 30 ? '...' : ''}
                    </span>
                  )}
                  {instructions && ctxSelectedBrandingTags.length > 0 && (
                    <span className="text-neutral-500"> · </span>
                  )}
                  {ctxSelectedBrandingTags.length > 0 && (
                    <span className="text-neutral-500">
                      {ctxSelectedBrandingTags.length} {t('mockup.identity')}
                    </span>
                  )}
                </span>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isInstructionsExpanded ? (
            <ChevronUp size={16} className="text-neutral-500" />
          ) : (
            <ChevronDown size={16} className="text-neutral-500" />
          )}
        </div>
      </Button>

      {isInstructionsExpanded && (
        <div className="p-3 pt-2 animate-fade-in space-y-3">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <MicroTitle as="span">
                {t('mockup.instructions')}
              </MicroTitle>
              <Button variant="ghost" 
                type="button"
                onClick={() =>
                  setIsInstructionsTextareaVisible(!isInstructionsTextareaVisible)
                }
                className={cn(
                  'p-1 rounded-md transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-white/10 text-neutral-500 hover:text-brand-cyan'
                    : 'hover:bg-neutral-100 text-neutral-500 hover:text-brand-cyan'
                )}
                title={
                  isInstructionsTextareaVisible
                    ? t('mockup.collapse') || 'Collapse'
                    : t('mockup.expand') || 'Expand'
                }
                aria-label={
                  isInstructionsTextareaVisible
                    ? t('mockup.collapse') || 'Collapse'
                    : t('mockup.expand') || 'Expand'
                }
              >
                {isInstructionsTextareaVisible ? <X size={12} /> : <Plus size={12} />}
              </Button>
            </div>
            {isInstructionsTextareaVisible && (
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('mockup.instructionsPlaceholder')}
                className={cn(
                  'w-full min-h-[80px] p-3 text-sm font-mono rounded-lg focus:outline-none resize-none shadow-inner animate-fade-in',
                  theme === 'dark'
                    ? 'bg-black/10 border border-white/10 text-white placeholder:text-neutral-700 focus:border-brand-cyan/50'
                    : 'bg-white border border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-cyan/50'
                )}
              />
            )}
          </div>

          <div
            className={cn(
              'space-y-2 cursor-pointer rounded-md transition-colors',
              theme === 'dark'
            )}
            onClick={() => setIsEditingCustomBranding(true)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Palette
                  size={12}
                  className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}
                />
                <MicroTitle as="span">
                  {t('mockup.identity')}
                </MicroTitle>
              </div>
              <Button variant="ghost" 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingCustomBranding(true);
                }}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-white/10 text-neutral-500 hover:text-brand-cyan'
                    : 'hover:bg-neutral-100 text-neutral-500 hover:text-brand-cyan'
                )}
                title={t('mockup.customTagLabel')}
                aria-label={t('mockup.customTagLabel')}
              >
                <Plus size={12} />
              </Button>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <BrandingSection
                tags={displayBrandingTags}
                selectedTags={ctxSelectedBrandingTags}
                suggestedTags={suggestedBrandingTags}
                onTagToggle={handleBrandingTagToggle}
                customInput={customBrandingInput}
                onCustomInputChange={setCustomBrandingInput}
                onAddCustomTag={handleAddCustomBrandingTag}
                isComplete={ctxSelectedBrandingTags.length > 0}
                hideTitle
                isEditingCustom={isEditingCustomBranding}
                onSetIsEditingCustom={setIsEditingCustomBranding}
              />
            </div>
          </div>
        </div>
      )}
    </GlassPanel>
  );
};

