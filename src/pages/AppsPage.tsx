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
import { motion, AnimatePresence } from 'framer-motion';
import { appsService, AppConfig } from '@/services/appsService';
import { getLucideIcon } from '@/lib/ui/lucideIcon';
import { usePinnedNav } from '@/hooks/usePinnedNav';
import { FEATURE_COPILOT } from '@/config/featureFlags';
import { AppEditDialog } from '@/components/AppEditDialog';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { toast } from 'sonner';
import { glassSurface } from '@/lib/ui/glass';
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
  const map = getLastUsed();
  map[appId] = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(map));
};

// ─── Category Config ────────────────────────────────────────────────────────
// Labels/descriptions live in i18n (apps.categories.<key>.*); here we only
// map the stable key → icon. `admin` is appended conditionally.

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

type AccessFilter = 'all' | 'free' | 'premium';

const appId = (app: any): string => app.id || app.appId;

// ─── Skeleton ───────────────────────────────────────────────────────────────

function AppCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-neutral-800 animate-pulse">
      <div className="aspect-[16/10] bg-neutral-800/20" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-1/2 bg-neutral-800/30 rounded-full" />
        <div className="h-3 w-4/5 bg-neutral-800/20 rounded-full" />
      </div>
    </div>
  );
}

// ─── Unified App Card (featured = spanning variant) ─────────────────────────

interface AppCardProps {
  app: any;
  isAdmin: boolean;
  hasAccess: boolean;
  featured?: boolean;
  onOpen: (app: any) => void;
  onEdit: (app: any) => void;
}

function AppCard({ app, isAdmin, hasAccess, featured = false, onOpen, onEdit }: AppCardProps) {
  const { t } = useTranslation();
  const isComingSoon = app.badgeVariant === 'comingSoon';
  const isPremium = app.badgeVariant === 'premium' || app.badgeVariant === 'featured';
  const isFree = app.badgeVariant === 'free' || app.free === true;
  const isAlpha = app.alpha === true;
  const isExternal = app.isExternal;
  const description = app.description || app.desc;
  // Ícone lucide do app (AppConfig.icon, editável no admin) como fallback do
  // thumbnail — em vez do genérico ImageIcon. Plano APP-SHELL P3.
  const AppIcon = getLucideIcon(app.icon) ?? ImageIcon;
  // Fixar no rail (star estilo Figma).
  const { isPinned, toggle } = usePinnedNav();
  const pinId = app.appId || app.id;
  const pinned = isPinned('app', pinId);
  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle({ type: 'app', id: pinId, label: app.name, to: app.link, icon: app.icon });
  };

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
    if (fallback) fallback.style.display = 'flex';
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.98 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      role="button"
      tabIndex={isComingSoon ? -1 : 0}
      aria-label={app.name}
      onClick={() => onOpen(app)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(app);
        }
      }}
      className={cn(
        'group relative rounded-2xl overflow-hidden flex flex-col',
        'bg-white/[0.03] border border-neutral-800',
        'transition-all duration-300 outline-none cursor-pointer',
        'hover:border-white/10 hover:bg-white/[0.035] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20',
        'focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
        // Featured não spanneia mais (grid uniforme): destaque vem da seção +
        // badge, não de um card gigante escuro que sumia no fundo.
        isComingSoon && 'opacity-30 grayscale pointer-events-none',
        app.isHidden && 'border-warning/20 opacity-60'
      )}
    >
      {app.isHidden && (
        <div className="absolute top-0 right-0 z-50 bg-warning/90 text-black px-2.5 py-0.5 text-[10px] font-semibold rounded-bl-xl">
          {t('apps.hidden')}
        </div>
      )}

      {/* Thumbnail — superfície levemente iluminada + separador embaixo para
          definir a arte escura contra o card (contraste). Todos os controles de
          overlay (star, lock, edit, Abrir) vivem AQUI dentro, no mesmo contexto
          de empilhamento, pra os z-index serem coerentes (star não flutua mais
          por cima do resto). */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-b from-neutral-800/50 to-neutral-950/70 border-b border-white/5">
        {app.thumbnail ? (
          <>
            <img
              src={app.thumbnail}
              alt={app.name}
              loading="lazy"
              onError={handleImgError}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="w-full h-full items-center justify-center text-neutral-800 hidden">
              <AppIcon size={32} strokeWidth={1.2} />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-700">
            <AppIcon size={featured ? 40 : 32} strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-transparent to-transparent opacity-80" />

        {/* Hover overlay (Abrir) — z-10, atrás dos botões de canto */}
        <div className="absolute inset-0 z-10 flex items-center justify-center transition-all duration-300 bg-neutral-950/40 backdrop-blur-[3px] opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="text-sm font-medium text-white px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center gap-2 shadow-lg">
            {isExternal ? t('apps.launch') : t('apps.open')}
            {isExternal ? <ExternalLink size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>

        {/* Favoritar/fixar (star estilo Figma) — top-left, aparece no hover ou
            fica se fixado. Mesmo contexto de empilhamento dos outros controles. */}
        <button
          onClick={togglePin}
          aria-label={pinned ? t('nav.unpin') : t('nav.pin')}
          title={pinned ? t('nav.unpin') : t('nav.pin')}
          className={cn(
            'absolute top-3 left-3 z-20 p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 transition-all',
            pinned
              ? 'opacity-100 text-brand-cyan'
              : 'text-white/70 hover:text-white opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100'
          )}
        >
          <Star size={12} className={pinned ? 'fill-brand-cyan' : ''} />
        </button>

        {/* Cluster top-right — edit (admin) + indicador de acesso, lado a lado
            num flex pra nunca se sobreporem. */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(app);
              }}
              aria-label={t('apps.edit_app')}
              className="p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white hover:scale-110 active:scale-95 transition-all opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <Edit3 size={12} />
            </button>
          )}
          {isPremium && !hasAccess ? (
            <div className="p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 text-brand-cyan">
              <Lock size={12} />
            </div>
          ) : isExternal ? (
            <div className="p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 text-neutral-400">
              <ExternalLink size={12} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              'font-semibold text-neutral-100 group-hover:text-white transition-colors leading-snug',
              featured ? 'text-base sm:text-lg' : 'text-[15px]'
            )}
          >
            {app.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {isComingSoon ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-neutral-600">
                {t('apps.badge.soon')}
              </span>
            ) : isFree ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success/80">
                {t('apps.badge.free')}
              </span>
            ) : isPremium ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan/80">
                {t('apps.badge.pro')}
              </span>
            ) : null}
            {isAlpha && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400/80 border border-violet-500/20">
                {t('apps.badge.alpha')}
              </span>
            )}
          </div>
        </div>
        <p
          className={cn(
            'text-neutral-500 leading-relaxed flex-1',
            featured ? 'text-sm line-clamp-2 max-w-2xl' : 'text-[13px] line-clamp-2'
          )}
        >
          {description}
        </p>
        {isPremium && !hasAccess && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-600">
            <Lock size={10} /> {t('apps.requiresPro')}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Category rail item (desktop sidebar) ───────────────────────────────────

interface RailItemProps {
  icon: typeof Crown;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

// ─── Category chip (mobile rail) ────────────────────────────────────────────

function CategoryChip({ icon: Icon, label, count, active, onClick }: RailItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all shrink-0',
        active
          ? 'text-neutral-200 bg-white/5 border-white/10 font-medium'
          : 'text-neutral-500 hover:text-neutral-300 border-transparent bg-white/[0.03]'
      )}
    >
      <Icon size={13} className="shrink-0" />
      {label}
      <span className={cn('text-[10px]', active ? 'text-neutral-400' : 'text-neutral-600')}>
        {count}
      </span>
    </button>
  );
}

// ─── Section header (category grids) ────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  description,
  count,
}: {
  icon: typeof Crown;
  label: string;
  description?: string;
  count: number;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-white/5 border border-neutral-800">
          <Icon size={16} className="text-neutral-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-200">{label}</h2>
          {description && <p className="text-xs text-neutral-600">{description}</p>}
        </div>
      </div>
      <span className="text-xs text-neutral-700 pb-0.5 shrink-0 tabular-nums">{count}</span>
    </div>
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
  const railSlot = useRailSlot()?.railSlot ?? null;

  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingApp, setEditingApp] = useState<AppConfig | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'recent'>('default');
  // Cinto de utilidades colapsado por padrão (two-tier, RCD §3.3).
  const [showUtilities, setShowUtilities] = useState(false);

  const catLabel = useCallback((key: string) => t(`apps.categories.${key}.label`), [t]);
  const catDesc = useCallback((key: string) => t(`apps.categories.${key}.description`), [t]);

  // ─── Static apps config ─────────────────────────────────────────────────

  const staticAppsData = useMemo(
    () => [
      // Pro Tools
      {
        id: 'mockup-machine',
        name: t('apps.mockupMachine.name'),
        desc: t('apps.mockupMachine.description'),
        link: '/mockupmachine',
        badge: t('apps.badge.featured'),
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
        badge: t('apps.badge.premium'),
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
        badge: t('apps.badge.premium'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.new'),
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
        badge: t('apps.badge.new'),
        badgeVariant: 'premium',
        category: 'pro',
        free: false,
      },
      {
        id: 'budget-machine',
        name: t('apps.budgetMachine.name'),
        desc: t('apps.budgetMachine.description'),
        link: '/budget-machine',
        badge: t('apps.badge.comingSoon'),
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
        badge: t('apps.badge.beta'),
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
        badge: t('apps.badge.new'),
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
        badge: t('apps.badge.new'),
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
        badge: t('apps.badge.new'),
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
        badge: t('apps.badge.new'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.free'),
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
        badge: t('apps.badge.new'),
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
        badge: t('apps.badge.admin'),
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
          badge: s.badge,
          thumbnail: s.thumbnail,
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
  // flag. Injetado no topo para ancorar a faixa Featured em Pro Tools.
  const visibleApps = useMemo(() => {
    const withoutCopilot = apps.filter((a) => appId(a) !== 'copilot');
    if (!FEATURE_COPILOT) return withoutCopilot;
    return [
      {
        id: 'copilot',
        name: t('apps.copilot.name'),
        desc: t('apps.copilot.description'),
        link: '/copilot',
        badge: t('apps.badge.premium'),
        // "featured" (como o Mockup Machine) navega até o preview travado do
        // /copilot em vez do modal — paywall que mostra o produto vende mais.
        badgeVariant: 'featured',
        thumbnail: '/tools/mockup-machine.webp',
        category: 'pro',
        free: false,
      } as any,
      ...withoutCopilot,
    ];
  }, [apps, t]);

  // ─── Filtered & Sorted ────────────────────────────────────────────────

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase().trim();

    return visibleApps.filter((app) => {
      if (app.isHidden && !isAdmin) return false;
      if ((app as any).adminOnly && !isAdmin) return false;
      if (activeCategory && app.category !== activeCategory) return false;
      if (accessFilter === 'free' && !(app as any).free && app.badgeVariant !== 'free')
        return false;
      if (accessFilter === 'premium' && ((app as any).free || app.badgeVariant === 'free'))
        return false;
      if (q) {
        const name = (app.name || '').toLowerCase();
        const desc = (app.description || (app as any).desc || '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [visibleApps, isAdmin, search, activeCategory, accessFilter]);

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

  // Category counts (always over the full visible set, ignoring filters).
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleApps.forEach((app) => {
      if (app.isHidden && !isAdmin) return;
      if ((app as any).adminOnly && !isAdmin) return;
      counts[app.category] = (counts[app.category] || 0) + 1;
    });
    return counts;
  }, [visibleApps, isAdmin]);

  const totalApps = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const hasActiveFilters = !!search || !!activeCategory || accessFilter !== 'all';

  // Sectioned view: only on "All", no search, default sort.
  const showSections = !activeCategory && !search && sortBy === 'default';

  const sections = useMemo(() => {
    if (!showSections) return [];
    return categories
      .map((cat) => ({
        key: cat.key,
        icon: cat.icon,
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
    if (app.isExternal) window.open(app.link, '_blank');
    else navigate(app.link);
  };

  const startEdit = (app: any) => {
    setEditingApp(app);
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch('');
    setActiveCategory(null);
    setAccessFilter('all');
  };

  const cardProps = {
    isAdmin,
    hasAccess,
    onOpen: openApp,
    onEdit: startEdit,
  };

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
            className="h-9 px-4 gap-2 text-xs font-medium text-neutral-400 hover:text-brand-cyan hover:bg-brand-cyan/5 rounded-xl"
          >
            <Plus size={14} /> {t('apps.addApp')}
          </Button>
        ) : undefined
      }
    >
      <div className="min-w-0">
        {/* ─── Categorias → L2 no rail (SSoT igual references/my-outputs) ──────
            A lista in-page de desktop virou portal pro rail drill-in. Mobile
            mantém os chips (rail some no mobile). */}
        {railSlot &&
          createPortal(
            <nav className="space-y-0.5">
              <p className="px-2.5 pb-1.5 text-[11px] text-sidebar-foreground/50">
                {t('apps.categoriesLabel')}
              </p>
              {[
                {
                  key: null as string | null,
                  icon: LayoutGrid,
                  label: t('apps.allApps'),
                  count: totalApps,
                },
                ...categories
                  .filter((cat) => (categoryCounts[cat.key] || 0) > 0 || cat.key === 'admin')
                  .map((cat) => ({
                    key: cat.key,
                    icon: cat.icon,
                    label: catLabel(cat.key),
                    count: categoryCounts[cat.key] || 0,
                  })),
              ].map((item) => {
                const active = item.key === null ? !activeCategory : activeCategory === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key ?? 'all'}
                    onClick={() =>
                      setActiveCategory(
                        item.key === null ? null : activeCategory === item.key ? null : item.key
                      )
                    }
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                      active
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <span className="text-[11px] tabular-nums text-sidebar-foreground/40">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </nav>,
            railSlot
          )}

        {/* ─── Main column ────────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Mobile category chips */}
          <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-4 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 w-max">
              <CategoryChip
                icon={LayoutGrid}
                label={t('apps.allApps')}
                count={totalApps}
                active={!activeCategory}
                onClick={() => setActiveCategory(null)}
              />
              {categories.map((cat) => {
                const count = categoryCounts[cat.key] || 0;
                if (count === 0 && cat.key !== 'admin') return null;
                return (
                  <CategoryChip
                    key={cat.key}
                    icon={cat.icon}
                    label={catLabel(cat.key)}
                    count={count}
                    active={activeCategory === cat.key}
                    onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
                  />
                );
              })}
            </div>
          </div>

          {/* Sticky toolbar: search + access + sort */}
          <div
            className={cn(
              'sticky z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800',
              inShell ? 'top-0' : 'top-10 md:top-14'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('apps.searchPlaceholder')}
                  className={cn(
                    'w-full pl-9 pr-9 py-2 text-sm rounded-xl text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-white/15 focus:bg-white/5 transition-all',
                    glassSurface.tile
                  )}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label={t('apps.empty.clearFilters')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Access segmented control */}
              <div
                className={cn(
                  'hidden sm:flex items-center gap-0.5 p-0.5 rounded-xl shrink-0',
                  glassSurface.tile
                )}
              >
                {(['all', 'free', 'premium'] as AccessFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setAccessFilter(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all',
                      accessFilter === key
                        ? 'bg-white/5 text-neutral-100 font-medium'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {t(`apps.access.${key}`)}
                  </button>
                ))}
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
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all shrink-0',
                  sortBy !== 'default'
                    ? 'border-white/10 text-neutral-200 bg-white/5'
                    : 'border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]'
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
            <div className="space-y-8">
              <div className={GRID_CLASS}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <AppCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ) : sortedApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5 text-center py-20">
              <div className={cn('p-5 rounded-2xl', glassSurface.panel)}>
                <PackageOpen size={48} strokeWidth={1.2} className="text-neutral-700" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-neutral-400">
                  {search ? t('apps.empty.noResultsTitle') : t('apps.empty.noCategoryTitle')}
                </h3>
                <p className="text-sm text-neutral-600 max-w-sm">
                  {search
                    ? t('apps.empty.noResultsDesc', { query: search })
                    : t('apps.empty.noCategoryDesc')}
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium text-brand-cyan hover:text-white transition-colors flex items-center gap-1.5 mt-2"
                >
                  <X size={14} /> {t('apps.empty.clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}-${accessFilter}-${sortBy}-${search ? 'q' : ''}`}
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
                }}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="space-y-12"
              >
                {showSections ? (
                  <>
                    {/* Featured apps fundidos nas categorias (mantêm o badge Pro) —
                        sem seção "Destaque" solitária deixando colunas vazias. */}

                    {/* Core sections (brand-AI) — sempre abertas */}
                    {sections
                      .filter((s) => CORE_CATEGORY_KEYS.has(s.key))
                      .map((section) => (
                        <section key={section.key}>
                          <SectionHeader
                            icon={section.icon}
                            label={catLabel(section.key)}
                            description={catDesc(section.key)}
                            count={section.apps.length}
                          />
                          <div className={GRID_CLASS}>
                            {section.apps.map((app) => (
                              <AppCard key={appId(app)} app={app} {...cardProps} />
                            ))}
                          </div>
                        </section>
                      ))}

                    {/* Cinto de utilidades — colapsado por padrão (Swiss Knife Index) */}
                    {(() => {
                      const utility = sections.filter((s) => !CORE_CATEGORY_KEYS.has(s.key));
                      const utilityCount = utility.reduce((n, s) => n + s.apps.length, 0);
                      if (utility.length === 0) return null;
                      return (
                        <section className="border-t border-neutral-800 pt-8">
                          <button
                            type="button"
                            onClick={() => setShowUtilities((v) => !v)}
                            aria-expanded={showUtilities}
                            className="group flex w-full items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 rounded-lg"
                          >
                            <LayoutGrid size={16} className="text-neutral-500" />
                            <MicroTitle as="span" className="text-neutral-300">
                              {t('apps.quickTools')}
                            </MicroTitle>
                            <span className="text-xs font-mono text-neutral-600 tabular-nums">
                              {utilityCount}
                            </span>
                            <ChevronRight
                              size={16}
                              className={cn(
                                'ml-auto text-neutral-500 transition-transform',
                                showUtilities && 'rotate-90'
                              )}
                            />
                          </button>
                          {!showUtilities && (
                            <p className="mt-2 text-sm text-neutral-600">
                              {t('apps.quickToolsDesc')}
                            </p>
                          )}
                          {showUtilities && (
                            <div className="mt-8 space-y-12">
                              {utility.map((section) => (
                                <section key={section.key}>
                                  <SectionHeader
                                    icon={section.icon}
                                    label={catLabel(section.key)}
                                    description={catDesc(section.key)}
                                    count={section.apps.length}
                                  />
                                  <div className={GRID_CLASS}>
                                    {section.apps.map((app) => (
                                      <AppCard key={appId(app)} app={app} {...cardProps} />
                                    ))}
                                  </div>
                                </section>
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    })()}
                  </>
                ) : (
                  // Flat grid (category selected or searching)
                  <div className={GRID_CLASS}>
                    {sortedApps.map((app) => (
                      <AppCard key={appId(app)} app={app} {...cardProps} />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
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
