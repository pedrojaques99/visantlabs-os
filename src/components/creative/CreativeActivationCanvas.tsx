import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Pickaxe } from '@/lib/ui/icons';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useCreativeProjects } from '@/hooks/queries/useCreativeProjects';
import { useCreativeStore } from './store/creativeStore';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { glassSurface } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

// Pontos de partida quando a marca ainda não tem criativos — preenchem um
// scaffold de prompt e focam a ideia. Honesto (sem mockar criativo fake) e
// mata a página em branco (audit P0-1 / P0-3).
// Mesmas sementes do rail (CreativeSetupSidebar): label/prompt em creativeSetup.starters.*
const STARTERS = ['feed', 'story', 'banner', 'launch'] as const;

/**
 * Superfície de ativação do canvas em `status: 'setup'`.
 * Substitui a caixa tracejada vazia: mostra os criativos recentes da marca
 * ativa (prova antes do pedido) ou, se a marca é nova, pontos de partida que
 * preenchem a ideia. Ocupa o canvas inteiro e rola sozinha.
 */
export const CreativeActivationCanvas: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
            <h2 className="text-2xl font-semibold text-neutral-100">
              {t('creativeSetup.activation.recentTitle')}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {t('creativeSetup.activation.recentSubtitle')}
            </p>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-5">
              {recent.map((p) => {
                const thumb = failedThumbs.has(p._id) ? null : p.thumbnailUrl || p.backgroundUrl;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => navigate(`/create?project=${p._id}`)}
                    className={cn(
                      'group text-left rounded-2xl overflow-hidden hover:border-neutral-700 transition-colors',
                      glassSurface.tile
                    )}
                  >
                    <div className="relative aspect-square bg-neutral-900/50 overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={p.name || t('creative.projects.untitled')}
                          className="w-full h-full object-cover"
                          onError={() => setFailedThumbs((prev) => new Set(prev).add(p._id))}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Diamond size={32} className="text-neutral-800" strokeWidth={1} />
                        </div>
                      )}
                      {p.format && (
                        <span className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 border border-white/10 text-2xs font-mono tabular-nums text-neutral-200">
                          {p.format}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-neutral-200 line-clamp-1 group-hover:text-white transition-colors">
                        {p.name || t('creative.projects.untitled')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-neutral-100">
              {t('creativeSetup.activation.startersTitle')}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {t('creativeSetup.activation.startersSubtitle')}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-5">
              {STARTERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => seedIdea(t(`creativeSetup.starters.${key}.prompt`))}
                  className={cn(
                    'group text-left rounded-2xl p-5 min-h-[9rem] flex flex-col justify-between hover:border-neutral-700 transition-colors',
                    glassSurface.tile
                  )}
                >
                  <Pickaxe
                    size={18}
                    className="text-neutral-600 group-hover:text-neutral-300 transition-colors"
                  />
                  <div>
                    <p className="text-base font-semibold text-neutral-100">
                      {t(`creativeSetup.starters.${key}.label`)}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {t(`creativeSetup.starters.${key}.sub`)}
                    </p>
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
