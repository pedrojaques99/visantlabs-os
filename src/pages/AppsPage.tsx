import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { PageShell } from '../components/ui/PageShell';
import { cn } from '../lib/utils';
import {
  ExternalLink,
  Lock,
  Crown,
  Palette,
  Music,
  Globe,
  ShieldCheck,
  PackageOpen,
  ArrowUpDown,
  Image as ImageIcon,
  Edit3,
  Plus,
  ChevronRight,
  Search,
  X,
  LayoutGrid,
  Star,
} from '@/lib/ui/icons';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { appsService, AppConfig } from '@/services/appsService';
import { getLucideIcon } from '@/lib/ui/lucideIcon';
import { usePinnedNav } from '@/hooks/usePinnedNav';
import { FEATURE_COPILOT } from '@/config/featureFlags';
import { AppEditDialog } from '@/components/AppEditDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Thumb } from '@/components/ui/Thumb';
import { toast } from 'sonner';
import { glassSurface } from '@/lib/ui/glass';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { useRailSlot } from '@/components/shell/RailSlotContext';
import { createPortal } from 'react-dom';

// ─── Last-used tracking (shared with HomePage) ──────────────────────────────
const LS_KEY = 'vsn_app_last_used';
const getLastUsed = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
};
const recordLastUsed = (appId: string) => {
  try {
    const map = getLastUsed();
    map[appId] = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // Storage bloqueado (aba privada): a ordem "recentes" só perde este clique.
  }
};

// ─── Category Config ────────────────────────────────────────────────────────
// Labels live in i18n (apps.categories.<key>.label); here we only map the
// stable key → icon. `admin` is appended conditionally.

type CategoryDef = { key: string; icon: typeof Crown };

const CATEGORY_CONFIG: CategoryDef[] = [
  { key: 'pro', icon: Crown },
  { key: 'creative', icon: Palette },
  { key: 'image', icon: ImageIcon },
  { key: 'converters', icon: ArrowUpDown },
  { key: 'generators', icon: PackageOpen },
  { key: 'audio', icon: Music },
  { key: 'community', icon: Globe },
];

const ADMIN_CATEGORY: CategoryDef = { key: 'admin', icon: ShieldCheck };

// Two-tier na home do catálogo (RCD §3.3 — Swiss Knife Index): o core brand-AI
// fica sempre aberto; o cinto de utilidades (conversores, geradores, áudio,
// comunidade) colapsa sob um disclosure pra não diluir "pra que a Visant serve".
const CORE_CATEGORY_KEYS = new Set(['pro', 'creative']);

const appId = (app: any): string => app.id || app.appId;

// ─── Skeleton ───────────────────────────────────────────────────────────────

function AppCardSkeleton() {
  return (
    <div className={cn('rounded-2xl overflow-hidden animate-pulse', glassSurface.surface)}>
      <div className="aspect-[16/10] bg-muted" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-1/2 bg-muted rounded-full" />
        <div className="h-3 w-4/5 bg-muted rounded-full" />
      </div>
    </div>
  );
}

// ─── App Card ───────────────────────────────────────────────────────────────

interface AppCardProps {
  app: any;
  isAdmin: boolean;
  hasAccess: boolean;
  onOpen: (app: any) => void;
  onEdit: (app: any) => void;
}

const cornerBtn = 'p-2 rounded-xl bg-background/80 border border-border';

function AppCard({ app, isAdmin, hasAccess, onOpen, onEdit }: AppCardProps) {
  const { t } = useTranslation();
  const isComingSoon = app.badgeVariant === 'comingSoon';
  const isPremium = app.badgeVariant === 'premium' || app.badgeVariant === 'featured';
  const locked = isPremium && !hasAccess;
  const isExternal = app.isExternal;
  const description = app.description || app.desc;
  // Ícone real do app (AppConfig.icon, editável no admin). Sem ícone genérico:
  // app sem thumb e sem ícone mostra o próprio nome.
  const AppIcon = getLucideIcon(app.icon);
  // Fixar no rail (star estilo Figma).
  const { isPinned, toggle } = usePinnedNav();
  const pinId = app.appId || app.id;
  const pinned = isPinned('app', pinId);
  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle({ type: 'app', id: pinId, label: app.name, to: app.link, icon: app.icon });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={app.name}
      onClick={() => onOpen(app)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(app);
        }
      }}
      className={cn(
        'group relative rounded-2xl overflow-hidden flex flex-col outline-none cursor-pointer',
        glassSurface.tile,
        'focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted border-b border-border">
        {app.thumbnail ? (
          <Thumb
            src={app.thumbnail}
            alt={app.name}
            loading="lazy"
            className="w-full h-full object-cover"
            fallbackIcon={AppIcon ?? undefined}
          />
        ) : AppIcon ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <AppIcon size={40} strokeWidth={1.25} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-6 text-center text-lg font-semibold text-muted-foreground">
            {app.name}
          </div>
        )}

        <button
          onClick={togglePin}
          aria-label={pinned ? t('nav.unpin') : t('nav.pin')}
          title={pinned ? t('nav.unpin') : t('nav.pin')}
          className={cn(
            'absolute top-3 left-3 z-20',
            cornerBtn,
            pinned
              ? 'text-brand-cyan'
              : cn(hoverReveal, 'text-muted-foreground hover:text-foreground')
          )}
        >
          <Star size={12} className={pinned ? 'fill-brand-cyan' : ''} />
        </button>

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(app);
              }}
              aria-label={t('apps.edit_app')}
              title={t('apps.edit_app')}
              className={cn(cornerBtn, hoverReveal, 'text-muted-foreground hover:text-foreground')}
            >
              <Edit3 size={12} />
            </button>
          )}
          {locked ? (
            <span
              title={t('apps.requiresPro')}
              aria-label={t('apps.requiresPro')}
              className={cn(cornerBtn, 'text-muted-foreground')}
            >
              <Lock size={12} />
            </span>
          ) : isExternal ? (
            <span className={cn(cornerBtn, 'text-muted-foreground')}>
              <ExternalLink size={12} />
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground leading-snug">{app.name}</h3>
          {isAdmin && (app.isHidden || isComingSoon) && (
            <Badge variant="neutral" className="shrink-0">
              {app.isHidden ? t('apps.hidden') : t('apps.badge.soon')}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Category chip (rail fallback: mobile or collapsed rail) ────────────────

interface CategoryChipProps {
  icon: typeof Crown;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryChip({ icon: Icon, label, count, active, onClick }: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors shrink-0',
        active
          ? 'text-foreground bg-muted border-border font-medium'
          : 'text-muted-foreground hover:text-foreground border-transparent bg-muted/40'
      )}
    >
      <Icon size={13} className="shrink-0" />
      {label}
      <span className="text-2xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

const GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4';

// ─── Page ───────────────────────────────────────────────────────────────────

export const AppsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess } = usePremiumAccess();
  const { onSubscriptionModalOpen, user } = useLayout();
  const isAdmin = user?.isAdmin === true;
  // Dentro do AppShell o <main> é o próprio container de scroll (não há Header
  // global fixo por cima): o offset sticky vira 0. Fora dele, mantém o offset
  // que limpa o Header do site (top-14). Sem isto o conteúdo passa POR CIMA da
  // toolbar (bug do "Ferramentas Pro" vazando sobre a busca).
  const inShell = useInAppShell();
  // Categorias viram L2 no rail (SSoT igual references/my-outputs) via RailSlot.
  // O slot só existe com o rail expandido; sem ele, a página mostra os chips.
  const railSlot = useRailSlot()?.railSlot ?? null;

  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingApp, setEditingApp] = useState<AppConfig | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'recent'>('default');
  // Cinto de utilidades colapsado por padrão (two-tier, RCD §3.3).
  const [showUtilities, setShowUtilities] = useState(false);

  const catLabel = useCallback((key: string) => t(`apps.categories.${key}.label`), [t]);

  // ─── Static apps config ─────────────────────────────────────────────────

  const staticAppsData = useMemo(
    () => [
      // Pro Tools
      {
        id: 'mockup-machine',
        name: t('apps.mockupMachine.name'),
        desc: t('apps.mockupMachine.description'),
        link: '/mockupmachine',
        badgeVariant: 'featured',
        thumbnail: '/tools/mockup-machine.webp',
        category: 'pro',
        free: false,
      },
      {
        id: 'branding-machine',
        name: t('apps.brandingMachine.name'),
        desc: t('apps.brandingMachine.description'),
        link: '/branding-machine',
        badgeVariant: 'premium',
        thumbnail: '/tools/branding-machine.webp',
        category: 'pro',
        free: false,
      },
      {
        id: 'brand-guidelines',
        name: t('apps.brandGuidelines.name'),
        desc: t('apps.brandGuidelines.description'),
        link: '/brand-guidelines',
        badgeVariant: 'premium',
        thumbnail: '/tools/brand-guidelines.webp',
        category: 'pro',
        free: false,
      },
      {
        id: 'canvas',
        name: t('apps.canvas.name'),
        desc: t('apps.canvas.description'),
        link: '/canvas',
        badgeVariant: 'free',
        thumbnail: '/tools/canvas.webp',
        category: 'creative',
        free: true,
      },
      {
        id: 'instagram-extractor',
        name: t('apps.instagramExtractor.name'),
        desc: t('apps.instagramExtractor.description'),
        link: '/extractor',
        thumbnail: '/tools/instagram-extractor.webp',
        badgeVariant: 'premium',
        category: 'pro',
        free: false,
      },
      {
        id: 'moodboard-studio',
        name: t('apps.moodboardStudio.name'),
        desc: t('apps.moodboardStudio.description'),
        link: '/moodboard',
        thumbnail: '/tools/moodboard-studio.webp',
        badgeVariant: 'premium',
        category: 'pro',
        free: false,
      },
      {
        id: 'budget-machine',
        name: t('apps.budgetMachine.name'),
        desc: t('apps.budgetMachine.description'),
        link: '/budget-machine',
        badgeVariant: 'comingSoon',
        thumbnail: '/tools/budget-machine.webp',
        category: 'pro',
        free: false,
      },
      {
        id: 'content-studio',
        name: t('apps.contentStudio.name'),
        desc: t('apps.contentStudio.description'),
        link: '/content-studio',
        // Pago (category 'pro', free:false) — variant 'premium' pra NÃO renderizar o
        // badge verde "Grátis" (isFree deriva de badgeVariant==='free'); senão o card
        // promete grátis e o clique cai no paywall.
        badgeVariant: 'premium',
        category: 'pro',
        free: false,
      },
      {
        id: 'naming-machine',
        name: t('apps.namingMachine.name'),
        desc: t('apps.namingMachine.description'),
        link: '/naming',
        // Pago — variant 'premium' (não 'free') pra não mostrar badge verde enganoso.
        badgeVariant: 'premium',
        category: 'pro',
        free: false,
      },

      // Creative Lab
      {
        id: 'grid-machine',
        name: t('apps.gridMachine.name'),
        desc: t('apps.gridMachine.description'),
        link: '/grid-machine',
        thumbnail: '/tools/grid-machine.webp',
        badgeVariant: 'free',
        category: 'creative',
        free: true,
      },
      {
        id: '3d-studio',
        name: t('apps.studio3d.name'),
        desc: t('apps.studio3d.description'),
        link: '/3d-studio',
        thumbnail: '/tools/3d-studio.webp',
        badgeVariant: 'free',
        category: 'creative',
        free: true,
        alpha: true,
      },
      {
        id: 'image-lab',
        name: t('apps.imageLab.name'),
        desc: t('apps.imageLab.description'),
        link: '/image-lab',
        thumbnail: '/tools/cmyk-halftone.webp',
        badgeVariant: 'free',
        category: 'creative',
        free: true,
        alpha: true,
      },
      {
        id: 'ascii-vortex',
        name: t('apps.asciiVortex.name'),
        desc: t('apps.asciiVortex.description'),
        link: 'https://vsn-labs.vercel.app/ascii-vortex',
        thumbnail: '/tools/ascii-vortex.webp',
        badgeVariant: 'free',
        category: 'creative',
        isExternal: true,
        free: true,
      },
      {
        id: 'grid-paint',
        name: t('apps.gridPaint.name'),
        desc: t('apps.gridPaint.description'),
        link: '/grid-paint',
        thumbnail: '/tools/gridpaint.webp',
        badgeVariant: 'free',
        category: 'creative',
        free: true,
      },

      // Image Tools
      {
        id: 'compress',
        name: t('apps.imageCompressor.name'),
        desc: t('apps.imageCompressor.description'),
        link: '/compress',
        badgeVariant: 'free',
        thumbnail: '/tools/compress.webp',
        category: 'image',
        free: true,
      },
      {
        id: 'upscale',
        name: t('apps.bicubicUpscale.name'),
        desc: t('apps.bicubicUpscale.description'),
        link: '/upscale',
        badgeVariant: 'free',
        thumbnail: '/tools/upscale.webp',
        category: 'image',
        free: true,
        alpha: true,
      },
      {
        id: 'remove-bg',
        name: t('apps.backgroundRemover.name'),
        desc: t('apps.backgroundRemover.description'),
        link: '/remove-bg',
        badgeVariant: 'free',
        thumbnail: '/tools/remove-bg.webp',
        category: 'image',
        free: true,
      },
      {
        id: 'watermark',
        name: t('apps.watermark.name'),
        desc: t('apps.watermark.description'),
        link: '/watermark',
        badgeVariant: 'free',
        thumbnail: '/tools/watermark.webp',
        category: 'image',
        free: true,
      },
      {
        id: 'visual-search',
        name: t('apps.visualSearch.name'),
        desc: t('apps.visualSearch.description'),
        link: '/visual-search',
        badgeVariant: 'free',
        thumbnail: '/tools/visual-search.webp',
        category: 'image',
        free: true,
        alpha: true,
      },
      // Converters
      {
        id: 'converter',
        name: t('apps.fileConverter.name'),
        desc: t('apps.fileConverter.description'),
        link: '/converter',
        badgeVariant: 'free',
        thumbnail: '/tools/file-converter.webp',
        category: 'converters',
        free: true,
      },
      {
        id: 'svg-optimizer',
        name: t('apps.svgOptimizer.name'),
        desc: t('apps.svgOptimizer.description'),
        link: '/svg-optimizer',
        badgeVariant: 'free',
        thumbnail: '/tools/svg-optimizer.webp',
        category: 'converters',
        free: true,
      },
      {
        id: 'color-converter',
        name: t('apps.colorConverter.name'),
        desc: t('apps.colorConverter.description'),
        link: '/color-converter',
        badgeVariant: 'free',
        thumbnail: '/tools/color-converter.webp',
        category: 'converters',
        free: true,
      },
      // Generators
      {
        id: 'qrcode',
        name: t('apps.qrCode.name'),
        desc: t('apps.qrCode.description'),
        link: '/qrcode',
        badgeVariant: 'free',
        thumbnail: '/tools/qrcode.webp',
        category: 'generators',
        free: true,
      },
      {
        id: 'favicon',
        name: t('apps.faviconGenerator.name'),
        desc: t('apps.faviconGenerator.description'),
        link: '/favicon',
        badgeVariant: 'free',
        thumbnail: '/tools/favicon.webp',
        category: 'generators',
        free: true,
      },
      {
        id: 'og-image',
        name: t('apps.ogImage.name'),
        desc: t('apps.ogImage.description'),
        link: '/og-image',
        badgeVariant: 'free',
        thumbnail: '/tools/og-image.webp',
        category: 'generators',
        free: true,
        alpha: true,
      },

      // Audio
      {
        id: 'youtube-mixer',
        name: t('apps.youtubeMixer.name'),
        desc: t('apps.youtubeMixer.description'),
        link: 'https://vsn-labs.vercel.app/youtube-mixer',
        thumbnail: '/tools/youtube-mixer.webp',
        badgeVariant: 'free',
        category: 'audio',
        isExternal: true,
        free: true,
      },
      {
        id: 'ellipse-audio',
        name: t('apps.ellipseAudio.name'),
        desc: t('apps.ellipseAudio.description'),
        link: 'https://vsn-labs.vercel.app/elipse-audio-freq',
        thumbnail: '/tools/elipse-audio.webp',
        badgeVariant: 'free',
        isExternal: true,
        free: true,
        category: 'audio',
      },

      // Community
      {
        id: 'colorfy',
        name: t('apps.colorfy.name'),
        desc: t('apps.colorfy.description'),
        link: 'https://gradient-machine.vercel.app/',
        badgeVariant: 'free',
        thumbnail: '/tools/color-extractor.webp',
        category: 'community',
        isExternal: true,
        free: true,
      },
      {
        id: 'halftone-machine',
        name: t('apps.halftoneMachine.name'),
        desc: t('apps.halftoneMachine.description'),
        link: 'https://pedrojaques99.github.io/halftone-machine/',
        badgeVariant: 'free',
        thumbnail: '/tools/halftone-machine.webp',
        isExternal: true,
        category: 'community',
        free: true,
      },
      {
        id: 'vsn-labs',
        name: t('apps.vsnLabs.name'),
        desc: t('apps.vsnLabs.description'),
        link: 'https://vsn-labs.vercel.app/',
        thumbnail: '/tools/vsn-labs.webp',
        badgeVariant: 'free',
        category: 'community',
        isExternal: true,
        free: true,
      },
      {
        id: 'labs',
        name: t('apps.labs.name'),
        desc: t('apps.labs.description'),
        link: '/labs',
        thumbnail: '/tools/labs.webp',
        badgeVariant: 'free',
        category: 'community',
        free: true,
      },

      // Admin
      {
        id: 'smart-analyzer',
        name: t('apps.smartAnalyzer.name'),
        desc: t('apps.smartAnalyzer.description'),
        link: '/admin/smart-analyzer',
        thumbnail: '/tools/smart-analyzer.webp',
        badgeVariant: 'admin',
        category: 'admin',
        free: false,
        adminOnly: true,
      },
    ],
    [t]
  );

  // ─── Categories ─────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = [...CATEGORY_CONFIG];
    if (isAdmin) cats.push(ADMIN_CATEGORY);
    return cats;
  }, [isAdmin]);

  // ─── Fetch & Sync ───────────────────────────────────────────────────────

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await appsService.getAll();
      const dbAppIds = new Set(data.map((app) => app.appId));

      if (isAdmin) {
        const missingApps = staticAppsData.filter((app) => !dbAppIds.has(app.id));
        if (missingApps.length > 0) {
          await appsService.seed(staticAppsData);
          const syncedData = await appsService.getAll();
          setApps(syncedData);
          return;
        }
      }

      const staticById = new Map(staticAppsData.map((a) => [a.id, a]));
      const mergedDbApps = data.map((dbApp) => {
        const s = staticById.get(dbApp.appId);
        if (!s) return dbApp;
        return {
          ...dbApp,
          name: s.name,
          description: s.desc,
          // A thumb que o admin envia (AppEditDialog) vale; a estática é só
          // fallback. Antes o estático sobrescrevia com undefined quem não tinha.
          thumbnail: dbApp.thumbnail || s.thumbnail,
          category: s.category,
        };
      });

      const missingStaticApps = staticAppsData
        .filter((app) => !dbAppIds.has(app.id))
        .map((app) => ({ ...app, appId: app.id, description: app.desc })) as any[];

      setApps(
        data.length === 0 ? (staticAppsData as any) : [...mergedDbApps, ...missingStaticApps]
      );
    } catch (error) {
      console.error('Error fetching apps:', error);
      setApps(staticAppsData as any);
      toast.error(t('apps.failed_to_load_apps_from_database_using'));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, staticAppsData, t]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // Copilot é flag-gated e fica FORA do staticAppsData de propósito: assim
  // nunca é seedado no DB de apps e a visibilidade/kill-switch segue só a
  // flag. Sem thumb própria: o card mostra o ícone real (Bot).
  const visibleApps = useMemo(() => {
    const withoutCopilot = apps.filter((a) => appId(a) !== 'copilot');
    if (!FEATURE_COPILOT) return withoutCopilot;
    return [
      {
        id: 'copilot',
        name: t('apps.copilot.name'),
        desc: t('apps.copilot.description'),
        link: '/copilot',
        // "featured" (como o Mockup Machine) navega até o preview travado do
        // /copilot em vez do modal — paywall que mostra o produto vende mais.
        badgeVariant: 'featured',
        icon: 'Bot',
        category: 'pro',
        free: false,
      } as any,
      ...withoutCopilot,
    ];
  }, [apps, t]);

  // Quem o usuário pode ver: oculto, admin-only e "em breve" só pro admin.
  const isListed = useCallback(
    (app: any) => isAdmin || (!app.isHidden && !app.adminOnly && app.badgeVariant !== 'comingSoon'),
    [isAdmin]
  );

  // ─── Filtered & Sorted ────────────────────────────────────────────────

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase().trim();

    return visibleApps.filter((app) => {
      if (!isListed(app)) return false;
      if (activeCategory && app.category !== activeCategory) return false;
      if (q) {
        const name = (app.name || '').toLowerCase();
        const desc = (app.description || (app as any).desc || '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [visibleApps, isListed, search, activeCategory]);

  const sortedApps = useMemo(() => {
    const sorted = [...filteredApps];
    if (sortBy === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'recent') {
      const lu = getLastUsed();
      sorted.sort((a, b) => (lu[appId(b)] ?? 0) - (lu[appId(a)] ?? 0));
    }
    return sorted;
  }, [filteredApps, sortBy]);

  // Category counts (always over the full listed set, ignoring filters).
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleApps.forEach((app) => {
      if (!isListed(app)) return;
      counts[app.category] = (counts[app.category] || 0) + 1;
    });
    return counts;
  }, [visibleApps, isListed]);

  const totalApps = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const hasActiveFilters = !!search || !!activeCategory;

  // Uma única lista de categorias pra rail e chips; categoria vazia não aparece.
  const categoryNav = useMemo(
    () => [
      { key: null as string | null, icon: LayoutGrid, label: t('apps.allApps'), count: totalApps },
      ...categories
        .filter((cat) => (categoryCounts[cat.key] || 0) > 0)
        .map((cat) => ({
          key: cat.key as string | null,
          icon: cat.icon,
          label: catLabel(cat.key),
          count: categoryCounts[cat.key] || 0,
        })),
    ],
    [categories, categoryCounts, totalApps, catLabel, t]
  );
  const isCategoryActive = (key: string | null) =>
    key === null ? !activeCategory : activeCategory === key;
  const selectCategory = (key: string | null) =>
    setActiveCategory(key === null || activeCategory === key ? null : key);

  // Sectioned view: only on "All", no search, default sort.
  const showSections = !activeCategory && !search && sortBy === 'default';

  const sections = useMemo(() => {
    if (!showSections) return [];
    return categories
      .map((cat) => ({
        key: cat.key,
        apps: sortedApps.filter((a) => a.category === cat.key),
      }))
      .filter((cat) => cat.apps.length > 0);
  }, [showSections, categories, sortedApps]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const openApp = (app: any) => {
    if (app.badgeVariant === 'comingSoon') return;
    if (app.badgeVariant === 'premium' && !hasAccess) {
      onSubscriptionModalOpen();
      return;
    }
    const id = appId(app);
    if (id) recordLastUsed(id);
    if (app.isExternal) window.open(app.link, '_blank', 'noopener,noreferrer');
    else navigate(app.link);
  };

  const startEdit = (app: any) => {
    setEditingApp(app);
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch('');
    setActiveCategory(null);
  };

  const cardProps = {
    isAdmin,
    hasAccess,
    onOpen: openApp,
    onEdit: startEdit,
  };

  const renderSection = (section: { key: string; apps: any[] }) => (
    <section key={section.key}>
      <h2 className="text-lg font-semibold text-foreground mb-4">{catLabel(section.key)}</h2>
      <div className={GRID_CLASS}>
        {section.apps.map((app) => (
          <AppCard key={appId(app)} app={app} {...cardProps} />
        ))}
      </div>
    </section>
  );

  const coreSections = sections.filter((s) => CORE_CATEGORY_KEYS.has(s.key));
  const utilitySections = sections.filter((s) => !CORE_CATEGORY_KEYS.has(s.key));

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <PageShell
      pageId="apps"
      width="full"
      seoTitle={t('apps.seoTitle')}
      seoDescription={t('apps.seoDescription')}
      title={t('apps.title')}
      microTitle={t('apps.microTitle')}
      description={t('apps.headerDescription')}
      breadcrumb={[{ label: t('apps.home'), to: '/' }, { label: t('apps.title') }]}
      actions={
        isAdmin ? (
          <Button
            onClick={() => {
              setEditingApp(undefined);
              setIsDialogOpen(true);
            }}
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <Plus size={14} /> {t('apps.addApp')}
          </Button>
        ) : undefined
      }
    >
      <div className="min-w-0">
        {/* Categorias → L2 no rail (SSoT igual references/my-outputs). */}
        {railSlot &&
          createPortal(
            <nav className="space-y-0.5">
              {categoryNav.map((item) => {
                const active = isCategoryActive(item.key);
                const Icon = item.icon;
                return (
                  <button
                    key={item.key ?? 'all'}
                    onClick={() => selectCategory(item.key)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <span className="text-2xs tabular-nums text-sidebar-foreground/40">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </nav>,
            railSlot
          )}

        {/* Chips = fallback do rail. Sem slot (rail recolhido ou fora do shell)
            aparecem sempre; com slot, só abaixo de md, onde o rail desktop some
            (mesmo breakpoint do `md:flex` do AppSidebar). */}
        <div
          className={cn(
            '-mx-4 sm:-mx-6 px-4 sm:px-6 mb-4 overflow-x-auto scrollbar-none',
            railSlot && 'md:hidden'
          )}
        >
          <div className="flex items-center gap-2 w-max">
            {categoryNav.map((item) => (
              <CategoryChip
                key={item.key ?? 'all'}
                icon={item.icon}
                label={item.label}
                count={item.count}
                active={isCategoryActive(item.key)}
                onClick={() => selectCategory(item.key)}
              />
            ))}
          </div>
        </div>

        {/* Sticky toolbar: search + sort */}
        <div
          className={cn(
            'sticky z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-background border-b border-border',
            inShell ? 'top-0' : 'top-10 md:top-14'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('apps.searchPlaceholder')}
                className={cn(
                  'w-full pl-9 pr-9 py-2 text-sm rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring',
                  glassSurface.tile
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label={t('apps.empty.clearFilters')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={() =>
                setSortBy(
                  sortBy === 'default' ? 'recent' : sortBy === 'recent' ? 'name' : 'default'
                )
              }
              title={
                sortBy === 'recent'
                  ? t('apps.sort.hintRecent')
                  : sortBy === 'name'
                    ? t('apps.sort.hintName')
                    : t('apps.sort.hintDefault')
              }
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border transition-colors shrink-0',
                sortBy !== 'default'
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <ArrowUpDown size={14} />
              <span className="hidden sm:inline">
                {sortBy === 'recent'
                  ? t('apps.sort.recent')
                  : sortBy === 'name'
                    ? t('apps.sort.name')
                    : t('apps.sort.label')}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className={GRID_CLASS}>
            {Array.from({ length: 9 }).map((_, i) => (
              <AppCardSkeleton key={i} />
            ))}
          </div>
        ) : sortedApps.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={search ? t('apps.empty.noResultsTitle') : t('apps.empty.noCategoryTitle')}
            description={
              search
                ? t('apps.empty.noResultsDesc', { query: search })
                : t('apps.empty.noCategoryDesc')
            }
            actionLabel={hasActiveFilters ? t('apps.empty.clearFilters') : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : showSections ? (
          <div className="space-y-12">
            {/* Core sections (brand-AI) — sempre abertas */}
            {coreSections.map(renderSection)}

            {/* Cinto de utilidades — colapsado por padrão (Swiss Knife Index) */}
            {utilitySections.length > 0 && (
              <section className="border-t border-border pt-8">
                <button
                  type="button"
                  onClick={() => setShowUtilities((v) => !v)}
                  aria-expanded={showUtilities}
                  className="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('apps.quickTools')}
                  <ChevronRight
                    size={16}
                    className={cn('ml-auto transition-transform', showUtilities && 'rotate-90')}
                  />
                </button>
                {showUtilities && (
                  <div className="mt-8 space-y-12">{utilitySections.map(renderSection)}</div>
                )}
              </section>
            )}
          </div>
        ) : (
          // Flat grid (category selected or searching)
          <div className={GRID_CLASS}>
            {sortedApps.map((app) => (
              <AppCard key={appId(app)} app={app} {...cardProps} />
            ))}
          </div>
        )}
      </div>

      <AppEditDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        app={editingApp}
        onSaved={fetchApps}
      />
    </PageShell>
  );
};
