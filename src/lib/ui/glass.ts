/**
 * Glass surface SSoT — canonical chrome for panels, tiles, controls and chips.
 *
 * Design rules (keep it optimized, not "over-glass"):
 *  - **Blur only on top-level panels.** Panels are few and large; nesting
 *    `backdrop-blur` inside an already-blurred panel is pure GPU waste and
 *    reads muddy. Tiles / controls / chips / icons therefore carry NO blur.
 *  - **Contained shadows.** Panels use a tight, negative-spread ambient shadow
 *    (`-8px` spread) + a 1px inset top highlight — not a big floating drop.
 *  - **Standard opacity steps** (`/10` → `/20`) so the design linter passes AND
 *    hover stays visible (base and hover must differ).
 */
export const glassSurface = {
  // ── Panels: large containers (GlassPanel, bento cards, profile cards) ──
  panel:
    'border border-white/10 bg-neutral-950/40 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-8px_rgba(0,0,0,0.35)] transition-colors hover:border-white/20',
  panelSubtle:
    'border border-white/10 bg-neutral-950/35 backdrop-blur-md transition-colors hover:border-white/20',
  panelStrong:
    'border border-white/20 bg-neutral-950/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_32px_-8px_rgba(0,0,0,0.40)] transition-colors hover:border-white/30',

  // ── Tile: interactive inner surface inside a panel (has hover, NO blur) ──
  tile:
    'border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20 hover:bg-white/5',
  // ── Surface: static inner surface / chip / input (NO hover, NO blur) ──
  surface: 'border border-white/10 bg-white/[0.03]',
  // ── Control: buttons / nav rows (readable fill, hover, NO blur) ──
  control:
    'border border-white/10 bg-white/5 transition-colors hover:border-white/20 hover:bg-white/10',
  // ── Icon well: static, faint (NO hover, NO blur) ──
  icon: 'border border-white/10 bg-neutral-950/55',
} as const;
