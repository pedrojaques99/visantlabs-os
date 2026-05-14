import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { PageShell } from '../components/ui/PageShell';
import { cn } from '../lib/utils';
import {
  ExternalLink,
  Lock,
  Diamond,
  Zap,
  Image as ImageIcon,
  Edit3,
  Plus,
  Database,
  ShieldCheck,
  PackageOpen,
  ArrowUpDown,
} from 'lucide-react';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { motion } from 'framer-motion';
import { appsService, AppConfig } from '@/services/appsService';
import { AppEditDialog } from '@/components/AppEditDialog';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { SearchBar } from '@/components/ui/SearchBar';
import { toast } from 'sonner';

function AppCardSkeleton() {
  return (
    <div className="rounded-[--radius] overflow-hidden bg-white/[0.02] border border-white/10 animate-pulse">
      <div className="aspect-[16/10] bg-neutral-800/30" />
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-2/3 bg-neutral-800/40 rounded" />
          <div className="h-3 w-full bg-neutral-800/30 rounded" />
          <div className="h-3 w-4/5 bg-neutral-800/30 rounded" />
        </div>
        <div className="pt-3 border-t border-white/[0.03]">
          <div className="h-4 w-16 bg-neutral-800/30 rounded" />
        </div>
      </div>
    </div>
  );
}

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
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'free'>('default');

  const staticAppsData = useMemo(() => [
    { id: 'mockup-machine', name: t('apps.mockupMachine.name'), desc: t('apps.mockupMachine.description'), link: '/', badge: t('apps.badge.featured'), badgeVariant: 'featured', thumbnail: '/tools/mockup-machine.webp', category: 'mockup', free: false, span: 'lg:col-span-2 lg:row-span-1' },
    { id: 'branding-machine', name: t('apps.brandingMachine.name'), desc: t('apps.brandingMachine.description'), link: '/branding-machine', badge: t('apps.badge.premium'), badgeVariant: 'premium', thumbnail: '/tools/branding-machine.webp', category: 'design', free: false, span: 'lg:col-span-2 lg:row-span-1' },
    { id: 'brand-guidelines', name: t('apps.brandGuidelines.name'), desc: t('apps.brandGuidelines.description'), link: '/brand-guidelines', badge: t('apps.badge.premium'), badgeVariant: 'premium', thumbnail: '/tools/brand-guidelines.webp', category: 'design', free: false, span: 'lg:col-span-2 lg:row-span-1' },
    { id: 'canvas', name: t('apps.canvas.name'), desc: t('apps.canvas.description'), link: '/canvas', badge: t('apps.badge.premium'), badgeVariant: 'premium', thumbnail: '/tools/canvas.webp', category: 'design', free: false, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'budget-machine', name: t('apps.budgetMachine.name'), desc: t('apps.budgetMachine.description'), link: '/budget-machine', badge: t('apps.badge.comingSoon'), badgeVariant: 'comingSoon', thumbnail: '/tools/budget-machine.webp', category: 'design', free: false, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'colorfy', name: t('apps.colorfy.name'), desc: t('apps.colorfy.description'), link: 'https://gradient-machine.vercel.app/', badge: t('apps.badge.free'), badgeVariant: 'free', thumbnail: '/tools/color-extractor.webp', category: 'design', isExternal: true, free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'halftone-machine', name: t('apps.halftoneMachine.name'), desc: t('apps.halftoneMachine.description'), link: 'https://pedrojaques99.github.io/halftone-machine/', badge: t('apps.badge.free'), badgeVariant: 'free', thumbnail: '/tools/halftone-machine.webp', isExternal: true, category: 'effects', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'youtube-mixer', name: t('apps.youtubeMixer.name'), desc: t('apps.youtubeMixer.description'), link: '/youtube-mixer', thumbnail: '/tools/youtube-mixer.webp', badge: t('apps.badge.free'), badgeVariant: 'free', category: 'audio', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'ascii-vortex', name: t('apps.asciiVortex.name'), desc: t('apps.asciiVortex.description'), link: '/ascii-vortex', thumbnail: '/tools/ascii-vortex.webp', badge: t('apps.badge.free'), badgeVariant: 'free', category: 'effects', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'grid-paint', name: t('apps.gridPaint.name'), desc: t('apps.gridPaint.description'), link: '/grid-paint', thumbnail: '/tools/gridpaint.webp', badge: t('apps.badge.free'), badgeVariant: 'free', category: 'effects', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: '3d-studio', name: t('apps.studio3d.name'), desc: t('apps.studio3d.description'), link: '/3d-studio', thumbnail: '/tools/3d-studio.webp', badge: 'NEW', badgeVariant: 'free', category: 'effects', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'cmyk-halftone', name: t('apps.cmykHalftone.name'), desc: t('apps.cmykHalftone.description'), link: '/cmyk-halftone', thumbnail: '/tools/cmyk-halftone.webp', badge: 'NEW', badgeVariant: 'free', category: 'effects', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'grid-machine', name: t('apps.gridMachine.name'), desc: t('apps.gridMachine.description'), link: '/grid-machine', thumbnail: '/tools/grid-machine.svg', badge: 'NEW', badgeVariant: 'free', category: 'design', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'instagram-extractor', name: t('apps.instagramExtractor.name'), desc: t('apps.instagramExtractor.description'), link: '/extractor', thumbnail: '/tools/instagram-extractor.webp', badge: 'NEW', badgeVariant: 'premium', category: 'design', free: false, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'moodboard-studio', name: t('apps.moodboardStudio.name'), desc: t('apps.moodboardStudio.description'), link: '/moodboard', thumbnail: '/tools/moodboard-studio.webp', badge: 'NEW', badgeVariant: 'premium', category: 'design', free: false, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'ellipse-audio', name: t('apps.ellipseAudio.name'), desc: t('apps.ellipseAudio.description'), link: '/elipse-audio-freq', thumbnail: '/tools/elipse-audio.webp', badge: t('apps.badge.free'), badgeVariant: 'free', free: true, category: 'audio', span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'vsn-labs', name: t('apps.vsnLabs.name'), desc: t('apps.vsnLabs.description'), link: 'https://vsn-labs.vercel.app/', thumbnail: '/tools/vsn-labs.webp', badge: t('apps.badge.free'), badgeVariant: 'free', showExternalLink: true, category: 'experimental', isExternal: true, free: true, span: 'lg:col-span-2 lg:row-span-1' },
    { id: 'labs', name: 'Labs', desc: 'Generative design experiments and mini-tools. Wind tunnels, reaction diffusion, and more.', link: '/labs', thumbnail: '/tools/labs.webp', badge: 'NEW', badgeVariant: 'free', category: 'experimental', free: true, span: 'lg:col-span-1 lg:row-span-1' },
    { id: 'smart-analyzer', name: 'Smart Analyzer', desc: 'AI-powered image analysis. Auto-detects image type and generates optimized prompts for Figma plugin or image generation.', link: '/admin/smart-analyzer', thumbnail: '/tools/smart-analyzer.webp', badge: 'ADMIN', badgeVariant: 'admin', category: 'admin', free: false, adminOnly: true, span: 'lg:col-span-1 lg:row-span-1' },
  ], [t]);

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await appsService.getAll();

      const dbAppIds = new Set(data.map(app => app.appId));

      if (isAdmin) {
        const missingApps = staticAppsData.filter(app => !dbAppIds.has(app.id));
        if (missingApps.length > 0) {
          await appsService.seed(staticAppsData);
          const syncedData = await appsService.getAll();
          setApps(syncedData);
          return;
        }
      }

      const staticById = new Map(staticAppsData.map(a => [a.id, a]));

      const mergedDbApps = data.map(dbApp => {
        const s = staticById.get(dbApp.appId);
        if (!s) return dbApp;
        return {
          ...dbApp,
          name: s.name,
          description: (s as any).desc || (s as any).description,
          badge: s.badge,
          thumbnail: s.thumbnail,
        };
      });

      const missingStaticApps = staticAppsData
        .filter(app => !dbAppIds.has(app.id))
        .map(app => ({
          ...app,
          appId: app.id,
          description: (app as any).desc || (app as any).description,
        })) as any[];

      if (data.length === 0) {
        setApps(staticAppsData as any);
      } else {
        setApps([...mergedDbApps, ...missingStaticApps]);
      }
    } catch (error) {
      console.error('Error fetching apps:', error);
      setApps(staticAppsData as any);
      toast.error('Failed to load apps from database, using offline mode');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, staticAppsData]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const CATEGORIES = useMemo(() => {
    const categories = [
      { key: 'mockup', title: 'Mockup Labs', icon: Zap },
      { key: 'design', title: t('apps.brandingTools'), icon: Diamond },
      { key: 'effects', title: t('apps.effectsTools'), icon: ImageIcon },
      { key: 'audio', title: t('apps.audioTools'), icon: Zap },
      { key: 'experimental', title: 'Experimental', icon: Diamond },
    ];
    if (isAdmin) categories.push({ key: 'admin', title: 'Admin Tools', icon: ShieldCheck });
    return categories;
  }, [t, isAdmin]);

  const appsByCategory = useMemo(() => {
    const q = search.toLowerCase().trim();
    const categoriesToShow = activeCategory
      ? CATEGORIES.filter(c => c.key === activeCategory)
      : CATEGORIES;

    const result = categoriesToShow.map(cat => {
      let filtered = apps.filter(app => {
        if (app.isHidden && !isAdmin) return false;
        if (app.category !== cat.key) return false;
        if ((app as any).adminOnly && !isAdmin) return false;
        if (q) {
          const name = (app.name || '').toLowerCase();
          const desc = (app.description || (app as any).desc || '').toLowerCase();
          if (!name.includes(q) && !desc.includes(q)) return false;
        }
        return true;
      });

      if (sortBy === 'name') {
        filtered = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sortBy === 'free') {
        filtered = [...filtered].sort((a, b) => {
          const aFree = (a as any).free || a.badgeVariant === 'free' ? 0 : 1;
          const bFree = (b as any).free || b.badgeVariant === 'free' ? 0 : 1;
          return aFree - bFree;
        });
      }

      return { ...cat, apps: filtered };
    }).filter(cat => cat.apps.length > 0);

    return result;
  }, [apps, CATEGORIES, isAdmin, search, activeCategory, sortBy]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  const openApp = (app: any) => {
    const isComingSoon = app.badgeVariant === 'comingSoon';
    const isPremium = app.badgeVariant === 'premium';
    if (isComingSoon) return;
    if (isPremium && !hasAccess) { onSubscriptionModalOpen(); return; }
    if (app.isExternal) window.open(app.link, '_blank');
    else navigate(app.link);
  };

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
    if (fallback) fallback.style.display = 'flex';
  };

  const adminActions = isAdmin && (
    <Button
      onClick={() => { setEditingApp(undefined); setIsDialogOpen(true); }}
      variant="ghost"
      className="h-9 px-4 gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-brand-cyan hover:bg-brand-cyan/5"
    >
      <Plus size={14} />
      Add New App
    </Button>
  );

  return (
    <PageShell
      pageId="apps"
      seoTitle={t('apps.seoTitle')}
      seoDescription={t('apps.seoDescription')}
      title={t('apps.title')}
      microTitle="Systems // Library"
      description={t('apps.subtitle')}
      breadcrumb={[
        { label: t('apps.home'), to: '/' },
        { label: t('apps.title') }
      ]}
      actions={adminActions}
    >
      {/* Search, Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('apps.searchPlaceholder') !== 'apps.searchPlaceholder' ? t('apps.searchPlaceholder') : 'Search apps...'}
          containerClassName="w-full sm:w-64"
        />

        <div className="flex items-center gap-2 flex-wrap flex-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-md border transition-all',
              !activeCategory
                ? 'border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5'
                : 'border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/20'
            )}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-md border transition-all',
                activeCategory === cat.key
                  ? 'border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5'
                  : 'border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/20'
              )}
            >
              {cat.title}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortBy(prev => prev === 'default' ? 'name' : prev === 'name' ? 'free' : 'default')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-md border border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/20 transition-all shrink-0"
        >
          <ArrowUpDown size={10} />
          {sortBy === 'default' ? 'Default' : sortBy === 'name' ? 'A–Z' : 'Free first'}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-16">
          {[0, 1].map(i => (
            <section key={i} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-7 w-36 bg-neutral-800/30 rounded-md animate-pulse" />
                <div className="h-px flex-grow bg-white/[0.03]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {Array.from({ length: i === 0 ? 3 : 6 }).map((_, j) => (
                  <AppCardSkeleton key={j} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : appsByCategory.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <PackageOpen size={64} strokeWidth={1} className="text-neutral-700" />
          <h3 className="text-xl font-mono uppercase tracking-widest text-neutral-400">
            {search || activeCategory ? 'No apps found' : 'No apps available'}
          </h3>
          <p className="text-sm text-neutral-600 max-w-md">
            {search || activeCategory ? 'Try a different search or filter.' : t('apps.subtitle')}
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-16"
        >
          {appsByCategory.map((category) => (
            <section key={category.key} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.02] border border-white/10">
                  <category.icon size={12} className="text-brand-cyan" />
                  <MicroTitle className="text-neutral-400">{category.title}</MicroTitle>
                </div>
                <div className="h-px flex-grow bg-white/[0.03]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {category.apps.map((app) => {
                  const isComingSoon = app.badgeVariant === 'comingSoon';
                  const isPremium = app.badgeVariant === 'premium';
                  const description = app.description || (app as any).desc;
                  const thumbnail = app.thumbnail;

                  return (
                    <motion.div
                      key={app.id || app.appId}
                      variants={itemVariants}
                      role="button"
                      tabIndex={isComingSoon ? -1 : 0}
                      aria-label={app.name}
                      onClick={() => openApp(app)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openApp(app); } }}
                      className={cn(
                        'group relative rounded-[--radius] overflow-hidden flex flex-col',
                        'bg-white/[0.02] border border-white/10 backdrop-blur-sm',
                        'transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/50 focus-visible:border-brand-cyan/30',
                        !isComingSoon
                          ? 'hover:border-brand-cyan/30 cursor-pointer'
                          : 'opacity-40 grayscale pointer-events-none',
                        app.isHidden && 'border-amber-500/20 opacity-60',
                      )}
                    >
                      {app.isHidden && (
                        <div className="absolute top-0 right-0 z-50 bg-amber-500/90 text-black px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-bl-md">
                          Hidden
                        </div>
                      )}

                      {/* Thumbnail */}
                      <div className="aspect-[16/10] relative overflow-hidden bg-neutral-900/40 border-b border-white/[0.03]">
                        {thumbnail ? (
                          <>
                            <img
                              src={thumbnail}
                              alt={app.name}
                              loading="lazy"
                              onError={handleImgError}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="w-full h-full items-center justify-center text-neutral-700 hidden">
                              <ImageIcon size={40} strokeWidth={1.2} />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-700">
                            <ImageIcon size={40} strokeWidth={1.2} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent opacity-70 group-hover:opacity-50 transition-opacity" />

                        {isPremium && !hasAccess && (
                          <div className="absolute top-3 right-3 z-20">
                            <div className="p-2 rounded-full bg-neutral-950/60 backdrop-blur-md border border-white/10 text-brand-cyan">
                              <Lock size={12} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Admin Controls */}
                      {isAdmin && (
                        <div className="absolute top-3 left-3 z-30 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingApp(app);
                              setIsDialogOpen(true);
                            }}
                            className="p-2 rounded-full bg-neutral-950/60 backdrop-blur-md border border-white/10 text-brand-cyan hover:scale-110 active:scale-95 transition-all"
                            title="Edit App"
                          >
                            <Edit3 size={12} />
                          </button>
                          {app.databaseInfo && (
                            <div
                              className="px-2 py-1 rounded-full bg-brand-cyan/5 border border-brand-cyan/20 text-brand-cyan flex items-center gap-1.5"
                              title={app.databaseInfo}
                            >
                              <Database size={10} />
                              <span className="text-[10px] font-mono font-bold truncate max-w-[80px]">
                                {app.databaseInfo}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Body */}
                      <div className="p-5 space-y-4 flex-1 flex flex-col">
                        <div className="space-y-1.5 flex-1">
                          <h3 className="text-base font-bold text-neutral-200 group-hover:text-brand-cyan transition-colors tracking-tight">
                            {app.name}
                          </h3>
                          <p className="text-[11px] font-mono text-neutral-500 leading-relaxed line-clamp-2 min-h-[32px]">
                            {description}
                          </p>
                        </div>

                        <div className="pt-3 flex items-center justify-between border-t border-white/[0.03] mt-auto">
                          <div className="flex gap-2">
                            {isPremium && !hasAccess ? (
                              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-md border border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5 flex items-center gap-1.5">
                                <Lock size={8} /> Premium
                              </span>
                            ) : app.badge && (
                              <span className={cn(
                                'text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-md border',
                                app.badgeVariant === 'featured' && 'border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5',
                                app.badgeVariant === 'premium' && 'border-brand-cyan/20 text-brand-cyan/80 bg-brand-cyan/5',
                                app.badgeVariant === 'free' && 'border-white/10 text-neutral-500',
                                app.badgeVariant === 'comingSoon' && 'border-white/5 text-neutral-600',
                                app.badgeVariant === 'admin' && 'border-amber-500/30 text-amber-400 bg-amber-500/5',
                              )}>
                                {app.badge}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-600 group-hover:text-brand-cyan transition-colors">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                              {(app as any).isExternal ? 'Launch' : 'Enter'}
                            </span>
                            <ExternalLink size={10} className="translate-x-1 group-hover:translate-x-0 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </motion.div>
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
