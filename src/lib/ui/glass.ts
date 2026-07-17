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
  //
  // Theme-aware (SSoT): surfaces use semantic tokens so glass frosts correctly
  // in BOTH themes. `bg-card/NN` is a translucent card (white-ish in light,
  // near-black in dark) that lets the blur show through. The 1px inset top
  // highlight is driven by `--foreground` so it reads as a light highlight on
  // dark and a subtle dark inset on light. Ambient drop shadow stays black
  // (shadows are dark in every theme). Hover uses `foreground/20` for a
  // theme-correct border lift.
  panel:
    'border border-border bg-card/80 backdrop-blur-lg shadow-[inset_0_1px_0_oklch(from_var(--foreground)_l_c_h/6%),0_8px_24px_-8px_rgba(0,0,0,0.35)] transition-colors hover:border-ring',
  panelSubtle:
    'border border-border bg-card/70 backdrop-blur-md transition-colors hover:border-ring',
  panelStrong:
    'border border-border bg-card/90 backdrop-blur-xl shadow-[inset_0_1px_0_oklch(from_var(--foreground)_l_c_h/8%),0_12px_32px_-8px_rgba(0,0,0,0.40)] transition-colors hover:border-ring',

  // ── Tile: interactive inner surface inside a panel (has hover, NO blur) ──
  tile: 'border border-border bg-muted/40 transition-colors hover:border-ring hover:bg-muted/60',
  // ── Surface: static inner surface / chip / input (NO hover, NO blur) ──
  surface: 'border border-border bg-muted/40',
  // ── Control: buttons / nav rows (readable fill, hover, NO blur) ──
  control:
    'border border-border bg-muted/50 transition-colors hover:border-ring hover:bg-accent',
  // ── Icon well: static, faint (NO hover, NO blur) ──
  icon: 'border border-border bg-muted/50',
} as const;
