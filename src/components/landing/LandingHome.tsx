import React, { useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Palette,
  Megaphone,
  Building2,
  Code,
  Box,
  BookOpen,
  LayoutGrid,
  FileText,
  Boxes,
  Image as ImageIcon,
  LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { GridDotsBackground } from '../ui/GridDotsBackground';
import { VisantLogo3D } from '../3d/VisantLogo3D';
import { Button } from '../ui/button';

gsap.registerPlugin(ScrollTrigger);

interface LandingHomeProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  isMobile: boolean;
}

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
    {children}
  </span>
);

export const LandingHome: React.FC<LandingHomeProps> = ({ onGetStarted, onSignIn, isMobile }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      // Animations only run when the user hasn't asked to reduce motion.
      // matchMedia reverts cleanly, leaving elements in their natural (visible) state.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero intro
        gsap.from('[data-hero] > *', {
          opacity: 0,
          y: 28,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
        });

        // Scroll-revealed blocks
        const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]');
        reveals.forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 36,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          });
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const segments: { icon: LucideIcon; title: string; pain: string; gain: string }[] = [
    {
      icon: Palette,
      title: t('landing.segments.designerTitle'),
      pain: t('landing.segments.designerPain'),
      gain: t('landing.segments.designerGain'),
    },
    {
      icon: Megaphone,
      title: t('landing.segments.marketingTitle'),
      pain: t('landing.segments.marketingPain'),
      gain: t('landing.segments.marketingGain'),
    },
    {
      icon: Building2,
      title: t('landing.segments.agencyTitle'),
      pain: t('landing.segments.agencyPain'),
      gain: t('landing.segments.agencyGain'),
    },
    {
      icon: Code,
      title: t('landing.segments.devTitle'),
      pain: t('landing.segments.devPain'),
      gain: t('landing.segments.devGain'),
    },
  ];

  const apps: { icon: LucideIcon; name: string; desc: string; route: string }[] = [
    {
      icon: Box,
      name: t('landing.apps.mockupName'),
      desc: t('landing.apps.mockupDesc'),
      route: '/mockupmachine',
    },
    {
      icon: BookOpen,
      name: t('landing.apps.brandName'),
      desc: t('landing.apps.brandDesc'),
      route: '/brand-guidelines',
    },
    {
      icon: LayoutGrid,
      name: t('landing.apps.canvasName'),
      desc: t('landing.apps.canvasDesc'),
      route: '/canvas',
    },
    {
      icon: FileText,
      name: t('landing.apps.contentName'),
      desc: t('landing.apps.contentDesc'),
      route: '/content-studio',
    },
    {
      icon: Boxes,
      name: t('landing.apps.studioName'),
      desc: t('landing.apps.studioDesc'),
      route: '/3d-studio',
    },
    {
      icon: ImageIcon,
      name: t('landing.apps.imageName'),
      desc: t('landing.apps.imageDesc'),
      route: '/image-lab',
    },
  ];

  const steps = [
    { title: t('landing.how.step1Title'), desc: t('landing.how.step1Desc') },
    { title: t('landing.how.step2Title'), desc: t('landing.how.step2Desc') },
    { title: t('landing.how.step3Title'), desc: t('landing.how.step3Desc') },
  ];

  const problems = [t('landing.problem.p1'), t('landing.problem.p2'), t('landing.problem.p3')];

  return (
    <div
      ref={rootRef}
      className="relative z-20 min-h-screen w-full bg-neutral-950 text-white overflow-x-hidden"
      data-vsn-page="home"
      data-vsn-component="LandingHome"
    >
      {/* Ambient 3D backdrop behind the hero (desktop only — perf) */}
      {!isMobile && (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-40" aria-hidden>
          <VisantLogo3D fullScreen presetIndex={1} xOffsetPx={0} />
        </div>
      )}
      <GridDotsBackground opacity={0.04} spacing={30} color="#ffffff" />

      {/* ── Top nav ─────────────────────────────────────────────── */}
      <nav className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-300">
          Visant Labs
        </span>
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/apps')}
            className="hidden sm:block font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            {t('landing.nav.apps')}
          </button>
          <button
            onClick={() => navigate('/community')}
            className="hidden sm:block font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            {t('landing.nav.community')}
          </button>
          <button
            onClick={onSignIn}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
          >
            {t('landing.nav.signin')}
          </button>
          <Button
            variant="brand"
            size="sm"
            onClick={onGetStarted}
            className="rounded-full font-mono text-[10px] uppercase tracking-widest"
          >
            {t('landing.nav.cta')}
          </Button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative z-20 mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-6 text-center">
        <div data-hero className="flex flex-col items-center gap-6">
          <Eyebrow>{t('landing.hero.eyebrow')}</Eyebrow>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t('landing.hero.titleLine1')}
            <br />
            <span className="text-neutral-500">{t('landing.hero.titleLine2')}</span>
          </h1>
          <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
            {t('landing.hero.subtitle')}
          </p>
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              variant="brand"
              onClick={onGetStarted}
              className="h-12 rounded-full px-8 text-[11px] font-bold uppercase tracking-widest"
            >
              {t('landing.hero.ctaPrimary')} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/apps')}
              className="h-12 rounded-full px-8 text-[11px] font-bold uppercase tracking-widest"
            >
              {t('landing.hero.ctaSecondary')}
            </Button>
          </div>
        </div>
        <span className="absolute bottom-4 font-mono text-[9px] uppercase tracking-widest text-neutral-700">
          {t('landing.hero.scroll')}
        </span>
      </header>

      {/* ── Problem ─────────────────────────────────────────────── */}
      <section className="relative z-20 border-t border-white/5 bg-neutral-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <div data-reveal className="flex flex-col gap-4">
            <Eyebrow>{t('landing.problem.eyebrow')}</Eyebrow>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('landing.problem.title')}
            </h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:grid-cols-3">
            {problems.map((p, i) => (
              <div key={i} data-reveal className="bg-neutral-950 p-6">
                <span className="font-mono text-xs text-neutral-600">0{i + 1}</span>
                <p className="mt-3 text-sm text-neutral-400">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="relative z-20 bg-neutral-950">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div data-reveal className="flex flex-col gap-4">
            <Eyebrow>{t('landing.how.eyebrow')}</Eyebrow>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('landing.how.title')}
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={i}
                data-reveal
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-neutral-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Segments ────────────────────────────────────────────── */}
      <section className="relative z-20 border-t border-white/5 bg-neutral-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div data-reveal className="flex flex-col gap-4">
            <Eyebrow>{t('landing.segments.eyebrow')}</Eyebrow>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('landing.segments.title')}
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {segments.map((seg, i) => (
              <div
                key={i}
                data-reveal
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-neutral-900">
                  <seg.icon className="h-4 w-4 text-neutral-300" />
                </div>
                <h3 className="text-base font-semibold text-white">{seg.title}</h3>
                <p className="font-mono text-xs text-neutral-500">{seg.pain}</p>
                <p className="text-sm text-neutral-400">{seg.gain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Apps / proof ────────────────────────────────────────── */}
      <section className="relative z-20 bg-neutral-950">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div data-reveal className="flex flex-col gap-3">
            <Eyebrow>{t('landing.apps.eyebrow')}</Eyebrow>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('landing.apps.title')}
            </h2>
            <p className="text-sm text-neutral-500">{t('landing.apps.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app, i) => (
              <button
                key={i}
                data-reveal
                onClick={() => navigate(app.route)}
                className="group flex flex-col gap-3 bg-neutral-950 p-6 text-left transition-colors hover:bg-neutral-900"
              >
                <app.icon className="h-5 w-5 text-neutral-400 transition-colors group-hover:text-neutral-200" />
                <h3 className="text-sm font-semibold text-neutral-200">{app.name}</h3>
                <p className="text-xs text-neutral-500">{app.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="relative z-20 border-t border-white/5 bg-neutral-950">
        <div
          data-reveal
          className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-28 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('landing.finalCta.title')}
          </h2>
          <p className="text-sm text-neutral-500">{t('landing.finalCta.subtitle')}</p>
          <Button
            variant="brand"
            onClick={onGetStarted}
            className="h-12 rounded-full px-10 text-[11px] font-bold uppercase tracking-widest"
          >
            {t('landing.finalCta.button')} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="relative z-20 border-t border-white/5 bg-neutral-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
            {t('landing.footer.tagline')}
          </span>
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate('/about')}
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              {t('home.info')}
            </button>
            <a
              href="mailto:contato@visant.co"
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              {t('home.contact')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
