import React, { useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getTotalBrandingCredits } from '@/utils/creditCalculator';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { ChatInput } from '../shared/chat/ChatInput';
import { cn } from '@/lib/utils';

interface BrandingChatInputProps {
  // Prompt
  promptPreview: string;
  onPromptChange: (value: string) => void;

  // Créditos
  creditsRequired?: number;

  // Geração
  onGenerateClick: () => void;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;
  isGenerateDisabled: boolean;
  isPromptReady: boolean;

  // Sugestões (opcional)
  promptSuggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  onGenerateSuggestion?: (suggestion: string) => void;
  creditsPerGeneration?: number;
}

export const BrandingChatInput: React.FC<BrandingChatInputProps> = ({
  promptPreview,
  onPromptChange,
  creditsRequired,
  onGenerateClick,
  isGenerating,
  isGeneratingPrompt,
  isGenerateDisabled,
  isPromptReady,
  promptSuggestions = [],
  onSuggestionClick,
  onGenerateSuggestion,
  creditsPerGeneration
}) => {
  const { t } = useTranslation();

  const calculatedCredits = useMemo(() => {
    return creditsRequired || getTotalBrandingCredits();
  }, [creditsRequired]);

  return (
    <GlassPanel className="w-full shadow-lg border-white/5" padding="md">
      <div className="space-y-4">
        {/* Chat Input */}
        <ChatInput
          value={promptPreview}
          onChange={onPromptChange}
          onSend={onGenerateClick}
          isLoading={isGenerating || isGeneratingPrompt}
          placeholder={t('branding.promptPlaceholder')}
          minHeight={120}
          disabled={isGenerateDisabled}
        />

        {/* Credits Badge (if needed) */}
        {calculatedCredits !== undefined && calculatedCredits > 0 && (
          <div className="flex items-center justify-end pt-1">
            <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5">
              {calculatedCredits} {calculatedCredits === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
            </Badge>
          </div>
        )}

        {/* Sugestões de Prompt (se houver) */}
        {promptSuggestions.length > 0 && (
          <div className="pt-2 border-t border-border/5 space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-muted-foreground">{t('branding.aiSuggestions')}</p>
            {promptSuggestions.map((suggestion, index) => (
              <GlassPanel key={index} className="border-white/5 bg-white/5" padding="sm">
                <div className="space-y-2">
                  <Button variant="ghost" onClick={() => onSuggestionClick?.(suggestion)}
                    className="w-full text-left text-xs h-auto py-2 font-normal justify-start hover:text-brand-cyan transition-colors"
                  >
                    {suggestion}
                  </Button>
                  {onGenerateSuggestion && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/5">
                      <PremiumButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSuggestion(suggestion);
                        }}
                        disabled={isGenerating || !suggestion.trim()}
                        isLoading={isGenerating}
                        className="flex-1 h-9 py-0 text-xs"
                      >
                        {isGenerating ? (
                          <span>{t('branding.generating')}</span>
                        ) : (
                          <span>{t('branding.startAnalysis')}</span>
                        )}
                      </PremiumButton>
                      {creditsPerGeneration !== undefined && creditsPerGeneration > 0 && (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {creditsPerGeneration} {creditsPerGeneration === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </GlassPanel>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  );
};

