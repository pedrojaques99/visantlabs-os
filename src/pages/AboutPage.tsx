import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { SEO } from '../components/SEO';
import { OrganizationSchema } from '../components/StructuredData';
import {
  BreadcrumbWithBack,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { branding, getGithubUrl } from '../config/branding';
import { RepellantText } from '../components/RepellantText';
import { motion } from 'framer-motion';
import { ExternalLink, Github, ArrowUpRight, ArrowRight } from '@/lib/ui/icons';
import { Thumb } from '../components/ui/Thumb';

const TEAM = [
  {
    name: 'Pedro Jaques',
    role: 'Creative Director',
    profile: '/jaques-profile',
    status: true,
    avatar: '/avatars/jacao.webp',
    bio: 'Brand strategy, motion design & creative technology.',
  },
  {
    name: 'Pedro Xavier',
    role: 'Creative Director',
    profile: '/pedro-xavier',
    status: true,
    avatar: '/avatars/pedro.webp',
    bio: 'Product design, visual systems & generative art.',
  },
];

const FEATURED_TOOLS = [
  {
    label: 'Mockup Machine',
    description: 'AI-generated product mockups from brand context.',
    image: '/tools/mockup-machine.webp',
    href: '/create',
  },
  {
    label: 'Brand Guidelines',
    description: 'Living brand guidelines that feed AI generation.',
    image: '/tools/brand-guidelines.webp',
    href: '/brand-guidelines',
  },
  {
    label: '3D Studio',
    description: 'Real-time 3D renders, materials and lighting.',
    image: '/tools/3d-studio.webp',
    href: '/studio-3d',
  },
  {
    label: 'Canvas',
    description: 'Node-based AI generation canvas for creatives.',
    image: '/tools/canvas.webp',
    href: '/canvas-projects',
  },
];

const LINKS = [
  { label: 'Portfolio', href: branding.links?.website, external: true },
  { label: 'Instagram', href: 'https://instagram.com/visant.co', external: true },
  { label: 'Alpha Labs', href: 'https://vsn-labs.vercel.app', external: true },
  { label: 'GitHub', href: getGithubUrl(), external: true },
  { label: 'contato@visant.co', href: 'mailto:contato@visant.co', external: false },
];

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

const inView = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { delay, duration: 0.4, ease: EASE },
});

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Sao_Paulo' })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <SEO
        title={t('about.seo.title')}
        description={t('about.seo.description')}
        keywords={t('about.seo.keywords')}
      />
      <OrganizationSchema />

      <div
        className="min-h-screen text-foreground relative overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, oklch(0.10 0 0) 0%, oklch(0.145 0 0) 40%, oklch(0.13 0.015 198.6) 100%)',
        }}
        data-vsn-page="about"
        data-vsn-component="AboutPage"
      >
        {/* Subtle radial glow top-right */}
        <div
          className="pointer-events-none fixed top-0 right-0 w-[600px] h-[400px] opacity-[0.06]"
          style={{
            background:
              'radial-gradient(ellipse at top right, oklch(0.81 0.156 198.6), transparent 70%)',
          }}
          aria-hidden
        />

        <div className="relative z-10 max-w-3xl mx-auto px-6 pt-20 pb-32">
          {/* Breadcrumb */}
          <BreadcrumbWithBack to="/">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    to="/"
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    {t('common.home')}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-muted-foreground" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-muted-foreground text-xs">Info</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="mt-12 mb-16 flex flex-col sm:flex-row sm:items-end gap-8">
            <div className="flex-1">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="text-xs text-muted-foreground mb-3"
              >
                São Paulo, Brasil <span className="ml-2 font-mono tabular-nums">{time}</span>
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.5, ease: EASE }}
                className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight leading-tight mb-4"
              >
                Independent creative lab.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.4 }}
                className="text-sm text-muted-foreground leading-relaxed max-w-sm"
              >
                We build the infrastructure that makes brand guidelines work, turning identity into
                structured context for every model, tool, and team.
              </motion.p>
            </div>

            {/* Logo mark */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
              className="shrink-0"
            >
              <img
                src="/logo-vsn-labs.png"
                alt="Visant Labs"
                className="w-20 h-20 object-contain opacity-80"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </motion.div>
          </div>

          {/* ── Team ─────────────────────────────────────────────────────── */}
          <Section label={t('about.teamTitle')} delay={0}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEAM.map((member) => (
                <motion.div key={member.name} {...inView()}>
                  <Link
                    to={member.profile}
                    className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-muted hover:bg-accent hover:border-border-hover transition-[color,background-color,border-color,opacity,filter] duration-200"
                    aria-label={member.name}
                  >
                    <div className="relative shrink-0">
                      <Thumb
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-[opacity,filter] duration-300"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                          member.status ? 'bg-success' : 'bg-muted-foreground'
                        }`}
                        aria-label={member.status ? 'online' : 'offline'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground transition-colors truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{member.role}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {member.bio}
                      </p>
                    </div>
                    <ArrowUpRight
                      size={14}
                      className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5"
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* ── Featured work ─────────────────────────────────────────────── */}
          <Section label="What we build" delay={0}>
            <div className="grid grid-cols-2 gap-3">
              {FEATURED_TOOLS.map((tool) => (
                <motion.div key={tool.label} {...inView()}>
                  <Link
                    to={tool.href}
                    className="group flex flex-col rounded-xl border border-border bg-muted hover:bg-accent hover:border-border-hover overflow-hidden transition-colors duration-200"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      <Thumb
                        src={tool.image}
                        alt={tool.label}
                        aspectRatio="16 / 9"
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium text-foreground transition-colors">
                        {tool.label}
                      </p>
                      <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* ── Links ────────────────────────────────────────────────────── */}
          <Section label={t('about.links.title')} delay={0}>
            <div className="flex flex-col gap-0">
              {LINKS.filter((l) => l.href).map((l) => (
                <motion.div key={l.label} {...inView()}>
                  <a
                    href={l.href!}
                    target={l.external ? '_blank' : undefined}
                    rel={l.external ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-3 py-2.5 border-b border-border group transition-colors last:border-0"
                    aria-label={l.label}
                  >
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                      {l.label}
                    </span>
                    {l.external ? (
                      <ExternalLink
                        size={10}
                        className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
                      />
                    ) : null}
                  </a>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <motion.div
            {...inView(0)}
            className="mt-10 pt-6 border-t border-border flex items-center justify-between"
          >
            <span className="text-xs text-muted-foreground">
              {t('about.openSource.description')}
            </span>
            <div className="flex items-center gap-4">
              <a
                href={getGithubUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github size={12} />
                GitHub
              </a>
              <Link
                to="/apps"
                className="flex items-center gap-1 font-mono text-2xs text-muted-foreground hover:text-foreground transition-colors"
              >
                /apps
                <ArrowRight size={10} />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Background VISANT wordmark */}
        <div
          className="fixed bottom-[-2vw] left-0 right-0 overflow-hidden select-none flex justify-center"
          style={{ pointerEvents: 'none' }}
          aria-hidden
        >
          <RepellantText
            className="text-[20vw] font-semibold leading-none tracking-tighter whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-b from-foreground/5 to-foreground/[0.03]"
            style={{ pointerEvents: 'auto' }}
          >
            VISANT
          </RepellantText>
        </div>
      </div>
    </>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ label: string; delay: number; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <motion.section
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.4 }}
    className="mb-12"
    aria-label={label}
  >
    <p className="text-xs font-medium text-muted-foreground mb-4">{label}</p>
    {children}
  </motion.section>
);
