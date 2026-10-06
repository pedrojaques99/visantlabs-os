import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Pickaxe } from '@/lib/ui/icons';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useCreativeProjects } from '@/hooks/queries/useCreativeProjects';
import { useCreativeStore } from './store/creativeStore';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { MediaTile } from '@/components/ui/MediaTile';
import { Badge } from '@/components/ui/badge';
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
                <SkeletonLoader key={i} height="15rem" className="w-full rounded-xl" />
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
              {recent.map((p) => (
                <MediaTile
                  key={p._id}
                  src={p.thumbnailUrl || p.backgroundUrl || undefined}
                  alt={p.name || t('creative.projects.untitled')}
                  title={p.name || t('creative.projects.untitled')}
                  aspectRatio={1}
                  fallbackIcon={Diamond}
                  badge={
                    p.format ? (
                      <Badge variant="neutral" className="font-mono tabular-nums">
                        {p.format}
                      </Badge>
                    ) : undefined
                  }
                  onClick={() => navigate(`/create?project=${p._id}`)}
                />
              ))}
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
                    'group text-left rounded-xl p-5 min-h-[9rem] flex flex-col justify-between hover:border-neutral-700 transition-colors',
                    glassSurface.tile
                  )}
                >
                  <Pickaxe
                    size={18}
                    className="text-neutral-600 group-hover:text-neutral-300 transition-colors"
                  />
                  <div>
                    <p className="text-base font-medium text-neutral-100">
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
