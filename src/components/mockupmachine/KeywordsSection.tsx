import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Grid3x3 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMockup } from './MockupContext';

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
        'rounded-xl border p-3 transition-all duration-200 cursor-pointer space-y-2',
        theme === 'dark'
          ? 'bg-neutral-900/30 border-neutral-800/50 hover:bg-neutral-900/50'
          : 'bg-white/50 border-neutral-200 hover:bg-white/70'
      )}
      onClick={() => setIsSearchVisible(true)}
    >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Grid3x3 size={12} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
            <span className={cn('text-[10px] uppercase font-mono tracking-widest', theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600')}>
              {t('mockup.tags') || 'PALAVRAS-CHAVE'}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSearchVisible(!isSearchVisible);
            }}
            className={cn(
              'p-1 rounded-md transition-colors',
              theme === 'dark' ? 'hover:bg-white/10 text-neutral-500 hover:text-brand-cyan' : 'hover:bg-neutral-100 text-neutral-500 hover:text-brand-cyan'
            )}
          >
            {isSearchVisible ? <X size={12} /> : <Plus size={12} />}
          </button>
        </div>
        {isSearchVisible && (
          <div className="flex flex-col gap-2 pb-2" onClick={(e) => e.stopPropagation()}>
            <Input
              type="text"
              placeholder="Digite para buscar ou adicionar tags..."
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
                'h-9 text-sm font-mono rounded-lg border transition-all duration-200 focus:ring-1',
                theme === 'dark'
                  ? 'bg-black/20 border-white/10 text-neutral-200 placeholder:text-neutral-600 focus:border-brand-cyan/50 focus:ring-brand-cyan/20 shadow-inner'
                  : 'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-cyan/50 focus:ring-brand-cyan/20 shadow-inner'
              )}
            />
            {/* Smart Suggestions as Badges */}
            {displaySuggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span
                  className={cn(
                    'text-[9px] font-mono uppercase tracking-widest self-center mr-1',
                    theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
                  )}
                >
                  Sugestões:
                </span>
                {displaySuggestedTags.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => !selectedTags.includes(tag) && onTagToggle(tag)}
                    disabled={selectedTags.includes(tag)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-mono rounded-full border transition-all duration-200',
                      selectedTags.includes(tag)
                        ? 'bg-brand-cyan/20 border-brand-cyan/30 text-brand-cyan cursor-default'
                        : theme === 'dark'
                          ? 'bg-neutral-800/80 border-neutral-700/50 text-neutral-300 hover:bg-brand-cyan/10 hover:border-brand-cyan/30 hover:text-brand-cyan cursor-pointer'
                          : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-brand-cyan/10 hover:border-brand-cyan/30 hover:text-brand-cyan cursor-pointer'
                    )}
                  >
                    {translateTag(tag)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
};
