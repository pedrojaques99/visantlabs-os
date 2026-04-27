import React, { useState, useEffect, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Layers } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface TokensSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const TokensSection: React.FC<TokensSectionProps> = ({ guideline, onUpdate, span }) => {
  // json is UI-only state (controlled textarea buffer for partial JSON input)
  const [json, setJson] = useState(JSON.stringify(guideline.tokens || {}, null, 2));
  const [isValid, setIsValid] = useState(true);

  // Reset json buffer when guideline changes (different brand)
  useEffect(() => { setJson(JSON.stringify(guideline.tokens || {}, null, 2)); }, [guideline.id]);

  const persist = useCallback((value: string) => {
    try {
      const tokens = JSON.parse(value);
      setIsValid(true);
      onUpdate({ tokens });
    } catch {
      setIsValid(false);
    }
  }, [onUpdate]);

  const tokens = guideline.tokens || {};

  return (
    <SectionBlock id="tokens" icon={<Layers size={14} />} title="Design Tokens" span={span as any}>
      <div className="space-y-3 py-1">
        {/* View: flat token rows */}
        {(tokens.spacing || tokens.radius) && (
          <div className="space-y-2">
            {tokens.spacing && (
              <div className="space-y-1">
                <MicroTitle className="text-neutral-600">Spacing</MicroTitle>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {Object.entries(tokens.spacing).map(([k, v]) => (
                    <span key={k} className="text-[10px] font-mono text-neutral-500"><span className="text-neutral-600">{k}:</span> {String(v)}</span>
                  ))}
                </div>
              </div>
            )}
            {tokens.radius && (
              <div className="space-y-1">
                <MicroTitle className="text-neutral-600">Radius</MicroTitle>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {Object.entries(tokens.radius).map(([k, v]) => (
                    <span key={k} className="text-[10px] font-mono text-neutral-500"><span className="text-neutral-600">{k}:</span> {String(v)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <Textarea
          value={json}
          onChange={(e) => { setJson(e.target.value); persist(e.target.value); }}
          className={`border-white/5 text-[10px] font-mono min-h-[120px] resize-none placeholder:text-neutral-700 ${!isValid ? 'border-red-500/30' : ''}`}
          placeholder={'{"spacing": {"s": "4px"}, "radius": {"m": "10px"}}'}
        />
        {!isValid && <p className="text-[10px] text-red-400 font-mono">Invalid JSON</p>}
      </div>
    </SectionBlock>
  );
};
