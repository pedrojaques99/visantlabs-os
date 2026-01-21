import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, sectionTitleClass } from '@/lib/utils';

interface BrandingSectionProps {
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
  isComplete: boolean;
  suggestedTags?: string[];
  hasAnalyzed?: boolean;
}

export const BrandingSection: React.FC<BrandingSectionProps> = ({
  tags,
  selectedTags,
  onTagToggle,
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  isComplete,
  suggestedTags = [],
  hasAnalyzed = false
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const limitReached = selectedTags.length >= 3;

  useEffect(() => {
    if (isEditingCustom && inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [isEditingCustom]);

  const handleCustomTagClick = () => {
    if (!limitReached) {
      setIsEditingCustom(true);
    }
  };

  const handleCustomTagSubmit = () => {
    if (customInput.trim() && !limitReached) {
      onAddCustomTag();
      setIsEditingCustom(false);
    } else {
      handleCustomTagCancel();
    }
  };

  const handleCustomTagCancel = () => {
    onCustomInputChange('');
    setIsEditingCustom(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      handleCustomTagSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      handleCustomTagCancel();
    }
  };

  const handleBlur = () => {
    // Delay blur to allow click events to fire first
    blurTimeoutRef.current = window.setTimeout(() => {
      handleCustomTagSubmit();
    }, 150);
  };

  // If analyzed, only show selected tags
  const tagsToDisplay = hasAnalyzed ? selectedTags : tags;

  return (
    <section id="branding-section" className={isComplete || hasAnalyzed ? 'pb-0' : ''}>
      <h2 className={cn(sectionTitleClass(theme === 'dark'), (isComplete || hasAnalyzed) ? 'mb-1' : 'mb-3', 'transition-all duration-300')}>
        {t('mockup.branding')}
      </h2>
      {!isComplete && !hasAnalyzed && (
        <p className={`text-xs mb-3 font-mono ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.brandingComment')}</p>
      )}
      <div>
        <div className="flex flex-wrap gap-2 cursor-pointer">
          {tagsToDisplay.map(tag => {
            const isSelected = selectedTags.includes(tag);
            const isSuggested = suggestedTags.includes(tag);
            const limitReached = selectedTags.length >= 3;
            const isDisabled = limitReached && !isSelected;

            return (
              <Badge
                key={tag}
                onClick={hasAnalyzed ? undefined : () => onTagToggle(tag)}
                variant="outline"
                className={cn(
                  "text-xs font-medium transition-all duration-200",
                  !hasAnalyzed && "cursor-pointer",
                  isSelected
                    ? theme === 'dark'
                      ? 'bg-brand-cyan/20 text-brand-cyan border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
                      : 'bg-brand-cyan/20 text-neutral-800 border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
                    : theme === 'dark'
                      ? isSuggested
                        ? 'bg-neutral-800/80 text-neutral-300 border-brand-cyan/50 hover:border-brand-cyan/70 hover:text-white animate-pulse-subtle'
                        : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                      : isSuggested
                        ? 'bg-brand-cyan/10 text-neutral-800 border-brand-cyan/50 shadow-sm shadow-brand-cyan/5 animate-pulse-subtle'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900',
                  isDisabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                {translateTag(tag)}
              </Badge>
            );
          })}
          {!isEditingCustom && !hasAnalyzed && (
            <Badge
              onClick={handleCustomTagClick}
              variant="outline"
              className={cn(
                "text-xs font-medium transition-all duration-200 gap-1 cursor-pointer",
                limitReached
                  ? theme === 'dark'
                    ? 'opacity-40 bg-neutral-800/50 text-neutral-400 border-neutral-700/50 cursor-not-allowed'
                    : 'opacity-40 bg-neutral-100 text-neutral-500 border-neutral-300 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                    : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900'
              )}
            >
              <Plus size={14} />
              <span>{t('mockup.customTagLabel')}</span>
            </Badge>
          )}
          {isEditingCustom && !hasAnalyzed && (
            <Input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={t('mockup.customStylePlaceholder')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all duration-200 border-[brand-cyan]/30 focus:ring-0 min-w-[120px] font-mono",
                theme === 'dark'
                  ? 'bg-brand-cyan/20 text-brand-cyan'
                  : 'bg-brand-cyan/20 text-neutral-800'
              )}
              autoFocus
            />
          )}
        </div>
      </div>
    </section>

  );
};


