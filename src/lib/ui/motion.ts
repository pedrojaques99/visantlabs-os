/**
 * Motion tokens (SSoT) — JS mirror of the CSS `--duration-*` / `--ease-*` tokens
 * defined in `src/index.css`. Use these for framer-motion transitions so timing
 * stays consistent across dialogs, wizards and micro-interactions instead of
 * scattering inline literals.
 *
 * Keep this in sync with the CSS block. Direction: subtle (Apple / Anthropic).
 */

/** seconds — framer-motion expects seconds, not ms */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

/** cubic-bezier control points */
export const EASE = {
  /** standard ease-out — the app's default */
  brand: [0.4, 0, 0.2, 1],
  /** gentle overshoot for enters/pops */
  spring: [0.34, 1.56, 0.64, 1],
} as const;

export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE.brand },
  base: { duration: DURATION.base, ease: EASE.brand },
  spring: { duration: DURATION.slow, ease: EASE.spring },
} as const;

/** Ready-to-spread framer-motion presets for enter/exit transitions. */
export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: transitions.base,
} as const;

/** Horizontal shared-axis step transition (wizards/steppers). */
export const stepSlide = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: transitions.base,
} as const;
