import React from 'react';
import { SectionBlock } from '../SectionBlock';
import { Image as ImageIcon } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface LogosSectionProps {
  guideline: BrandGuideline;
  logos: BrandGuideline['logos'];
}

export const LogosSection: React.FC<LogosSectionProps> = ({ guideline, logos }) => {
  return (
    <SectionBlock
      id="logos"
      icon={<ImageIcon size={14} />}
      title="Assets"
    >
      <div className="flex flex-col items-center justify-center min-h-[140px] pt-4 pb-2">
        {logos && logos.length > 0 ? (
          <div className="relative group/logo flex flex-col items-center gap-4">
            <div className="relative p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] group-hover/logo:bg-white/[0.03] transition-all duration-500">
              <img
                src={logos[0].url}
                alt="Primary Logo"
                className="max-h-[70px] w-auto object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)] group-hover/logo:scale-105 transition-transform duration-500"
              />
            </div>
            {logos.length > 1 && (
              <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest opacity-40">
                +{logos.length - 1} library assets
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-10">
            <ImageIcon size={32} strokeWidth={1} />
            <span className="text-[9px] font-mono uppercase tracking-[0.3em]">Empty gallery</span>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
