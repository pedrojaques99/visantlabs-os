import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { SEO } from '../components/SEO';
import { Badge } from '../components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { cn } from '../lib/utils';
import { ExternalLink, Lock, Sparkles, Zap, Image as ImageIcon, Edit3, Plus, Database, Wand2, ShieldCheck } from 'lucide-react';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { appsService, AppConfig } from '@/services/appsService';
import { AppEditDialog } from '@/components/AppEditDialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const AppsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess, isLoading: isAccessLoading } = usePremiumAccess();
  const { onSubscriptionModalOpen, user } = useLayout();
  const isAdmin = user?.isAdmin === true;

  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingApp, setEditingApp] = useState<AppConfig | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const staticAppsData = useMemo(() => [
    {
      id: 'mockup-machine',
      name: t('apps.mockupMachine.name'),
      desc: t('apps.mockupMachine.description'),
      link: '/',
      badge: t('apps.badge.featured'),
      badgeVariant: 'featured',
      thumbnail: '/tools/mockup-machine.png',
      category: 'mockup',
      free: false,
      span: 'lg:col-span-2 lg:row-span-1'
    },
    {
      id: 'branding-machine',
      name: t('apps.brandingMachine.name'),
      desc: t('apps.brandingMachine.description'),
      link: '/branding-machine',
      badge: t('apps.badge.premium'),
      badgeVariant: 'premium',
      thumbnail: '/tools/branding-machine.png',
      category: 'design',
      free: false,
      span: 'lg:col-span-2 lg:row-span-1'
    },
    {
      id: 'brand-guidelines',
      name: t('apps.brandGuidelines.name'),
      desc: t('apps.brandGuidelines.description'),
      link: '/brand-guidelines',
      badge: t('apps.badge.premium'),
      badgeVariant: 'premium',
      thumbnail: '/tools/brand-guidelines.png',
      category: 'design',
      free: false,
      span: 'lg:col-span-2 lg:row-span-1'
    },
    {
      id: 'canvas',
      name: t('apps.canvas.name'),
      desc: t('apps.canvas.description'),
      link: '/canvas',
      badge: t('apps.badge.premium'),
      badgeVariant: 'premium',
      thumbnail: '/tools/canvas.png',
      category: 'design',
      free: false,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'budget-machine',
      name: t('apps.budgetMachine.name'),
      desc: t('apps.budgetMachine.description'),
      link: '/budget-machine',
      badge: t('apps.badge.comingSoon'),
      badgeVariant: 'comingSoon',
      thumbnail: '/tools/budget-machine.png',
      category: 'design',
      free: false,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'colorfy',
      name: t('apps.colorfy.name'),
      desc: t('apps.colorfy.description'),
      link: 'https://gradient-machine.vercel.app/',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      thumbnail: '/tools/color-extractor.png',
      category: 'design',
      isExternal: true,
      free: true,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'halftone-machine',
      name: t('apps.halftoneMachine.name'),
      desc: t('apps.halftoneMachine.description'),
      link: 'https://pedrojaques99.github.io/halftone-machine/',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      thumbnail: '/tools/halftone-machine.png',
      isExternal: true,
      category: 'effects',
      free: true,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'youtube-mixer',
      name: t('apps.youtubeMixer.name'),
      desc: t('apps.youtubeMixer.description'),
      link: '/youtube-mixer',
      thumbnail: '/tools/youtube-mixer.png',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      category: 'audio',
      free: true,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'ascii-vortex',
      name: t('apps.asciiVortex.name'),
      desc: t('apps.asciiVortex.description'),
      link: '/ascii-vortex',
      thumbnail: '/tools/ascii-vortex.png',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      category: 'effects',
      free: true,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'grid-paint',
      name: t('apps.gridPaint.name'),
      desc: t('apps.gridPaint.description'),
      link: '/grid-paint',
      thumbnail: '/tools/gridpaint.png',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      category: 'effects',
      free: true,
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'ellipse-audio',
      name: t('apps.ellipseAudio.name'),
      desc: t('apps.ellipseAudio.description'),
      link: '/elipse-audio-freq',
      thumbnail: '/tools/elipse-audio.png',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      free: true,
      category: 'audio',
      span: 'lg:col-span-1 lg:row-span-1'
    },
    {
      id: 'vsn-labs',
      name: t('apps.vsnLabs.name'),
      desc: t('apps.vsnLabs.description'),
      link: 'https://vsn-labs.vercel.app/',
      thumbnail: '/tools/vsn-labs.png',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      showExternalLink: true,
      category: 'experimental',
      isExternal: true,
      free: true,
      span: 'lg:col-span-2 lg:row-span-1'
    },
    // Admin-only tools
    {
      id: 'smart-analyzer',
      name: 'Smart Analyzer',
      desc: 'AI-powered image analysis. Auto-detects image type and generates optimized prompts for Figma plugin or image generation.',
      link: '/admin/smart-analyzer',
      thumbnail: '/tools/smart-analyzer.png',
      badge: 'ADMIN',
      badgeVariant: 'admin',
      category: 'admin',
      free: false,
      adminOnly: true,
      span: 'lg:col-span-1 lg:row-span-1'
    }
  ], [t]);

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await appsService.getAll();
      
      // Auto seed if missing any app and user is admin
      if (isAdmin && data.length < staticAppsData.length) {
        // Find which apps are missing by checking appId
        const dbAppIds = new Set(data.map(app => app.appId));
        const missingApps = staticAppsData.filter(app => !dbAppIds.has(app.id));
        
        if (missingApps.length > 0) {
           console.log(`Syncing ${missingApps.length} missing apps to database...`);
           await appsService.seed(staticAppsData);
           const syncedData = await appsService.getAll();
           setApps(syncedData);
           return;
        }
      }

      if (data.length === 0) {
        // Fallback to static data if not admin and DB is empty
        setApps(staticAppsData as any);
      } else {
        setApps(data);
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
      { key: 'mockup', title: 'MOCKUP LABS //', icon: Zap },
      { key: 'design', title: t('apps.brandingTools'), icon: Sparkles },
      { key: 'effects', title: t('apps.effectsTools'), icon: ImageIcon },
      { key: 'audio', title: t('apps.audioTools'), icon: Zap },
      { key: 'experimental', title: 'EXPERIMENTAL //', icon: Sparkles },
    ];
    // Admin-only category
    if (isAdmin) {
      categories.push({ key: 'admin', title: 'ADMIN TOOLS //', icon: ShieldCheck });
    }
    return categories;
  }, [t, isAdmin]);

  const appsByCategory = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      apps: apps.filter(app => {
        // Filter out hidden apps for non-admins
        if (app.isHidden && !isAdmin) return false;
        // Filter by category
        if (app.category !== cat.key) return false;
        // Filter out admin-only apps for non-admins
        if ((app as any).adminOnly && !isAdmin) return false;
        return true;
      })
    })).filter(cat => cat.apps.length > 0);
  }, [apps, CATEGORIES, isAdmin]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <>
      <SEO
        title={t('apps.seoTitle')}
        description={t('apps.seoDescription')}
        keywords={t('apps.seoKeywords')}
      />
      <div className="min-h-screen bg-[#050505] text-neutral-300 relative overflow-hidden pb-32 pt-10 md:pt-14">
        {/* Dynamic Sexy Background */}
        <div className="fixed inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-cyan/10 blur-[120px] rounded-full opacity-20 animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full opacity-20" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
        </div>
        
        <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-20 flex justify-between items-end"
          >
            <div>
              <Breadcrumb className="mb-10">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/" className="text-neutral-500 hover:text-brand-cyan transition-colors text-[10px] font-mono tracking-[0.2em]">{t('apps.home')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-neutral-800" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-neutral-400 text-[10px] font-mono tracking-[0.2em] uppercase">{t('apps.title')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="space-y-6">
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-5xl md:text-8xl font-black font-redhatmono text-white tracking-tighter leading-[0.9] flex flex-col md:flex-row md:items-baseline gap-2"
                >
                  <span>{t('apps.title')}</span> <span className="bg-gradient-to-r from-brand-cyan to-brand-cyan/20 bg-clip-text text-transparent">/ LABS</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="text-neutral-400 font-mono text-sm max-w-xl leading-relaxed border-l border-brand-cyan/30 pl-6 py-1"
                >
                  {t('apps.subtitle')}
                </motion.p>
              </div>
            </div>

            {isAdmin && (
              <Button 
                onClick={() => {
                  setEditingApp(undefined);
                  setIsDialogOpen(true);
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[10px] tracking-widest gap-2 h-12 px-6 backdrop-blur-sm"
              >
                <Plus size={14} className="text-brand-cyan" />
                ADD NEW APP //
              </Button>
            )}
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-32"
          >
            {appsByCategory.map((category) => (
              <section key={category.key} className="space-y-12">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
                    <category.icon size={12} className="text-brand-cyan" />
                    <h2 className="text-[10px] uppercase font-mono tracking-[0.3em] text-neutral-300 font-bold whitespace-nowrap">
                      {category.title}
                    </h2>
                  </div>
                  <div className="h-[1px] flex-grow bg-gradient-to-r from-neutral-800/80 to-transparent" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {category.apps.map((app) => {
                    const isComingSoon = app.badgeVariant === 'comingSoon';
                    const isPremium = app.badgeVariant === 'premium';
                    const description = app.description || (app as any).desc;
                    const thumbnail = app.thumbnail;

                    return (
                      <motion.div
                        key={app.id || app.appId}
                        variants={itemVariants}
                        className={cn(
                          "group relative bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden transition-all duration-500",
                          !isComingSoon ? "hover:border-brand-cyan/30 hover:shadow-[0_0_40px_-15px_rgba(0,186,227,0.2)] cursor-pointer" : "opacity-40 grayscale pointer-events-none",
                          app.isHidden && "border-amber-500/20 opacity-60"
                        )}
                      >
                        {app.isHidden && (
                          <div className="absolute top-0 right-0 z-50 bg-amber-500 text-black px-2 py-0.5 text-[8px] font-bold font-mono rounded-bl-lg">
                            HIDDEN //
                          </div>
                        )}
                        {/* Thumbnail Area */}
                        <div 
                          className="aspect-[16/10] relative overflow-hidden bg-neutral-900"
                          onClick={() => {
                            if (isComingSoon) return;
                            if (isPremium && !hasAccess) {
                              onSubscriptionModalOpen();
                              return;
                            }
                            if (app.isExternal) {
                              window.open(app.link, '_blank');
                            } else {
                              navigate(app.link);
                            }
                          }}
                        >
                           {thumbnail ? (
                             <img 
                               src={thumbnail} 
                               alt={app.name}
                               className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                             />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-neutral-800">
                               <ImageIcon size={40} />
                             </div>
                           )}
                           <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                           
                           {/* Premium Indicator */}
                           {isPremium && !hasAccess && (
                             <div className="absolute top-4 right-4 z-20">
                                <div className="bg-black/60 backdrop-blur-md border border-white/20 p-2 rounded-full text-brand-cyan shadow-lg animate-bounce-slow">
                                  <Lock size={14} />
                                </div>
                             </div>
                           )}
                        </div>
                        
                        {/* Admin Controls Area */}
                        {isAdmin && (
                          <div className="absolute top-4 left-4 z-30 flex gap-2">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setEditingApp(app);
                                 setIsDialogOpen(true);
                               }}
                               className="bg-black/80 backdrop-blur-md border border-white/20 p-2 rounded-full text-brand-cyan hover:scale-110 transition-transform shadow-xl"
                               title="Edit App"
                             >
                               <Edit3 size={12} />
                             </button>
                             {app.databaseInfo && (
                               <div 
                                 className="bg-brand-cyan/20 backdrop-blur-md border border-brand-cyan/40 px-2 py-1 rounded-full text-brand-cyan flex items-center gap-1.5 shadow-xl"
                                 title={app.databaseInfo}
                               >
                                 <Database size={10} />
                                 <span className="text-[8px] font-mono font-bold truncate max-w-[80px]">{app.databaseInfo}</span>
                               </div>
                             )}
                          </div>
                        )}

                        <div 
                          className="p-6 relative z-10 space-y-4"
                          onClick={() => {
                            if (isComingSoon) return;
                            if (isPremium && !hasAccess) {
                              onSubscriptionModalOpen();
                              return;
                            }
                            if (app.isExternal) {
                              window.open(app.link, '_blank');
                            } else {
                              navigate(app.link);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1.5">
                              <h3 className="text-xl font-bold text-neutral-100 group-hover:text-brand-cyan transition-colors font-manrope tracking-tight">
                                {app.name}
                              </h3>
                              <p className="text-[11px] text-neutral-500 font-mono leading-relaxed line-clamp-2 min-h-[32px]">
                                {description}
                              </p>
                            </div>
                          </div>

                          <div className="pt-4 flex items-center justify-between border-t border-white/5">
                            <div className="flex gap-2">
                                {isPremium && !hasAccess ? (
                                    <span className="text-[8px] uppercase font-bold tracking-[0.2em] px-2 py-1 rounded-sm border border-brand-cyan/50 text-brand-cyan bg-brand-cyan/5 flex items-center gap-1.5">
                                      <Lock size={8} /> PREMIUM ACCESS
                                    </span>
                                ) : app.badge && (
                                    <span className={cn(
                                      "text-[8px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full border",
                                      app.badgeVariant === 'featured' && "border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5",
                                      app.badgeVariant === 'premium' && "border-teal-500/30 text-teal-400 bg-teal-500/5",
                                      app.badgeVariant === 'free' && "border-neutral-800 text-neutral-500",
                                      app.badgeVariant === 'comingSoon' && "border-neutral-900 text-neutral-600",
                                      app.badgeVariant === 'admin' && "border-amber-500/30 text-amber-400 bg-amber-500/5"
                                    )}>
                                      {app.badge}
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1 text-[9px] font-mono text-neutral-600 group-hover:text-brand-cyan transition-colors">
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                                {app.isExternal ? 'LAUNCH' : 'ENTER'}
                              </span>
                              <ExternalLink size={10} className="translate-x-1 group-hover:translate-x-0 transition-transform" />
                            </div>
                          </div>
                        </div>

                        {/* Hover Gradient Shine */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand-cyan/0 via-brand-cyan/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        
                        {/* Interactive Line */}
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-brand-cyan origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </motion.div>
        </div>

        <AppEditDialog 
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          app={editingApp}
          onSaved={fetchApps}
        />
        
        {/* Custom animations for bounce */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
            50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
          }
          .animate-bounce-slow {
            animation: bounce-slow 2s infinite;
          }
        `}} />
      </div>
    </>
  );
};



