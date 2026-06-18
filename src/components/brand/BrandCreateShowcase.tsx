import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Box, LayoutGrid, Layers, Megaphone, Wand2, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { cn } from '@/lib/utils';

/**
 * BrandCreateShowcase — an owner-facing "Create" card on the brand overview.
 *
 * An auto-advancing slideshow of the main brand-aware apps, each inviting the
 * owner to put THIS brand to work. Backgrounds use the real app thumbnails
 * (public/tools/*.webp) where they exist, and fall back to a brand-palette
 * gradient for apps without imagery. The whole card is themed via the brand's
 * own CSS custom properties (--accent / --brand-surface / --brand-text), so it
 * "wears" the brand it sits inside. Built on framer-motion (already in the app);
 * no carousel dependency is added.
 */

interface CreateSlide {
  id: string;
  name: string;
  /** Route to open. brandScoped slides append ?brandId so the app pre-loads the brand. */
  path: string;
  brandScoped: boolean;
  Icon: LucideIcon;
  /** Real app thumbnail; null → brand-gradient fallback. */
  image: string | null;
  invite: string;
}

const SLIDES: CreateSlide[] = [
  {
    id: 'mockup',
    name: 'Mockup Machine',
    path: '/',
    brandScoped: false,
    Icon: Layers,
    image: '/tools/mockup-machine.webp',
    invite: 'Drop this brand onto real-world products.',
  },
  {
    id: 'create',
    name: 'Creative Studio',
    path: '/create',
    brandScoped: true,
    Icon: Wand2,
    image: null,
    invite: 'Generate a post that already looks like you.',
  },
  {
    id: 'canvas',
    name: 'Canvas',
    path: '/canvas',
    brandScoped: false,
    Icon: LayoutGrid,
    image: '/tools/canvas.webp',
    invite: 'Compose on-brand assets on an infinite canvas.',
  },
  {
    id: 'campaigns',
    name: 'Campaigns',
    path: '/campaigns',
    brandScoped: true,
    Icon: Megaphone,
    image: null,
    invite: 'Spin up a full ad campaign from this brand.',
  },
  {
    id: '3d',
    name: '3D Studio',
    path: '/3d-studio',
    brandScoped: false,
    Icon: Box,
    image: '/tools/3d-studio.webp',
    invite: 'Turn your logo into a dimensional scene.',
  },
];

const ADVANCE_MS = 4800;

export const BrandCreateShowcase: React.FC<{ brandId: string; className?: string }> = ({
  brandId,
  className,
}) => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = SLIDES[index];

  // Auto-advance, paused on hover/focus.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, ADVANCE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused]);

  const open = useCallback(
    (s: CreateSlide) => {
      const to = s.brandScoped ? `${s.path}?brandId=${brandId}` : s.path;
      navigate(to);
    },
    [brandId, navigate]
  );

  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 my-8', className)}>
      <div
        className="relative h-[280px] sm:h-[300px] rounded-2xl overflow-hidden border border-[var(--brand-text)]/10 bg-[var(--brand-surface)]/20"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {/* Background layer — crossfade */}
        <AnimatePresence mode="sync">
          <motion.div
            key={slide.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {slide.image ? (
              <img
                src={slide.image}
                alt=""
                aria-hidden
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              // Brand-palette fallback for apps without a thumbnail.
              <div
                className="w-full h-full"
                style={{
                  background:
                    'radial-gradient(120% 120% at 85% 15%, var(--accent) 0%, transparent 55%), linear-gradient(135deg, var(--brand-surface) 0%, var(--brand-bg) 100%)',
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Legibility overlay (brand-tinted) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-bg)] via-[var(--brand-bg)]/55 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-bg)]/70 to-transparent pointer-events-none" />

        {/* Top label */}
        <div className="absolute top-4 left-5 flex items-center gap-2">
          <Sparkles size={12} className="text-[var(--accent)]" />
          <MicroTitle className="text-[var(--brand-text)]/60 tracking-[0.18em]">
            Create with this brand
          </MicroTitle>
        </div>

        {/* Slide content */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="max-w-lg"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <slide.Icon size={16} className="text-[var(--accent)]" />
                <h3 className="text-lg sm:text-xl font-semibold text-[var(--brand-text)]">
                  {slide.name}
                </h3>
              </div>
              <p className="text-sm text-[var(--brand-text)]/70 mb-4">{slide.invite}</p>
              <button
                onClick={() => open(slide)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 transition-opacity"
              >
                Open {slide.name}
                <ArrowRight size={14} />
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="absolute bottom-5 right-5 flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ${s.name}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index
                  ? 'w-5 bg-[var(--accent)]'
                  : 'w-1.5 bg-[var(--brand-text)]/25 hover:bg-[var(--brand-text)]/45'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
