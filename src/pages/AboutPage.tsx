import React, { useMemo, useState, useEffect } from 'react';
import { ExternalLink, Github, Users, Building2, Lightbulb, Code, Info, Layers, Mail, Globe, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
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
import { RepellantText } from '../components/RepellantText';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/card';

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: 'America/Sao_Paulo'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const teamMembers = useMemo(() => [
    {
      name: 'PEDRO JAQUES',
      role: 'CREATIVE DIRECTOR',
      profile: '/jaques-profile',
      status: 'ONLINE',
      avatar: '/avatars/jacao.webp'
    },
    {
      name: 'PEDRO XAVIER',
      role: 'CREATIVE DIRECTOR',
      profile: '/pedro-xavier',
      status: 'ONLINE',
      avatar: '/avatars/pedro.webp'
    }
  ], []);

  const visantWorks = useMemo(() => [
    { title: 'TRINITY PROJECT', year: '2025', medium: 'BRAND IDENTITY' },
    { title: 'CALHA NORTE', year: '2025', medium: 'DIGITAL DESIGN' },
    { title: 'CARDS TYPPER', year: '2025', medium: 'UI/UX DESIGN' },
    { title: 'PORTFOLIO TRINITY', year: '2025', medium: 'VISUAL DESIGN' },
    { title: 'EXPERIMENTAL 35', year: '2025', medium: 'DIGITAL ART' },
    { title: 'MINIMAL 53', year: '2025', medium: 'GRAPHIC DESIGN' },
  ], []);

  return (
    <>
      <SEO
        title={t('about.seo.title') || t('about.title') || 'About Visant Labs®'}
        description={t('about.seo.description') || t('about.description.text') || 'Independent Brazilian agency. Experimentation laboratory creating personalized solutions for graphic designers and entrepreneurs.'}
        keywords={t('about.seo.keywords') || 'visant labs, about, agency, design, Brazil, creative tools'}
      />
      <OrganizationSchema />
      <div className="min-h-screen bg-background text-neutral-300 pt-12 pb-100 md:pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>

        {/* Scanlines Effect */}
        <div className="fixed inset-0 pointer-events-none z-10 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.05) 2px, rgba(255, 255, 255, 0.05) 4px)`
          }}
        />

        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-32 relative z-20">
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
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4 grid cols-2">
              <div className="col-span-2">
                <p className="text-neutral-500 font-mono text-sm md:text-base mt-1">
                  BRASIL [{currentTime}]
                </p>
              </div>
            </div>
          </div>

          {/* Bento Box Grid */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

            {/* Banner Card - Explore Apps */}
            <Link
              to="/apps"
              className="md:col-span-2 lg:col-span-3 h-[240px] md:h-[320px] relative overflow-hidden rounded-md border border-neutral-800/50 group hover:border-brand-cyan/30 transition-all cursor-pointer"
            >
              <img
                src="/og-image.png"
                alt="Visant Labs Banner"
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className="flex items-end justify-between gap-4">
                  <div className="max-w-xl">
                    <h2 className="text-3xl md:text-5xl font-bold font-manrope text-white mb-2 tracking-tighter">
                      VISANT // <span className="text-brand-cyan">LABS</span>
                    </h2>
                    <p className="text-neutral-400 font-mono text-sm md:text-base leading-relaxed">
                      Experimentation laboratory creator of personalized solutions for graphic designers and entrepreneurs.
                    </p>
                  </div>
                  <div className="hidden md:flex px-6 py-3 bg-brand-cyan text-black font-bold font-mono text-sm rounded-md items-center gap-2 group-hover:bg-white transition-colors shrink-0">
                    EXPLORE APPS <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            </Link>

            {/* Description - Large Card */}
            <div className="md:col-span-2 lg:col-span-2 bg-card/50 border border-neutral-800/50 rounded-md p-6 md:p-8 hover:border-brand-cyan/30 transition-all group">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 mt-1 flex-shrink-0 text-brand-cyan group-hover:text-brand-cyan/80 transition-colors" />
                <div className="flex-1">
                  <div className="font-mono text-sm text-brand-cyan mb-2">about.txt</div>
                  <div className="space-y-4 font-mono text-neutral-400 leading-relaxed text-sm md:text-base">
                    <div>
                      <span className="text-neutral-200 font-semibold">{t('about.visantStudio') || 'VISANT STUDIO'}</span>
                      <div className="text-neutral-700 my-1">─────────────</div>
                      <p>Independent creative lab based in Brazil.</p>
                      <p>We love to experiment with design and technology.</p>
                    </div>

                    <div>
                      <div className="text-neutral-700 my-1">─</div>
                      <p className="text-neutral-300 font-medium mb-1">What we do:</p>
                      <ul className="list-none space-y-1 pl-2 border-l-2 border-neutral-800">
                        <li>• Brand identity & visual systems</li>
                        <li>• Interactive web experiences</li>
                        <li>• Design experiments & tools</li>
                        <li>• Creative technology</li>
                      </ul>
                    </div>

                    <div>
                      <div className="text-neutral-700 my-1">─</div>
                      <p className="text-neutral-300 font-medium mb-1">Our approach:</p>
                      <ul className="list-none space-y-1 pl-2 border-l-2 border-neutral-800">
                        <li>• Bridge art and code</li>
                        <li>• Focus on interactiveness & innovation</li>
                        <li>• Open source mindset</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Links & Socials */}
            <div className="bg-card/50 border border-neutral-800/50 rounded-md p-6 md:p-8 hover:border-brand-cyan/30 transition-all flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <Globe className="w-6 h-6 flex-shrink-0 text-brand-cyan" />
                <h2 className="text-xl font-semibold font-mono text-neutral-200">
                  Connect
                </h2>
              </div>
              <div className="space-y-3 flex-1">
                {branding.links.website && (
                  <a
                    href={branding.links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-neutral-800/30 hover:bg-neutral-800/50 text-neutral-300 border border-neutral-800 hover:border-brand-cyan/40 group"
                  >
                    <span className="flex-1">Portfolio</span>
                    <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-brand-cyan transition-colors" />
                  </a>
                )}
                <a
                  href="https://www.vsn-labs.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-neutral-800/30 hover:bg-neutral-800/50 text-neutral-300 border border-neutral-800 hover:border-brand-cyan/40 group"
                >
                  <span className="flex-1">Alpha Labs</span>
                  <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-brand-cyan transition-colors" />
                </a>

                <a
                  href="https://instagram.com/visant.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-neutral-800/30 hover:bg-neutral-800/50 text-neutral-300 border border-neutral-800 hover:border-brand-cyan/40 group"
                >
                  <span className="flex-1">Instagram</span>
                  <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-brand-cyan transition-colors" />
                </a>

                <a
                  href="mailto:contato@visant.co"
                  className="flex items-center gap-2 px-4 py-3 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-neutral-800/30 hover:bg-neutral-800/50 text-neutral-300 border border-neutral-800 hover:border-brand-cyan/40 group"
                >
                  <span className="flex-1">Email Us</span>
                  <Mail className="w-3 h-3 text-neutral-500 group-hover:text-brand-cyan transition-colors" />
                </a>

                <Link
                  to="/apps"
                  className="flex items-center gap-2 px-4 py-3 rounded-md transition-all duration-300 font-mono text-sm hover:scale-[1.02] active:scale-95 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/20 group mt-4 h-14 shrink-0"
                >
                  <span className="flex-1 font-bold italic tracking-tighter">LABS APPS //</span>
                  <ArrowRight className="w-4 h-4 text-brand-cyan group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-300">
                {t('about.title')}
              </h1>
            </div>

            {/* Team Section */}
            <div className="md:col-span-2 lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="group flex items-center gap-4 p-4 border border-neutral-800/50 rounded-md bg-card/50 hover:bg-card hover:border-brand-cyan/30 transition-all duration-300"
                  >
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-neutral-800 group-hover:border-brand-cyan/40 transition-colors">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://ui-avatars.com/api/?name=${member.name}&background=random`;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-neutral-500">0{index + 1}</span>
                        <h3 className="font-bold text-neutral-200 group-hover:text-brand-cyan transition-colors truncate">
                          {member.name}
                        </h3>
                      </div>
                      <p className="text-xs font-mono text-neutral-400 mb-1">{member.role}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", member.status === 'ONLINE' ? "bg-green-500" : "bg-neutral-500")} />
                        <span className="text-[10px] font-mono text-neutral-500">{member.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Open Source */}
          <div className="md:col-span-1 lg:col-span-3 bg-card/50 border border-neutral-800/50 rounded-md p-4 mt-6 hover:border-brand-cyan/30 transition-all flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 flex-shrink-0 text-brand-cyan" />
              <span className="font-mono text-neutral-400 text-sm">
                {t('about.openSource.description')}
              </span>
            </div>
            <a
              href={getGithubUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-300 font-mono text-xs hover:scale-[1.02] bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/20"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>

      {/* Huge VISANT Text - Bottom Layer */}
      <div className="absolute bottom-[10px] left-0 right-0 overflow-hidden pointer-events-none z-0 flex justify-center items-end opacity-10 select-none">
        <RepellantText
          className="text-[20vw] md:text-[30vw] font-manrope font-semibold leading-none tracking-tighter text-neutral-600"
          style={{
            marginBottom: '-2vw',
            whiteSpace: 'nowrap'
          }}
        >
          VISANT
        </RepellantText>
      </div>
    </>
  );
};
