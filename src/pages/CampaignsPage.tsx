import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Wand2,
  ImageOff,
  Loader2,
  Download,
  AlertCircle,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useLayout } from '@/hooks/useLayout';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Thumb } from '@/components/ui/Thumb';
import { StatusBadge, type ItemStatus } from '@/components/shared/StatusBadge';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useCampaigns, useCampaign } from '@/hooks/queries/useCampaigns';
import type { CampaignSummary } from '@/services/campaignApi';

/**
 * Campaigns cockpit — the user-facing surface for persisted, brand-scoped
 * campaigns. Composes existing design-system primitives (GlassPanel, MicroTitle,
 * EmptyState) and mirrors the ContentStudioPage visual language. No new
 * design-system components are introduced.
 */
export const CampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useLayout();
  const isLoggedIn = isAuthenticated === true;

  // A marca vem do SSoT global (o chip do AppSpine já renderiza nesta rota,
  // porque `/campaigns` é contexto de produção). Antes esta página tinha um
  // <select> PRÓPRIO, semeado uma única vez do `?brandId=`: trocar de marca no
  // chip do topo não mexia nele, e os dois controles divergiam em silêncio.
  const { activeBrand, isAllBrands, setActiveBrand, brands } = useActiveBrand();
  const brandId = isAllBrands ? '' : (activeBrand?.id ?? '');
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Link de entrada com `?brandId=` (ex.: o card "em andamento" do cockpit)
  // manda a marca ativa pro alvo, em vez de abrir divergente do chip.
  const urlBrandId = searchParams.get('brandId');
  useEffect(() => {
    if (!urlBrandId || urlBrandId === activeBrand?.id) return;
    if (!brands.some((g) => g.id === urlBrandId)) return;
    setActiveBrand(urlBrandId);
  }, [urlBrandId, activeBrand?.id, brands, setActiveBrand]);

  const { data: campaigns = [], isLoading, isError, refetch } = useCampaigns(brandId || undefined);

  if (selectedId) {
    return <CampaignDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <PageShell
      pageId="campaigns"
      title={t('campaigns.title')}
      description={t('campaigns.description')}
      width="7xl"
      actions={
        <div className="flex items-center gap-2">
          {/* Sem seletor de marca aqui: o chip do AppSpine é o único. */}
          {/* Create from brand */}
          <button
            onClick={() => navigate(brandId ? `/create?brandId=${brandId}` : '/create')}
            title={t('campaigns.creative')}
            className="shrink-0 flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs text-muted-foreground border border-border bg-card hover:border-border-hover hover:text-foreground transition-colors"
          >
            <Wand2 size={12} />
            <span className="hidden md:inline">{t('campaigns.creative')}</span>
          </button>

          {/* Generate campaign (lives in Canvas chat today) — primary CTA */}
          <button
            onClick={() => navigate('/canvas')}
            title={t('campaigns.newCampaign')}
            className="shrink-0 flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium bg-brand-cyan text-black hover:bg-brand-cyan/90 transition-colors"
          >
            <Plus size={12} />
            <span className="hidden md:inline">{t('campaigns.newCampaign')}</span>
          </button>
        </div>
      }
    >
      {!isLoggedIn ? (
        <EmptyState
          icon={Megaphone}
          title={t('campaigns.signedOutTitle')}
          description={t('campaigns.signedOutDesc')}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="aspect-[4/3] bg-muted animate-pulse" />
              <div className="p-3 space-y-2 border-t border-border">
                <div className="h-2.5 w-32 bg-muted rounded animate-pulse" />
                <div className="h-1.5 w-full bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title={t('campaigns.loadErrorTitle')}
          description={t('campaigns.loadErrorDesc')}
          onRetry={() => refetch()}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={brandId ? t('campaigns.emptyBrandTitle') : t('campaigns.emptyTitle')}
          description={t('campaigns.emptyDesc')}
          actionLabel={t('campaigns.emptyAction')}
          onAction={() => navigate('/canvas')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} onOpen={() => setSelectedId(c.id)} />
          ))}
        </div>
      )}
    </PageShell>
  );
};

// Status de campanha no vocabulário do StatusBadge compartilhado (SSoT de status).
const CAMPAIGN_STATUS: Record<CampaignSummary['status'], ItemStatus> = {
  planning: 'queued',
  generating: 'processing',
  done: 'done',
  error: 'error',
};
const toItemStatus = (s: CampaignSummary['status']): ItemStatus => CAMPAIGN_STATUS[s] ?? 'queued';

function CampaignCard({ c, onOpen }: { c: CampaignSummary; onOpen: () => void }) {
  const { t } = useTranslation();
  const pct = c.totalCount ? Math.round((c.completedCount / c.totalCount) * 100) : 0;
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-border-hover transition-colors"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <Thumb
          src={c.coverImageUrl || undefined}
          alt={c.name}
          loading="lazy"
          fallbackIcon={ImageOff}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-background/80 border border-border">
          <StatusBadge status={toItemStatus(c.status)} />
        </div>
      </div>
      <div className="p-3 space-y-2 border-t border-border">
        <p className="text-xs text-foreground truncate">{c.name}</p>
        <div className="flex items-center justify-between text-2xs text-muted-foreground">
          {c.totalCount ? (
            <span className="tabular-nums">
              {c.completedCount}/{c.totalCount} {t('campaigns.ads')}
            </span>
          ) : (
            <span />
          )}
          <span className="truncate ml-2 font-mono">{c.formats.join(', ')}</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full transition-colors',
              c.status === 'error' ? 'bg-destructive/70' : 'bg-muted-foreground'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { data: campaign, isLoading, isError, refetch } = useCampaign(id);
  const results = campaign?.results ?? [];

  return (
    <PageShell
      pageId="campaign-detail"
      title={campaign?.name || t('campaigns.detail.fallbackTitle')}
      width="7xl"
      actions={
        <div className="flex items-center gap-3">
          {campaign && campaign.totalCount ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {campaign.completedCount}/{campaign.totalCount}
            </span>
          ) : null}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('campaigns.detail.backAria')}
          >
            <ArrowLeft size={14} />
            {t('campaigns.detail.back')}
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <ErrorState
          title={t('campaigns.detail.loadErrorTitle')}
          description={t('campaigns.detail.loadErrorDesc')}
          onRetry={() => refetch()}
        />
      ) : results.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <GlassPanel padding="lg" className="max-w-md text-center">
            <MicroTitle as="h3" className="text-foreground mb-2">
              {t('campaigns.detail.noResults')}
            </MicroTitle>
            <p className="text-sm text-muted-foreground">
              {campaign?.status === 'error'
                ? campaign?.error || t('campaigns.detail.failed')
                : t('campaigns.detail.stillGenerating')}
            </p>
          </GlassPanel>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {results.map((r) => (
            <div key={r.index} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="relative aspect-square bg-muted flex items-center justify-center">
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-background/80 border border-border">
                  <span className="text-2xs text-foreground">{r.adAngle}</span>
                </div>
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-background/80 border border-border">
                  <span className="text-2xs font-mono text-muted-foreground">{r.format}</span>
                </div>
                {r.status === 'done' && r.imageUrl ? (
                  <Thumb
                    src={r.imageUrl}
                    alt={r.adAngle}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : r.status === 'error' ? (
                  <div className="flex flex-col items-center gap-2 px-4 text-center">
                    <AlertCircle size={20} className="text-destructive/60" />
                    <span className="text-2xs text-destructive">{r.error}</span>
                  </div>
                ) : (
                  <Loader2 size={22} className="animate-spin text-muted-foreground" />
                )}
              </div>
              {r.status === 'done' && r.imageUrl && (
                <div className="p-3 border-t border-border">
                  <a
                    href={r.imageUrl}
                    download={`campaign-${r.index}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 w-fit rounded text-2xs text-muted-foreground hover:text-foreground border border-border hover:border-border-hover transition-colors"
                  >
                    <Download size={10} />
                    {t('campaigns.detail.download')}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
