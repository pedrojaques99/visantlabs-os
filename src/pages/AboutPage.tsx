import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { OrganizationSchema } from '../components/StructuredData';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { branding, getGithubUrl } from '../config/branding';
import { RepellantText } from '../components/RepellantText';
import { motion } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';

const TEAM = [
  { name: 'PEDRO JAQUES',  role: 'CREATIVE DIRECTOR', profile: '/jaques-profile', status: true, avatar: '/avatars/jacao.webp' },
  { name: 'PEDRO XAVIER',  role: 'CREATIVE DIRECTOR', profile: '/pedro-xavier',   status: true, avatar: '/avatars/pedro.webp' },
];

const LINKS = [
  { label: 'Portfolio',    href: branding.links?.website,             external: true  },
  { label: 'Instagram',    href: 'https://instagram.com/visant.co',   external: true  },
  { label: 'Alpha Labs',   href: 'https://vsn-labs.vercel.app',       external: true  },
  { label: 'GitHub',       href: getGithubUrl(),                      external: true  },
  { label: 'contato@visant.co', href: 'mailto:contato@visant.co',    external: false },
];

const DOT_COLS = 32;
const fillDots = (a: string, b: string) =>
  '·'.repeat(Math.max(3, DOT_COLS - a.length - b.length));

const fade = (i: number) => ({
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: i * 0.05, duration: 0.16 },
});

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Sao_Paulo' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <SEO
        title={t('about.seo.title') || 'About — Visant Labs'}
        description={t('about.seo.description') || 'Independent creative lab based in Brazil.'}
        keywords={t('about.seo.keywords') || 'visant labs, about, design, Brazil'}
      />
      <OrganizationSchema />

      <div
        className="min-h-screen bg-black text-neutral-300 relative overflow-hidden"
        data-vsn-page="about"
        data-vsn-component="AboutPage"
      >
        <GridDotsBackground opacity={0.04} spacing={30} color="#ffffff" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-20 pb-32">

          {/* Breadcrumb */}
          <BreadcrumbWithBack to="/">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="text-neutral-600 hover:text-neutral-400 font-mono text-[10px] uppercase tracking-widest transition-colors">
                    {t('common.home') || 'Home'}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-neutral-800" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest">
                  Info
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>

          {/* Header */}
          <div className="mt-10 mb-12">
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 mb-2"
            >
              BRASIL · {time}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="sr-only"
            >
              About Visant Labs
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="font-mono text-[11px] text-neutral-500 leading-relaxed max-w-sm"
            >
              Independent creative lab. We experiment with design and technology —
              building tools for graphic designers and entrepreneurs.
            </motion.p>
          </div>

          {/* ── Team ─────────────────────────────────────────────────────────── */}
          <Section label="team" delay={0.12}>
            {TEAM.map((m, i) => (
              <motion.div key={m.name} {...fade(i)} className="group">
                <Link
                  to={m.profile}
                  className="flex items-center gap-3 py-[5px] hover:opacity-100 transition-opacity"
                  aria-label={m.name}
                >
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="w-6 h-6 rounded-full object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="font-mono text-[11px] text-neutral-500 group-hover:text-neutral-200 transition-colors tracking-wider flex-1">
                    {m.name}
                  </span>
                  <span className="font-mono text-[9px] text-neutral-800 tracking-widest">
                    {m.role}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.status ? 'bg-green-600' : 'bg-neutral-700'}`} aria-label={m.status ? 'online' : 'offline'} />
                </Link>
              </motion.div>
            ))}
          </Section>

          {/* ── What we do ───────────────────────────────────────────────────── */}
          <Section label="stack" delay={0.24}>
            {[
              ['Brand identity & visual systems',   '01'],
              ['Interactive web experiences',        '02'],
              ['Design experiments & tools',         '03'],
              ['Creative technology',                '04'],
            ].map(([item, num], i) => (
              <motion.div key={num} {...fade(i)} className="flex items-center font-mono text-[11px] py-[4px]">
                <span className="text-neutral-800 w-6 text-[9px]">{num}</span>
                <span className="text-neutral-600">{item}</span>
              </motion.div>
            ))}
          </Section>

          {/* ── Links ────────────────────────────────────────────────────────── */}
          <Section label="links" delay={0.38}>
            {LINKS.filter(l => l.href).map((l, i) => (
              <motion.div key={l.label} {...fade(i)}>
                <a
                  href={l.href!}
                  target={l.external ? '_blank' : undefined}
                  rel={l.external ? 'noopener noreferrer' : undefined}
                  className="flex items-center font-mono text-[11px] py-[4px] group"
                  aria-label={l.label}
                >
                  <span className="text-neutral-800 group-hover:text-brand-cyan transition-colors w-4 shrink-0">›</span>
                  <span className="text-neutral-500 group-hover:text-neutral-200 transition-colors tracking-wider flex-1">
                    {l.label}
                  </span>
                  <span className="text-neutral-900 group-hover:text-neutral-700 transition-colors">
                    {fillDots(l.label, '')}
                  </span>
                  {l.external
                    ? <ExternalLink size={9} className="text-neutral-800 group-hover:text-neutral-500 transition-colors ml-1 shrink-0" />
                    : null
                  }
                </a>
              </motion.div>
            ))}
          </Section>

          {/* ── Open source ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
            className="mt-10 pt-6 border-t border-neutral-900 flex items-center justify-between"
          >
            <span className="font-mono text-[10px] text-neutral-700 uppercase tracking-widest">
              {t('about.openSource.description') || 'Open source'}
            </span>
            <a
              href={getGithubUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-mono text-[10px] text-neutral-600 hover:text-neutral-300 transition-colors uppercase tracking-widest"
            >
              <Github size={11} />
              GitHub
            </a>
          </motion.div>

          {/* ── Apps CTA ─────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}
            className="mt-6"
          >
            <Link
              to="/apps"
              className="font-mono text-[10px] text-neutral-700 hover:text-neutral-400 transition-colors uppercase tracking-widest"
            >
              /apps →
            </Link>
          </motion.div>
        </div>

        {/* Background VISANT text */}
        <div className="fixed bottom-0 left-0 right-0 overflow-hidden select-none flex justify-center group/visant" style={{ pointerEvents: 'none' }}>
          <RepellantText
            className="text-[22vw] font-bold leading-none tracking-tighter text-white whitespace-nowrap opacity-[0.06] transition-[filter] duration-700 ease-out"
            style={{
              filter: 'blur(12px)',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
              (e.currentTarget as HTMLElement).style.filter = 'blur(2px)';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
              (e.currentTarget as HTMLElement).style.filter = 'blur(12px)';
            }}
          >
            VISANT
          </RepellantText>
        </div>
      </div>
    </>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ label: string; delay: number; children: React.ReactNode }> = ({ label, delay, children }) => (
  <motion.section
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}
    className="mb-10"
    aria-label={label}
  >
    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-800 mb-3">{label}</p>
    <div className="border-l border-neutral-900 pl-4 flex flex-col">
      {children}
    </div>
  </motion.section>
);
