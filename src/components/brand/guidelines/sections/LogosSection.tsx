import React from 'react';
import { SectionBlock } from '../SectionBlock';
import { Image as ImageIcon } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface LogosSectionProps {
  guideline: BrandGuideline;
  logos: BrandGuideline['logos'];
  span?: string;
}

export const LogosSection: React.FC<LogosSectionProps> = ({ guideline, logos, span }) => {
  return (
    <SectionBlock
      id="logos"
      icon={<ImageIcon size={14} />}
      title="Assets"
      span={span as any}
    >
      <div className="flex flex-col items-center justify-center min-h-[160px] py-6 px-4">
        {logos && logos.length > 0 ? (
          <div className="relative group/logo flex flex-col items-center gap-6 w-full">
            <div className="relative w-full aspect-video flex items-center justify-center rounded-3xl bg-neutral-950/20 border border-white/[0.02] group-hover/logo:bg-neutral-950/40 transition-all duration-700 overflow-hidden">
              <div className="absolute inset-0 bg-brand-cyan/2 blur-3xl opacity-0 group-hover/logo:opacity-100 transition-opacity" />
              <img
                src={logos[0].url}
                alt="Primary Logo"
                className="max-h-[85px] w-[80%] object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)] group-hover/logo:scale-105 transition-transform duration-700"
              />
            </div>
            {logos.length > 1 && (
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-8 bg-white/5" />
                <span className="text-[10px] font-bold font-mono text-neutral-600 uppercase tracking-[0.2em] opacity-40">
                  +{logos.length - 1} Library Assets
                </span>
                <div className="h-[1px] w-8 bg-white/5" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 opacity-5 py-12">
            <ImageIcon size={48} strokeWidth={1} />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] font-bold">No Assets</span>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
