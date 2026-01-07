import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { LinearGradientBackground } from '../components/ui/LinearGradientBackground';
import { Pickaxe, Palette, FileText, Layers, ArrowRight } from 'lucide-react';
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
} from "@/components/ui/breadcrumb";
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
    },
    {
      id: 'branding',
      name: t('apps.brandingMachine.name'),
      description: t('apps.brandingMachine.description'),
      route: '/branding-machine',
      icon: Palette,
      color: 'brand-cyan',
    },
    {
      id: 'budget',
      name: t('apps.budgetMachine.name'),
      description: t('apps.budgetMachine.description'),
      route: '/budget-machine',
      icon: FileText,
      color: 'brand-cyan',
    },
    {
      id: 'canvas',
      name: t('apps.canvas.name'),
      description: t('apps.canvas.description'),
      route: '/canvas',
      icon: Layers,
      color: 'brand-cyan',
    },
  ];

  return (
    <>
      <SEO
        title={t('apps.seoTitle')}
        description={t('apps.seoDescription')}
        keywords={t('apps.seoKeywords')}
      />
      <div className="min-h-screen bg-background text-zinc-300 relative overflow-hidden">
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
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-zinc-200 mb-2">
                {t('apps.title')}
              </h1>
              <p className="text-zinc-500 font-mono text-sm md:text-base">
                {t('apps.subtitle')}
              </p>
            </div>
            <Separator className="mt-6" />
          </div>

          <div className="space-y-8">
            {/* Canvas - Hierarquia 1 em Bentobox */}
            {(() => {
              const canvasApp = apps.find(app => app.id === 'canvas');
              if (!canvasApp) return null;

              const Icon = canvasApp.icon;
              const handleClick = () => {
                if (!isLoadingAccess && hasAccess) {
                  navigate(canvasApp.route);
                } else {
                  navigate('/waitlist');
                }
              };

              return (
                <Card
                  className="group relative overflow-hidden border-zinc-800/50 bg-card/50 hover:border-brand-cyan/50 hover:bg-card/70 hover:shadow-lg hover:shadow-brand-cyan/10 transition-all duration-300 cursor-pointer"
                  onClick={handleClick}
                >
                  <LinearGradientBackground
                    className="rounded-lg"
                    opacity={0.25}
                  />
                  <CardContent className="relative z-10 p-8 md:p-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      <div
                        className="p-5 rounded-xl flex-shrink-0 border border-brand-cyan/20 bg-brand-cyan/10 group-hover:bg-brand-cyan/20 group-hover:border-brand-cyan/40 transition-all duration-300"
                      >
                        <Icon
                          size={48}
                          className="text-brand-cyan transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-2xl md:text-3xl font-semibold text-zinc-200 font-manrope">
                            {canvasApp.name}
                          </h3>
                          <Badge variant="outline" className="border-brand-cyan/30 text-brand-cyan">
                            Featured
                          </Badge>
                        </div>
                        <p className="text-base text-zinc-400 font-mono leading-relaxed">
                          {canvasApp.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="p-3 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 group-hover:bg-brand-cyan/20 transition-colors">
                          <ArrowRight className="w-5 h-5 text-brand-cyan" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Outros 3 Apps - Grid de 3 colunas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {apps
                .filter(app => app.id !== 'canvas')
                .map((app) => {
                  const Icon = app.icon;
                  const handleClick = () => {
                    // Mockup Machine is always accessible
                    if (app.id === 'mockup') {
                      navigate(app.route);
                      return;
                    }

                    // Check access for premium apps
                    if (!isLoadingAccess && hasAccess) {
                      navigate(app.route);
                    } else {
                      navigate('/waitlist');
                    }
                  };

                  const isFree = app.id === 'mockup';

                  return (
                    <Card
                      key={app.id}
                      onClick={handleClick}
                      className={cn(
                        "group relative overflow-hidden border-zinc-800/50 bg-card/50",
                        "hover:border-brand-cyan/50 hover:bg-card/70 hover:shadow-lg hover:shadow-brand-cyan/10",
                        "transition-all duration-300 cursor-pointer",
                        "hover:scale-[1.02] active:scale-[0.98]"
                      )}
                    >
                      <CardContent className="p-6 md:p-8">
                        <div className="flex flex-col items-start space-y-5">
                          <div className="flex items-center justify-between w-full">
                            <div
                              className={cn(
                                "p-4 rounded-xl border transition-all duration-300",
                                "bg-brand-cyan/10 border-brand-cyan/20",
                                "group-hover:bg-brand-cyan/20 group-hover:border-brand-cyan/40"
                              )}
                            >
                              <Icon
                                size={32}
                                className="text-brand-cyan transition-transform duration-300 group-hover:scale-110"
                              />
                            </div>
                            {isFree && (
                              <Badge variant="outline" className="text-xs border-zinc-700/50 text-zinc-400">
                                Free
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 w-full">
                            <h3 className="text-xl font-semibold text-zinc-200 mb-2 font-manrope group-hover:text-brand-cyan/90 transition-colors">
                              {app.name}
                            </h3>
                            <p className="text-sm text-zinc-400 font-mono leading-relaxed">
                              {app.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-full">
                            <span>Explore</span>
                            <ArrowRight className="w-3 h-3" />
                          </div>
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

