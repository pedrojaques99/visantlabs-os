import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
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
  suggestionSource?: string;
  hideTitle?: boolean;
  isEditingCustom?: boolean;
  onSetIsEditingCustom?: (value: boolean) => void;
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
  hasAnalyzed = false,
  hideTitle = false,
  isEditingCustom = false,
  onSetIsEditingCustom
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Local state for expansion
  const [isExpanded, setIsExpanded] = useState(false);

  // Local state for editing if not provided via props (fallback)
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = onSetIsEditingCustom !== undefined ? isEditingCustom : internalIsEditing;
  const setEditing = onSetIsEditingCustom || setInternalIsEditing;

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const limitReached = selectedTags.length >= 3;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [isEditing]);

  const handleCustomTagSubmit = () => {
    if (customInput.trim() && !limitReached) {
      onAddCustomTag();
      setEditing(false);
    } else {
      handleCustomTagCancel();
    }
  };

  const handleCustomTagCancel = () => {
    onCustomInputChange('');
    setEditing(false);
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

  // Logic: Sort suggested tags first, then others
  const sortedTags = React.useMemo(() => {
    const suggested = tags.filter(t => suggestedTags.includes(t));
    const others = tags.filter(t => !suggestedTags.includes(t));
    // Also prioritize selected tags if desired, but user asked for "Suggested"
    // Usually selected tags are already "interesting".
    // Let's stick to Suggested -> Others.
    return [...suggested, ...others];
  }, [tags, suggestedTags]);

  const tagsToDisplay = hasAnalyzed ? selectedTags : sortedTags;

  // "3 lines" approximation involves limits. Let's start with a rough number or use CSS
  // Since CSS line clamp is hard with flex-wrap badges, we'll try a container max-height.
  // 3 lines * ~32px/line = ~96px.

  return (
    <section id="branding-section" className={isComplete || hasAnalyzed ? 'pb-0' : ''}>
      {!hideTitle && (
        <h2 className={cn(sectionTitleClass(theme === 'dark'), (isComplete || hasAnalyzed) ? 'mb-1' : 'mb-3', 'transition-all duration-300')}>
          {t('mockup.branding')}
        </h2>
      )}
      {!isComplete && !hasAnalyzed && (
        <p className={`text-xs mb-3 font-mono ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.brandingComment')}</p>
      )}
      <div>
        <div
          className={cn(
            "flex flex-wrap gap-2 cursor-pointer transition-all duration-500 relative overflow-hidden",
            !isExpanded && !hasAnalyzed && "max-h-[105px]" // Limits to approx 3 lines (32px * 3 + gap)
          )}
        >
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

          {/* Internal Custom Input (When triggered via Header) */}
          {isEditing && !hasAnalyzed && (
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

          {/* Gradient Overlay when collapsed */}
          {!isExpanded && !hasAnalyzed && tagsToDisplay.length > 12 && ( // Only show gradient if enough tags
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-8 pointer-events-none",
              theme === 'dark'
                ? "bg-gradient-to-t from-neutral-950 to-transparent"
                : "bg-gradient-to-t from-white to-transparent"
            )} />
          )}

        </div>

        {/* Expand/Collapse Button */}
        {!hasAnalyzed && (tagsToDisplay.length > 12) && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={12} />
                  {t('common.collapse')}
                </>
              ) : (
                <>
                  <ChevronDown size={12} />
                  {t('common.expand')}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};


