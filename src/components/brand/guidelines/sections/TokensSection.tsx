import React, { useState, useEffect } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Layers, Plus } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface TokensSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const TokensSection: React.FC<TokensSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tokensJson, setTokensJson] = useState('');

  useEffect(() => {
    setTokensJson(JSON.stringify(guideline.tokens || {}, null, 2));
  }, [guideline.id]);

  const handleSave = () => {
    try {
      const tokens = JSON.parse(tokensJson);
      onUpdate({ tokens });
      setIsEditing(false);
    } catch { }
  };

  const renderTokenGrid = (label: string, entries: Record<string, number>) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[8px] font-mono text-neutral-700 uppercase tracking-widest font-bold opacity-50">{label}</span>
        <div className="h-[1px] flex-1 bg-white/[0.02]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(entries).slice(0, 9).map(([k, v]) => (
          <div key={k} className="bg-white/[0.02] group/token px-2 py-2.5 rounded-xl border border-white/[0.05] text-center hover:border-brand-cyan/20 hover:bg-brand-cyan/[0.02] transition-all duration-300">
            <span className="text-[8px] font-mono text-neutral-700 block uppercase tracking-tight mb-1 opacity-50 group-hover/token:text-brand-cyan/60">{k}</span>
            <span className="text-[11px] font-mono text-neutral-400 font-bold group-hover/token:text-white transition-colors">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <SectionBlock
      id="tokens"
      icon={<Layers size={14} />}
      title="Design Tokens"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setTokensJson(JSON.stringify(guideline.tokens || {}, null, 2)); setIsEditing(false); }}
      span={span as any}
      expandedContent={(guideline.tokens?.spacing || guideline.tokens?.radius) ? (
        <div className="space-y-8">
          {guideline.tokens?.spacing && (
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-brand-cyan/60 uppercase tracking-widest font-bold">Spacing</span>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {Object.entries(guideline.tokens.spacing).map(([k, v]) => (
                  <div key={k} className="bg-white/[0.02] group/token p-3 rounded-xl border border-white/[0.05] text-center hover:border-brand-cyan/20 hover:bg-brand-cyan/[0.02] transition-all">
                    <span className="text-[9px] font-mono text-neutral-600 block uppercase tracking-tight mb-1">{k}</span>
                    <span className="text-[12px] font-mono text-white font-bold">{v as any}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {guideline.tokens?.radius && (
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-brand-cyan/60 uppercase tracking-widest font-bold">Radius</span>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {Object.entries(guideline.tokens.radius).map(([k, v]) => (
                  <div key={k} className="bg-white/[0.02] group/token p-3 rounded-xl border border-white/[0.05] text-center hover:border-brand-cyan/20 hover:bg-brand-cyan/[0.02] transition-all">
                    <span className="text-[9px] font-mono text-neutral-600 block uppercase tracking-tight mb-1">{k}</span>
                    <span className="text-[12px] font-mono text-white font-bold">{v as any}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : undefined}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
          }}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="space-y-6 py-2">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest pl-1">Design Tokens (JSON)</MicroTitle>
              <Textarea
                value={tokensJson}
                onChange={(e) => setTokensJson(e.target.value)}
                className="text-[10px] font-mono bg-neutral-900/50 border-white/5 min-h-[180px] focus:border-brand-cyan/20 transition-all p-4"
                placeholder='{"spacing": {"s": "4px"}, "radius": {"m": "8px"}}'
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {guideline.tokens?.spacing && renderTokenGrid('Spacing', guideline.tokens.spacing)}
            {guideline.tokens?.radius && renderTokenGrid('Radius', guideline.tokens.radius)}
            {(!guideline.tokens?.spacing && !guideline.tokens?.radius) && (
              <div className="py-12 text-center opacity-10 italic text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 rounded-2xl">No Design Tokens</div>
            )}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
