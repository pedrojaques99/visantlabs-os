/**
 * Motion tokens (SSoT) — JS mirror of the `@theme` motion block in `src/index.css`.
 * The CSS `@theme` is the source of truth: if you change a value here, change it
 * there too (and vice-versa). These exist so framer-motion transitions read from
 * the same scale as the Tailwind `ease-*` / `duration-*` utilities instead of
 * scattering inline literals.
 *
 * Which token for what:
 *   EASE_OUT     → default. Anything entering or leaving the screen.
 *   EASE_IN_OUT  → an element MOVING/morphing while staying on screen.
 *   EASE_DRAWER  → sheets, drawers, bottom panels.
 *   DUR.press    → press/active feedback on controls (.12s).
 *   DUR.fast     → hover, small state flips (.16s).
 *   DUR.base     → default for UI transitions (.2s).
 *   DUR.slow     → ceiling for UI (.3s). Nothing interactive goes past 300ms.
 *
 * Rules: never `ease-in` on UI; never `scale(0)` (start at .95 + opacity);
 * animate transform + opacity only; `whileTap` always carries its own
 * transition or it inherits the (slower) enter one; spring is for
 * momentum/gesture (drag, flick), not for fading a menu.
 */

/** cubic-bezier control points — mirrors `--ease-out` */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** mirrors `--ease-in-out` */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
/** mirrors `--ease-drawer` */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** seconds — framer-motion expects seconds. Mirrors `--dur-*` (ms). */
export const DUR = {
  press: 0.12,
  fast: 0.16,
  base: 0.2,
  slow: 0.3,
} as const;

/**
 * seconds — mirrors the LEGACY `--duration-*` CSS tokens, which are also emitted
 * by `server/lib/brand-token-compiler.ts` into customer-exported CSS.
 * @deprecated for product UI — prefer `DUR`.
 * `DURATION.slow` (0.4s) is above the 300ms UI ceiling; only legitimate on
 * marketing/scroll surfaces.
 */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

/** cubic-bezier control points (legacy names). */
export const EASE = {
  /** mirrors `--ease-brand`. Actually an ease-in-out; prefer `EASE_OUT`. */
  brand: [0.4, 0, 0.2, 1],
  /**
   * mirrors `--ease-spring`. Overshoots (bounce).
   * @deprecated dated tell on UI enters — use `EASE_OUT`. Real springs belong
   * to momentum/gesture only (`type: 'spring'` on drag/flick).
   */
  spring: [0.34, 1.56, 0.64, 1],
} as const;

export const transitions = {
  /** press/active feedback — pair with `whileTap` */
  press: { duration: DUR.press, ease: EASE_OUT },
  fast: { duration: DUR.fast, ease: EASE_OUT },
  base: { duration: DUR.base, ease: EASE_OUT },
  slow: { duration: DUR.slow, ease: EASE_OUT },
  /** element moving/morphing while staying on screen */
  move: { duration: DUR.base, ease: EASE_IN_OUT },
  /** sheets, drawers, bottom panels */
  drawer: { duration: DUR.slow, ease: EASE_DRAWER },
  /** @deprecated bouncy enter — use `transitions.base` */
  spring: { duration: DURATION.slow, ease: EASE.spring },
} as const;

/** Ready-to-spread framer-motion presets for enter/exit transitions. */

/** Plain opacity crossfade — safest default, survives reduced motion as-is. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitions.base,
} as const;

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

/**
 * Short, capped stagger for list/grid items. Spread onto each item with its
 * index. The cap keeps long lists from turning into a slow cascade — past the
 * cap everything lands together.
 *
 * @example <motion.li key={id} {...itemEnter(i)} />
 */
export const itemEnter = (index: number, step = 0.04, cap = 0.4) =>
  ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: {
      ...transitions.fast,
      delay: Math.min(index * step, cap),
    },
  }) as const;

/**
 * Press feedback for clickable cards/tiles. Carries its own (fast) transition
 * so it does not inherit the slower enter transition of the element.
 *
 * @example <motion.button {...pressable} />
 */
export const pressable = {
  whileTap: { scale: 0.98 },
  transition: transitions.press,
} as const;
