import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { cn } from '../lib/utils';
import { ImageOff, ExternalLink } from 'lucide-react';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { RenderAppGrid } from '../components/RenderAppGrid';

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
      free: false
    },
    {
      id: 'branding-machine',
      name: t('apps.brandingMachine.name'),
      desc: t('apps.brandingMachine.description'),
      link: '/branding-machine',
      badge: t('apps.badge.premium'),
      badgeVariant: 'premium',
      category: 'branding',
      free: false
    },
    {
      id: 'budget-machine',
      name: t('apps.budgetMachine.name'),
      desc: t('apps.budgetMachine.description'),
      link: '/budget-machine',
      badge: t('apps.badge.comingSoon'),
      badgeVariant: 'comingSoon',
      category: 'branding',
      free: false
    },
    {
      id: 'canvas',
      name: t('apps.canvas.name'),
      desc: t('apps.canvas.description'),
      link: '/canvas',
      badge: t('apps.badge.premium'),
      badgeVariant: 'premium',
      free: false
    },
    {
      id: 'colorfy',
      name: t('apps.colorfy.name'),
      desc: t('apps.colorfy.description'),
      link: 'https://gradient-machine.vercel.app/',
      badge: t('apps.badge.free'),
      badgeVariant: 'free',
      thumbnail: '/tools/color-extractor.png',
      category: 'branding',
      isExternal: true,
      free: true
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
      free: true
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
      free: true
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
      free: true
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
      free: true
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
      category: 'audio'
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
      free: true
    }
  ], [t]);

  const categorizedApps = useMemo(() => {
    const core: any[] = [];
    const branding: any[] = [];
    const effects: any[] = [];
    const audio: any[] = [];
    const experimental: any[] = [];

    appsData.forEach(app => {
      // Featured, Premium, and Coming Soon items stay in the prominent "Core" section
      const isProminent = app.badgeVariant === 'featured' || app.badgeVariant === 'premium' || app.badgeVariant === 'comingSoon';

      if (isProminent) {
        core.push(app);
      } else {
        switch (app.category) {
          case 'branding':
            branding.push(app);
            break;
          case 'effects':
            effects.push(app);
            break;
          case 'audio':
            audio.push(app);
            break;
          case 'experimental':
            experimental.push(app);
            break;
          default:
            core.push(app);
        }
      }
    });

    core.sort((a, b) => {
      const isAProminent = a.badgeVariant === 'featured' || a.badgeVariant === 'premium';
      const isBProminent = b.badgeVariant === 'featured' || b.badgeVariant === 'premium';

      if (isAProminent && !isBProminent) return -1;
      if (!isAProminent && isBProminent) return 1;

      if (a.badgeVariant === 'comingSoon' && b.badgeVariant !== 'comingSoon') return 1;
      if (a.badgeVariant !== 'comingSoon' && b.badgeVariant === 'comingSoon') return -1;

      return 0;
    });

    return { core, branding, effects, audio, experimental };
  }, [appsData]);

  return (
    <>
      <SEO
        title={t('apps.seoTitle')}
        description={t('apps.seoDescription')}
        keywords={t('apps.seoKeywords')}
      />
      <div className="min-h-screen bg-background text-neutral-300 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16 relative z-10">
          <div className="mb-8">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/" className="hover:text-brand-cyan transition-colors">{t('apps.home')}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t('apps.title')}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="mb-12">
            <div className="mb-4">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-200 mb-2">
                {t('apps.title')}
              </h1>
              <p className="text-neutral-500 font-mono text-sm md:text-base">
                {t('apps.subtitle')}
              </p>
            </div>
            <Separator className="mt-6 border-neutral-800/50" />
          </div>

          <div className="space-y-16">
            {/* Core Grid: Featured and Premium items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 auto-rows-fr">
              {categorizedApps.core.map((app) => {
                const isProminent = app.badgeVariant === 'featured' || app.badgeVariant === 'premium';
                const isComingSoon = app.badgeVariant === 'comingSoon';

                return (
                  <Card
                    key={app.id}
                    onClick={() => {
                      if (isComingSoon) return;

                      // Check for premium access
                      if (app.badgeVariant === 'premium' && !hasAccess) {
                        onSubscriptionModalOpen();
                        return;
                      }

                      if (app.isExternal) {
                        window.open(app.link, '_blank');
                        return;
                      }
                      navigate(app.link);
                    }}
                    className={cn(
                      "group relative overflow-hidden border-neutral-800/40 bg-card/30 flex flex-col transition-all duration-500",
                      isProminent ? "md:col-span-3 h-auto border-brand-cyan/20 bg-brand-cyan/[0.03]" : "col-span-1",
                      !isComingSoon ? "hover:border-neutral-700 hover:bg-card/50 cursor-pointer" : "opacity-60 cursor-default grayscale"
                    )}
                  >
                    <div className={cn("flex flex-col", isProminent && "md:flex-row")}>
                      <div className={cn(
                        "relative overflow-hidden bg-neutral-900/50 transition-colors shrink-0",
                        isProminent ? "aspect-[21/9] md:aspect-video md:w-1/2" : "aspect-video border-b border-neutral-800/50"
                      )}>
                        {app.thumbnail ? (
                          <img
                            src={app.thumbnail}
                            alt={app.name}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-900/80">
                            <ImageOff size={isProminent ? 84 : 48} className="text-neutral-800/50 group-hover:text-neutral-700/50 transition-colors" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60" />
                        {app.badge && (
                          <div className="absolute top-4 right-4 z-20">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase font-mono tracking-widest py-1 px-3 bg-black/60 backdrop-blur-md border-neutral-800/80 text-neutral-400",
                                app.badgeVariant === 'featured' && "border-brand-cyan/40 text-brand-cyan bg-brand-cyan/10",
                                app.badgeVariant === 'premium' && "border-brand-cyan/40 text-brand-cyan/90",
                                app.badgeVariant === 'comingSoon' && "border-neutral-800 text-neutral-500",
                                app.badgeVariant === 'free' && "border-neutral-700 text-neutral-300"
                              )}
                            >
                              {app.badge}
                            </Badge>
                          </div>
                        )}
                        {app.isExternal && (
                          <div className="absolute bottom-4 right-4 z-20">
                            <ExternalLink size={14} className="text-neutral-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}

                        {/* Premium CTA Overlay */}
                        {app.badgeVariant === 'premium' && !hasAccess && !isAccessLoading && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-30">
                            <span className="bg-brand-cyan text-black px-6 py-2 rounded-full font-bold text-sm tracking-wider transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              {t('apps.subscribeNow')}
                            </span>
                          </div>
                        )}
                      </div>
                      <CardContent className={cn("p-6 flex flex-col flex-1 justify-center", isProminent && "md:p-10")}>
                        <div className="space-y-4">
                          <h3 className={cn(
                            "font-semibold text-neutral-200 font-manrope transition-colors leading-tight",
                            isProminent ? "text-3xl md:text-5xl tracking-tighter" : "text-lg",
                            "group-hover:text-white"
                          )}>
                            {app.name}
                          </h3>
                          <p className={cn(
                            "text-neutral-500 font-mono leading-relaxed",
                            isProminent ? "text-sm md:text-base max-w-xl" : "text-xs line-clamp-2"
                          )}>
                            {app.desc}
                          </p>
                          {isProminent && (
                            <div className="pt-4 hidden md:block">
                              <span className="text-brand-cyan font-mono text-xs uppercase tracking-widest border border-brand-cyan/20 px-4 py-2 rounded-md bg-brand-cyan/5 group-hover:bg-brand-cyan/10 transition-colors">
                                EXPLORE APP //
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Categorized Tool Sections */}
            <RenderAppGrid
              title={t('apps.brandingTools')}
              apps={categorizedApps.branding}
              hasAccess={hasAccess}
              isAccessLoading={isAccessLoading}
              onSubscriptionModalOpen={onSubscriptionModalOpen}
            />
            <RenderAppGrid
              title={t('apps.effectsTools')}
              apps={categorizedApps.effects}
              hasAccess={hasAccess}
              isAccessLoading={isAccessLoading}
              onSubscriptionModalOpen={onSubscriptionModalOpen}
            />
            <RenderAppGrid
              title={t('apps.audioTools')}
              apps={categorizedApps.audio}
              hasAccess={hasAccess}
              isAccessLoading={isAccessLoading}
              onSubscriptionModalOpen={onSubscriptionModalOpen}
            />
            {categorizedApps.experimental.length > 0 && (
              <RenderAppGrid
                title="EXPERIMENTAL LABS //"
                apps={categorizedApps.experimental}
                hasAccess={hasAccess}
                isAccessLoading={isAccessLoading}
                onSubscriptionModalOpen={onSubscriptionModalOpen}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
