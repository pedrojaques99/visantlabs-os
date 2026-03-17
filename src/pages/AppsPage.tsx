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
import { MicroTitle } from '@/components/ui/MicroTitle'

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
      category: 'branding',
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
      category: 'branding',
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
      category: 'branding',
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
      category: 'branding',
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
      category: 'branding',
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

  return (
    <>
      <SEO
        title={t('apps.seoTitle')}
        description={t('apps.seoDescription')}
        keywords={t('apps.seoKeywords')}
      />
      <div className="min-h-screen bg-background text-neutral-300 relative overflow-hidden">
        <div className="fixed inset-0 z-0" />
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
              <h1 className="text-3xl md:text-5xl font-bold font-redhatmono text-neutral-200 mb-4 tracking-tight">
                {t('apps.title')} // <span className="text-brand-cyan opacity-50">LABS</span>
              </h1>
              <p className="text-neutral-500 font-mono text-sm md:text-base max-w-2xl leading-relaxed">
                {t('apps.subtitle')}
              </p>
            </div>
            <Separator className="mt-8 border-neutral-800/40" />
          </div>

          {/* Unified Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
            {appsData.map((app) => {
              const isProminent = app.span && app.span.includes('lg:col-span-2');
              const isComingSoon = app.badgeVariant === 'comingSoon';

              return (
                <Card
                  key={app.id}
                  onClick={() => {
                    if (isComingSoon) return;

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
                    "group relative overflow-hidden border-neutral-800/40 bg-card/20 flex flex-col transition-all duration-500",
                    app.span || "col-span-1",
                    !isComingSoon ? "hover:border-brand-cyan/30 hover:bg-card/40 cursor-pointer" : "opacity-60 cursor-default grayscale"
                  )}
                >
                  <div className={cn("flex flex-col h-full", isProminent ? "flex-col" : "flex-col")}>
                    {/* Image / Thumbnail Section */}
                    <div className={cn(
                      "relative overflow-hidden bg-neutral-900/50 transition-colors shrink-0",
                      isProminent ? "aspect-video" : "aspect-[16/10] border-b border-neutral-800/50"
                    )}>
                      {app.thumbnail ? (
                        <img
                          src={app.thumbnail}
                          alt={app.name}
                          className="w-full h-full object-cover opacity-50 group-hover:opacity-300 group-hover:scale-105 transition-all duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-900/20">
                          <ImageOff size={isProminent ? 64 : 32} className="text-neutral-800/50 group-hover:text-brand-cyan/20 transition-colors duration-500" />
                        </div>
                      )}

                      {/* Gradient Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-80 group-hover:opacity-300 transition-opacity duration-500" />

                      {/* Badges */}
                      {app.badge && (
                        <div className="absolute top-3 right-3 z-20">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] uppercase font-mono tracking-widest py-1 px-3 bg-black/60 backdrop-blur-md border-neutral-800/80 text-neutral-400 font-bold",
                              app.badgeVariant === 'featured' && "border-brand-cyan/40 text-brand-cyan bg-brand-cyan/10",
                              app.badgeVariant === 'premium' && "border-white/20 text-white/80",
                              app.badgeVariant === 'comingSoon' && "border-neutral-800 text-neutral-500",
                              app.badgeVariant === 'free' && "border-neutral-700 text-neutral-300"
                            )}
                          >
                            {app.badge}
                          </Badge>
                        </div>
                      )}

                      {/* External Link Icon */}
                      {app.isExternal && (
                        <div className="absolute bottom-3 right-3 z-20">
                          <ExternalLink size={12} className="text-neutral-500 opacity-60 group-hover:opacity-300 group-hover:text-brand-cyan transition-all" />
                        </div>
                      )}

                      {/* Premium Overlay */}
                      {app.badgeVariant === 'premium' && !hasAccess && !isAccessLoading && (
                        <div className="absolute inset-0 bg-neutral-950/80 opacity-0 group-hover:opacity-300 transition-opacity duration-300 flex items-center justify-center z-30">
                          <MicroTitle className="bg-brand-cyan text-black px-6 py-2 rounded-full font-bold text-xs transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            {t('apps.subscribeNow')}
                          </MicroTitle>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <CardContent className={cn("p-5 flex flex-col flex-1 gap-2")}>
                      <div className="space-y-1.5 mt-auto">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "font-bold text-neutral-100 font-manrope transition-colors leading-tight tracking-tight",
                            isProminent ? "text-xl md:text-2xl" : "text-base",
                            "group-hover:text-brand-cyan"
                          )}>
                            {app.name}
                          </h3>
                        </div>
                        <p className={cn(
                          "text-neutral-500 font-mono leading-relaxed",
                          isProminent ? "text-xs md:text-sm line-clamp-2" : "text-[10px] line-clamp-2"
                        )}>
                          {app.desc}
                        </p>
                      </div>

                      {isProminent && (
                        <div className="pt-3 opacity-0 group-hover:opacity-300 transition-opacity duration-300">
                          <span className="text-brand-cyan font-mono text-[9px] uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-1 bg-brand-cyan rounded-full animate-pulse" />
                            EXPLORE // ACCESS
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

