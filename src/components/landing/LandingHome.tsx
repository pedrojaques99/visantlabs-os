import React, { useRef, useLayoutEffect, useState, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTranslation } from '@/hooks/useTranslation';
import { VisantLogo3D, HERO_SHADER_NAMES, type HeroShaderName } from '../3d/VisantLogo3D';
import { Button } from '../ui/button';
import ASCIIFooter from '../ASCIIFooter';
import { useNavigate } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

interface LandingHomeProps {
  onGetStarted: () => void;
  isMobile: boolean;
}

// Secondary tools — scrolling motion band, no labels.
const MARQUEE = [
  'moodboard-studio',
  'color-extractor',
  'halftone-machine',
  'riso-machine',
  'grid-machine',
  'upscale',
  'remove-bg',
  'smart-analyzer',
  'gridpaint',
  'ascii-vortex',
];

const Marquee: React.FC<{ names: string[]; reverse?: boolean; speed?: number }> = ({
  names,
  reverse = false,
  speed = 55,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          trackRef.current,
          { xPercent: reverse ? -50 : 0 },
          { xPercent: reverse ? 0 : -50, duration: speed, ease: 'none', repeat: -1 }
        );
      });
    }, trackRef);
    return () => ctx.revert();
  }, [reverse, speed]);
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div ref={trackRef} className="flex gap-4 w-max">
        {[...names, ...names].map((name, i) => (
          <div
            key={`${name}-${i}`}
            className="shrink-0 w-[200px] md:w-[280px] h-32 md:h-44 rounded-xl overflow-hidden border border-white/10 bg-neutral-900"
          >
            <img
              src={`/tools/${name}.webp`}
              alt=""
              aria-hidden
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const LandingHome: React.FC<LandingHomeProps> = ({ onGetStarted, isMobile }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [shaderIntensity, setShaderIntensity] = useState(0.25);
  const [ctaGlow, setCtaGlow] = useState({ x: 50, y: 50, active: false });
  const intensityRef = useRef(0.25);
  const targetIntensityRef = useRef(0.25);
  const rafRef = useRef<number>(0);

  const lerpIntensity = (target: number) => {
    targetIntensityRef.current = target;
    const step = () => {
      const cur = intensityRef.current;
      const tgt = targetIntensityRef.current;
      const next = cur + (tgt - cur) * 0.28;
      if (Math.abs(next - tgt) < 0.004) {
        intensityRef.current = tgt;
        setShaderIntensity(tgt);
        return;
      }
      intensityRef.current = next;
      setShaderIntensity(next);
      rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current!);
    rafRef.current = requestAnimationFrame(step);
  };

  // Pick one shader per session, stable across re-renders
  const sessionShader = useMemo<HeroShaderName>(() => {
    const KEY = 'vsn-hero-shader';
    const stored = sessionStorage.getItem(KEY) as HeroShaderName | null;
    if (stored && (HERO_SHADER_NAMES as readonly string[]).includes(stored)) return stored;
    const pick = HERO_SHADER_NAMES[Math.floor(Math.random() * HERO_SHADER_NAMES.length)];
    sessionStorage.setItem(KEY, pick);
    return pick;
  }, []);

  // Featured tools — the bento. First one is wide. Image + short label.
  const bento = [
    {
      img: 'mockup-machine',
      name: t('landing.bento.mockupName'),
      desc: t('landing.bento.mockupDesc'),
      wide: true,
    },
    {
      img: 'brand-guidelines',
      name: t('landing.bento.brandName'),
      desc: t('landing.bento.brandDesc'),
    },
    { img: 'canvas', name: t('landing.bento.canvasName'), desc: t('landing.bento.canvasDesc') },
    { img: '3d-studio', name: t('landing.bento.studioName'), desc: t('landing.bento.studioDesc') },
    {
      img: 'branding-machine',
      name: t('landing.bento.brandingName'),
      desc: t('landing.bento.brandingDesc'),
    },
  ];

  useLayoutEffect(() => () => cancelAnimationFrame(rafRef.current!), []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-hero] > *', {
          opacity: 0,
          y: 28,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.1,
        });
        gsap.from('[data-stage]', {
          opacity: 0,
          scale: 0.92,
          duration: 1.2,
          ease: 'power3.out',
          delay: 0.3,
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 36,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          });
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative z-20 min-h-screen w-full overflow-x-hidden bg-neutral-950 text-white pt-10 md:pt-14"
      data-vsn-page="home"
      data-vsn-component="LandingHome"
    >
      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative h-[100svh] min-h-[640px] overflow-hidden">
        {/* 3D logo as full background */}
        <div data-stage aria-hidden className="absolute inset-0 z-0 opacity-60">
          <VisantLogo3D
            presetIndex={1}
            xOffsetPx={0}
            shaderName={sessionShader}
            shaderIntensity={shaderIntensity}
          />
        </div>

        {/* Bottom fade so hero bleeds into bento cleanly */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-neutral-950 to-transparent z-10"
        />

        {/* Hero text — pointer-events-none so drag passes through to canvas; buttons restore it */}
        <div className="pointer-events-none relative z-20 flex h-full flex-col items-center justify-center px-6 text-center">
          <div data-hero className="flex flex-col items-center gap-7">
            <h1 className="text-5xl font-semibold leading-[0.91] tracking-[-0.08em] sm:text-7xl lg:text-[6rem]">
              <span className="block text-white">{t('landing.hero.titleLine1')}</span>
              <span className="block text-brand-cyan">{t('landing.hero.titleLine2')}</span>
            </h1>
            <p className="max-w-lg text-base text-neutral-400 sm:text-lg">
              {t('landing.hero.subtitle')}
            </p>
            <div
              className="pointer-events-auto mt-1 flex flex-col items-center gap-3 sm:flex-row"
              onMouseEnter={() => lerpIntensity(2)}
              onMouseLeave={() => lerpIntensity(0.25)}
            >
              <Button
                variant="brand"
                onClick={onGetStarted}
                className="h-12 rounded-full px-8 text-sm font-semibold"
              >
                {t('landing.hero.ctaPrimary')}
              </Button>
              <Button
                variant="outline"
                onClick={onGetStarted}
                className="h-12 rounded-full px-8 text-sm font-semibold"
              >
                {t('landing.hero.ctaSecondary')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div data-reveal className="mb-14 flex flex-col gap-3 text-center">
          <span className="font-redhatmono text-[10px] uppercase tracking-widest text-neutral-500">
            {t('landing.howItWorks.eyebrow')}
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('landing.howItWorks.title')}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-3 rounded-2xl overflow-hidden border border-white/5">
          {[
            {
              num: t('landing.howItWorks.step1Num'),
              title: t('landing.howItWorks.step1Title'),
              desc: t('landing.howItWorks.step1Desc'),
            },
            {
              num: t('landing.howItWorks.step2Num'),
              title: t('landing.howItWorks.step2Title'),
              desc: t('landing.howItWorks.step2Desc'),
            },
            {
              num: t('landing.howItWorks.step3Num'),
              title: t('landing.howItWorks.step3Title'),
              desc: t('landing.howItWorks.step3Desc'),
            },
          ].map((step) => (
            <div
              key={step.num}
              data-reveal
              className="flex flex-col gap-5 bg-neutral-950 p-8 sm:p-10"
            >
              <span className="font-redhatmono text-[11px] text-neutral-600 tracking-widest">
                {step.num}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-white tracking-tight">{step.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bento ───────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div data-reveal className="mb-10 flex flex-col gap-3 text-center">
          <span className="font-redhatmono text-[10px] uppercase tracking-widest text-neutral-500">
            {t('landing.bento.eyebrow')}
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('landing.bento.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bento.map((tool) => (
            <button
              key={tool.img}
              data-reveal
              onClick={onGetStarted}
              className={`group relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10 text-left transition-colors hover:border-white/20 sm:min-h-[240px] ${
                tool.wide ? 'sm:col-span-2 lg:col-span-2' : ''
              }`}
            >
              <img
                src={`/tools/${tool.img}.webp`}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
              <div className="relative z-10 flex h-full flex-col justify-end p-5">
                <span className="font-redhatmono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">
                  {tool.name}
                </span>
                <p className="max-w-xs text-sm font-medium text-white">{tool.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-white/5 py-5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6">
          {[
            t('landing.trust.label1'),
            t('landing.trust.label2'),
            t('landing.trust.label3'),
            t('landing.trust.label4'),
          ].map((label) => (
            <span
              key={label}
              className="font-redhatmono text-[11px] uppercase tracking-widest text-neutral-500"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Motion band ─────────────────────────────────────────── */}
      <section className="relative z-10 py-6">
        <Marquee names={MARQUEE} speed={60} />
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden min-h-[420px] cursor-default"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setCtaGlow({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
            active: true,
          });
        }}
        onMouseLeave={() => setCtaGlow((g) => ({ ...g, active: false }))}
      >
        {/* Subtle ambient gradient base */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_120%,rgba(82,221,235,0.07),transparent)]"
        />
        {/* Mouse-follow glow — CSS only, no GPU */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
          style={{
            opacity: ctaGlow.active ? 1 : 0,
            background: `radial-gradient(500px at ${ctaGlow.x}% ${ctaGlow.y}%, rgba(82,221,235,0.1), transparent 65%)`,
          }}
        />
        <div
          data-reveal
          className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 py-28 text-center sm:py-36"
        >
          <h2 className="text-4xl font-semibold leading-[0.91] tracking-[-0.08em] text-white sm:text-6xl">
            {t('landing.finalCta.title')}
          </h2>
          <Button
            variant="brand"
            onClick={onGetStarted}
            className="h-12 rounded-full px-10 text-sm font-semibold"
          >
            {t('landing.finalCta.button')}
          </Button>
          <p className="font-redhatmono text-[10px] uppercase tracking-widest text-neutral-600">
            {t('landing.finalCta.anchor')}
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <ASCIIFooter
        isDarkMode
        onPrivacyClick={() => navigate('/privacy')}
        onTermsClick={() => navigate('/terms')}
        onUsagePolicyClick={() => navigate('/usage-policy')}
        onRefundClick={() => navigate('/refund-policy')}
      />
    </div>
  );
};
