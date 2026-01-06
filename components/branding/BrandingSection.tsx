import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';
import { translateTag } from '../../utils/localeUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

interface BrandingSectionProps {
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
  isComplete: boolean;
}

export const BrandingSection: React.FC<BrandingSectionProps> = ({
  tags,
  selectedTags,
  onTagToggle,
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  isComplete
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

  return (
    <section id="branding-section" className={isComplete ? 'pb-0' : ''}>
      <h2 className={`font-semibold font-mono uppercase tracking-widest mb-3 transition-all duration-300 ${isComplete ? 'text-[10px] mb-1' : 'text-sm'} ${isComplete ? (theme === 'dark' ? 'text-zinc-600' : 'text-zinc-500') : (theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600')}`}>
        {t('mockup.branding')}
      </h2>
      {!isComplete && (
        <p className={`text-xs mb-3 font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('mockup.brandingComment')}</p>
      )}
      <div>
        <div className="flex flex-wrap gap-2 cursor-pointer">
          {tags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            const limitReached = selectedTags.length >= 3;
            const isDisabled = limitReached && !isSelected;
            
            return (
              <Button
                key={tag}
                onClick={() => onTagToggle(tag)}
                disabled={isDisabled}
                variant="outline"
                size="sm"
                className={cn(
                  "text-xs font-medium transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0",
                  isSelected 
                    ? theme === 'dark'
                      ? 'bg-brand-cyan/20 text-brand-cyan border-[#52ddeb]/30 shadow-sm shadow-[#52ddeb]/10'
                      : 'bg-brand-cyan/20 text-zinc-800 border-[#52ddeb]/30 shadow-sm shadow-[#52ddeb]/10'
                    : theme === 'dark'
                      ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:text-zinc-900'
                )}
              >
                {translateTag(tag)}
              </Button>
            );
          })}
          {!isComplete && (
            !isEditingCustom ? (
              <Button
                onClick={handleCustomTagClick}
                disabled={limitReached}
                variant="outline"
                size="sm"
                className={cn(
                  "text-xs font-medium transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0",
                  limitReached
                    ? theme === 'dark'
                      ? 'opacity-40 bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                      : 'opacity-40 bg-zinc-100 text-zinc-500 border-zinc-300'
                    : theme === 'dark'
                      ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:text-zinc-900'
                )}
              >
                <Plus size={14} />
                <span>{t('mockup.customTagLabel')}</span>
              </Button>
            ) : (
              <Input
                ref={inputRef}
                type="text"
                value={customInput}
                onChange={(e) => onCustomInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={t('mockup.customStylePlaceholder')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all duration-200 border-[#52ddeb]/30 focus:ring-0 min-w-[120px] font-mono",
                  theme === 'dark'
                    ? 'bg-brand-cyan/20 text-brand-cyan'
                    : 'bg-brand-cyan/20 text-zinc-800'
                )}
                autoFocus
              />
            )
          )}
        </div>
      </div>
    </section>
  );
};


