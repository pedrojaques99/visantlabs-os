import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Dna } from 'lucide-react';
import type { BrandIdentity } from '@/types/reactFlow';
import { cn } from '@/lib/utils';

interface BrandIdentityPanelProps {
  brandIdentity: BrandIdentity;
  onInsertElement?: (text: string) => void;
  className?: string;
}

export const BrandIdentityPanel: React.FC<BrandIdentityPanelProps> = ({
  brandIdentity,
  onInsertElement,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleColorClick = (color: string, type: 'primary' | 'secondary' | 'accent') => {
    if (onInsertElement) {
      const colorRef = `{brand-color: ${color}}`;
      onInsertElement(colorRef);
    }
  };

  const handleTypographyClick = (font: string, type: 'primary' | 'secondary') => {
    if (onInsertElement) {
      const typoRef = `{brand-typography: ${font}}`;
      onInsertElement(typoRef);
    }
  };

  const handlePersonalityClick = (value: string, type: 'tone' | 'feeling') => {
    if (onInsertElement) {
      const personalityRef = `{brand-${type}: ${value}}`;
      onInsertElement(personalityRef);
    }
  };

  const handleElementClick = (element: string) => {
    if (onInsertElement) {
      const elementRef = `{brand-element: ${element}}`;
      onInsertElement(elementRef);
    }
  };

  const allColors = [
    ...brandIdentity.colors.primary.map(c => ({ color: c, type: 'primary' as const })),
    ...brandIdentity.colors.secondary.map(c => ({ color: c, type: 'secondary' as const })),
    ...brandIdentity.colors.accent.map(c => ({ color: c, type: 'accent' as const })),
  ];

  return (
    <div className={cn('border-t border-neutral-700/30 pt-3 mb-3', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs font-mono text-neutral-400 hover:text-neutral-300 mb-2"
      >
        <div className="flex items-center gap-2">
          <Dna size={14} className="text-brand-cyan" />
          <span>Brand Identity</span>
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isExpanded && (
        <div className="space-y-3 text-xs">
          {/* Colors */}
          {allColors.length > 0 && (
            <div>
              <div className="text-neutral-500 font-mono mb-1.5">Colors</div>
              <div className="flex flex-wrap gap-2">
                {allColors.map(({ color, type }, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleColorClick(color, type)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 rounded transition-colors cursor-pointer"
                    title={`Click to insert {brand-color: ${color}}`}
                  >
                    <div
                      className="w-3 h-3 rounded border border-neutral-700/50"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-neutral-400 font-mono text-[10px]">{color}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Typography */}
          {(brandIdentity.typography.primary || brandIdentity.typography.secondary) && (
            <div>
              <div className="text-neutral-500 font-mono mb-1.5">Typography</div>
              <div className="flex flex-wrap gap-2">
                {brandIdentity.typography.primary && (
                  <button
                    onClick={() => handleTypographyClick(brandIdentity.typography.primary, 'primary')}
                    className="px-2 py-1 bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 rounded text-neutral-400 font-mono text-[10px] transition-colors cursor-pointer"
                    title={`Click to insert {brand-typography: ${brandIdentity.typography.primary}}`}
                  >
                    {brandIdentity.typography.primary}
                  </button>
                )}
                {brandIdentity.typography.secondary && (
                  <button
                    onClick={() => handleTypographyClick(brandIdentity.typography.secondary!, 'secondary')}
                    className="px-2 py-1 bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 rounded text-neutral-400 font-mono text-[10px] transition-colors cursor-pointer"
                    title={`Click to insert {brand-typography: ${brandIdentity.typography.secondary}}`}
                  >
                    {brandIdentity.typography.secondary}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Personality */}
          {(brandIdentity.personality.tone || brandIdentity.personality.feeling) && (
            <div>
              <div className="text-neutral-500 font-mono mb-1.5">Personality</div>
              <div className="flex flex-wrap gap-2">
                {brandIdentity.personality.tone && (
                  <button
                    onClick={() => handlePersonalityClick(brandIdentity.personality.tone, 'tone')}
                    className="px-2 py-1 bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 rounded text-neutral-400 text-[10px] transition-colors cursor-pointer"
                    title={`Click to insert {brand-tone: ${brandIdentity.personality.tone}}`}
                  >
                    Tone: {brandIdentity.personality.tone}
                  </button>
                )}
                {brandIdentity.personality.feeling && (
                  <button
                    onClick={() => handlePersonalityClick(brandIdentity.personality.feeling, 'feeling')}
                    className="px-2 py-1 bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 rounded text-neutral-400 text-[10px] transition-colors cursor-pointer"
                    title={`Click to insert {brand-feeling: ${brandIdentity.personality.feeling}}`}
                  >
                    Feeling: {brandIdentity.personality.feeling}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Visual Elements */}
          {brandIdentity.visualElements.length > 0 && (
            <div>
              <div className="text-neutral-500 font-mono mb-1.5">Visual Elements</div>
              <div className="flex flex-wrap gap-1.5">
                {brandIdentity.visualElements.slice(0, 8).map((element, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleElementClick(element)}
                    className="px-2 py-1 bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 rounded text-neutral-400 text-[10px] transition-colors cursor-pointer"
                    title={`Click to insert {brand-element: ${element}}`}
                  >
                    {element}
                  </button>
                ))}
                {brandIdentity.visualElements.length > 8 && (
                  <span className="text-neutral-500 text-[10px] px-2 py-1">+{brandIdentity.visualElements.length - 8} more</span>
                )}
              </div>
            </div>
          )}

          {/* Composition Style */}
          {brandIdentity.composition.style && (
            <div>
              <div className="text-neutral-500 font-mono mb-1.5">Composition</div>
              <div className="text-neutral-400 text-[10px]">
                {brandIdentity.composition.style}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
