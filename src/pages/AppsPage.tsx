import React, { useMemo } from 'react';
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
import { ExternalLink } from 'lucide-react';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';

export const AppsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess, isLoading: isAccessLoading } = usePremiumAccess();
  const { onSubscriptionModalOpen } = useLayout();

  const appsData = useMemo(() => [
    {
      id: 'mockup-machine',
      name: t('apps.mockupMachine.name'),
      desc: t('apps.mockupMachine.description'),
      link: '/',
      badge: t('apps.badge.featured'),
      badgeVariant: 'featured',
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
    }
  ], [t]);

  const CATEGORIES = useMemo(() => [
    { key: 'design', title: t('apps.brandingTools') },
    { key: 'mockup', title: 'MOCKUP LABS //' },
    { key: 'effects', title: t('apps.effectsTools') },
    { key: 'audio', title: t('apps.audioTools') },
    { key: 'experimental', title: 'EXPERIMENTAL //' }
  ], [t]);

  const appsByCategory = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      apps: appsData.filter(app => app.category === cat.key)
    })).filter(cat => cat.apps.length > 0);
  }, [appsData, CATEGORIES]);

  return (
    <>
      <SEO
        title={t('apps.seoTitle')}
        description={t('apps.seoDescription')}
        keywords={t('apps.seoKeywords')}
      />
      <div className="min-h-screen bg-[#050505] text-neutral-300 relative overflow-hidden pb-32 pt-10 md:pt-14">
        <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,186,227,0.05),transparent_50%)]" />
        
        <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
          <div className="mb-16">
            <Breadcrumb className="mb-8">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/" className="text-neutral-500 hover:text-brand-cyan transition-colors text-xs font-mono tracking-widest">{t('apps.home')}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-neutral-700" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-neutral-400 text-xs font-mono tracking-widest uppercase">{t('apps.title')}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold font-redhatmono text-neutral-100 tracking-tightest leading-none">
                {t('apps.title')} <span className="text-brand-cyan/40">/</span> LABS
              </h1>
              <p className="text-neutral-500 font-mono text-sm max-w-xl leading-relaxed opacity-70">
                {t('apps.subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-24">
            {appsByCategory.map((category) => (
              <section key={category.key} className="space-y-8">
                <div className="flex items-center gap-4">
                  <h2 className="text-[10px] uppercase font-mono tracking-[0.3em] text-brand-cyan/60 font-bold whitespace-nowrap">
                    {category.title}
                  </h2>
                  <div className="h-[1px] w-full bg-gradient-to-r from-neutral-800/100 to-transparent" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.apps.map((app) => {
                    const isComingSoon = app.badgeVariant === 'comingSoon';
                    const isPremium = app.badgeVariant === 'premium';
                    return (
                      <div
                        key={app.id}
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
                        className={cn(
                          "group relative bg-[#0A0A0A] border border-neutral-800/40 rounded-sm overflow-hidden transition-all duration-300",
                          !isComingSoon ? "hover:border-brand-cyan/40 hover:bg-[#0D0D0D] cursor-pointer" : "opacity-40 grayscale pointer-events-none"
                        )}
                      >
                        {/* Interactive BG Glow */}
                        <div className="absolute inset-0 bg-brand-cyan/0 group-hover:bg-brand-cyan/[0.02] transition-colors duration-500" />
                        
                        <div className="p-6 relative z-10 space-y-4">
                          <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1.5">
                              <h3 className="text-lg font-bold text-neutral-200 group-hover:text-brand-cyan transition-colors font-manrope">
                                {app.name}
                              </h3>
                              <p className="text-[11px] text-neutral-500 font-mono leading-relaxed line-clamp-2">
                                {app.desc}
                              </p>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {isPremium && !hasAccess ? (
                                    <div className="bg-white/5 border border-white/10 p-1.5 rounded-sm">
                                        <Badge className="bg-white text-black text-[8px] font-bold px-1.5 py-0 rounded-none tracking-tighter hover:bg-white">
                                            LOCKED
                                        </Badge>
                                    </div>
                                ) : (
                                    <div className="p-1 border border-neutral-800/50 rounded-sm group-hover:border-brand-cyan/20 transition-colors">
                                        <ExternalLink size={10} className="text-neutral-600 group-hover:text-brand-cyan/50" />
                                    </div>
                                )}
                            </div>
                          </div>

                          <div className="pt-2 flex items-center justify-between border-t border-neutral-800/40">
                            <div className="flex gap-2">
                              {app.badge && (
                                <span className={cn(
                                  "text-[8px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full border",
                                  app.badgeVariant === 'featured' && "border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5",
                                  app.badgeVariant === 'premium' && "border-white/10 text-neutral-400 bg-white/5",
                                  app.badgeVariant === 'free' && "border-neutral-800 text-neutral-500",
                                  app.badgeVariant === 'comingSoon' && "border-neutral-900 text-neutral-600"
                                )}>
                                  {app.badge}
                                </span>
                              )}
                            </div>
                            
                            <span className="text-[9px] font-mono text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0 transition-transform">
                              {app.isExternal ? 'LAUNCH EXTERNAL' : 'OPEN LAB'} _
                            </span>
                          </div>
                        </div>

                        {/* Hover Line */}
                        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-brand-cyan scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};


