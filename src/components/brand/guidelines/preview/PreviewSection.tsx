import React, { useMemo, useState } from 'react';
import { SectionBlock } from '../SectionBlock';
import { LayoutTemplate, Instagram, Linkedin, FileImage, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { buildMockTokens } from './mockTokens';
import {
  InstagramFeedMock,
  LinkedInPostMock,
  PosterMock,
  StoriesMock,
} from './BrandMocks';

interface PreviewSectionProps {
  guideline: BrandGuideline;
  span?: string;
}

type FormatId = 'instagram' | 'linkedin' | 'poster' | 'stories';

const FORMATS: Array<{ id: FormatId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'linkedin',  label: 'LinkedIn',  icon: Linkedin },
  { id: 'poster',    label: 'Poster',    icon: FileImage },
  { id: 'stories',   label: 'Stories',   icon: Smartphone },
];

export const PreviewSection: React.FC<PreviewSectionProps> = ({ guideline, span }) => {
  const [active, setActive] = useState<FormatId>('instagram');
  const tokens = useMemo(() => buildMockTokens(guideline), [guideline]);

  const hasMinimum =
    (tokens.palette.length > 0) || !!tokens.primaryLogo || !!guideline.identity?.name;

  return (
    <SectionBlock
      id="preview"
      span={span as any}
      icon={<LayoutTemplate size={14} />}
      title="Brand Preview"
    >
      {!hasMinimum ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
          <p className="text-xs text-neutral-500 max-w-[320px] leading-relaxed">
            Adicione cores, tipografia e um logo pra visualizar como sua marca aparece em
            criativos reais. Sem chamada de IA — render local com seus tokens.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1 border-b border-white/[0.05] pb-2">
            {FORMATS.map(f => {
              const Icon = f.icon;
              const isActive = active === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActive(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest transition-all',
                    isActive
                      ? 'bg-white/[0.06] text-neutral-200'
                      : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]'
                  )}
                >
                  <Icon size={11} />
                  {f.label}
                </button>
              );
            })}
            <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-neutral-700">
              Live · sem IA
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-3 md:p-6 rounded-xl bg-neutral-950/40 border border-white/[0.04]">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-700">
                {dimsLabel(active)}
              </span>
              {active === 'instagram' && <InstagramFeedMock tokens={tokens} />}
              {active === 'linkedin' && <LinkedInPostMock tokens={tokens} />}
              {active === 'poster' && <PosterMock tokens={tokens} />}
              {active === 'stories' && <StoriesMock tokens={tokens} />}
            </div>

            <div className="flex flex-col gap-3 text-[11px] text-neutral-500">
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-700">
                  Tokens em uso
                </span>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm border border-white/10"
                      style={{ background: tokens.primaryColor }}
                    />
                    <span className="font-mono text-[10px] text-neutral-400">
                      primary · {tokens.primaryColor}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm border border-white/10"
                      style={{ background: tokens.theme.accent }}
                    />
                    <span className="font-mono text-[10px] text-neutral-400">
                      accent · {tokens.theme.accent}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm border border-white/10"
                      style={{ background: tokens.theme.bg }}
                    />
                    <span className="font-mono text-[10px] text-neutral-400">
                      bg · {tokens.theme.bg}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-white/[0.04] pt-3">
                <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-700">
                  Tipografia
                </span>
                <p className="mt-1 font-mono text-[10px] text-neutral-400 truncate" title={tokens.headingFamily}>
                  H · {firstFamily(tokens.headingFamily)}
                </p>
                <p className="font-mono text-[10px] text-neutral-400 truncate" title={tokens.bodyFamily}>
                  B · {firstFamily(tokens.bodyFamily)}
                </p>
              </div>

              <p className="text-[10px] text-neutral-600 leading-relaxed border-t border-white/[0.04] pt-3">
                Edite tokens em <span className="text-neutral-400">Identidade Visual</span> e veja a
                atualização ao vivo. Esse render é o mesmo contexto enviado a LLMs ao gerar
                criativos com esta marca.
              </p>
            </div>
          </div>
        </div>
      )}
    </SectionBlock>
  );
};

function dimsLabel(id: FormatId): string {
  switch (id) {
    case 'instagram': return 'Instagram feed · 1080 × 1080';
    case 'linkedin':  return 'LinkedIn post · 1200 × 627';
    case 'poster':    return 'Poster · 1080 × 1440';
    case 'stories':   return 'Stories · 1080 × 1920';
  }
}

function firstFamily(stack: string): string {
  const m = stack.match(/^['"]?([^'",]+)/);
  return m?.[1]?.trim() || stack;
}
