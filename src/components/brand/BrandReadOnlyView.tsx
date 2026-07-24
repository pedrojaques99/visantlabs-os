import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colord } from 'colord';
import { Download, MousePointerClick, Diamond, User, Copy, FileCode } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Masonry } from '@/components/ui/Masonry';
import type { BrandGuideline } from '@/lib/figma-types';
import { manifestoText } from '@/lib/brandManifesto';
import { FullScreenViewer } from '@/components/FullScreenViewer';
import { copyToClipboard, copyImageAsPng } from '@/utils/clipboard';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { getArchetypeImage } from '@/constants/archetypeImages';
import { InlineEditable } from './InlineEditable';

export type BrandViewSection =
  | 'identity'
  | 'coreMessage'
  | 'pillars'
  | 'manifesto'
  | 'archetypes'
  | 'personas'
  | 'voiceValues'
  | 'colors'
  | 'typography'
  | 'logos'
  | 'media'
  | 'guidelines';

type AssetType = 'logo' | 'media';

export interface BrandReadOnlyViewProps {
  guideline: BrandGuideline;
  /** compact = sidebar-friendly single-column tight layout. full = page layout. */
  compact?: boolean;
  /** Restrict which sections render. Default: all. */
  sections?: BrandViewSection[];
  /** Client-side text filter (color name/hex, logo label/variant, media label). */
  searchTerm?: string;
  /** Override the default "copy hex to clipboard" on color click. */
  onColorClick?: (hex: string, item: { name?: string; role?: string }) => void;
  /** Override the default "download asset" on logo/media click. */
  onAssetClick?: (url: string, type: AssetType, item: any) => void;
  /** Enable dragging assets out of the view (drag-to-chat, drag-to-canvas, etc.). */
  onAssetDragStart?: (e: React.DragEvent, url: string, type: AssetType) => void;
  /** Render an action node (e.g. edit button) anchored to each section header. */
  renderSectionActions?: (section: BrandViewSection) => React.ReactNode;
  /** Owner inline editing of prose fields (identity/manifesto/coreMessage). */
  editable?: boolean;
  onPatch?: (patch: Partial<BrandGuideline>) => void;
  className?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Accessibility + theming helpers (reusable)
// ──────────────────────────────────────────────────────────────────────────────

export function getRelativeLuminance(hex: string): number {
  // Normalize any CSS color (3-digit hex, rgb(), named) to 6-digit hex first —
  // the raw `.replace/.padEnd` below mis-parses '#fff' as '#fff000'.
  const c = colord(hex);
  const h = (c.isValid() ? c.toHex() : '#000000').replace('#', '').padEnd(6, '0');
  const rgb = [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function getContrastRatio(l1: number, l2: number): number {
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// WCAG AA contrast threshold for normal-size text.
const AA_TEXT = 4.5;

/** WCAG contrast ratio between two hex colors. */
function contrastHex(a: string, b: string): number {
  return getContrastRatio(getRelativeLuminance(a), getRelativeLuminance(b));
}

/**
 * Nudge `fg` (hue preserved) toward the bg's opposite luminance pole until it
 * clears `target` WCAG contrast on `bg`, re-saturating lightly so the brand hue
 * stays vivid instead of washing out. Snaps to pure ink only if unreachable.
 * This is what keeps brand accents/links readable instead of hard black/white.
 */
function ensureReadable(fg: string, bg: string, target = AA_TEXT): string {
  let c = colord(fg);
  if (!c.isValid()) c = colord('#888888');
  if (contrastHex(c.toHex(), bg) >= target) return c.toHex();
  const towardLight = colord(bg).isDark();
  for (let i = 0; i < 50; i++) {
    // Lighten/darken only — never saturate: re-saturating a near-neutral color
    // amplifies its residual hue into a hallucinated cast (black → rose).
    c = towardLight ? c.lighten(0.04) : c.darken(0.04);
    const hex = c.toHex();
    if (contrastHex(hex, bg) >= target) return hex;
    const b = c.brightness();
    if ((towardLight && b >= 0.98) || (!towardLight && b <= 0.02)) break;
  }
  return colord(bg).isDark() ? '#ffffff' : '#111111';
}

/** Most chromatic, mid-luminance palette color — the brand's signature hue. */
function pickChromatic(hexes: string[]): string | undefined {
  return hexes
    .map((hex) => ({ hex, hsl: colord(hex).toHsl() }))
    .filter((x) => x.hsl.l > 10 && x.hsl.l < 90)
    .sort((a, b) => b.hsl.s - a.hsl.s)[0]?.hex;
}

/** Saturated & mid-luminance enough to serve as a UI accent (a pop, not ink). */
function isVivid(hex: string): boolean {
  const { s, l } = colord(hex).toHsl();
  return s >= 25 && l >= 20 && l <= 88;
}

export function toCSSVariables(g: BrandGuideline): string {
  const lines: string[] = [':root {'];
  g.colors?.forEach((c) => {
    const name = (c.name || 'color')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    lines.push(`  --color-${name}: ${c.hex};`);
  });
  g.typography?.forEach((t) => {
    const role = (t.role || 'font')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    lines.push(`  --font-${role}: '${t.family}', sans-serif;`);
  });
  lines.push('}');
  return lines.join('\n');
}

export type BrandTheme = {
  accent: string;
  accentRgb: string;
  /** Readable text color to use ON the accent background (black or white, WCAG AA). */
  accentText: string;
  bg: string;
  surface: string;
  text: string;
  isCustomBg: boolean;
};

/**
 * Resolve a readable theme from a brand palette for a given visual mode.
 * Used by PublicBrandGuideline's light/dark/brand toggle. Exported so other
 * routes can theme themselves from a guideline without reimplementing the
 * contrast-fix logic.
 */
export function extractBrandTheme(
  guideline: BrandGuideline | null | undefined,
  mode: 'brand' | 'light' | 'dark' = 'brand'
): BrandTheme {
  const findByRole = (role: string) =>
    guideline?.colors?.find(
      (c) => c.role?.toUpperCase() === role || c.name?.toUpperCase() === role
    );
  const findByMatch = (keywords: string[]) =>
    guideline?.colors?.find((c) =>
      keywords.some((k) => c.name?.toLowerCase().includes(k) || c.role?.toLowerCase().includes(k))
    );

  const colors = guideline?.colors || [];
  const hexes = colors.map((c) => c.hex).filter(Boolean) as string[];

  // ── Accent: the brand's VIVID signature, not a base neutral. A black or
  // white tagged "primary" is ink/canvas — honor an explicit accent role only
  // when it's actually chromatic; otherwise take the most chromatic swatch. ──
  const roleAccent =
    findByRole('ACCENT')?.hex ||
    findByRole('PRIMARY')?.hex ||
    findByMatch(['brand', 'primary', 'accent', 'main'])?.hex;
  const accentRaw =
    (roleAccent && isVivid(roleAccent) ? roleAccent : undefined) ||
    pickChromatic(hexes) ||
    roleAccent ||
    hexes[0] ||
    '#888888';

  // Palette poles by luminance drive the light/dark derivations.
  const byLum = [...hexes].sort((a, b) => getRelativeLuminance(a) - getRelativeLuminance(b));
  const lightest = byLum[byLum.length - 1] || '#ffffff';
  const darkest = byLum[0] || '#0a0a0a';

  const accentHsl = colord(accentRaw).toHsl();
  // Grayscale brands shouldn't get a phantom color cast on their dark canvas.
  const tintS = accentHsl.s < 12 ? 0 : 16;

  let rBg: string;
  let rSurface: string;
  let rText: string;

  if (mode === 'light') {
    // Brand LIGHT theme: near-white canvas, darkest brand ink for text.
    rBg = getRelativeLuminance(lightest) > 0.75 ? lightest : '#ffffff';
    rSurface = colord(rBg).darken(0.05).toHex();
    rText = ensureReadable(darkest, rBg, AA_TEXT);
  } else if (mode === 'dark') {
    // Brand DARK theme: near-black canvas subtly tinted with the brand hue,
    // light ink lifted to AA. This is what the app renders in dark mode.
    rBg = colord({ h: accentHsl.h, s: tintS, l: 7 }).toHex();
    rSurface = colord({ h: accentHsl.h, s: Math.min(tintS, 14), l: 12 }).toHex();
    rText = ensureReadable(lightest, rBg, AA_TEXT);
  } else {
    // 'brand' — honor declared tokens, falling back to the palette's poles,
    // then enforce contrast so a self-declared theme still reads.
    const bgTok =
      findByRole('BACKGROUND') || findByRole('BG') || findByMatch(['background', 'canvas', 'bg']);
    const surfTok = findByRole('SURFACE') || findByRole('CARD') || findByMatch(['surface', 'card']);
    const textTok =
      findByRole('TEXT') || findByRole('HEADLINE') || findByMatch(['text', 'content', 'body']);
    rBg = bgTok?.hex || darkest || '#0a0a0a';
    const bgDark = colord(rBg).isDark();
    rSurface =
      surfTok?.hex ||
      (bgDark ? colord(rBg).lighten(0.06).toHex() : colord(rBg).darken(0.05).toHex());
    rText = ensureReadable(textTok?.hex || (bgDark ? lightest : darkest), rBg, AA_TEXT);
  }

  // Surface must read as a distinct layer from the canvas.
  if (contrastHex(rSurface, rBg) < 1.08) {
    rSurface = colord(rBg).isDark()
      ? colord(rBg).lighten(0.06).toHex()
      : colord(rBg).darken(0.05).toHex();
  }

  const toRgb = (hex: string) => {
    const { r, g, b } = colord(hex).toRgb();
    return `${r}, ${g}, ${b}`;
  };

  // Accent is used both as a fill AND as text/icon on the canvas, so pin it to
  // AA against the resolved bg (hue preserved) — links/labels never wash out.
  const accent = ensureReadable(accentRaw, rBg, AA_TEXT);
  const accentText = contrastHex(accent, '#000000') >= AA_TEXT ? '#000000' : '#ffffff';

  return {
    accent,
    accentRgb: toRgb(accent),
    accentText,
    bg: rBg,
    surface: rSurface,
    text: rText,
    isCustomBg:
      mode === 'brand' && (!!findByRole('BACKGROUND') || !!findByMatch(['background', 'bg'])),
  };
}

import { triggerAssetDownload, safeFileName, extFromUrl } from './brand-shared-config';

// ──────────────────────────────────────────────────────────────────────────────
// Section sub-components (exported for custom composition)
// ──────────────────────────────────────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

interface SectionCommonProps {
  guideline: BrandGuideline;
  compact?: boolean;
  /** When true, prose fields become inline-editable. */
  editable?: boolean;
  /** Persist an inline edit (merged patch). */
  onPatch?: (patch: Partial<BrandGuideline>) => void;
}

const CompactSectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <MicroTitle className="text-[10px] text-neutral-600">{label}</MicroTitle>
);

const FullSectionHeader: React.FC<{ label: string; className?: string }> = ({
  label,
  className,
}) => <h2 className={cn('text-4xl font-bold font-manrope opacity-90', className)}>{label}</h2>;

export const BrandIdentityView: React.FC<SectionCommonProps> = ({
  guideline,
  compact,
  editable,
  onPatch,
}) => {
  const identity = guideline.identity || {};
  if (!editable && !identity.description && !identity.tagline) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Identity" />
        {identity.tagline && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
            {identity.tagline}
          </p>
        )}
        {identity.description && (
          <p className="text-xs text-neutral-400 leading-relaxed">{identity.description}</p>
        )}
      </div>
    );
  }

  return (
    <motion.section
      id="identity"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="flex flex-col gap-10">
        <FullSectionHeader label="Identity" />
        {(editable || identity.description || identity.tagline) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              {(editable || identity.description) && (
                <InlineEditable
                  as="p"
                  multiline
                  editable={editable}
                  value={identity.description || ''}
                  placeholder="Brand description…"
                  onCommit={(v) => onPatch?.({ identity: { ...identity, description: v } })}
                  className="text-lg md:text-xl leading-relaxed font-light opacity-70"
                />
              )}
            </div>
            <div className="space-y-8">
              {(editable || identity.tagline) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[var(--brand-text)]/50 uppercase tracking-widest">
                    Brand Tagline
                  </span>
                  <InlineEditable
                    as="p"
                    editable={editable}
                    value={identity.tagline || ''}
                    placeholder="Tagline…"
                    onCommit={(v) => onPatch?.({ identity: { ...identity, tagline: v } })}
                    className="text-sm font-bold uppercase opacity-80"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
};

// Static column classes for the 1-or-3 triplet layouts (Tailwind can't purge
// dynamically-built `md:grid-cols-${n}` names, so map them explicitly).
const TRIPLET_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
};

export const BrandCoreMessageView: React.FC<SectionCommonProps> = ({
  guideline,
  compact,
  editable,
  onPatch,
}) => {
  const cm: { product?: string; differential?: string; emotionalBond?: string } =
    guideline.strategy?.coreMessage || {};
  if (!editable && !cm.product && !cm.differential && !cm.emotionalBond) return null;
  const setField = (key: 'product' | 'differential' | 'emotionalBond') => (v: string) =>
    onPatch?.({
      strategy: { ...guideline.strategy, coreMessage: { ...cm, [key]: v } } as any,
    });

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Mensagem Central" />
        <p className="text-xs text-neutral-400 leading-relaxed">
          {cm.product}
          {cm.differential && ` + ${cm.differential}`}
          {cm.emotionalBond && ` → ${cm.emotionalBond}`}
        </p>
      </div>
    );
  }

  const fields: Array<['product' | 'differential' | 'emotionalBond', string, string]> = [
    ['product', 'Produto', 'Produto…'],
    ['differential', 'Diferencial', 'Diferencial…'],
    ['emotionalBond', 'Elo Emocional', 'Elo emocional…'],
  ];
  const hasContent = !!(cm.product || cm.differential || cm.emotionalBond);
  const visible = fields.filter(([key]) => editable || cm[key]);

  // Empty + editable → compact single-row of light fields, so the placeholder
  // state doesn't dominate the page with three tall cards.
  if (editable && !hasContent) {
    return (
      <div className="space-y-4">
        <FullSectionHeader label="Mensagem Central" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fields.map(([key, label, ph]) => (
            <div
              key={key}
              className="rounded-xl bg-[var(--brand-surface)]/10 border border-[var(--brand-text)]/[0.06] px-4 py-3"
            >
              <MicroTitle className="text-[var(--accent)]/40 mb-1.5">{label}</MicroTitle>
              <InlineEditable
                as="p"
                multiline
                editable
                value={cm[key] || ''}
                placeholder={ph}
                onCommit={setField(key)}
                className="text-sm font-medium opacity-70"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Filled → break 1-or-3 (never an orphaned 2+1); auto-fit so 1 or 2 filled
  // fields still balance the row.
  return (
    <div className="space-y-8">
      <FullSectionHeader label="Mensagem Central" />
      <div
        className={cn('grid grid-cols-1 gap-8', TRIPLET_COLS[visible.length] || 'md:grid-cols-3')}
      >
        {visible.map(([key, label, ph]) => (
          <GlassPanel
            key={key}
            padding="md"
            className="bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10"
          >
            <MicroTitle className="text-[var(--accent)]/40 mb-3">{label}</MicroTitle>
            <InlineEditable
              as="p"
              multiline
              editable={editable}
              value={cm[key] || ''}
              placeholder={ph}
              onCommit={setField(key)}
              className="text-lg font-medium opacity-80"
            />
          </GlassPanel>
        ))}
      </div>
    </div>
  );
};

export const BrandPillarsView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const pillars = guideline.strategy?.pillars;
  if (!pillars?.length) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Pilares" />
        <div className="flex flex-wrap gap-2">
          {pillars.map((p, i) => (
            <span
              key={i}
              className="text-xs font-semibold text-neutral-300 bg-white/5 px-2 py-0.5 rounded"
            >
              {p.value}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Adaptive columns so a set of 3 lands as a clean 1-or-3 row instead of an
  // orphaned 2+1 (matches the strategy triplets); 4+ keep the 2-col rhythm.
  const cols = pillars.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div className="space-y-8">
      <FullSectionHeader label="Pilares" />
      <div className={cn('grid grid-cols-1 gap-8', cols)}>
        {pillars.map((p, i) => (
          <GlassPanel
            key={i}
            padding="md"
            className="bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-bold opacity-20">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h4 className="text-xl font-bold opacity-90">{p.value}</h4>
            </div>
            <p className="text-sm font-light opacity-60 leading-relaxed">{p.description}</p>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
};

export const BrandManifestoView: React.FC<SectionCommonProps> = ({
  guideline,
  compact,
  editable,
  onPatch,
}) => {
  const raw = guideline.strategy?.manifesto;
  if (!editable && !raw) return null;

  const isStructured = typeof raw === 'object' && raw !== null;
  const fullText = manifestoText(raw);
  if (!editable && !fullText) return null;

  // Structured object used for inline editing (seed legacy string into `full`).
  const m: { provocation?: string; tension?: string; promise?: string; full?: string } =
    isStructured ? (raw as any) : typeof raw === 'string' && raw ? { full: raw } : {};
  const setManifesto = (key: 'provocation' | 'tension' | 'promise') => (v: string) =>
    onPatch?.({ strategy: { ...guideline.strategy, manifesto: { ...m, [key]: v } } });
  const setFull = (v: string) =>
    onPatch?.({ strategy: { ...guideline.strategy, manifesto: { ...m, full: v } } });

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Manifesto" />
        <p className="text-xs text-neutral-400 italic leading-relaxed whitespace-pre-line line-clamp-6">
          &ldquo;{fullText}&rdquo;
        </p>
      </div>
    );
  }

  const fields: Array<['provocation' | 'tension' | 'promise', string, string]> = [
    ['provocation', 'Provocação', m.provocation || ''],
    ['tension', 'Tensão', m.tension || ''],
    ['promise', 'Promessa', m.promise || ''],
  ];
  const hasContent = !!(m.provocation || m.tension || m.promise);

  const header = (
    <div className="flex items-center gap-4">
      <div className="h-[1px] w-12 bg-[var(--accent)]/30" />
      <MicroTitle className="text-[var(--accent)]/60">[Manifesto]</MicroTitle>
    </div>
  );

  // Pillars own the section when they exist, or when there's nothing at all to
  // show and the owner is editing (three fields to fill beats a blank hero).
  // NOT on `editable` alone: that short-circuit meant an owner in edit mode saw
  // three empty placeholders while a perfectly good `full` text rendered nowhere.
  if (hasContent || (editable && !fullText)) {
    const visible = fields.filter(([, , value]) => editable || value);

    // Empty + editable → compact light fields instead of three tall placeholders.
    if (editable && !hasContent) {
      return (
        <div className="space-y-6">
          {header}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {fields.map(([key, label, value]) => (
              <div
                key={key}
                className="rounded-xl bg-[var(--brand-surface)]/10 border border-[var(--brand-text)]/[0.06] px-4 py-3"
              >
                <MicroTitle className="text-[var(--accent)]/40 mb-1.5">{label}</MicroTitle>
                <InlineEditable
                  as="p"
                  multiline
                  editable
                  value={value}
                  placeholder={`${label}…`}
                  onCommit={setManifesto(key)}
                  className="text-sm leading-relaxed font-light opacity-70"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-12">
        {header}
        <div
          className={cn(
            'grid grid-cols-1 gap-12',
            TRIPLET_COLS[visible.length] || 'md:grid-cols-3'
          )}
        >
          {visible.map(([key, label, value]) => (
            <div key={key} className="space-y-3">
              <MicroTitle className="text-[var(--accent)]/40">{label}</MicroTitle>
              <InlineEditable
                as="p"
                multiline
                editable={editable}
                value={value}
                placeholder={`${label}…`}
                onCommit={setManifesto(key)}
                className="text-lg leading-relaxed font-light opacity-70"
              />
            </div>
          ))}
        </div>
        {m.full && (
          <p className="text-xl leading-relaxed font-light opacity-60 mt-8 italic">
            &ldquo;{m.full}&rdquo;
          </p>
        )}
      </div>
    );
  }

  // The manifesto is running text — render it as the hero it is.
  const [firstLine, ...rest] = fullText.split('\n');
  return (
    <div className="space-y-12">
      {header}
      <div className="relative group">
        <div className="absolute -inset-8 bg-[var(--accent)]/[0.02] blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        {editable ? (
          // Edit the whole text as one field — the first-line/rest split below is
          // presentation, not structure, so editing it piecewise would be a lie.
          <InlineEditable
            as="p"
            multiline
            editable
            value={fullText}
            placeholder="Manifesto…"
            onCommit={setFull}
            className="text-2xl md:text-3xl leading-relaxed font-light opacity-80 whitespace-pre-line"
          />
        ) : (
          <>
            <h3 className="text-4xl md:text-6xl font-bold tracking-tight font-manrope leading-[1.1] opacity-90">
              {firstLine}
            </h3>
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16">
                {rest.map((para, i) => (
                  <p key={i} className="text-lg md:text-xl leading-relaxed font-light opacity-60">
                    {para}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Owner still needs a way to add the provocação/tensão/promessa arc on top
          of an ingested text — otherwise the pillars would be unreachable here. */}
      {editable && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fields.map(([key, label, value]) => (
            <div
              key={key}
              className="rounded-xl bg-[var(--brand-surface)]/10 border border-[var(--brand-text)]/[0.06] px-4 py-3"
            >
              <MicroTitle className="text-[var(--accent)]/40 mb-1.5">{label}</MicroTitle>
              <InlineEditable
                as="p"
                multiline
                editable
                value={value}
                placeholder={`${label}…`}
                onCommit={setManifesto(key)}
                className="text-sm leading-relaxed font-light opacity-70"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Deterministic neutral photo placeholder for empty archetype/persona slots.
// Grayscale reads as a placeholder; real images replace it once uploaded to R2.
function placeholderImage(seed: string, w = 600, h = 800): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed || 'brand')}/${w}/${h}?grayscale`;
}

// Image that falls back to a placeholder photo when no src, then to an icon if both fail.
const ImgOrFallback: React.FC<{
  src?: string;
  alt: string;
  seed: string;
  fallback: React.ReactNode;
  fit?: 'cover' | 'contain';
  /** When false, skip the photo placeholder and render `fallback` if there's no src. */
  usePlaceholder?: boolean;
}> = ({ src, alt, seed, fallback, fit, usePlaceholder = true }) => {
  const [failed, setFailed] = useState(false);
  const isReal = !!src;
  if ((!src && !usePlaceholder) || failed) return <>{fallback}</>;
  const url = src || placeholderImage(seed);
  const objectFit = fit || (isReal ? 'object-contain' : 'object-cover');
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('w-full h-full', objectFit === 'cover' ? 'object-cover' : 'object-contain')}
    />
  );
};

export const BrandArchetypesView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const archetypes = guideline.strategy?.archetypes || [];
  if (archetypes.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Archetypes" />
        <div className="flex flex-col gap-1.5">
          {archetypes.map((a, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold text-neutral-300 uppercase tracking-wide">{a.name}</span>
              {a.description && (
                <p className="text-[11px] text-neutral-500 leading-snug mt-0.5 line-clamp-2">
                  {a.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <ArchetypesInteractive archetypes={archetypes} />;
};

/**
 * Progressive-disclosure archetypes: cards show only image + name by default.
 * Clicking a card reveals a single detail panel below with the running
 * description + examples. Nothing is expanded on first paint.
 */
const ArchetypesInteractive: React.FC<{
  archetypes: NonNullable<NonNullable<BrandGuideline['strategy']>['archetypes']>;
}> = ({ archetypes }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected !== null ? archetypes[selected] : null;

  // Portrait cards: a single one centers; 3 go 3-up; everything else keeps a 2-col
  // rhythm — never an orphaned 2+1.
  const gridCls =
    archetypes.length === 1
      ? 'grid grid-cols-1 max-w-[280px] mx-auto gap-8'
      : archetypes.length === 3
        ? 'grid grid-cols-2 sm:grid-cols-3 gap-8'
        : 'grid grid-cols-1 sm:grid-cols-2 gap-8';

  return (
    <div className="space-y-12">
      <FullSectionHeader label="Archetypes" />
      <div className={gridCls}>
        {archetypes.map((arch, i) => {
          const isActive = selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(isActive ? null : i)}
              aria-expanded={isActive}
              aria-controls="archetype-detail-panel"
              className="group relative flex flex-col items-center gap-5 text-center transition-all"
            >
              {/* Just the card PNG — the art carries its own frame; no extra
                  surface/border. Selection reads via a soft accent glow. */}
              <div
                className={cn(
                  'w-full aspect-[3/4] max-w-[240px] relative transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-1 flex items-center justify-center',
                  isActive
                    ? 'drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)]'
                    : 'drop-shadow-[0_10px_28px_rgba(0,0,0,0.22)]'
                )}
              >
                {isActive && (
                  <div className="absolute -inset-4 rounded-3xl bg-[var(--accent)]/15 blur-2xl -z-10" />
                )}
                <ImgOrFallback
                  src={arch.image || getArchetypeImage(arch.name) || undefined}
                  alt={arch.name}
                  seed={`archetype-${arch.name}`}
                  fit="contain"
                  fallback={<Diamond size={64} className="opacity-10" aria-hidden="true" />}
                />
              </div>
              <div className="space-y-1">
                <h4 className="text-2xl font-bold tracking-tight opacity-90">{arch.name}</h4>
                {arch.role && (
                  <span className="block text-[10px] font-mono uppercase tracking-widest opacity-40">
                    {arch.role}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest opacity-40 group-hover:opacity-70 transition-opacity">
                <MousePointerClick size={11} aria-hidden="true" />
                {isActive ? 'Hide' : 'Details'}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={selected}
            id="archetype-detail-panel"
            role="region"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <GlassPanel
              padding="lg"
              className="bg-[var(--brand-surface)]/30 border-[var(--brand-text)]/10"
            >
              <div className="space-y-6">
                <h4 className="text-3xl font-bold tracking-tight opacity-90">{active.name}</h4>
                <p className="text-lg font-light leading-relaxed opacity-60">
                  {active.description}
                </p>
                {active.examples && active.examples.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {active.examples.map((ex, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full border border-[var(--brand-text)]/10 bg-[var(--brand-text)]/5 text-[10px] font-bold uppercase tracking-widest opacity-60"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const BrandPersonasView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const personas = guideline.strategy?.personas || [];
  if (personas.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Personas" />
        <div className="flex flex-col gap-1.5">
          {personas.map((p, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold text-neutral-300">
                {p.name}
                {p.age ? `, ${p.age}` : ''}
              </span>
              {p.traits && p.traits.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.traits.slice(0, 4).map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-[9px] font-mono uppercase text-neutral-500"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const brandName = guideline.name || guideline.identity?.name || 'a marca';

  return (
    <div className="space-y-16">
      <FullSectionHeader label="Personas" />
      {personas.map((persona, i) => {
        const displayName = persona.name || 'Persona';
        return (
          <div key={i} className="space-y-10">
            {/* ── Identity: photo + name/traits/bio (Figma DS Urban Stay layout) ── */}
            <div className="flex flex-col md:flex-row gap-8 md:gap-10">
              <div className="w-full md:w-[300px] shrink-0 space-y-2">
                <div className="aspect-square rounded-[20px] overflow-hidden shadow-2xl">
                  <ImgOrFallback
                    src={persona.image}
                    alt={persona.name}
                    seed={`persona-${persona.name}`}
                    fit="cover"
                    usePlaceholder={false}
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--brand-surface)] to-[var(--brand-bg)]">
                        <span className="text-6xl font-black opacity-15 select-none">
                          {persona.name?.[0]?.toUpperCase() || <User size={56} />}
                        </span>
                      </div>
                    }
                  />
                </div>
                {persona.imageAttribution?.author && (
                  <p className="text-[10px] font-mono opacity-30 text-center">
                    Photo:{' '}
                    {persona.imageAttribution.authorUrl ? (
                      <a
                        href={persona.imageAttribution.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:opacity-60 underline"
                      >
                        {persona.imageAttribution.author}
                      </a>
                    ) : (
                      persona.imageAttribution.author
                    )}{' '}
                    / {persona.imageAttribution.license}
                  </p>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-5 pt-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <h4 className="text-2xl md:text-3xl tracking-tight text-balance">
                    <span className="font-bold opacity-90">{displayName}</span>
                    {persona.age ? (
                      <span className="font-light opacity-60">, {persona.age}</span>
                    ) : null}
                  </h4>
                  {persona.traits && persona.traits.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {persona.traits.map((trait, idx) => (
                        <span
                          key={idx}
                          className="px-4 py-1.5 rounded-full border border-[var(--brand-text)]/25 text-xs font-light tracking-wide opacity-70"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {persona.occupation && (
                  <p className="text-xs font-mono uppercase tracking-widest opacity-40">
                    {persona.occupation}
                  </p>
                )}
                {persona.bio && (
                  <p className="text-lg md:text-xl font-light leading-relaxed opacity-70 max-w-3xl">
                    {persona.bio}
                  </p>
                )}
              </div>
            </div>

            {/* ── Desires: left question / right stacked full-width cards ── */}
            {persona.desires && persona.desires.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] gap-10 pt-12 border-t border-[var(--brand-text)]/10">
                <div className="space-y-4 lg:sticky lg:top-24 self-start">
                  <MicroTitle className="text-[var(--accent)]/60">O que deseja</MicroTitle>
                  <h3 className="text-2xl md:text-4xl font-light leading-[1.12] tracking-tight opacity-90 text-balance">
                    O que sente ao ser atendido por {brandName}?
                  </h3>
                </div>
                <div className="flex flex-col gap-3">
                  {persona.desires.map((desire, idx) => (
                    <div
                      key={idx}
                      className="rounded-[20px] border border-[var(--brand-text)]/12 bg-[var(--brand-surface)]/10 px-7 py-6 md:px-9 md:py-7"
                    >
                      <p className="text-base md:text-lg leading-relaxed opacity-80">{desire}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pain points kept as a subtle secondary strip (not in the Figma frame,
                but preserving data the persona may carry). */}
            {persona.painPoints && persona.painPoints.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] gap-10">
                <MicroTitle className="text-[var(--brand-text)]/40 lg:pt-1">
                  Dores &amp; atritos
                </MicroTitle>
                <div className="flex flex-wrap gap-2">
                  {persona.painPoints.map((p, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 rounded-xl border border-[var(--brand-text)]/8 bg-[var(--brand-text)]/[0.03] text-sm font-light opacity-60"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const BrandVoiceValuesView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const voiceValues = guideline.strategy?.voiceValues || [];
  // Copy examples share this section: voiceValues describe the tone, these show
  // it. A brand can have one without the other.
  const copyExamples = (guideline.strategy?.copyExamples || []).filter((c) => c.text);
  if (voiceValues.length === 0 && copyExamples.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Tone of Voice" />
        <div className="flex flex-col gap-1.5">
          {voiceValues.map((v, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold text-neutral-300 uppercase tracking-wide">{v.title}</span>
              {v.description && (
                <p className="text-[11px] text-neutral-500 leading-snug mt-0.5 line-clamp-2">
                  {v.description}
                </p>
              )}
            </div>
          ))}
          {copyExamples.map((c, i) => (
            <p key={`copy-${i}`} className="text-[11px] text-neutral-500 leading-snug italic">
              "{c.text}"
            </p>
          ))}
        </div>
      </div>
    );
  }

  // 3 → clean 1-or-3 row; otherwise keep the 2-col editorial rhythm. Cards size to
  // their content (a firm min-height keeps the row even) instead of a fixed 400px
  // that left short tones swimming in empty space.
  const cols = voiceValues.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div className="space-y-16">
      <FullSectionHeader label="Tone of Voice" />
      <div className={cn('grid grid-cols-1 gap-6', cols, voiceValues.length === 0 && 'hidden')}>
        {voiceValues.map((v, i) => (
          <div
            key={i}
            className="relative group p-8 rounded-[32px] border transition-all duration-500 overflow-hidden min-h-[220px] flex flex-col bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 hover:bg-[var(--brand-surface)]/40 hover:border-[var(--brand-text)]/10"
          >
            <div className="absolute top-0 left-0 w-14 h-14 rounded-br-[28px] flex items-center justify-center text-lg font-bold bg-[var(--brand-text)]/5 opacity-20">
              {i + 1}
            </div>
            <div className="mt-10 space-y-4 flex-1 flex flex-col">
              <h4 className="text-2xl font-bold opacity-90">{v.title}</h4>
              <p className="text-sm leading-relaxed opacity-60 transition-colors">
                {v.description}
              </p>
              {v.example && (
                <div className="p-4 rounded-xl border mt-auto bg-[var(--brand-text)]/[0.02] border-[var(--brand-text)]/5 shadow-inner">
                  <p className="text-xs font-medium leading-relaxed italic opacity-80">
                    "{v.example}"
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {copyExamples.length > 0 && (
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.2em] opacity-40">Copy examples</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {copyExamples.map((c, i) => (
              <div
                key={i}
                className="p-6 rounded-[24px] border bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5"
              >
                {c.type && (
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-30">
                    {c.type}
                  </span>
                )}
                <p className="text-lg font-medium leading-snug opacity-80 mt-1">"{c.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface BrandColorsViewProps extends SectionCommonProps {
  searchTerm?: string;
  onColorClick?: (hex: string, item: { name?: string; role?: string }) => void;
}

/** Grid span per usage rank — biggest tile = most used (φ-laddered hierarchy). */
function rankSpan(rank?: number): string {
  switch (rank) {
    case 1:
      return 'sm:col-span-2 sm:row-span-2';
    case 2:
      return 'sm:col-span-1 sm:row-span-2';
    case 3:
      return 'sm:col-span-2 sm:row-span-1';
    default:
      return 'sm:col-span-1 sm:row-span-1';
  }
}

/**
 * Proportional palette: tiles sized by how much each color is actually used
 * across the brand's assets (most used = largest). Falls back to the uniform
 * grid (caller decides) when no usage data exists.
 */
const ColorUsagePalette: React.FC<{
  colors: BrandGuideline['colors'];
  onClick: (hex: string, item: { name?: string; role?: string }) => void;
}> = ({ colors, onClick }) => {
  const ranked = useMemo(
    () =>
      [...(colors || [])].sort(
        (a, b) => (a.usageRank ?? 999) - (b.usageRank ?? 999) || (b.usage ?? 0) - (a.usage ?? 0)
      ),
    [colors]
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[110px] sm:auto-rows-[140px] gap-4 grid-flow-dense">
      {ranked.map((color, i) => {
        const pct = typeof color.usage === 'number' ? Math.round(color.usage * 100) : null;
        const big = (color.usageRank ?? 99) <= 2;
        return (
          <motion.button
            key={i}
            type="button"
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onClick(color.hex, color)}
            aria-label={`Copy hex ${color.hex}${color.name ? ` — ${color.name}` : ''}${
              pct !== null ? ` — ${pct}% usage` : ''
            }`}
            className={cn(
              'group relative rounded-2xl overflow-hidden border border-[var(--brand-text)]/10 transition-all hover:border-[var(--accent)]/30 shadow-2xl text-left',
              rankSpan(color.usageRank)
            )}
          >
            <div className="absolute inset-0" style={{ backgroundColor: color.hex }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            {pct !== null && (
              <span
                className={cn(
                  'absolute top-3 right-3 font-mono tabular-nums text-white/90 drop-shadow',
                  big ? 'text-2xl font-bold' : 'text-xs font-bold'
                )}
              >
                {pct}%
              </span>
            )}
            <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col gap-0.5">
              <span
                className={cn(
                  'font-bold uppercase tracking-tight text-white/95 truncate drop-shadow',
                  big ? 'text-sm' : 'text-[11px]'
                )}
              >
                {color.name || 'Untitled'}
              </span>
              <span className="text-[10px] font-mono uppercase text-white/60 flex items-center gap-1.5">
                {color.hex}
                <span className="opacity-70 can-hover:opacity-0 can-hover:group-hover:opacity-100 transition-opacity">
                  · copy
                </span>
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export const BrandColorsView: React.FC<BrandColorsViewProps> = ({
  guideline,
  compact,
  searchTerm,
  onColorClick,
}) => {
  const colors = guideline.colors || [];
  const filtered = useMemo(
    () =>
      colors.filter(
        (c) =>
          !searchTerm ||
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.hex.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [colors, searchTerm]
  );
  const handleClick = useCallback(
    (hex: string, item: { name?: string; role?: string }) => {
      if (onColorClick) return onColorClick(hex, item);
      copyToClipboard(hex);
      toast.success(`Copied ${hex}`);
    },
    [onColorClick]
  );

  // Proportional layout only when usage was computed AND we're not filtering
  // (a search would break the rank hierarchy).
  const hasUsage =
    !searchTerm &&
    filtered.some((c) => typeof c.usage === 'number' && c.usage > 0 && !!c.usageRank);

  if (filtered.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Colors" />
        <div className="grid grid-cols-6 gap-1.5">
          {filtered.slice(0, 12).map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(c.hex, c)}
              className="aspect-square rounded border border-white/10 cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: c.hex }}
              title={`${c.name || ''} ${c.hex}`.trim()}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.section
      id="colors"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="space-y-12">
        <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
          <FullSectionHeader label="Color Palette" />
        </div>
        {hasUsage ? (
          <ColorUsagePalette colors={filtered} onClick={handleClick} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filtered.map((color, i) => (
              <motion.button
                key={i}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => handleClick(color.hex, color)}
                aria-label={`Copy hex ${color.hex}${color.name ? ` — ${color.name}` : ''}`}
                className="group cursor-pointer space-y-3 text-left"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-[var(--brand-text)]/10 transition-all group-hover:scale-105 group-hover:border-[var(--accent)]/30 shadow-2xl">
                  <div className="absolute inset-0" style={{ backgroundColor: color.hex }} />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]">
                    <span className="text-[10px] font-mono text-white opacity-60">COPY HEX</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold truncate uppercase tracking-tight opacity-90">
                    {color.name || 'Untitled'}
                  </p>
                  <span className="text-[10px] font-mono opacity-40 uppercase flex items-center gap-2">
                    {color.hex}
                    {color.role && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-current opacity-20" />
                        {color.role}
                      </>
                    )}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
};

export const BrandTypographyView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const typography = guideline.typography || [];
  if (typography.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Typography" />
        <div className="flex flex-col gap-1">
          {typography.map((t, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
              <span
                className="font-bold text-neutral-300 truncate"
                style={{ fontFamily: t.family }}
              >
                {t.family}
              </span>
              <span className="text-[9px] font-mono uppercase text-neutral-600 tracking-widest shrink-0">
                {t.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.section
      id="typography"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="space-y-12">
        <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
          <FullSectionHeader label="Typography" />
        </div>
        <div className="grid grid-cols-1 gap-8">
          {typography.map((font, i) => (
            <div
              key={i}
              className="group flex flex-col md:flex-row md:items-center gap-8 md:gap-16 p-8 rounded-3xl border transition-all bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 hover:border-[var(--brand-text)]/10"
            >
              <div
                className="text-7xl md:text-8xl font-bold tracking-tighter w-40 text-center shrink-0 opacity-90"
                style={{ fontFamily: font.family }}
              >
                Aa
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase font-black tracking-widest border bg-[var(--brand-text)]/5 text-[var(--brand-text)] border-[var(--brand-text)]/10">
                    {font.role}
                  </span>
                  <span className="text-xs font-mono font-medium opacity-40">{font.family}</span>
                </div>
                <p
                  className="text-4xl md:text-5xl tracking-tight leading-none opacity-80"
                  style={{ fontFamily: font.family }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
                <div className="flex items-center gap-6 pt-2">
                  {/* Only render declared spec values — a fabricated "Regular"/"16PX"
                      on a brand source-of-truth doc reads as declared data and
                      propagates into generation. */}
                  {font.style && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-30">
                        Style
                      </span>
                      <p className="text-sm font-bold opacity-70">{font.style}</p>
                    </div>
                  )}
                  {font.size && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-30">
                        Base Size
                      </span>
                      <p className="text-sm font-bold opacity-70">{font.size}PX</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export interface BrandLogosViewProps extends SectionCommonProps {
  searchTerm?: string;
  onAssetClick?: BrandReadOnlyViewProps['onAssetClick'];
  onAssetDragStart?: BrandReadOnlyViewProps['onAssetDragStart'];
  onBatchDownload?: (items: Array<{ url: string; label?: string; variant?: string }>) => void;
}

export const BrandLogosView: React.FC<BrandLogosViewProps> = ({
  guideline,
  compact,
  searchTerm,
  onAssetClick,
  onAssetDragStart,
  onBatchDownload,
}) => {
  const logos = guideline.logos || [];
  const filtered = useMemo(
    () =>
      logos.filter(
        (l) =>
          l.url &&
          (!searchTerm ||
            l.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.variant?.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [logos, searchTerm]
  );

  const handleClick = useCallback(
    (logo: any) => {
      if (onAssetClick) return onAssetClick(logo.url, 'logo', logo);
      triggerAssetDownload(
        logo.url,
        `${safeFileName(logo.label || logo.variant)}.${extFromUrl(logo.url)}`
      );
    },
    [onAssetClick]
  );

  // Hide assets whose image fails to load (broken R2 links, dead URLs).
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const markFailed = useCallback((id: string) => {
    setFailed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleDownload = useCallback((logo: any) => {
    triggerAssetDownload(
      logo.url,
      `${safeFileName(logo.label || logo.variant)}.${extFromUrl(logo.url)}`
    );
  }, []);

  const handleCopyPng = useCallback(async (logo: any) => {
    const res = await copyImageAsPng(logo.url);
    if (res.success) toast.success('Copied as PNG');
    else toast.error(res.error || 'Could not copy image');
  }, []);

  const handleCopySvg = useCallback(async (logo: any) => {
    try {
      // R2 dev domain lacks CORS headers → fetch via same-origin image proxy.
      let r = await fetch(logo.url).catch(() => null);
      if (!r || !r.ok) r = await fetch(getProxiedUrl(logo.url));
      const text = await r.text();
      const ok = await copyToClipboard(text);
      if (ok) toast.success('Copied SVG code');
      else toast.error('Could not copy SVG');
    } catch {
      toast.error('Could not copy SVG');
    }
  }, []);

  // Assets whose image loaded ok — hide the whole section if every asset is broken.
  const visible = filtered.filter((l) => !failed.has(l.id));
  if (filtered.length === 0 || visible.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Logos" />
        <div className="grid grid-cols-4 gap-2">
          {filtered.slice(0, 12).map((logo) => (
            <button
              key={logo.id}
              type="button"
              onClick={() => handleClick(logo)}
              className="group/logo relative aspect-square rounded-md border border-white/5 bg-neutral-900/40 overflow-hidden hover:border-brand-cyan/30 transition-colors"
              draggable={!!onAssetDragStart}
              onDragStart={(e) =>
                onAssetDragStart?.(e as unknown as React.DragEvent, logo.url, 'logo')
              }
              title={logo.label || logo.variant}
            >
              <img
                src={logo.url}
                alt={logo.label || logo.variant}
                className="w-full h-full object-contain p-2"
                loading="lazy"
              />
              <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-neutral-500 text-center py-0.5 bg-black/60 uppercase">
                {logo.variant}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.section
      id="logos"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="space-y-12">
        <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
          <FullSectionHeader label="Logo Assets" />
          {onBatchDownload && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] font-mono opacity-40 hover:opacity-100 hover:text-[var(--accent)] gap-2"
              onClick={() => onBatchDownload(visible)}
            >
              <Download size={12} />
              Export {visible.length} Assets
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((logo) => {
            if (failed.has(logo.id)) return null;
            const isSvg = extFromUrl(logo.url) === 'svg';
            return (
              <motion.div
                key={logo.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group relative flex flex-col gap-4"
                draggable={!!onAssetDragStart}
                onDragStart={(e) =>
                  onAssetDragStart?.(e as unknown as React.DragEvent, logo.url, 'logo')
                }
              >
                <div className="relative aspect-[4/3] rounded-3xl p-8 flex items-center justify-center overflow-hidden transition-all duration-500 border bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 group-hover:bg-[var(--brand-surface)]/40 group-hover:border-[var(--brand-text)]/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                  <img
                    src={logo.url}
                    alt={logo.label || 'Logo'}
                    loading="lazy"
                    onError={() => markFailed(logo.id)}
                    className="w-3/4 h-3/4 object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_15px_25px_rgba(0,0,0,0.2)]"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 opacity-100 translate-y-0 can-hover:opacity-0 can-hover:translate-y-2 can-hover:group-hover:opacity-100 can-hover:group-hover:translate-y-0 transition-all duration-300">
                    {onAssetClick ? (
                      <Button
                        className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-2 shadow-lg transition-all bg-[var(--accent)] text-[var(--accent-text)] hover:scale-[1.02]"
                        onClick={() => handleClick(logo)}
                      >
                        <MousePointerClick size={14} /> Use
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          title="Download"
                          className="flex-1 h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1.5 shadow-lg transition-all bg-[var(--accent)] text-[var(--accent-text)] hover:scale-[1.02]"
                          onClick={() => handleDownload(logo)}
                        >
                          <Download size={13} /> Download
                        </Button>
                        <Button
                          title="Copy as PNG"
                          aria-label="Copy as PNG"
                          className="h-9 w-9 p-0 rounded-xl shadow-lg transition-all bg-[var(--brand-surface)] text-[var(--brand-text)] border border-[var(--brand-text)]/10 hover:scale-[1.05]"
                          onClick={() => handleCopyPng(logo)}
                        >
                          <Copy size={13} />
                        </Button>
                        {isSvg && (
                          <Button
                            title="Copy SVG code"
                            aria-label="Copy SVG code"
                            className="h-9 w-9 p-0 rounded-xl shadow-lg transition-all bg-[var(--brand-surface)] text-[var(--brand-text)] border border-[var(--brand-text)]/10 hover:scale-[1.05]"
                            onClick={() => handleCopySvg(logo)}
                          >
                            <FileCode size={13} />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-90">
                    {logo.label || 'Untitled Asset'}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-widest mt-1 opacity-40">
                    {logo.variant} Variant
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
};

export interface BrandMediaViewProps extends SectionCommonProps {
  searchTerm?: string;
  onAssetClick?: BrandReadOnlyViewProps['onAssetClick'];
  onAssetDragStart?: BrandReadOnlyViewProps['onAssetDragStart'];
}

/** How many assets the gallery shows before "ver toda a galeria". */
const MEDIA_GRID_LIMIT = 12;

/** Compact vibe/aesthetic chips from an asset's LLM analysis (read-only). */
const AssetTagChips: React.FC<{ analysis?: { dimensions?: Record<string, string[]> } }> = ({
  analysis,
}) => {
  const dims = analysis?.dimensions;
  if (!dims) return null;
  const tags = [...(dims.vibe || []), ...(dims.aesthetic || [])].slice(0, 3);
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 py-0.5">
      {tags.map((t, i) => (
        <span
          key={i}
          className="px-1.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-[9px] font-mono uppercase tracking-wide text-white/80"
        >
          {t}
        </span>
      ))}
    </div>
  );
};

/**
 * One asset tile. The art sets its own height — a fixed aspect box + object-cover
 * used to crop every piece — and the label/chips only surface on hover, so at rest
 * the grid is nothing but the work. Mirrors the reference library's card.
 */
const BrandMediaCard: React.FC<{
  item: any;
  index: number;
  onOpen: () => void;
  onDownload: () => void;
  onError: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}> = ({ item, index, onOpen, onDownload, onError, onDragStart }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group relative rounded-2xl overflow-hidden border border-white/[0.04] bg-neutral-900/40 cursor-pointer transition-colors hover:border-white/10"
      draggable={!!onDragStart}
      // motion.div types onDragStart as its own pan gesture; the HTML drag event
      // is what we actually get, hence the cast (same as the pre-masonry code).
      onDragStart={(e) => onDragStart?.(e as unknown as React.DragEvent)}
      onClick={onOpen}
    >
      <img
        src={item.url}
        alt={item.label || 'Media'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={onError}
        className="w-full h-auto block"
        // Placeholder ratio only until the real one is known — dropped on load so
        // the art keeps its own proportions.
        style={{ aspectRatio: loaded ? undefined : '4 / 5' }}
      />

      <div className={cn('absolute inset-0 duration-300 pointer-events-none', hoverReveal)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <Button
          size="icon"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/80 backdrop-blur-sm border border-white/10 pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          aria-label="Download"
        >
          <Download size={15} />
        </Button>
        <div className="absolute bottom-3 left-3 right-3 space-y-1">
          <p className="text-xs font-bold text-white tracking-tight truncate">
            {item.label || 'Production File'}
          </p>
          <AssetTagChips analysis={item.analysis} />
          <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
            Asset // {String(index + 1).padStart(2, '0')}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export const BrandMediaView: React.FC<BrandMediaViewProps> = ({
  guideline,
  compact,
  searchTerm,
  onAssetClick,
  onAssetDragStart,
}) => {
  const media = guideline.media || [];
  const [fullScreenIdx, setFullScreenIdx] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  // Broken assets are dropped from the list, not rendered as null: the masonry
  // distributes by index, so a hole would unbalance the columns and throw off
  // both the "Asset // NN" numbering and the +N count on the button.
  const filtered = useMemo(
    () =>
      media.filter(
        (m) =>
          !failed.has(m.id) &&
          (!searchTerm || m.label?.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [media, searchTerm, failed]
  );

  const visible = expanded ? filtered : filtered.slice(0, MEDIA_GRID_LIMIT);
  const hidden = filtered.length - visible.length;

  const markFailed = useCallback((id: string) => {
    setFailed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleDownload = useCallback((item: any) => {
    triggerAssetDownload(
      item.url,
      `${safeFileName(item.label || 'media')}.${extFromUrl(item.url)}`
    );
  }, []);

  const handleClick = useCallback(
    (item: any, idx: number) => {
      if (onAssetClick) return onAssetClick(item.url, 'media', item);
      setFullScreenIdx(idx);
    },
    [onAssetClick]
  );

  if (filtered.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Media" />
        <div className="grid grid-cols-3 gap-2">
          {filtered.slice(0, 9).map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item, i)}
              draggable={!!onAssetDragStart}
              onDragStart={(e) =>
                onAssetDragStart?.(e as unknown as React.DragEvent, item.url, 'media')
              }
              className="aspect-square rounded-md overflow-hidden border border-white/5 bg-neutral-900/40 hover:border-brand-cyan/30 transition-colors"
              title={item.label || 'Media'}
            >
              <img
                src={item.url}
                alt={item.label || 'Media'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.section
      id="media"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="space-y-12">
        <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
          <FullSectionHeader label="Media Library" />
        </div>

        <Masonry
          items={visible}
          getKey={(item) => item.id}
          breakpoints={{ base: 1, sm: 2, lg: 3, xl: 3 }}
          gap={16}
          renderItem={(item, i) => (
            <BrandMediaCard
              item={item}
              index={i}
              onOpen={() => handleClick(item, i)}
              onDownload={() => handleDownload(item)}
              onError={() => markFailed(item.id)}
              onDragStart={
                onAssetDragStart
                  ? (e) => onAssetDragStart(e as unknown as React.DragEvent, item.url, 'media')
                  : undefined
              }
            />
          )}
        />

        {hidden > 0 && (
          <div className="flex justify-center">
            <Button variant="subtle" onClick={() => setExpanded(true)} className="gap-2">
              Ver toda a galeria
              <span className="text-[10px] font-mono opacity-50">+{hidden}</span>
            </Button>
          </div>
        )}

        {fullScreenIdx !== null && (
          <FullScreenViewer
            imageUrl={filtered[fullScreenIdx]?.url}
            isLoading={false}
            onClose={() => setFullScreenIdx(null)}
            onNavigatePrevious={
              fullScreenIdx > 0 ? () => setFullScreenIdx(fullScreenIdx - 1) : undefined
            }
            onNavigateNext={
              fullScreenIdx < filtered.length - 1
                ? () => setFullScreenIdx(fullScreenIdx + 1)
                : undefined
            }
            hasPrevious={fullScreenIdx > 0}
            hasNext={fullScreenIdx < filtered.length - 1}
          />
        )}
      </div>
    </motion.section>
  );
};

export const BrandGuidelinesView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const g = guideline.guidelines || {};
  const hasAny = !!(g.voice || g.dos?.length || g.donts?.length);
  if (!hasAny) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Guidelines" />
        {g.voice && (
          <p className="text-[11px] text-neutral-400 italic leading-snug mb-2">"{g.voice}"</p>
        )}
        {g.dos && g.dos.length > 0 && (
          <ul className="space-y-1 mb-2">
            {g.dos.slice(0, 5).map((item, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-neutral-400">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-green-500 shrink-0" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        )}
        {g.donts && g.donts.length > 0 && (
          <ul className="space-y-1">
            {g.donts.slice(0, 5).map((item, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-neutral-400">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500 shrink-0" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <motion.section
      id="editorial"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
        <div className="space-y-8">
          <FullSectionHeader label="Guidelines" />
          {g.voice && (
            <div className="p-8 rounded-3xl bg-[var(--brand-text)]/[0.03] border border-[var(--brand-text)]/[0.05]">
              <p className="text-lg md:text-xl font-serif italic leading-relaxed opacity-60">
                "{g.voice}"
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {g.dos && g.dos.length > 0 && (
            <div className="space-y-6">
              <MicroTitle className="text-green-500/60 pt-12">Do</MicroTitle>
              <ul className="space-y-4">
                {g.dos.map((item, i) => (
                  <li key={i} className="flex gap-4 group">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" />
                    <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g.donts && g.donts.length > 0 && (
            <div className="space-y-6">
              <MicroTitle className="text-red-500/60 pt-12">Don't</MicroTitle>
              <ul className="space-y-4">
                {g.donts.map((item, i) => (
                  <li key={i} className="flex gap-4 group">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                    <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Composed view — import this for the standard layout.
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: BrandViewSection[] = [
  'identity',
  'coreMessage',
  'pillars',
  'manifesto',
  'archetypes',
  'personas',
  'voiceValues',
  'colors',
  'typography',
  'logos',
  'media',
  'guidelines',
];

export const BrandReadOnlyView: React.FC<BrandReadOnlyViewProps> = ({
  guideline,
  compact = false,
  sections = DEFAULT_SECTIONS,
  searchTerm,
  onColorClick,
  onAssetClick,
  onAssetDragStart,
  renderSectionActions,
  editable,
  onPatch,
  className,
}) => {
  if (!guideline) return null;

  const enabled = new Set(sections);
  const wrapperCls = compact ? 'flex flex-col' : 'flex flex-col gap-16';

  const wrap = (id: BrandViewSection, node: React.ReactNode) => {
    const actions = renderSectionActions?.(id);
    if (!actions) return node;
    // Named group so the section-hover doesn't trigger every card's `group-hover`
    // inside (cards use their own plain `group`).
    return (
      <div key={id} className="relative group/section">
        {node}
        <div className="absolute top-0 right-0">{actions}</div>
      </div>
    );
  };

  return (
    <div className={cn(wrapperCls, className)}>
      {enabled.has('identity') &&
        wrap(
          'identity',
          <BrandIdentityView
            guideline={guideline}
            compact={compact}
            editable={editable}
            onPatch={onPatch}
          />
        )}
      {enabled.has('coreMessage') &&
        wrap(
          'coreMessage',
          <BrandCoreMessageView
            guideline={guideline}
            compact={compact}
            editable={editable}
            onPatch={onPatch}
          />
        )}
      {enabled.has('pillars') &&
        wrap('pillars', <BrandPillarsView guideline={guideline} compact={compact} />)}
      {enabled.has('manifesto') &&
        wrap(
          'manifesto',
          <BrandManifestoView
            guideline={guideline}
            compact={compact}
            editable={editable}
            onPatch={onPatch}
          />
        )}
      {enabled.has('archetypes') &&
        wrap('archetypes', <BrandArchetypesView guideline={guideline} compact={compact} />)}
      {enabled.has('personas') &&
        wrap('personas', <BrandPersonasView guideline={guideline} compact={compact} />)}
      {enabled.has('voiceValues') &&
        wrap('voiceValues', <BrandVoiceValuesView guideline={guideline} compact={compact} />)}
      {enabled.has('colors') &&
        wrap(
          'colors',
          <BrandColorsView
            guideline={guideline}
            compact={compact}
            searchTerm={searchTerm}
            onColorClick={onColorClick}
          />
        )}
      {enabled.has('typography') &&
        wrap('typography', <BrandTypographyView guideline={guideline} compact={compact} />)}
      {enabled.has('logos') &&
        wrap(
          'logos',
          <BrandLogosView
            guideline={guideline}
            compact={compact}
            searchTerm={searchTerm}
            onAssetClick={onAssetClick}
            onAssetDragStart={onAssetDragStart}
          />
        )}
      {enabled.has('media') &&
        wrap(
          'media',
          <BrandMediaView
            guideline={guideline}
            compact={compact}
            searchTerm={searchTerm}
            onAssetClick={onAssetClick}
            onAssetDragStart={onAssetDragStart}
          />
        )}
      {enabled.has('guidelines') &&
        wrap('guidelines', <BrandGuidelinesView guideline={guideline} compact={compact} />)}
    </div>
  );
};
