import React from 'react';
import { ExternalLink, Github, Users, Building2, Lightbulb, Code, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../hooks/useTheme';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { OrganizationSchema } from '../components/StructuredData';
import { BreadcrumbWithBack } from '../components/ui/BreadcrumbWithBack';
import {
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { branding, getGithubUrl } from '../config/branding';

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <>
      <SEO
        title={t('about.seo.title') || t('about.title') || 'About Visant Labs®'}
        description={t('about.seo.description') || t('about.description.text') || 'Independent Brazilian agency. Experimentation laboratory creating personalized solutions for graphic designers and entrepreneurs.'}
        keywords={t('about.seo.keywords') || 'visant labs, about, agency, design, Brazil, creative tools'}
      />
      <OrganizationSchema />
      <div className="min-h-screen bg-background text-zinc-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
          {/* Breadcrumb with Back Button */}
          <div className="mb-4">
            <BreadcrumbWithBack to="/">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">{t('common.home')}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t('about.title')}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Info className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-zinc-300">
                {t('about.title')}
              </h1>
              <p className="text-zinc-500 font-mono text-sm md:text-base mt-1">
                {t('about.tagline')}
              </p>
            </div>
          </div>

          {/* Bento Box Grid */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Description - Large Card */}
            <div className="md:col-span-2 lg:col-span-3 bg-card border border-zinc-800/50 rounded-md p-6 md:p-8 hover:border-brand-cyan/30 transition-all">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 mt-1 flex-shrink-0 text-brand-cyan" />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold font-mono mb-3 text-zinc-200">
                    {t('about.description.title')}
                  </h2>
                  <p className="text-base leading-relaxed font-mono text-zinc-400">
                    {t('about.description.text')}
                  </p>
                </div>
              </div>
            </div>

            {/* Founders */}
            <div className="bg-card border border-zinc-800/50 rounded-md p-6 md:p-8 hover:border-brand-cyan/30 transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 flex-shrink-0 text-brand-cyan" />
                  <h2 className="text-xl font-semibold font-mono text-zinc-200">
                    {t('about.founders.title')}
                  </h2>
                </div>
                <div className="space-y-3">
                  <div className="font-mono text-zinc-300">
                    <span className="font-semibold">{t('about.founders.pedroJaques')}</span>
                  </div>
                  <div className="font-mono text-zinc-300">
                    <span className="font-semibold">{t('about.founders.pedroXavier')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Open Source */}
            <div className="bg-card border border-zinc-800/50 rounded-md p-6 md:p-8 hover:border-brand-cyan/30 transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Code className="w-6 h-6 flex-shrink-0 text-brand-cyan" />
                  <h2 className="text-xl font-semibold font-mono text-zinc-200">
                    {t('about.openSource.title')}
                  </h2>
                </div>
                <p className="text-base leading-relaxed font-mono text-zinc-400 mb-4">
                  {t('about.openSource.description')}
                </p>
                <a
                  href={getGithubUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 hover:border-brand-cyan/50"
                >
                  <Github className="w-4 h-4" />
                  <span>{t('about.openSource.viewOnGitHub')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div className="bg-card border border-zinc-800/50 rounded-md p-6 md:p-8 hover:border-brand-cyan/30 transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 flex-shrink-0 text-brand-cyan" />
                  <h2 className="text-xl font-semibold font-mono text-zinc-200">
                    {t('about.links.title')}
                  </h2>
                </div>
                <div className="space-y-3">
                  {branding.links.website && (
                    <a
                      href={branding.links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-zinc-800/50 hover:bg-zinc-800/70 text-zinc-300 border border-zinc-700 hover:border-brand-cyan/50"
                    >
                      <span>{t('about.links.portfolio')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <a
                    href="https://www.vsn-labs.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-zinc-800/50 hover:bg-zinc-800/70 text-zinc-300 border border-zinc-700 hover:border-brand-cyan/50"
                  >
                    <span>{t('about.links.alphaTests')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Full Width Image Header - At the end */}
          <div className="mt-6 w-full bg-card border border-zinc-800/50 rounded-md overflow-hidden hover:border-brand-cyan/30 transition-all">
            <div className="relative w-full aspect-video md:aspect-[21/9]">
              <img
                src={t('about.headerImage.url') || '/og-image.png'}
                alt={t('about.headerImage.alt') || t('about.title')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/og-image.png';
                }}
              />
              {/* Optional overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};









