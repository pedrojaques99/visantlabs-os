import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Grid3x3 } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMockup } from './MockupContext';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';

interface KeywordsSectionProps {
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
  displaySuggestedTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
}

export const KeywordsSection: React.FC<KeywordsSectionProps> = ({
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  displaySuggestedTags,
  selectedTags,
  onTagToggle,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors duration-200 cursor-pointer space-y-2',
        'bg-card border-border hover:bg-accent'
      )}
      onClick={() => setIsSearchVisible(true)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Grid3x3 size={12} className="text-muted-foreground" />
          <span className={cn('text-2xs', 'text-muted-foreground')}>{t('mockup.tags')}</span>
        </div>
        <Button
          variant="ghost"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsSearchVisible(!isSearchVisible);
          }}
          className={cn(
            'p-1 rounded-md transition-colors',
            theme === 'dark'
              ? 'hover:bg-accent text-neutral-500 hover:text-foreground'
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-foreground'
          )}
        >
          {isSearchVisible ? <X size={12} /> : <Plus size={12} />}
        </Button>
      </div>
      {isSearchVisible && (
        <div className="flex flex-col gap-2 pb-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="text"
            placeholder={t('mockup.tagSearchPlaceholder')}
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customInput.trim()) {
                e.preventDefault();
                onAddCustomTag();
                onCustomInputChange('');
              }
            }}
            className={cn(
              'h-9 text-sm rounded-md border transition-[color,background-color,border-color,box-shadow] duration-200 focus:ring-1',
              'bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-brand-cyan/20 shadow-inner'
            )}
          />
          {/* Smart Suggestions as Badges */}
          {displaySuggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className={cn('text-2xs self-center mr-1', 'text-muted-foreground')}>
                Sugestões:
              </span>
              {displaySuggestedTags.slice(0, 5).map((tag) => (
                <Button
                  variant="ghost"
                  key={tag}
                  onClick={() => !selectedTags.includes(tag) && onTagToggle(tag)}
                  disabled={selectedTags.includes(tag)}
                  className={cn(
                    'px-2 py-0.5 text-2xs rounded-full border transition-colors duration-200',
                    selectedTags.includes(tag)
                      ? 'bg-brand-cyan/10 border-brand-cyan/30 text-foreground cursor-default'
                      : theme === 'dark'
                        ? 'bg-neutral-800/80 border-neutral-700/50 text-neutral-300 hover:bg-muted hover:border-neutral-700 hover:text-foreground cursor-pointer'
                        : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-muted hover:border-neutral-700 hover:text-foreground cursor-pointer'
                  )}
                >
                  {translateTag(tag)}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
