import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { LinearGradientBackground } from '../components/ui/LinearGradientBackground';
import { Pickaxe, Palette, FileText, Layers, ArrowRight, Grid } from 'lucide-react';
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

export const AppsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();

  const apps = [
    {
      id: 'mockup',
      name: t('apps.mockupMachine.name'),
      description: t('apps.mockupMachine.description'),
      route: '/',
      icon: Pickaxe,
      color: 'brand-cyan',
      badge: t('apps.badge.free') || 'Free',
      isExternal: false,
    },
    {
      id: 'branding',
      name: t('apps.brandingMachine.name'),
      description: t('apps.brandingMachine.description'),
      route: '/branding-machine',
      icon: Palette,
      color: 'brand-cyan',
      badge: 'Premium Users Only',
      requiresPremium: true,
      isExternal: false,
    },
    {
      id: 'budget',
      name: t('apps.budgetMachine.name'),
      description: t('apps.budgetMachine.description'),
      route: '/budget-machine',
      icon: FileText,
      color: 'brand-cyan',
      badge: 'Coming Soon',
      isExternal: false,
      disabled: true,
    },
    {
      id: 'canvas',
      name: t('apps.canvas.name'),
      description: t('apps.canvas.description'),
      route: '/canvas',
      icon: Layers,
      color: 'brand-cyan',
      badge: 'Featured',
      requiresPremium: true,
      isExternal: false,
    },
    {
      id: 'colorfy',
      name: 'Colorfy',
      description: 'A gradient generator for your projects.',
      route: 'https://gradient-machine.vercel.app/',
      icon: Palette, // Using Palette as placeholder/reuse if specific paint icon not available instantly, but user suggested paint bucket
      color: 'brand-cyan',
      badge: 'Beta',
      isExternal: true,
    },
    {
      id: 'halftone',
      name: 'Halftone Machine',
      description: 'Create halftone effects from your images.',
      route: 'https://pedrojaques99.github.io/halftone-machine/',
      icon: Grid, // Need to import Grid
      color: 'brand-cyan',
      badge: 'Beta',
      isExternal: true,
    },
  ];

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
          {/* Breadcrumb */}
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

          {/* Header */}
          <div className="mb-12">
            <div className="mb-4">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-200 mb-2">
                {t('apps.title')}
              </h1>
              <p className="text-neutral-500 font-mono text-sm md:text-base">
                {t('apps.subtitle')}
              </p>
            </div>
            <Separator className="mt-6" />
          </div>

          <div className="space-y-8">


            {/* Outros Apps - Grid de 3 colunas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {apps
                .map((app) => {
                  const Icon = app.icon;
                  const handleClick = () => {
                    if (app.disabled) return;

                    if (app.isExternal) {
                      window.open(app.route, '_blank');
                      return;
                    }

                    // Mockup Machine is always accessible
                    if (app.id === 'mockup') {
                      navigate(app.route);
                      return;
                    }

                    // Check access for premium apps
                    if (app.requiresPremium) {
                      if (!isLoadingAccess && hasAccess) {
                        navigate(app.route);
                      } else {
                        navigate('/waitlist');
                      }
                      return;
                    }

                    navigate(app.route);
                  };

                  return (
                    <Card
                      key={app.id}
                      onClick={handleClick}
                      className={cn(
                        "group relative overflow-hidden border-neutral-800/50 bg-card/50",
                        !app.disabled && "hover:border-brand-cyan/50 hover:bg-card/70 hover:shadow-lg hover:shadow-brand-cyan/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                        app.disabled && "opacity-60 cursor-not-allowed",
                        "transition-all duration-300"
                      )}
                    >
                      <CardContent className="p-6 md:p-8">
                        <div className="flex flex-col items-start space-y-5">
                          <div className="flex items-center justify-between w-full">
                            <div
                              className={cn(
                                "p-4 rounded-xl border transition-all duration-300",
                                "bg-brand-cyan/10 border-brand-cyan/20",
                                !app.disabled && "group-hover:bg-brand-cyan/20 group-hover:border-brand-cyan/40"
                              )}
                            >
                              <Icon
                                size={32}
                                className={cn(
                                  "text-brand-cyan transition-transform duration-300",
                                  !app.disabled && "group-hover:scale-110"
                                )}
                              />
                            </div>
                            {app.badge && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs border-neutral-700/50 text-neutral-400",
                                  app.id === 'branding' && "border-brand-cyan/30 text-brand-cyan",
                                  app.id === 'canvas' && "border-brand-cyan/30 text-brand-cyan"
                                )}
                              >
                                {app.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 w-full">
                            <h3 className={cn(
                              "text-xl font-semibold text-neutral-200 mb-2 font-manrope transition-colors",
                              !app.disabled && "group-hover:text-brand-cyan/90"
                            )}>
                              {app.name}
                            </h3>
                            <p className="text-sm text-neutral-400 font-mono leading-relaxed">
                              {app.description}
                            </p>
                          </div>
                          {!app.disabled && (
                            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-full">
                              <span>{app.isExternal ? 'Visit' : 'Explore'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

