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
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { GuidelinesSidebar } from '@/components/brand/guidelines/GuidelinesSidebar';
import { PublicBrandGuideline } from '@/pages/PublicBrandGuideline';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { Input } from '@/components/ui/input';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { computeBrandCompleteness, completenessStatus } from '@/lib/brandCompleteness';
import {
  Layers,
  AlignLeft,
  Plus,
  Search,
  Globe,
  Folder,
  ArrowUpDown,
  FileText,
  Figma,
  Archive,
  ArchiveRestore,
  MoreVertical,
  ChevronDown,
  AlertTriangle,
  Pencil,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[70vh] flex flex-col items-center justify-center text-center gap-6 px-6"
    >
      <div className="p-4 rounded-2xl bg-muted/40 border border-border">
        <Layers size={26} strokeWidth={1.2} className="text-muted-foreground" />
      </div>
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
      {/* Tell first-timers what a guideline can be built from — kills the "now what?" gap. */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileText size={13} strokeWidth={1.5} /> PDF
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Globe size={13} strokeWidth={1.5} /> Website
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Figma size={13} strokeWidth={1.5} /> Figma
        </span>
      </div>
    </motion.div>
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
 * O logo também fica de fora — ele já aparece como o chip logo abaixo.
 * Sem match → CoverFallback pinta as cores da própria marca, que sempre lê
 * como aquela marca.
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

const CoverFallback = ({ colors }: { colors?: BrandGuideline['colors'] }) => {
  const c1 = colors?.[0]?.hex || '#262626';
  const c2 = colors?.[1]?.hex || '#171717';
  const c3 = colors?.[2]?.hex || c1;
  return (
    <div
      className="absolute inset-0"
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)` }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='1'%3E%3Cpath d='M0 0h20v20H0zM20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
};

const SCORE_COLORS = {
  low: 'bg-destructive',
  medium: 'bg-warning',
  high: 'bg-success',
} as const;

const BrandCard = ({
  guideline,
  onSelect,
  index,
  archived = false,
  onArchive,
  onUnarchive,
  onQuickEdit,
}: {
  guideline: BrandGuideline;
  onSelect: (g: BrandGuideline) => void;
  index: number;
  archived?: boolean;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onQuickEdit?: (g: BrandGuideline) => void;
}) => {
  const { t } = useTranslation();
  const [coverLoaded, setCoverLoaded] = useState(false);
  // Sem `onError` a capa quebrada era um skeleton pulsando pra sempre: o
  // `onLoad` nunca dispara, a <img> fica em opacity-0 e o CoverFallback nunca
  // entra (ele só cobria coverUrl == null, não URL inválida).
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = getCoverUrl(guideline);
  const showCover = !!coverUrl && !coverFailed;
  const report = useMemo(() => computeBrandCompleteness(guideline), [guideline]);
  const status = completenessStatus(report.score);
  const brandName = guideline.identity?.name || guideline.name || 'Untitled';

  // A % sozinha não aciona nada — dizer O QUE falta (por peso) transforma o
  // medidor num próximo passo. Labels vêm da lib por id, traduzidas aqui.
  const completenessHint = useMemo(() => {
    if (report.missing.length === 0)
      return t('brandGuidelines.completenessFull', { score: report.score });
    const top = [...report.missing].sort((a, b) => b.weight - a.weight);
    const items = top
      .slice(0, 3)
      .map((r) => t(`brandCompleteness.${r.id}`) || r.label)
      .join(', ');
    const extra = top.length - 3;
    return t('brandGuidelines.completenessMissing', {
      score: report.score,
      items: extra > 0 ? `${items} ${t('brandGuidelines.completenessMore', { count: extra })}` : items,
    });
  }, [report, t]);
  const primaryFont = guideline.typography?.find(
    (t) => t.role === 'heading' || t.role === 'headline'
  )?.family;
  const bodyFont = guideline.typography?.find(
    (t) => t.role === 'body' || t.role === 'paragraph'
  )?.family;
  const fontHint = [primaryFont, bodyFont].filter(Boolean).join(' / ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileHover={{ y: -3 }}
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card hover:border-ring hover:shadow-lg hover:shadow-black/20 transition-[color,background-color,border-color,box-shadow,opacity,filter] duration-200 overflow-hidden text-left',
        archived && 'opacity-60 grayscale-[0.6] hover:opacity-80'
      )}
    >
      {/* Ação principal como "stretched link": cobre o card inteiro SEM aninhar
          interativos. Antes a raiz era um <button> com o menu ⋮ (role=button)
          dentro — botão dentro de botão: árvore de acessibilidade inválida e o
          menu inalcançável por teclado. Agora o menu é irmão, num z acima. */}
      <button
        type="button"
        onClick={() => onSelect(guideline)}
        aria-label={brandName}
        className="absolute inset-0 z-[1] rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Cover */}
      <div className="relative w-full h-32 sm:h-40 shrink-0 overflow-hidden bg-muted">
        {showCover ? (
          <>
            {!coverLoaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
            <img
              src={getProxiedUrl(coverUrl)}
              alt=""
              loading="lazy"
              onLoad={() => setCoverLoaded(true)}
              onError={() => setCoverFailed(true)}
              className={cn(
                'w-full h-full object-cover group-hover:scale-105 transition-all duration-500',
                coverLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'
              )}
            />
          </>
        ) : (
          <CoverFallback colors={guideline.colors} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* Badges overlay */}
        <div className="absolute top-2 right-2 z-[2] flex items-center gap-1.5">
          {archived && (
            <Badge
              variant="secondary"
              className="bg-white/10 backdrop-blur-sm border-white/10 text-white/80 text-[10px] px-1.5 py-0 h-5 gap-1"
            >
              <Archive size={9} />
              {t('brandQuota.archivedBadge')}
            </Badge>
          )}
          {(onArchive || onUnarchive || onQuickEdit) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('brandQuota.brandActions')}
                  className="p-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={11} className="text-white/90" />
                </button>
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
          {guideline.isPublic && (
            <Badge
              variant="secondary"
              className="bg-white/10 backdrop-blur-sm border-white/10 text-white/80 text-[10px] px-1.5 py-0 h-5 gap-1"
            >
              <Globe size={9} />
              Public
            </Badge>
          )}
          {guideline.folder && (
            <Badge
              variant="secondary"
              className="bg-white/10 backdrop-blur-sm border-white/10 text-white/70 text-[10px] px-1.5 py-0 h-5 gap-1"
            >
              <Folder size={9} />
              {guideline.folder}
            </Badge>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="relative px-3 sm:px-4 -mt-5">
        <div className="ring-2 ring-card rounded-lg w-fit">
          <BrandAvatar brand={guideline} size={40} rounded="md" preference="primary" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 px-3 sm:px-4 pt-2 pb-3 min-w-0 flex flex-col gap-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate transition-colors">
            {brandName}
          </p>
          {guideline.identity?.tagline && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
              {guideline.identity.tagline}
            </p>
          )}
        </div>

        {/* Footer: completeness + font hint */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border">
          <Tooltip content={completenessHint} position="bottom">
            <div className="relative z-[2] flex items-center gap-1.5">
              <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-colors', SCORE_COLORS[status])}
                  style={{ width: `${report.score}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{report.score}%</span>
            </div>
          </Tooltip>
          {fontHint && (
            <p className="text-[10px] text-muted-foreground truncate max-w-[50%]">{fontHint}</p>
          )}
        </div>
      </div>
    </motion.div>
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
      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {unlimited
          ? t('brandQuota.meterUnlimited', { used })
          : t('brandQuota.meter', { used, max })}
      </span>
      {full && (
        <Button variant="subtle" size="sm" className="h-6 px-2 text-[11px]" onClick={onUpgrade}>
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

// Sidebar-lista de marcas escondida por ora (single-column + grid preenche a
// tela; mata a duplicação de lista/busca). O componente `GuidelinesSidebar`
// segue pronto pra reimportar — basta virar este flag pra true.
const SHOW_BRAND_SIDEBAR = false;

const BrandGrid = ({
  guidelines,
  onSelect,
  onArchive,
  onUnarchive,
  search: searchProp,
  onSearchChange,
}: {
  guidelines: BrandGuideline[];
  onSelect: (g: BrandGuideline) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  /** Busca controlada (SSoT único compartilhado com a sidebar). */
  search?: string;
  onSearchChange?: (v: string) => void;
}) => {
  const { t } = useTranslation();
  const [internalSearch, setInternalSearch] = useState('');
  const search = searchProp ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
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
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-4">
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
                'shrink-0 px-2.5 py-1 rounded-md text-[11px] border transition-colors',
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
                  'shrink-0 px-2.5 py-1 rounded-md text-[11px] border transition-colors flex items-center gap-1',
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
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-colors">
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

      {/* Count */}
      <p className="text-[11px] text-muted-foreground">
        {t('brandGuidelines.countBrands', {
          filtered: filtered.length,
          total: guidelines.length,
        })}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {activeList.map((g, i) => (
          <BrandCard
            key={g.id}
            guideline={g}
            onSelect={onSelect}
            index={i}
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
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
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
              {archivedList.map((g, i) => (
                <BrandCard
                  key={g.id}
                  guideline={g}
                  onSelect={onSelect}
                  index={i}
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
    </motion.div>
  );
};

export const BrandGuidelinesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, onSubscriptionModalOpen } = useLayout();

  const urlGuidelineId = searchParams.get('id');
  const [selectedId, setSelectedId] = useState<string | null>(urlGuidelineId);
  // Busca de marca — SSoT único: a sidebar (lista) e o BrandGrid (cards) filtram
  // pelo MESMO termo, em vez de dois estados desconexos. Finding #2.
  const [brandSearch, setBrandSearch] = useState('');
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

  // Persist the open brand in the URL (?id=) so the per-tab routing inside the
  // unified view is deep-linkable and survives refresh.
  const handleSelect = useCallback(
    (g: BrandGuideline) => {
      setSelectedId(g.id!);
      setSearchParams({ id: g.id! });
    },
    [setSearchParams]
  );

  const handleWizardSuccess = useCallback((id: string) => {
    setIsWizardOpen(false);
    setEditingGuideline(null);
    setSelectedId(id);
  }, []);

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

      {/* Só tem a marca demo → convite persistente pra trazer a real (abre o wizard). */}
      <DemoBrandBanner onCta={() => handleOpenWizard()} />

      {/* Two-pane contido: lista-de-marcas + conteúdo dentro do AppShell (não
          mais `fixed` cobrindo o rail). Cada pane rola independente. */}
      <div className="h-full bg-transparent relative z-10 flex overflow-hidden">
        {/* Desktop Sidebar (escondida por ora — SHOW_BRAND_SIDEBAR) */}
        {SHOW_BRAND_SIDEBAR && !isLoading && guidelines.length > 0 && (
          <aside
            role="navigation"
            aria-label={t('brand.guidelines.brand_guidelines_selection')}
            className="hidden lg:flex flex-col w-[260px] xl:w-[280px] shrink-0 border-r border-sidebar-border bg-sidebar overflow-y-auto"
            data-vsn-region="sidebar"
          >
            <GuidelinesSidebar
              guidelines={guidelines}
              selectedId={selectedId}
              onSelect={handleSelect}
              onCreate={() => handleOpenWizard()}
              search={brandSearch}
              onSearchChange={setBrandSearch}
            />
          </aside>
        )}

        {/* Main Content Area */}
        <main
          role="main"
          aria-label={t('brand.guidelines.brand_guideline_content')}
          className="flex-1 w-full min-w-0 overflow-y-auto"
          data-vsn-region="content"
        >
          <div className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile sidebar trigger (escondido por ora — SHOW_BRAND_SIDEBAR) */}
                <div className={SHOW_BRAND_SIDEBAR ? 'lg:hidden' : 'hidden'}>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-md"
                        aria-label={t('brand.guidelines.open_menu')}
                      >
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-[85vw] max-w-sm p-0 border-r border-border bg-background/95 backdrop-blur-xl"
                    >
                      <SheetTitle className="sr-only">{t('brand.guidelines.menu')}</SheetTitle>
                      <GuidelinesSidebar
                        guidelines={guidelines}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        onCreate={() => handleOpenWizard()}
                        search={brandSearch}
                        onSearchChange={setBrandSearch}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-foreground truncate">
                    {t('brandGuidelines.title')}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {FEATURE_BRAND_BILLING && brandQuota && (
                  <BrandQuotaMeter
                    used={brandQuota.used}
                    max={brandQuota.max}
                    onUpgrade={handleQuotaUpgrade}
                  />
                )}
                {/* Primary action must live ON the surface, not only in the
                    empty state — once the user has ≥1 brand the create path
                    would otherwise be unreachable from the list header. */}
                {guidelines.length > 0 && (
                  <Button size="sm" onClick={() => handleOpenWizard()} className="gap-1.5">
                    <Plus size={15} />
                    {t('brandGuidelines.newBrand') || 'New brand'}
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

            {/* Content — dashboard/list. The per-brand editor lives in the unified
                view (PublicBrandGuideline), reached via the early return above. */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-40 gap-6"
                >
                  <GlitchLoader size={40} />
                  <p className="text-muted-foreground text-xs animate-pulse">{t('common.loading')}</p>
                </motion.div>
              ) : isError ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-40 gap-4 text-center"
                >
                  <p className="text-sm font-medium text-foreground">
                    {t('brandGuidelines.loadFailedTitle') || 'Could not load your brands'}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {t('brandGuidelines.loadFailedBody') ||
                      'Something went wrong. Your brands are safe — try again.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    {t('common.retry') || 'Try again'}
                  </Button>
                </motion.div>
              ) : guidelines.length === 0 ? (
                <EmptyState key="empty" onCreate={() => handleOpenWizard()} />
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-8 md:gap-16 items-start w-full"
                >
                  <BrandGrid
                    guidelines={guidelines}
                    onSelect={handleSelect}
                    onArchive={FEATURE_BRAND_BILLING ? archiveActions.requestArchive : undefined}
                    onUnarchive={FEATURE_BRAND_BILLING ? archiveActions.unarchive : undefined}
                    search={brandSearch}
                    onSearchChange={setBrandSearch}
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
