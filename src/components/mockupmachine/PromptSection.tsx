import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Info, Pickaxe, Wand2, ArrowLeftRight } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslation } from '@/hooks/useTranslation';

import { useTheme } from '@/hooks/useTheme';
import { getTranslations } from '@/utils/localeUtils';
import { useMockup } from './MockupContext';

interface PromptSectionProps {
  promptPreview: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  promptSuggestions: string[];
  isGeneratingPrompt: boolean;
  isSuggestingPrompts: boolean;
  isGenerating: boolean;
  hasGenerated: boolean;
  mockups: (string | null)[];
  onSuggestPrompts: () => void;
  onGenerateSmartPrompt: () => void;
  onSimplify: () => void;
  onRegenerate: () => void;
  onSuggestionClick: (suggestion: string) => void;
  isSmartPromptActive: boolean;
  setIsSmartPromptActive: (value: boolean) => void;
  setIsPromptManuallyEdited: (value: boolean) => void;
  creditsPerGeneration?: number;
  onGenerateSuggestion?: (suggestion: string) => void;
  isGenerateDisabled?: boolean;
}

export const PromptSection: React.FC<PromptSectionProps> = ({
  promptPreview,
  onPromptChange,
  promptSuggestions,
  isGeneratingPrompt,
  isSuggestingPrompts,
  isGenerating,
  hasGenerated,
  mockups,
  onSuggestPrompts,
  onGenerateSmartPrompt,
  onSuggestionClick,
  creditsPerGeneration,
  onGenerateSuggestion,
  isGenerateDisabled = false
}) => {
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    selectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
  } = useMockup();

  // Combine all tags for highlighting
  const allSelectedTags = useMemo(() => {
    const tags = [
      ...selectedTags,
      ...selectedLocationTags,
      ...selectedAngleTags,
      ...selectedLightingTags,
      ...selectedEffectTags,
      ...selectedMaterialTags
    ].filter(Boolean);
    // Sort by length desc to match longest first (avoid partial matches of shorter tags)
    return tags.sort((a, b) => b.length - a.length);
  }, [selectedTags, selectedLocationTags, selectedAngleTags, selectedLightingTags, selectedEffectTags, selectedMaterialTags]);

  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    if (allSelectedTags.length === 0) return text;

    // Escape regex special chars in tags
    const escapedTags = allSelectedTags.map(tag => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (escapedTags.length === 0) return text;

    const regex = new RegExp(`(${escapedTags.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      // Check if this part matches one of the tags (case-insensitive check)
      const isMatch = allSelectedTags.some(tag => tag.toLowerCase() === part.toLowerCase());
      if (isMatch) {
        return (
          <span key={1} className="underline decoration-1 underline-offset-2 hover:text-brand-cyan">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const statusMessages = useMemo(() => {
    const translations = getTranslations(locale);
    return translations.mockup?.promptStatusMessages ?? [
      'understanding your design',
      'searching for the best visual solutions',
      'thinking as a senior graphic designer'
    ];
  }, [locale]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isGeneratingPrompt) {
      setMessageIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % statusMessages.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isGeneratingPrompt, statusMessages]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit all content, but respect max-height
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 600; // max-h-[600px]
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      // Enable overflow-y-auto if content exceeds max height
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [promptPreview]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit all content, but respect max-height
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 600; // max-h-[600px]
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    // Enable overflow-y-auto if content exceeds max height
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
    onPromptChange(e);
  };

  return (
    <section id="prompt-section" className={`p-3 rounded-md border ${theme === 'dark' ? 'bg-neutral-950/20 border-neutral-700/50' : 'bg-neutral-50 border-neutral-300'}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`flex items-center gap-2 text-xs font-mono ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
          <Info size={14} /> {t('mockup.prompt')}
        </h4>
        <div className="flex items-center gap-3">
          {/* Hide suggest button when prompt is empty */}
          {promptPreview.trim() && (
            <Tooltip content={t('mockup.suggestTooltip')} position="top">
              <button
                onClick={onSuggestPrompts}
                disabled={isSuggestingPrompts || !promptPreview.trim() || isGeneratingPrompt}
                className={`text-xs font-mono hover:text-brand-cyan transition-colors disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 ${theme === 'dark' ? 'text-neutral-500 disabled:text-neutral-600' : 'text-neutral-600 disabled:text-neutral-400'
                  }`}
              >
                {isSuggestingPrompts ? <GlitchLoader size={12} /> : <Pickaxe size={12} />}
                <span>{t('mockup.suggest')}</span>
              </button>
            </Tooltip>
          )}
          {(!hasGenerated || !mockups.some(m => m !== null)) && (
            <Tooltip content={isGenerateDisabled ? t('mockup.insufficientCredits') || "Insufficient credits to generate" : t('mockup.generateSmartPromptTooltip')} position="top">
              <button
                onClick={onGenerateSmartPrompt}
                disabled={isGeneratingPrompt || isSuggestingPrompts || isGenerateDisabled}
                className={`text-xs font-mono hover:text-brand-cyan transition-colors disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 ${theme === 'dark' ? 'text-neutral-500 disabled:text-neutral-600' : 'text-neutral-600 disabled:text-neutral-400'
                  }`}
              >
                <Wand2 size={12} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>


      <div className="relative group">
        {/* Backdrop for highlighting */}
        <div
          ref={backdropRef}
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full p-2 rounded-md border border-transparent whitespace-pre-wrap font-mono text-xs overflow-hidden pointer-events-none ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-700'
            }`}
          style={{
            // Match textarea sizing styles exactly
            lineHeight: '1.5', // Assuming default or verify
          }}
        >
          {renderHighlightedText(promptPreview)}
          {/* Add a trailing space match to ensure alignment if prompts ends with newline */}
          {promptPreview.endsWith('\n') && <br />}
        </div>

        <textarea
          ref={textareaRef}
          value={promptPreview}
          onChange={handleChange}
          onScroll={handleScroll} // Sync scroll
          rows={1}
          className={`relative z-10 w-full p-2 rounded-md border focus:outline-none focus:border-brand-cyan/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y bg-transparent ${theme === 'dark'
            ? 'border-neutral-700/50 text-transparent caret-neutral-400'
            : 'border-neutral-300 text-transparent caret-neutral-700'
            } ${isGeneratingPrompt ? 'opacity-50' : ''} selection:bg-brand-cyan/20 selection:text-transparent`} // Text transparent to show backdrop
          placeholder={t('mockup.promptPlaceholder')}
          style={{ minHeight: '100px', maxHeight: '600px', lineHeight: '1.5' }} // Explicit line-height
          disabled={isGeneratingPrompt}
          spellCheck={false} // Avoid red squiggles interfering
        />

        {isGeneratingPrompt && (
          <div className={`absolute h-min-[100px] inset-0 flex flex-col items-center justify-center gap-2 rounded-md ${theme === 'dark' ? 'bg-neutral-950/60' : 'bg-white/60'
            } backdrop-blur-sm`}>
            <GlitchLoader size={12} />
            <span className="text-xs font-mono font-semibold text-brand-cyan uppercase tracking-wider">
              GENERATING PROMPT...
            </span>
            <div className="h-4 text-[10px] font-mono uppercase tracking-wide text-foreground overflow-hidden">
              <span
                key={messageIndex}
                className="block animate-fade-in text-center"
              >
                {statusMessages[messageIndex]}
              </span>
            </div>
          </div>
        )}
      </div>
      {
        promptSuggestions.length > 0 && (
          <div className="mt-3 space-y-2 animate-fade-in">
            <p className={`text-xs font-mono ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.aiSuggestions')}</p>
            {promptSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`flex flex-col gap-2 p-2 rounded-md border ${theme === 'dark' ? 'bg-neutral-900/50 border-neutral-700/50' : 'bg-neutral-100 border-neutral-300'
                  }`}
              >
                <button
                  onClick={() => onSuggestionClick(suggestion)}
                  className={`w-full text-left text-xs font-mono transition-colors cursor-pointer ${theme === 'dark' ? 'text-neutral-400 hover:text-neutral-300' : 'text-neutral-700 hover:text-neutral-900'
                    }`}
                >
                  {suggestion}
                </button>
                {onGenerateSuggestion && (
                  <div className={`flex items-center justify-between gap-2 pt-2 border-t ${theme === 'dark' ? 'border-neutral-700/50' : 'border-neutral-300'
                    }`}>
                    {isGenerateDisabled ? (
                      <Tooltip content={t('mockup.insufficientCredits') || "Insufficient credits to generate"} position="top">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onGenerateSuggestion(suggestion);
                          }}
                          disabled={isGenerating || !suggestion.trim() || isGenerateDisabled}
                          className="flex-1 flex items-center justify-center gap-2 bg-brand-cyan/80 hover:bg-brand-cyan/90 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-black font-semibold py-2 px-3 rounded-md transition-all duration-300 text-xs transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50"
                        >
                          {isGenerating ? (
                            <>
                              <GlitchLoader size={12} />
                              <span>{t('mockup.generatingOutputs')}</span>
                            </>
                          ) : (
                            <>
                              <Pickaxe size={12} />
                              <span>{t('mockup.generateOutputs')}</span>
                            </>
                          )}
                        </button>
                      </Tooltip>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSuggestion(suggestion);
                        }}
                        disabled={isGenerating || !suggestion.trim() || isGenerateDisabled}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-cyan/80 hover:bg-brand-cyan/90 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-black font-semibold py-2 px-3 rounded-md transition-all duration-300 text-xs transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50"
                      >
                        {isGenerating ? (
                          <>
                            <GlitchLoader size={12} />
                            <span>{t('mockup.generatingOutputs')}</span>
                          </>
                        ) : (
                          <>
                            <Pickaxe size={12} />
                            <span>{t('mockup.generateOutputs')}</span>
                          </>
                        )}
                      </button>
                    )}
                    {creditsPerGeneration !== undefined && creditsPerGeneration > 0 && (
                      <span className={`text-xs font-mono whitespace-nowrap ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
                        }`}>
                        {creditsPerGeneration} {creditsPerGeneration === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </section >
  );
};

