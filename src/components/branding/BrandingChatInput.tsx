import React, { useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getTotalBrandingCredits } from '@/utils/creditCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FormButton } from '@/components/ui/form-button';
import { Badge } from '@/components/ui/badge';

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
    <Card className="w-full bg-card/30 backdrop-blur-sm shadow-lg border-0">
      <CardContent className="p-4 space-y-4">
        {/* Prompt Textarea */}
        <div className="space-y-2">
          <Textarea
            value={promptPreview}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={6}
            className="min-h-[120px] resize-y font-mono text-sm"
            placeholder={t('branding.promptPlaceholder')}
          />
        </div>

        {/* Configurações Compactas */}
        <div className="space-y-3 pt-2 border-t border-border/5">
          {/* Créditos Necessários */}
          {calculatedCredits !== undefined && calculatedCredits > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('branding.creditsRequired')}:</span>
              <Badge variant="secondary">
                {calculatedCredits} {calculatedCredits === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
              </Badge>
            </div>
          )}

          {/* Botão Generate */}
          <FormButton
            onClick={onGenerateClick}
            disabled={isGenerateDisabled || (isPromptReady && isGenerating)}
            variant="primary"
            size="lg"
            isLoading={isGenerating || isGeneratingPrompt}
            className="w-full"
          >
            {isGeneratingPrompt ? (
              <span>{t('branding.generatingPrompt')}</span>
            ) : isGenerating ? (
              <span>{t('branding.generating')}</span>
            ) : isPromptReady ? (
              <span>{t('branding.startAnalysis')}</span>
            ) : (
              <span>{t('branding.startAnalysis')}</span>
            )}
          </FormButton>
        </div>

        {/* Sugestões de Prompt (se houver) */}
        {promptSuggestions.length > 0 && (
          <div className="pt-2 border-t border-border/5 space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-muted-foreground">{t('branding.aiSuggestions')}</p>
            {promptSuggestions.map((suggestion, index) => (
              <Card key={index} className="border-border/5 bg-muted/30">
                <CardContent className="p-3 space-y-2">
                  <FormButton
                    variant="ghost"
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className="w-full text-left text-xs h-auto py-2 font-normal justify-start"
                  >
                    {suggestion}
                  </FormButton>
                  {onGenerateSuggestion && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/5">
                      <FormButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSuggestion(suggestion);
                        }}
                        disabled={isGenerating || !suggestion.trim()}
                        variant="primary"
                        size="sm"
                        isLoading={isGenerating}
                        className="flex-1"
                      >
                        {isGenerating ? (
                          <span>{t('branding.generating')}</span>
                        ) : (
                          <span>{t('branding.startAnalysis')}</span>
                        )}
                      </FormButton>
                      {creditsPerGeneration !== undefined && creditsPerGeneration > 0 && (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {creditsPerGeneration} {creditsPerGeneration === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

