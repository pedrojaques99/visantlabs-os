import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { Pickaxe, Palette, FileText, Layers } from 'lucide-react';
import { SEO } from '../components/SEO';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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
      color: '#52ddeb',
    },
    {
      id: 'branding',
      name: t('apps.brandingMachine.name'),
      description: t('apps.brandingMachine.description'),
      route: '/branding-machine',
      icon: Palette,
      color: '#52ddeb',
    },
    {
      id: 'budget',
      name: t('apps.budgetMachine.name'),
      description: t('apps.budgetMachine.description'),
      route: '/budget-machine',
      icon: FileText,
      color: '#52ddeb',
    },
    {
      id: 'canvas',
      name: t('apps.canvas.name'),
      description: t('apps.canvas.description'),
      route: '/canvas',
      icon: Layers,
      color: '#52ddeb',
    },
  ];

  return (
    <>
      <SEO
        title={t('apps.seoTitle')}
        description={t('apps.seoDescription')}
        keywords={t('apps.seoKeywords')}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-14 relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 relative z-10">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">{t('apps.home')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('apps.title')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-200 mb-4 font-mono">
            {t('apps.title')}
          </h1>
          <p className="text-lg text-zinc-400 font-mono">
            {t('apps.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app) => {
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

            return (
              <button
                key={app.id}
                onClick={handleClick}
                className="group relative p-8 bg-[#1A1A1A] border border-zinc-800 rounded-2xl hover:border-[#52ddeb]/50 transition-all duration-300 text-left hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <div className="flex flex-col items-start space-y-4">
                  <div
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: `${app.color}15` }}
                  >
                    <Icon
                      size={32}
                      className="transition-colors"
                      style={{ color: app.color }}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-zinc-200 mb-2 font-mono">
                      {app.name}
                    </h3>
                    <p className="text-sm text-zinc-400 font-mono">
                      {app.description}
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="w-2 h-2 rounded-md"
                    style={{ backgroundColor: app.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      </div>
    </>
  );
};

