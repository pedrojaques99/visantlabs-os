import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines, useBrandQuota } from '@/hooks/queries/useBrandGuidelines';
import { FEATURE_BRAND_BILLING } from '@/config/featureFlags';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { PublicBrandGuideline } from '@/pages/PublicBrandGuideline';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/input';
import { Thumb } from '@/components/ui/Thumb';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { computeBrandCompleteness } from '@/lib/brandCompleteness';
import {
  Layers,
  Plus,
  Search,
  Globe,
  Folder,
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  MoreVertical,
  ChevronDown,
  AlertTriangle,
  Pencil,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import type { BrandGuideline } from '@/lib/figma-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBrandArchiveActions, isArchived } from '@/components/brand/useBrandArchiveActions';
import { BrandQuickEditDialog } from '@/components/brand/guidelines/BrandQuickEditDialog';
import { DemoBrandBanner } from '@/components/onboarding/DemoBrandBanner';
import { glassSurface } from '@/lib/ui/glass';

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center text-center gap-6 px-6">
      <Layers size={26} strokeWidth={1.2} className="text-muted-foreground" />
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t('brandGuidelines.emptyState')}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('brandGuidelines.emptyStateDesc')}
        </p>
      </div>
      <Button onClick={onCreate} size="lg" className="h-11 px-6 gap-2 text-sm">
        <Plus size={15} />
        {t('brandGuidelines.createFirst')}
      </Button>
    </div>
  );
};

/**
 * Categorias que um humano escolheu para SER imagem de marca. Só elas podem
 * virar capa.
 *
 * `stock` / `product` / `other` / sem categoria são material de REFERÊNCIA
 * (a chuteira de um concorrente, o print de uma página do guideline). Promover
 * a primeira imagem qualquer a herói era o que fazia a grade virar ruído: a
 * capa é o único identificador da marca numa lista de 24, e estava sendo
 * decidida pela ordem de upload.
 *
 * Sem match, a capa mostra o próprio logo (BrandAvatar) sobre bg-muted: dado
 * real da marca, em vez de um degradê inventado.
 */
const COVER_CATEGORIES = ['background', 'graphic', 'texture'] as const;

const getCoverUrl = (g: BrandGuideline): string | null => {
  const media = Array.isArray(g.media) ? g.media : [];
  for (const category of COVER_CATEGORIES) {
    const hit = media.find((m) => m?.type === 'image' && m?.category === category && m?.url);
    if (hit) return hit.url;
  }
  return null;
};

const BrandCard = ({
  guideline,
  onSelect,
  archived = false,
  onArchive,
  onUnarchive,
  onQuickEdit,
}: {
  guideline: BrandGuideline;
  onSelect: (g: BrandGuideline) => void;
  archived?: boolean;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onQuickEdit?: (g: BrandGuideline) => void;
}) => {
  const { t } = useTranslation();
  const [coverLoaded, setCoverLoaded] = useState(false);
  // Capa que falha cai no logo, nunca num tile vazio ou num skeleton eterno.
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = getCoverUrl(guideline);
  const showCover = !!coverUrl && !coverFailed;
  const brandName = guideline.identity?.name || guideline.name || t('brandGuidelines.untitled');

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card hover:border-border-hover transition-[border-color,opacity,filter] duration-200 overflow-hidden text-left',
        archived && 'opacity-60 grayscale-[0.6] hover:opacity-80'
      )}
    >
      {/* Ação principal como "stretched link": cobre o card inteiro SEM aninhar
          interativos. O menu ⋮ é irmão, num z acima. */}
      <button
        type="button"
        onClick={() => onSelect(guideline)}
        aria-label={brandName}
        className="absolute inset-0 z-[1] rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Capa: imagem de marca real, ou o logo centrado sobre bg-muted */}
      <div className="relative w-full h-32 sm:h-40 shrink-0 overflow-hidden bg-muted border-b border-border">
        {showCover ? (
          <>
            {!coverLoaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
            <Thumb
              src={getProxiedUrl(coverUrl)}
              alt=""
              loading="lazy"
              onLoad={() => setCoverLoaded(true)}
              onError={() => setCoverFailed(true)}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-300',
                coverLoaded ? 'opacity-100' : 'opacity-0'
              )}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandAvatar brand={guideline} size={64} rounded="md" preference="primary" />
          </div>
        )}

        <div className="absolute top-2 right-2 z-[2] flex items-center gap-1.5">
          {guideline.isPublic && (
            <Badge
              variant="secondary"
              className="bg-background/80 border-border text-muted-foreground text-2xs px-1.5 py-0 h-5 gap-1"
            >
              <Globe size={9} />
              {t('brandGuidelines.public')}
            </Badge>
          )}
          {(onArchive || onUnarchive || onQuickEdit) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t('brandQuota.brandActions')}
                  className={cn(hoverReveal, 'h-6 w-6 bg-background/80')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[130px]">
                {!archived && onQuickEdit && (
                  <DropdownMenuItem
                    className="text-xs gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickEdit(guideline);
                    }}
                  >
                    <Pencil size={12} />
                    {t('brandQuota.quickEdit')}
                  </DropdownMenuItem>
                )}
                {archived
                  ? onUnarchive && (
                      <DropdownMenuItem
                        className="text-xs gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnarchive(guideline.id!);
                        }}
                      >
                        <ArchiveRestore size={12} />
                        {t('brandQuota.unarchive')}
                      </DropdownMenuItem>
                    )
                  : onArchive && (
                      <DropdownMenuItem
                        className="text-xs gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(guideline.id!);
                        }}
                      >
                        <Archive size={12} />
                        {t('brandQuota.archive')}
                      </DropdownMenuItem>
                    )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Info. Com capa real o logo vem inline; sem capa ele já está na capa. */}
      <div className="flex-1 px-3 sm:px-4 py-3 min-w-0 flex items-center gap-2.5">
        {showCover && <BrandAvatar brand={guideline} size={28} rounded="md" preference="primary" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{brandName}</p>
          {guideline.identity?.tagline && (
            <p className="text-2xs text-muted-foreground truncate mt-0.5 leading-tight">
              {guideline.identity.tagline}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

type SortMode = 'recent' | 'name' | 'completeness';

/**
 * "X de Y marcas ativas" — meter discreto do plano; Y = ∞ para agency/ilimitado.
 * CTA de upgrade só quando a quota está cheia (padrão paywall_hit do plano).
 */
const BrandQuotaMeter = ({
  used,
  max,
  onUpgrade,
}: {
  used: number;
  max: number | null;
  onUpgrade: () => void;
}) => {
  const { t } = useTranslation();
  const unlimited = max === null;
  const full = !unlimited && used >= max;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {!unlimited && (
        <div className="hidden sm:block w-16 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-colors',
              full ? 'bg-warning' : 'bg-muted-foreground'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <span className="text-2xs text-muted-foreground tabular-nums whitespace-nowrap">
        {unlimited
          ? t('brandQuota.meterUnlimited', { used })
          : t('brandQuota.meter', { used, max })}
      </span>
      {full && (
        <Button variant="subtle" size="sm" className="h-6 px-2 text-2xs" onClick={onUpgrade}>
          {t('brandQuota.upgrade')}
        </Button>
      )}
    </div>
  );
};

/**
 * Banner de tolerância de downgrade (RCD §3.5 — moldura de perda). Enquanto a
 * janela de 7 dias corre, as marcas em excesso seguem ATIVAS; passou o prazo, o
 * cron arquiva as mais antigas. Mostrar isso (com a perda enquadrada nas marcas
 * do próprio usuário) converte melhor que arquivar em silêncio.
 */
const BrandGraceBanner = ({
  graceUntil,
  atRisk,
  onUpgrade,
}: {
  graceUntil: string;
  /** Marcas que o cron vai arquivar, na ordem dele. Mesma lista do e-mail. */
  atRisk?: { id: string; name: string }[];
  onUpgrade: () => void;
}) => {
  const { t } = useTranslation();
  const until = new Date(graceUntil);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) return null;
  const days = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 86_400_000));

  return (
    <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <AlertTriangle size={16} className="text-warning shrink-0" />
        <p className="text-sm text-foreground flex-1">
          {t('brandQuota.graceMessage', { days, plural: days > 1 ? 's' : '' })}
        </p>
        <Button
          variant="subtle"
          size="sm"
          className="h-7 px-3 text-xs shrink-0 self-start sm:self-auto"
          onClick={onUpgrade}
        >
          {t('brandQuota.graceCta')}
        </Button>
      </div>
      {/* O e-mail de downgrade nomeia as marcas em risco; a tela precisa nomear
          as MESMAS, senão o usuário chega pelo CTA "escolher quais manter" e vê
          todas iguais, sem saber no que agir. */}
      {atRisk && atRisk.length > 0 && (
        <p className="mt-2 pl-0 sm:pl-7 text-xs text-muted-foreground">
          {t('brandQuota.graceAtRisk')}{' '}
          <span className="text-foreground">{atRisk.map((b) => b.name).join(', ')}</span>
        </p>
      )}
    </div>
  );
};

const BrandGrid = ({
  guidelines,
  onSelect,
  onArchive,
  onUnarchive,
}: {
  guidelines: BrandGuideline[];
  onSelect: (g: BrandGuideline) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');
  const [showArchived, setShowArchived] = useState(false);
  const [quickEdit, setQuickEdit] = useState<BrandGuideline | null>(null);

  const folders = useMemo(() => {
    const s = new Set<string>();
    guidelines.forEach((g) => {
      if (g.folder) s.add(g.folder);
    });
    return Array.from(s).sort();
  }, [guidelines]);

  const filtered = useMemo(() => {
    let list = guidelines;
    if (folderFilter) list = list.filter((g) => g.folder === folderFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((g) => {
        const name = (g.identity?.name || g.name || '').toLowerCase();
        const folder = (g.folder || '').toLowerCase();
        const tagline = (g.identity?.tagline || '').toLowerCase();
        return name.includes(term) || folder.includes(term) || tagline.includes(term);
      });
    }
    if (sort === 'name') {
      list = [...list].sort((a, b) =>
        (a.identity?.name || a.name || '').localeCompare(b.identity?.name || b.name || '')
      );
    } else if (sort === 'completeness') {
      list = [...list].sort(
        (a, b) => computeBrandCompleteness(b).score - computeBrandCompleteness(a).score
      );
    } else {
      // 'recent' is the default the UI advertises — sort explicitly rather than
      // trusting the API's array order, so the "Recent" label never lies.
      list = [...list].sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    }
    return list;
  }, [guidelines, search, folderFilter, sort]);

  // Marcas arquivadas saem do grid principal e viram seção colapsável no fim
  // (billing por marca ativa). Sem a flag, tudo cai em `activeList` como antes.
  const billingOn = FEATURE_BRAND_BILLING && (onArchive || onUnarchive);
  const activeList = billingOn ? filtered.filter((g) => !isArchived(g)) : filtered;
  const archivedList = billingOn ? filtered.filter(isArchived) : [];

  return (
    <div className="w-full space-y-4">
      {/* Toolbar: search + folder pills + sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-56">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('brandGuidelines.searchPlaceholder')}
            className={cn('h-8 pl-8 text-xs', glassSurface.control)}
          />
        </div>

        {folders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFolderFilter(null)}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-md text-2xs border transition-colors',
                !folderFilter
                  ? 'bg-accent border-border text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t('brandGuidelines.allFolders')}
            </button>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => setFolderFilter(folderFilter === f ? null : f)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-md text-2xs border transition-colors flex items-center gap-1',
                  folderFilter === f
                    ? 'bg-accent border-border text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Folder size={10} />
                {f}
              </button>
            ))}
          </div>
        )}

        <div className="sm:ml-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-colors">
                <ArrowUpDown size={11} />
                {sort === 'recent'
                  ? t('brandGuidelines.sortRecent')
                  : sort === 'name'
                    ? t('brandGuidelines.sortName')
                    : t('brandGuidelines.sortCompleteness')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[130px]">
              <DropdownMenuCheckboxItem
                className="text-xs"
                checked={sort === 'recent'}
                onCheckedChange={() => setSort('recent')}
              >
                {t('brandGuidelines.sortRecent')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="text-xs"
                checked={sort === 'name'}
                onCheckedChange={() => setSort('name')}
              >
                {t('brandGuidelines.sortName')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="text-xs"
                checked={sort === 'completeness'}
                onCheckedChange={() => setSort('completeness')}
              >
                {t('brandGuidelines.sortCompleteness')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contagem só com filtro ativo: sem filtro ela repete o medidor de quota. */}
      {(folderFilter || search.trim()) && (
        <p className="text-2xs text-muted-foreground">
          {t('brandGuidelines.countBrands', {
            filtered: filtered.length,
            total: guidelines.length,
          })}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {activeList.map((g) => (
          <BrandCard
            key={g.id}
            guideline={g}
            onSelect={onSelect}
            onArchive={billingOn ? onArchive : undefined}
            onQuickEdit={setQuickEdit}
          />
        ))}
      </div>

      {/* Archived section — atenuada, colapsável, no fim da lista */}
      {archivedList.length > 0 && (
        <div className="space-y-3 pt-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-2xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              size={12}
              className={cn('transition-transform', !showArchived && '-rotate-90')}
            />
            <Archive size={11} />
            {t('brandQuota.archivedSection', { count: archivedList.length })}
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {archivedList.map((g) => (
                <BrandCard
                  key={g.id}
                  guideline={g}
                  onSelect={onSelect}
                  archived
                  onUnarchive={billingOn ? onUnarchive : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 && search.trim() && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Search size={20} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {t('brandGuidelines.noMatch', { term: search })}
          </p>
        </div>
      )}

      {quickEdit && (
        <BrandQuickEditDialog
          guideline={quickEdit}
          open={!!quickEdit}
          onOpenChange={(o) => !o && setQuickEdit(null)}
        />
      )}
    </div>
  );
};

export const BrandGuidelinesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, onSubscriptionModalOpen } = useLayout();

  const urlGuidelineId = searchParams.get('id');
  const [selectedId, setSelectedId] = useState<string | null>(urlGuidelineId);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Server state via react-query — dashboard only needs the list.
  const {
    data: guidelines = [],
    isLoading,
    isError,
    refetch,
  } = useBrandGuidelines(isAuthenticated === true);

  // Billing por marca ativa (flag FEATURE_BRAND_BILLING)
  const { data: brandQuota } = useBrandQuota(FEATURE_BRAND_BILLING && isAuthenticated === true);
  const archiveActions = useBrandArchiveActions();

  const handleQuotaUpgrade = useCallback(() => {
    if (!brandQuota) return;
    onSubscriptionModalOpen({
      reason: 'brand_limit',
      message: t('brandQuota.limitMessage', {
        used: brandQuota.used,
        max: brandQuota.max ?? '∞',
      }),
    });
  }, [brandQuota, onSubscriptionModalOpen, t]);

  // Auth guard
  React.useEffect(() => {
    if (isAuthenticated === false) setShowAuthModal(true);
  }, [isAuthenticated]);

  // O card abre o COCKPIT da marca, não a guideline. O acervo responde "quais
  // marcas eu tenho"; a partir dali o destino é trabalhar naquela marca. Ver a
  // guideline é um passo adiante, e o cockpit tem o botão pra isso.
  //
  // O deep link `?id=` continua de pé: outras telas mandam pra
  // `/brand-guidelines?id=X` e essa entrada segue abrindo a view inline.
  const handleSelect = useCallback(
    (g: BrandGuideline) => {
      navigate(`/cockpit/${g.id}`);
    },
    [navigate]
  );

  // Marca recém-criada abre no mesmo destino do card (cockpit), não na view
  // inline do deep link `?id=`.
  const handleWizardSuccess = useCallback(
    (id: string) => {
      setIsWizardOpen(false);
      setEditingGuideline(null);
      navigate(`/cockpit/${id}`);
    },
    [navigate]
  );

  const handleOpenWizard = useCallback((guideline?: BrandGuideline | null) => {
    setEditingGuideline(guideline || null);
    setIsWizardOpen(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setIsWizardOpen(false);
    setEditingGuideline(null);
  }, []);

  // Unified view — selecting a brand opens the single per-brand view (same component
  // as the public page, with owner advanced edit). Replaces the old duplicated admin
  // editor shell. Wizard still mounts here for creation; the unified view handles edit.
  if (selectedId && !isWizardOpen) {
    return (
      <PublicBrandGuideline
        idOverride={selectedId}
        onBack={() => {
          setSelectedId(null);
          setSearchParams({});
        }}
      />
    );
  }

  return (
    <div
      className="brand-guidelines-root relative h-full"
      data-vsn-page="brand-guidelines"
      data-vsn-component="brand-explorer"
      data-vsn-selected-id={selectedId}
    >
      <SEO
        title={t('brandGuidelines.seoTitle')}
        description={t('brandGuidelines.seoDescription')}
      />
      <div className="absolute inset-0 z-0 bg-background" />

      <div className="h-full bg-transparent relative z-10 flex overflow-hidden">
        <main
          role="main"
          aria-label={t('brand.guidelines.brand_guideline_content')}
          className="flex-1 w-full min-w-0 overflow-y-auto"
          data-vsn-region="content"
        >
          {/* Só tem a marca demo: convite persistente pra trazer a real (abre o wizard). */}
          <DemoBrandBanner onCta={() => handleOpenWizard()} />

          <div className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <h1 className="min-w-0 text-base font-semibold text-foreground truncate">
                {t('brandGuidelines.title')}
              </h1>
              <div className="flex items-center gap-3 shrink-0">
                {FEATURE_BRAND_BILLING && brandQuota && (
                  <BrandQuotaMeter
                    used={brandQuota.used}
                    max={brandQuota.max}
                    onUpgrade={handleQuotaUpgrade}
                  />
                )}
                {/* A ação principal mora NA superfície, não só no empty state:
                    com 1+ marca, criar outra ficaria inalcançável pelo header. */}
                {guidelines.length > 0 && (
                  <Button size="sm" onClick={() => handleOpenWizard()} className="gap-1.5">
                    <Plus size={15} />
                    {t('brandGuidelines.newBrand')}
                  </Button>
                )}
              </div>
            </div>

            {FEATURE_BRAND_BILLING && brandQuota?.graceUntil && (
              <BrandGraceBanner
                graceUntil={brandQuota.graceUntil}
                atRisk={brandQuota.atRisk}
                onUpgrade={handleQuotaUpgrade}
              />
            )}

            {/* Lista. A view por marca (PublicBrandGuideline) vem pelo early return acima. */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-6">
                <GlitchLoader size={40} />
                <p className="text-muted-foreground text-xs animate-pulse">{t('common.loading')}</p>
              </div>
            ) : isError ? (
              <ErrorState
                className="py-40"
                title={t('brandGuidelines.loadFailedTitle')}
                description={t('brandGuidelines.loadFailedBody')}
                onRetry={() => refetch()}
              />
            ) : guidelines.length === 0 ? (
              <EmptyState onCreate={() => handleOpenWizard()} />
            ) : (
              <BrandGrid
                guidelines={guidelines}
                onSelect={handleSelect}
                onArchive={FEATURE_BRAND_BILLING ? archiveActions.requestArchive : undefined}
                onUnarchive={FEATURE_BRAND_BILLING ? archiveActions.unarchive : undefined}
              />
            )}
          </div>
        </main>
      </div>

      {FEATURE_BRAND_BILLING && <ConfirmationModal {...archiveActions.confirmModalProps} />}

      <BrandGuidelineWizardModal
        isOpen={isWizardOpen}
        onClose={handleCloseWizard}
        onSuccess={handleWizardSuccess}
        editGuideline={editingGuideline}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          navigate('/');
        }}
        onSuccess={() => {
          setShowAuthModal(false);
        }}
        isSignUp={false}
      />
    </div>
  );
};
