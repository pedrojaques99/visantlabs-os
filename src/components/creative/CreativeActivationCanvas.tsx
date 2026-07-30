import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Pickaxe, ArrowRight } from '@/lib/ui/icons';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useCreativeProjects } from '@/hooks/queries/useCreativeProjects';
import { useCreativeStore } from './store/creativeStore';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { glassSurface } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';

// Pontos de partida quando a marca ainda não tem criativos — preenchem um
// scaffold de prompt e focam a ideia. Honesto (sem mockar criativo fake) e
// mata a página em branco (audit P0-1 / P0-3).
const STARTERS: { label: string; sub: string; prompt: string }[] = [
  {
    label: 'Post de feed',
    sub: 'Quadrado, para o feed',
    prompt: 'Post de feed para redes sociais anunciando ',
  },
  {
    label: 'Story de anúncio',
    sub: 'Vertical, tela cheia',
    prompt: 'Story vertical de anúncio destacando ',
  },
  {
    label: 'Banner promo',
    sub: 'Desconto ou oferta',
    prompt: 'Banner promocional com desconto para ',
  },
  {
    label: 'Lançamento',
    sub: 'Apresente algo novo',
    prompt: 'Peça de lançamento apresentando ',
  },
];

/**
 * Superfície de ativação do canvas em `status: 'setup'`.
 * Substitui a caixa tracejada vazia: mostra os criativos recentes da marca
 * ativa (prova antes do pedido) ou, se a marca é nova, pontos de partida que
 * preenchem a ideia. Ocupa o canvas inteiro e rola sozinha.
 */
export const CreativeActivationCanvas: React.FC = () => {
  const navigate = useNavigate();
  // A thumbnail that 404s should fall back to the same placeholder as a
  // thumb-less project — hiding the <img> instead left a blank tile that read
  // as "no image" rather than "broken image" (error ≠ empty).
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const { activeBrandId } = useActiveBrand();
  const setPrompt = useCreativeStore((s) => s.setPrompt);
  const { data: projects = [], isLoading } = useCreativeProjects(
    activeBrandId ?? undefined,
    !!activeBrandId
  );

  const recent = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime()
        )
        .slice(0, 6),
    [projects]
  );

  const seedIdea = (prompt: string) => {
    setPrompt(prompt);
    // O textarea da ideia vive no rail (outro componente) — foca via id.
    requestAnimationFrame(() => {
      const el = document.getElementById('creative-idea') as HTMLTextAreaElement | null;
      el?.focus();
      el?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  return (
    <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-5xl px-6 md:px-12 py-12">
        {isLoading ? (
          <>
            <SkeletonLoader height="1.75rem" className="w-64 mb-2 rounded" />
            <SkeletonLoader height="1rem" className="w-80 mb-8 rounded" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <SkeletonLoader key={i} height="15rem" className="w-full rounded-2xl" />
              ))}
            </div>
          </>
        ) : recent.length > 0 ? (
          <>
            <h2 className="text-2xl font-semibold text-neutral-100">Continue de onde parou</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Seus criativos recentes — toque para abrir e editar.
            </p>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-5">
              {recent.map((p) => {
                const thumb =
                  failedThumbs.has(p._id) ? null : p.thumbnailUrl || p.backgroundUrl;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => navigate(`/create?project=${p._id}`)}
                    className={cn(
                      'group text-left rounded-2xl overflow-hidden hover:border-neutral-700 transition-all',
                      glassSurface.tile
                    )}
                  >
                    <div className="relative aspect-square bg-neutral-900/50 overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={p.name || 'Criativo'}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          onError={() =>
                            setFailedThumbs((prev) => new Set(prev).add(p._id))
                          }
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Diamond size={32} className="text-neutral-800" strokeWidth={1} />
                        </div>
                      )}
                      {p.format && (
                        <span className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono uppercase tracking-wider text-brand-cyan/90">
                          {p.format}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-neutral-200 line-clamp-1 group-hover:text-brand-cyan transition-colors">
                        {p.name || 'Criativo sem título'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-neutral-100">Comece com um exemplo</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Escolha um ponto de partida — a gente preenche a ideia pra você.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-5">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => seedIdea(s.prompt)}
                  className={cn(
                    'group text-left rounded-2xl p-5 min-h-[9rem] flex flex-col justify-between hover:border-neutral-700 transition-colors',
                    glassSurface.tile
                  )}
                >
                  <Pickaxe
                    size={18}
                    className="text-neutral-600 group-hover:text-brand-cyan transition-colors"
                  />
                  <div>
                    <p className="text-base font-semibold text-neutral-100 flex items-center gap-1.5">
                      {s.label}
                      <ArrowRight
                        size={14}
                        className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 text-brand-cyan transition-all"
                      />
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">{s.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
