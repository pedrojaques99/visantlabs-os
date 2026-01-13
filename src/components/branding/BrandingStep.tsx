import React from 'react';
import { FormButton } from '@/components/ui/form-button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, RefreshCw, Coins } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { getBrandingStepCredits } from '@/utils/creditCalculator';

interface BrandingStepProps {
  title: string;
  content: any;
  isGenerating: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  stepNumber: number;
}

export const BrandingStep: React.FC<BrandingStepProps> = ({
  title,
  content,
  isGenerating,
  onApprove,
  onRegenerate,
  stepNumber,
}) => {
  const { t } = useTranslation();
  const creditsRequired = getBrandingStepCredits(stepNumber);

  const renderContent = () => {
    if (isGenerating) {
      return (
        <div className="flex items-center justify-center py-12">
          <GlitchLoader size={32} color="brand-cyan" />
          <span className="ml-3 text-muted-foreground">{t('branding.generating')} {title}...</span>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          {t('branding.noContentAvailable')}
        </div>
      );
    }

    // Render based on content type
    if (typeof content === 'string') {
      // Parse markdown-like content
      const parseMarkdown = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactElement[] = [];
        let currentParagraph: string[] = [];
        let listItems: string[] = [];
        let inList = false;

        const flushParagraph = () => {
          if (currentParagraph.length > 0) {
            const paraText = currentParagraph.join(' ');
            elements.push(
              <p key={elements.length} className="mb-4 text-foreground leading-relaxed normal-case">
                {parseInlineMarkdown(paraText)}
              </p>
            );
            currentParagraph = [];
          }
        };

        const flushList = () => {
          if (listItems.length > 0) {
            elements.push(
              <ul key={elements.length} className="mb-6 space-y-2 list-none">
                {listItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-brand-cyan mt-1.5 flex-shrink-0">•</span>
                    <span className="text-foreground normal-case leading-relaxed">{parseInlineMarkdown(item.trim())}</span>
                  </li>
                ))}
              </ul>
            );
            listItems = [];
            inList = false;
          }
        };

        lines.forEach((line, index) => {
          const trimmed = line.trim();

          // Headers
          if (trimmed.startsWith('#### ')) {
            flushParagraph();
            flushList();
            elements.push(
              <h4 key={elements.length} className="text-lg font-semibold text-foreground mb-3 mt-6 normal-case">
                {parseInlineMarkdown(trimmed.substring(5))}
              </h4>
            );
          } else if (trimmed.startsWith('### ')) {
            flushParagraph();
            flushList();
            elements.push(
              <h3 key={elements.length} className="text-xl font-semibold text-foreground mb-4 mt-8 normal-case">
                {parseInlineMarkdown(trimmed.substring(4))}
              </h3>
            );
          } else if (trimmed.startsWith('## ')) {
            flushParagraph();
            flushList();
            elements.push(
              <h2 key={elements.length} className="text-2xl font-bold text-foreground mb-4 mt-8 normal-case">
                {parseInlineMarkdown(trimmed.substring(3))}
              </h2>
            );
          } else if (trimmed.startsWith('# ')) {
            flushParagraph();
            flushList();
            elements.push(
              <h1 key={elements.length} className="text-3xl font-bold text-foreground mb-4 mt-8 normal-case">
                {parseInlineMarkdown(trimmed.substring(2))}
              </h1>
            );
          } else if (trimmed.startsWith('---')) {
            flushParagraph();
            flushList();
            elements.push(
              <hr key={elements.length} className="my-6 border-border/10" />
            );
          } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            flushParagraph();
            if (!inList) inList = true;
            listItems.push(trimmed.substring(2));
          } else if (trimmed === '') {
            flushParagraph();
            flushList();
          } else {
            flushList();
            currentParagraph.push(trimmed);
          }
        });

        flushParagraph();
        flushList();

        return elements;
      };

      const parseInlineMarkdown = (text: string): (string | React.ReactElement)[] => {
        const parts: (string | React.ReactElement)[] = [];
        let currentIndex = 0;
        const boldRegex = /\*\*([^*]+)\*\*/g;
        let match;

        while ((match = boldRegex.exec(text)) !== null) {
          if (match.index > currentIndex) {
            parts.push(text.substring(currentIndex, match.index));
          }
          parts.push(
            <strong key={parts.length} className="font-semibold text-foreground">
              {match[1]}
            </strong>
          );
          currentIndex = match.index + match[0].length;
        }

        if (currentIndex < text.length) {
          parts.push(text.substring(currentIndex));
        }

        return parts.length > 0 ? parts : [text];
      };

      return (
        <div className="max-w-none space-y-2">
          {parseMarkdown(content)}
        </div>
      );
    }

    if (Array.isArray(content)) {
      return (
        <ul className="space-y-2">
          {content.map((item, index) => (
            <li key={index} className="flex items-start gap-2 animate-fade-in">
              <span className="text-brand-cyan mt-1">•</span>
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (typeof content === 'object' && content !== null) {
      // Handle SWOT
      if (content.strengths || content.weaknesses || content.opportunities || content.threats) {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.strengths && (
              <div>
                <h4 className="font-semibold text-green-400 mb-2">{t('branding.strengths')}</h4>
                <ul className="space-y-1">
                  {content.strengths.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {content.weaknesses && (
              <div>
                <h4 className="font-semibold text-red-400 mb-2">{t('branding.weaknesses')}</h4>
                <ul className="space-y-1">
                  {content.weaknesses.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {content.opportunities && (
              <div>
                <h4 className="font-semibold text-blue-400 mb-2">{t('branding.opportunities')}</h4>
                <ul className="space-y-1">
                  {content.opportunities.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {content.threats && (
              <div>
                <h4 className="font-semibold text-orange-400 mb-2">{t('branding.threats')}</h4>
                <ul className="space-y-1">
                  {content.threats.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }

      // Handle Persona
      if (content.demographics || content.desires || content.pains) {
        return (
          <div className="space-y-4">
            {content.demographics && (
              <div>
                <h4 className="font-semibold mb-2">{t('branding.demographics')}</h4>
                <p className="text-foreground">{content.demographics}</p>
              </div>
            )}
            {content.desires && (
              <div>
                <h4 className="font-semibold mb-2">{t('branding.desires')}</h4>
                <ul className="space-y-1">
                  {content.desires.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {content.pains && (
              <div>
                <h4 className="font-semibold mb-2">{t('branding.painPoints')}</h4>
                <ul className="space-y-1">
                  {content.pains.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }

      // Handle Color Palettes (array of palette objects)
      if (Array.isArray(content) && content.length > 0 && content[0]?.colors) {
        return (
          <div className="space-y-4">
            {content.map((palette: any, index: number) => {
              if (!palette || typeof palette !== 'object') return null;
              const paletteName = palette.name || 'Unnamed Palette';
              const paletteColors = Array.isArray(palette.colors) ? palette.colors : [];
              const palettePsychology = palette.psychology || '';

              return (
                <div key={index} className="border border-border rounded-md p-4 bg-card/50 animate-fade-in">
                  <h4 className="font-semibold mb-2 text-foreground normal-case">{String(paletteName)}</h4>
                  <div className="flex gap-2 mb-3">
                    {paletteColors.map((color: string, colorIndex: number) => (
                      <div
                        key={colorIndex}
                        className="w-12 h-12 rounded border border-border transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                        style={{ backgroundColor: String(color) }}
                        title={String(color)}
                      />
                    ))}
                  </div>
                  {palettePsychology && (
                    <p className="text-sm text-muted-foreground normal-case">{String(palettePsychology)}</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      // Handle single Color Palette object (not in array)
      if (typeof content === 'object' && content !== null && !Array.isArray(content) && content.colors) {
        const palette = content as any;
        const paletteName = palette.name || 'Unnamed Palette';
        const paletteColors = Array.isArray(palette.colors) ? palette.colors : [];
        const palettePsychology = palette.psychology || '';

        return (
          <div className="border border-border rounded-md p-4 bg-card/50 animate-fade-in">
            <h4 className="font-semibold mb-2 text-foreground normal-case">{String(paletteName)}</h4>
            <div className="flex gap-2 mb-3">
              {paletteColors.map((color: string, colorIndex: number) => (
                <div
                  key={colorIndex}
                  className="w-12 h-12 rounded border border-border transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                  style={{ backgroundColor: String(color) }}
                  title={String(color)}
                />
              ))}
            </div>
            {palettePsychology && (
              <p className="text-sm text-muted-foreground normal-case">{String(palettePsychology)}</p>
            )}
          </div>
        );
      }
    }

    return (
      <div className="text-muted-foreground">
        {JSON.stringify(content, null, 2)}
      </div>
    );
  };

  return (
    <Card className="w-full bg-card border border-border animate-fade-in transition-all duration-300">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground">
              {t('branding.step')} {stepNumber}: {title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="h-4 w-4" />
              <span>
                {creditsRequired} {creditsRequired === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
              </span>
            </div>
          </div>

          <div className="min-h-[200px]">
            {renderContent()}
          </div>

          {!isGenerating && content && (
            <div className="flex gap-3 pt-4 border-t border-border">
              <FormButton
                onClick={onRegenerate}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4" />
                {t('branding.regenerate')}
              </FormButton>
              <FormButton
                onClick={onApprove}
                variant="primary"
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('branding.approveContinue')}
              </FormButton>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

