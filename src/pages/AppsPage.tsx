import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  Wrench,
} from 'lucide-react';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { appsService, AppConfig } from '@/services/appsService';
import { AppEditDialog } from '@/components/AppEditDialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

type CategoryDef = {
  key: string;
  label: string;
  description: string;
  icon: typeof Crown;
};

const CATEGORY_CONFIG: CategoryDef[] = [
  {
    key: 'pro',
    label: 'Pro Tools',
    description: 'Professional design & branding suite',
    icon: Crown,
  },
  {
    key: 'creative',
    label: 'Creative Lab',
    description: 'Free creative tools to experiment with',
    icon: Palette,
  },
  {
    key: 'image',
    label: 'Image Tools',
    description: 'Process, enhance & transform images',
    icon: ImageIcon,
  },
  {
    key: 'converters',
    label: 'Converters',
    description: 'Convert formats, colors & optimize files',
    icon: ArrowUpDown,
  },
  {
    key: 'generators',
    label: 'Generators',
    description: 'Create QR codes, favicons & OG images',
    icon: PackageOpen,
  },
  { key: 'audio', label: 'Audio', description: 'Sound & music tools', icon: Music },
  {
    key: 'community',
    label: 'Community',
    description: 'Open-source experiments & external tools',
    icon: Globe,
  },
];

const COMPACT_CATEGORIES = new Set<string>();

const ADMIN_CATEGORY: CategoryDef = {
  key: 'admin',
  label: 'Admin',
  description: 'Internal tools',
  icon: ShieldCheck,
};

type AccessFilter = 'all' | 'free' | 'premium';

// ─── Skeleton ───────────────────────────────────────────────────────────────

function AppCardSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden bg-white/[0.03] border border-neutral-800 animate-pulse',
        large && 'lg:col-span-2 lg:row-span-2'
      )}
    >
      <div className={cn('bg-neutral-800/20', large ? 'aspect-[16/9]' : 'aspect-[16/10]')} />
      <div className="p-5 space-y-3">
        <div className="h-4 w-1/2 bg-neutral-800/30 rounded-full" />
        <div className="h-3 w-4/5 bg-neutral-800/20 rounded-full" />
      </div>
    </div>
  );
}

// ─── Hero Card ──────────────────────────────────────────────────────────────

interface HeroCardProps {
  app: any;
  variant: 'primary' | 'secondary';
  hasAccess: boolean;
  onOpen: (app: any) => void;
}

function HeroCard({ app, variant, hasAccess, onOpen }: HeroCardProps) {
  const isPrimary = variant === 'primary';
  const isPremium = app.badgeVariant === 'premium' || app.badgeVariant === 'featured';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen(app)}
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer',
        'border border-neutral-800 hover:border-white/15',
        'transition-all duration-500 hover:shadow-2xl hover:shadow-brand-cyan/5',
        isPrimary ? 'lg:col-span-2 lg:row-span-2' : ''
      )}
    >
      <div
        className={cn('relative overflow-hidden', isPrimary ? 'aspect-[16/9]' : 'aspect-[16/10]')}
      >
        {app.thumbnail ? (
          <img
            src={app.thumbnail}
            alt={app.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
            <ImageIcon size={48} className="text-neutral-800" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-neutral-950/10" />

        <div className="absolute inset-0 flex flex-col justify-end p-5 lg:p-7">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {isPremium && (
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan">
                  Pro
                </span>
              )}
            </div>
            <h3
              className={cn('font-bold text-white', isPrimary ? 'text-2xl lg:text-3xl' : 'text-lg')}
            >
              {app.name}
            </h3>
            <p
              className={cn(
                'text-neutral-400 leading-relaxed line-clamp-2',
                isPrimary ? 'text-sm max-w-lg' : 'text-xs'
              )}
            >
              {app.description || app.desc}
            </p>

            <div className="pt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan group-hover:text-white transition-colors">
                Open app{' '}
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </span>
              {isPremium && !hasAccess && (
                <span className="text-xs text-neutral-600 flex items-center gap-1">
                  <Lock size={10} /> Requires Pro
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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

function AppCard({ app, isAdmin, hasAccess, onOpen, onEdit }: AppCardProps) {
  const isComingSoon = app.badgeVariant === 'comingSoon';
  const isPremium = app.badgeVariant === 'premium';
  const isAlpha = (app as any).alpha === true;
  const isExternal = app.isExternal;
  const description = app.description || app.desc;

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
        'transition-all duration-300 outline-none',
        'hover:border-white/10 hover:bg-white/[0.035] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20',
        'focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
        isComingSoon && 'opacity-30 grayscale pointer-events-none',
        app.isHidden && 'border-warning/20 opacity-60'
      )}
    >
      {app.isHidden && (
        <div className="absolute top-0 right-0 z-50 bg-warning/90 text-black px-2.5 py-0.5 text-[10px] font-semibold rounded-bl-xl">
          Hidden
        </div>
      )}

      {/* Thumbnail */}
      <div className="aspect-[16/10] relative overflow-hidden bg-neutral-900/40">
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
              <ImageIcon size={32} strokeWidth={1.2} />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-800">
            <ImageIcon size={32} strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-transparent to-transparent opacity-80" />

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-neutral-950/40 backdrop-blur-[3px]">
          <span className="text-sm font-medium text-white px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center gap-2 shadow-lg">
            {isExternal ? 'Launch' : 'Open'}
            {isExternal ? <ExternalLink size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>

        {/* Top-right badge */}
        {isPremium && !hasAccess && (
          <div className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 text-brand-cyan">
            <Lock size={12} />
          </div>
        )}
        {isExternal && !(isPremium && !hasAccess) && (
          <div className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 text-neutral-400">
            <ExternalLink size={12} />
          </div>
        )}
      </div>

      {/* Admin Edit */}
      {isAdmin && (
        <div className="absolute top-3 left-3 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(app);
            }}
            className="p-2 rounded-xl bg-neutral-950/50 backdrop-blur-md border border-white/10 text-brand-cyan hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
          >
            <Edit3 size={12} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-neutral-100 group-hover:text-white transition-colors leading-snug">
            {app.name}
          </h3>
          {isComingSoon ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-neutral-600 shrink-0">
              Soon
            </span>
          ) : app.badgeVariant === 'free' || (app as any).free ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success/80 shrink-0">
              Free
            </span>
          ) : isPremium ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan/80 shrink-0">
              Pro
            </span>
          ) : null}
          {isAlpha && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400/80 border border-violet-500/20 shrink-0">
              Alpha
            </span>
          )}
        </div>
        <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-2 flex-1">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Compact Row (no thumbnail) ────────────────────────────────────────────

interface AppRowProps {
  app: any;
  isAdmin: boolean;
  hasAccess: boolean;
  onOpen: (app: any) => void;
  onEdit: (app: any) => void;
}

function AppRow({ app, isAdmin, hasAccess, onOpen, onEdit }: AppRowProps) {
  const isComingSoon = app.badgeVariant === 'comingSoon';
  const isPremium = app.badgeVariant === 'premium';
  const isAlpha = (app as any).alpha === true;
  const isExternal = app.isExternal;
  const description = app.description || app.desc;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
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
        'group flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-white/[0.03] border border-neutral-800/60',
        'transition-all duration-200 outline-none cursor-pointer',
        'hover:border-white/10 hover:bg-white/5',
        'focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
        isComingSoon && 'opacity-30 grayscale pointer-events-none',
        app.isHidden && 'border-warning/20 opacity-60'
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <h4 className="text-[13px] font-medium text-neutral-300 group-hover:text-white transition-colors truncate shrink-0">
          {app.name}
        </h4>
        {isComingSoon ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-neutral-600 shrink-0">
            Soon
          </span>
        ) : app.badgeVariant === 'free' || (app as any).free ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success/80 shrink-0">
            Free
          </span>
        ) : isPremium ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan/80 shrink-0">
            Pro
          </span>
        ) : null}
        {isAlpha && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400/80 border border-violet-500/20 shrink-0">
            Alpha
          </span>
        )}
        <p className="text-[12px] text-neutral-600 truncate hidden sm:block">{description}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(app);
            }}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-brand-cyan hover:bg-white/5 transition-all"
          >
            <Edit3 size={12} />
          </button>
        )}
        {isPremium && !hasAccess && <Lock size={12} className="text-neutral-600" />}
        {isExternal ? (
          <ExternalLink
            size={12}
            className="text-neutral-600 group-hover:text-neutral-400 transition-colors"
          />
        ) : (
          <ChevronRight
            size={12}
            className="text-neutral-600 group-hover:text-neutral-400 group-hover:translate-x-0.5 transition-all"
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Category Section Header ────────────────────────────────────────────────

function CategoryHeader({ category, count }: { category: CategoryDef; count: number }) {
  const Icon = category.icon;
  return (
    <div className="flex items-end justify-between gap-4 mb-1">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/5 border border-neutral-800">
            <Icon size={16} className="text-neutral-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-200">{category.label}</h2>
            <p className="text-xs text-neutral-600">{category.description}</p>
          </div>
        </div>
      </div>
      <span className="text-xs text-neutral-700 pb-0.5">
        {count} {count === 1 ? 'app' : 'apps'}
      </span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export const AppsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess } = usePremiumAccess();
  const { onSubscriptionModalOpen, user } = useLayout();
  const isAdmin = user?.isAdmin === true;

  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingApp, setEditingApp] = useState<AppConfig | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'recent'>('default');
  const tabBarRef = useRef<HTMLDivElement>(null);

  // ─── Static apps config ─────────────────────────────────────────────────

  const staticAppsData = useMemo(
    () => [
      // Pro Tools
      {
        id: 'mockup-machine',
        name: t('apps.mockupMachine.name'),
        desc: t('apps.mockupMachine.description'),
        link: '/',
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
        category: 'free',
        free: true,
      },
      {
        id: 'instagram-extractor',
        name: t('apps.instagramExtractor.name'),
        desc: t('apps.instagramExtractor.description'),
        link: '/extractor',
        thumbnail: '/tools/instagram-extractor.webp',
        badge: 'NEW',
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
        badge: 'NEW',
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
        name: 'Content Studio',
        desc: '1 brief → all social media assets with copy, images & brand consistency',
        link: '/content-studio',
        badge: 'BETA',
        badgeVariant: 'free',
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
        badge: 'NEW',
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
        badge: 'NEW',
        badgeVariant: 'free',
        category: 'creative',
        free: true,
        alpha: true,
      },
      {
        id: 'image-lab',
        name: 'Image Lab',
        desc: 'Halftone, texture overlay, and risograph effects in one unified editor. Switch modes instantly without reloading.',
        link: '/image-lab',
        thumbnail: '/tools/cmyk-halftone.webp',
        badge: 'NEW',
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
        name: 'Image Compressor',
        desc: 'Compress images with quality and format control. Batch supported.',
        link: '/compress',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/compress.webp',
        category: 'image',
        free: true,
      },
      {
        id: 'upscale',
        name: 'Bicubic Upscale',
        desc: 'Upscale images 2x–4x with sharpening control.',
        link: '/upscale',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/upscale.webp',
        category: 'image',
        free: true,
        alpha: true,
      },
      {
        id: 'remove-bg',
        name: 'Background Remover',
        desc: 'Remove backgrounds with AI or simple mode. Batch supported.',
        link: '/remove-bg',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/remove-bg.webp',
        category: 'image',
        free: true,
      },
      {
        id: 'watermark',
        name: 'Watermark',
        desc: 'Add text or logo watermarks with position, opacity and tile mode.',
        link: '/watermark',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/watermark.webp',
        category: 'image',
        free: true,
      },
      {
        id: 'visual-search',
        name: 'Visual Search',
        desc: 'Reverse image search across multiple sources.',
        link: '/visual-search',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/visual-search.webp',
        category: 'image',
        free: true,
        alpha: true,
      },
      // Converters
      {
        id: 'converter',
        name: 'File Converter',
        desc: 'Convert images between PNG, JPG, WebP, PDF and ICO.',
        link: '/converter',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/file-converter.webp',
        category: 'converters',
        free: true,
      },
      {
        id: 'svg-optimizer',
        name: 'SVG Optimizer',
        desc: 'Optimize and minify SVG files. Remove metadata, comments and empty groups.',
        link: '/svg-optimizer',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/svg-optimizer.webp',
        category: 'converters',
        free: true,
      },
      {
        id: 'color-converter',
        name: 'Color Converter',
        desc: 'Convert colors between HEX, RGB, CMYK, HSL with WCAG contrast check.',
        link: '/color-converter',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/color-converter.webp',
        category: 'converters',
        free: true,
      },
      // Generators
      {
        id: 'qrcode',
        name: 'QR Code Generator',
        desc: 'Generate QR codes with custom size, colors and error correction.',
        link: '/qrcode',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/qrcode.webp',
        category: 'generators',
        free: true,
      },
      {
        id: 'favicon',
        name: 'Favicon Generator',
        desc: 'Generate all favicon sizes, apple-touch-icon and web manifest from one image.',
        link: '/favicon',
        badge: 'Free',
        badgeVariant: 'free',
        thumbnail: '/tools/favicon.webp',
        category: 'generators',
        free: true,
      },
      {
        id: 'og-image',
        name: 'OG Image Generator',
        desc: 'Create Open Graph images with templates, custom text and colors.',
        link: '/og-image',
        badge: 'Free',
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
        name: 'Labs',
        desc: 'Generative design experiments and mini-tools. Wind tunnels, reaction diffusion, and more.',
        link: '/labs',
        thumbnail: '/tools/labs.webp',
        badge: 'NEW',
        badgeVariant: 'free',
        category: 'community',
        free: true,
      },

      // Admin
      {
        id: 'smart-analyzer',
        name: 'Smart Analyzer',
        desc: 'AI-powered image analysis. Auto-detects image type and generates optimized prompts for Figma plugin or image generation.',
        link: '/admin/smart-analyzer',
        thumbnail: '/tools/smart-analyzer.webp',
        badge: 'ADMIN',
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

  // ─── Featured apps for hero (explicit order) ───────────────────────────

  const HERO_ORDER = ['canvas', 'brand-guidelines', '3d-studio', 'cmyk-halftone'];

  const heroApps = useMemo(() => {
    const byId = new Map(apps.map((a) => [(a as any).id || a.appId, a]));
    return HERO_ORDER.map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, 3);
  }, [apps]);

  // ─── Filtered & Sorted ────────────────────────────────────────────────

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase().trim();

    return apps.filter((app) => {
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
  }, [apps, isAdmin, search, activeCategory, accessFilter]);

  const sortedApps = useMemo(() => {
    const sorted = [...filteredApps];
    if (sortBy === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'recent') {
      const lu = getLastUsed();
      sorted.sort((a, b) => {
        const aId = (a as any).id || a.appId;
        const bId = (b as any).id || b.appId;
        return (lu[bId] ?? 0) - (lu[aId] ?? 0);
      });
    }
    return sorted;
  }, [filteredApps, sortBy]);

  const appsByCategory = useMemo(() => {
    const categoriesToShow = activeCategory
      ? categories.filter((c) => c.key === activeCategory)
      : categories;

    return categoriesToShow
      .map((cat) => ({
        ...cat,
        apps: sortedApps.filter((a) => a.category === cat.key),
      }))
      .filter((cat) => cat.apps.length > 0);
  }, [sortedApps, categories, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    apps.forEach((app) => {
      if (app.isHidden && !isAdmin) return;
      if ((app as any).adminOnly && !isAdmin) return;
      counts[app.category] = (counts[app.category] || 0) + 1;
    });
    return counts;
  }, [apps, isAdmin]);

  const totalApps = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const hasActiveFilters = !!search || !!activeCategory || accessFilter !== 'all';

  // ─── Handlers ─────────────────────────────────────────────────────────

  const openApp = (app: any) => {
    if (app.badgeVariant === 'comingSoon') return;
    if (app.badgeVariant === 'premium' && !hasAccess) {
      onSubscriptionModalOpen();
      return;
    }
    const appId = app.id || app.appId;
    if (appId) recordLastUsed(appId);
    if (app.isExternal) window.open(app.link, '_blank');
    else navigate(app.link);
  };

  const clearFilters = () => {
    setSearch('');
    setActiveCategory(null);
    setAccessFilter('all');
  };

  const showHero = !hasActiveFilters && sortBy === 'default';

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <PageShell
      pageId="apps"
      seoTitle={t('apps.seoTitle')}
      seoDescription={t('apps.seoDescription')}
      title={t('apps.title')}
      microTitle="Platform // Tools"
      description="Explore our creative toolkit — from pro design tools to free experiments."
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
            <Plus size={14} /> Add App
          </Button>
        ) : undefined
      }
    >
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      {showHero && !isLoading && heroApps.length >= 3 && (
        <section className="mb-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            <HeroCard app={heroApps[0]} variant="primary" hasAccess={hasAccess} onOpen={openApp} />
            <div className="flex flex-col gap-3 lg:gap-4">
              <HeroCard
                app={heroApps[1]}
                variant="secondary"
                hasAccess={hasAccess}
                onOpen={openApp}
              />
              <HeroCard
                app={heroApps[2]}
                variant="secondary"
                hasAccess={hasAccess}
                onOpen={openApp}
              />
            </div>
          </div>
        </section>
      )}

      {/* ─── Navigation Bar ────────────────────────────────────────────── */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-10 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 -mx-1 px-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition-all',
                !activeCategory
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
              )}
            >
              All
              <span
                className={cn(
                  'text-[11px] px-1.5 py-0.5 rounded-full',
                  !activeCategory ? 'bg-white/10 text-neutral-300' : 'text-neutral-600'
                )}
              >
                {totalApps}
              </span>
            </button>

            {categories.map((cat) => {
              const Icon = cat.icon;
              const count = categoryCounts[cat.key] || 0;
              if (count === 0 && cat.key !== 'admin') return null;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition-all',
                    activeCategory === cat.key
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
                  )}
                >
                  <Icon size={14} />
                  {cat.label}
                  <span
                    className={cn(
                      'text-[11px] px-1.5 py-0.5 rounded-full',
                      activeCategory === cat.key
                        ? 'bg-white/10 text-neutral-300'
                        : 'text-neutral-600'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="w-px h-5 bg-white/5 mx-2 shrink-0 hidden sm:block" />

            {/* Access filter pills */}
            <button
              onClick={() => setAccessFilter(accessFilter === 'free' ? 'all' : 'free')}
              className={cn(
                'px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-all hidden sm:block',
                accessFilter === 'free'
                  ? 'bg-success/10 text-success font-medium'
                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]'
              )}
            >
              Free
            </button>
            <button
              onClick={() => setAccessFilter(accessFilter === 'premium' ? 'all' : 'premium')}
              className={cn(
                'px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-all hidden sm:block',
                accessFilter === 'premium'
                  ? 'bg-brand-cyan/10 text-brand-cyan font-medium'
                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]'
              )}
            >
              Pro
            </button>
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps..."
                className="w-full pl-9 pr-9 py-2 text-sm bg-white/[0.03] border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-white/15 focus:bg-white/5 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
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
                sortBy === 'recent' ? 'Most used first' : sortBy === 'name' ? 'Sorted A–Z' : 'Sort'
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
                {sortBy === 'recent' ? 'Most used' : sortBy === 'name' ? 'A–Z' : 'Sort'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Content ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-14">
          {showHero && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
              <AppCardSkeleton large />
              <div className="flex flex-col gap-3 lg:gap-4">
                <AppCardSkeleton />
                <AppCardSkeleton />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <AppCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : appsByCategory.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5 text-center py-20">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-neutral-800">
            <PackageOpen size={48} strokeWidth={1.2} className="text-neutral-700" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-neutral-400">
              {search ? 'No results found' : 'No apps in this category'}
            </h3>
            <p className="text-sm text-neutral-600 max-w-sm">
              {search
                ? `We couldn't find anything matching "${search}". Try a different term.`
                : 'Try selecting a different category or clearing your filters.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-brand-cyan hover:text-white transition-colors flex items-center gap-1.5 mt-2"
            >
              <X size={14} /> Clear all filters
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory}-${accessFilter}-${sortBy}`}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.035 } },
            }}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="space-y-14"
          >
            {(() => {
              const cardCategories = appsByCategory.filter((c) => !COMPACT_CATEGORIES.has(c.key));
              const compactCategories = appsByCategory.filter((c) => COMPACT_CATEGORIES.has(c.key));

              return (
                <>
                  {/* Card categories (Pro, Creative) — full-width with thumbnails */}
                  {cardCategories.map((category) => {
                    const withThumb = category.apps.filter((a) => a.thumbnail);
                    const withoutThumb = category.apps.filter((a) => !a.thumbnail);

                    return (
                      <section key={category.key}>
                        <CategoryHeader category={category} count={category.apps.length} />

                        {withThumb.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-5">
                            {withThumb.map((app) => (
                              <AppCard
                                key={app.id || app.appId}
                                app={app}
                                isAdmin={isAdmin}
                                hasAccess={hasAccess}
                                onOpen={openApp}
                                onEdit={(a) => {
                                  setEditingApp(a);
                                  setIsDialogOpen(true);
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {withoutThumb.length > 0 && (
                          <div className={cn('space-y-1.5', withThumb.length > 0 && 'mt-5')}>
                            {withoutThumb.map((app) => (
                              <AppRow
                                key={app.id || app.appId}
                                app={app}
                                isAdmin={isAdmin}
                                hasAccess={hasAccess}
                                onOpen={openApp}
                                onEdit={(a) => {
                                  setEditingApp(a);
                                  setIsDialogOpen(true);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}

                  {/* Compact categories (Utilities, Audio, Community) — 2-column grid */}
                  {compactCategories.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
                      {compactCategories.map((category) => (
                        <section key={category.key}>
                          <CategoryHeader category={category} count={category.apps.length} />
                          <div className="space-y-1.5 mt-5">
                            {category.apps.map((app) => (
                              <AppRow
                                key={app.id || app.appId}
                                app={app}
                                isAdmin={isAdmin}
                                hasAccess={hasAccess}
                                onOpen={openApp}
                                onEdit={(a) => {
                                  setEditingApp(a);
                                  setIsDialogOpen(true);
                                }}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>
      )}

      <AppEditDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        app={editingApp}
        onSaved={fetchApps}
      />
    </PageShell>
  );
};
