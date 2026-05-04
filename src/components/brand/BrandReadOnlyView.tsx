import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, MousePointerClick, Diamond, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlassPanel } from '@/components/ui/GlassPanel';
import type { BrandGuideline } from '@/lib/figma-types';

export type BrandViewSection =
  | 'identity'
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
  className?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Accessibility + theming helpers (reusable)
// ──────────────────────────────────────────────────────────────────────────────

export function getRelativeLuminance(hex: string): number {
  const h = hex.replace('#', '').padEnd(6, '0');
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

export function toCSSVariables(g: BrandGuideline): string {
  const lines: string[] = [':root {'];
  g.colors?.forEach((c) => {
    const name = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`  --color-${name}: ${c.hex};`);
  });
  g.typography?.forEach((t) => {
    const role = (t.role || 'font').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
    guideline?.colors?.find((c) => c.role?.toUpperCase() === role || c.name?.toUpperCase() === role);
  const findByMatch = (keywords: string[]) =>
    guideline?.colors?.find((c) =>
      keywords.some((k) => c.name?.toLowerCase().includes(k) || c.role?.toLowerCase().includes(k))
    );

  const accentToken =
    findByRole('PRIMARY') || findByRole('ACCENT') || findByMatch(['brand', 'primary', 'accent', 'main']) || { hex: '#00E5FF' };
  const bgToken = findByRole('BACKGROUND') || findByRole('BG') || findByMatch(['background', 'canvas', 'bg']) || { hex: '#0a0a0a' };
  const surfaceToken =
    findByRole('SURFACE') || findByRole('CARD') || findByMatch(['surface', 'card', 'neutral', 'off']) || { hex: '#141414' };
  const textToken = findByRole('TEXT') || findByRole('HEADLINE') || findByMatch(['text', 'content', 'body']) || { hex: '#ffffff' };

  const paletteByLum = [...(guideline?.colors || [])].sort(
    (a, b) => getRelativeLuminance(a.hex) - getRelativeLuminance(b.hex)
  );
  const lightestInPalette = paletteByLum[paletteByLum.length - 1]?.hex || '#ffffff';
  const darkestInPalette = paletteByLum[0]?.hex || '#050505';

  let rBg = bgToken.hex;
  let rSurface = surfaceToken.hex;
  let rText = textToken.hex;

  if (mode === 'light') {
    rBg = lightestInPalette;
    if (getRelativeLuminance(rBg) < 0.8) rBg = '#ffffff';
    rSurface = paletteByLum[paletteByLum.length - 2]?.hex || '#f5f5f7';
    rText = darkestInPalette;
  } else if (mode === 'dark') {
    rBg = darkestInPalette;
    if (getRelativeLuminance(rBg) > 0.2) rBg = '#050505';
    rSurface = paletteByLum[1]?.hex || '#111111';
    rText = lightestInPalette;
  }

  const bgLum = getRelativeLuminance(rBg);
  const textLum = getRelativeLuminance(rText);
  if (getContrastRatio(bgLum, textLum) < 4.5) {
    rText = bgLum > 0.5 ? '#000000' : '#ffffff';
  }

  const toRgb = (hex: string) => {
    const h = hex.replace('#', '').padEnd(6, '0');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  };

  const accentLum = getRelativeLuminance(accentToken.hex);
  const accentText =
    getContrastRatio(accentLum, getRelativeLuminance('#000000')) >= 4.5 ? '#000000' : '#ffffff';

  return {
    accent: accentToken.hex,
    accentRgb: toRgb(accentToken.hex),
    accentText,
    bg: rBg,
    surface: rSurface,
    text: rText,
    isCustomBg: mode === 'brand' && (!!findByRole('BACKGROUND') || !!findByMatch(['background', 'bg'])),
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
}

const CompactSectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <MicroTitle className="text-[10px] text-neutral-600 uppercase tracking-widest">{label}</MicroTitle>
);

const FullSectionHeader: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <h2 className={cn('text-4xl font-bold font-manrope opacity-90', className)}>{label}</h2>
);

export const BrandIdentityView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const identity = guideline.identity || {};
  if (!identity.description && !identity.tagline) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Identity" />
        {identity.tagline && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-cyan/80">{identity.tagline}</p>
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
        {identity.description && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <p className="text-lg md:text-xl leading-relaxed font-light opacity-70">{identity.description}</p>
            </div>
            <div className="space-y-8">
              {identity.tagline && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[var(--brand-text)]/50 uppercase tracking-widest">Brand Tagline</span>
                  <p className="text-sm font-bold uppercase opacity-80">{identity.tagline}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
};

export const BrandManifestoView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const manifesto = guideline.strategy?.manifesto;
  if (!manifesto) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Manifesto" />
        <p className="text-xs text-neutral-400 italic leading-relaxed whitespace-pre-line line-clamp-6">
          "{manifesto}"
        </p>
      </div>
    );
  }

  const [firstLine, ...rest] = manifesto.split('\n');
  return (
    <div className="space-y-12">
      <div className="flex items-center gap-4">
        <div className="h-[1px] w-12 bg-[var(--accent)]/30" />
        <MicroTitle className="text-[var(--accent)]/60 tracking-wider">[Manifesto]</MicroTitle>
      </div>
      <div className="relative group">
        <div className="absolute -inset-8 bg-[var(--accent)]/[0.02] blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
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
      </div>
    </div>
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
                <p className="text-[11px] text-neutral-500 leading-snug mt-0.5 line-clamp-2">{a.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <FullSectionHeader label="Archetypes" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {archetypes.map((arch, i) => (
          <div
            key={i}
            className="group relative rounded-[40px] p-12 flex flex-col md:flex-row gap-12 items-center overflow-hidden min-h-[400px] transition-colors bg-[var(--brand-surface)]/40 border-[var(--brand-text)]/5 hover:border-[var(--brand-text)]/10"
          >
            <div className="w-full md:w-1/2 aspect-[3/4] rounded-2xl border-[3px] p-4 flex flex-col items-center justify-between relative transition-all duration-500 border-[var(--brand-text)]/20 bg-[var(--brand-bg)] shadow-2xl group-hover:rotate-2">
              <div className="w-full text-center border-b border-[var(--brand-text)]/10 pb-2 flex items-center justify-center px-2">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{arch.name}</span>
              </div>
              <div className="flex-1 flex items-center justify-center py-8">
                {arch.image ? <img src={arch.image} alt={arch.name} className="w-full object-contain" /> : <Diamond size={64} className="opacity-10" aria-hidden="true" />}
              </div>
            </div>
            <div className="flex-1 space-y-6">
              <h4 className="text-3xl font-bold tracking-tight opacity-90">{arch.name}</h4>
              <p className="text-lg font-light leading-relaxed opacity-60">{arch.description}</p>
            </div>
          </div>
        ))}
      </div>
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

  return (
    <div className="space-y-16">
      <FullSectionHeader label="Personas" />
      <div className="grid grid-cols-1 gap-12">
        {personas.map((persona, i) => (
          <GlassPanel key={i} padding="lg" className="bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10">
            <div className="flex flex-col md:flex-row gap-12">
              <div className="w-full md:w-1/3 aspect-square rounded-[32px] overflow-hidden border border-[var(--brand-text)]/10 shadow-2xl">
                {persona.image ? (
                  <img src={persona.image} alt={persona.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black/20 flex items-center justify-center opacity-30">
                    <User size={64} />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-4xl font-bold opacity-90">
                      {persona.name}
                      {persona.age ? `, ${persona.age}` : ''}
                    </h4>
                    {persona.traits && persona.traits.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {persona.traits.map((trait, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full border border-[var(--brand-text)]/10 bg-[var(--brand-text)]/5 text-[10px] font-bold uppercase tracking-widest opacity-60"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[1px] w-full bg-[var(--brand-text)]/10" />

                {persona.desires && persona.desires.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {persona.desires.map((desire, idx) => (
                      <div
                        key={idx}
                        className="p-6 rounded-2xl border border-[var(--brand-text)]/5 bg-[var(--brand-surface)]/60 hover:border-[var(--brand-text)]/10 transition-all"
                      >
                        <p className="text-sm leading-relaxed font-light opacity-60">{desire}</p>
                      </div>
                    ))}
                  </div>
                )}

                {persona.bio && (
                  <div className="p-6 rounded-2xl border border-[var(--brand-text)]/5 bg-[var(--brand-text)]/[0.02]">
                    <p className="text-sm font-light leading-relaxed opacity-60">"{persona.bio}"</p>
                  </div>
                )}
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
};

export const BrandVoiceValuesView: React.FC<SectionCommonProps> = ({ guideline, compact }) => {
  const voiceValues = guideline.strategy?.voiceValues || [];
  if (voiceValues.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Tone of Voice" />
        <div className="flex flex-col gap-1.5">
          {voiceValues.map((v, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold text-neutral-300 uppercase tracking-wide">{v.title}</span>
              {v.description && (
                <p className="text-[11px] text-neutral-500 leading-snug mt-0.5 line-clamp-2">{v.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <FullSectionHeader label="Tone of Voice" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {voiceValues.map((v, i) => (
          <div
            key={i}
            className="relative group p-8 rounded-[32px] border transition-all duration-500 overflow-hidden min-h-[400px] flex flex-col bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 hover:bg-[var(--brand-surface)]/40 hover:border-[var(--brand-text)]/10"
          >
            <div className="absolute top-0 left-0 w-16 h-16 rounded-br-[32px] flex items-center justify-center text-xl font-bold bg-[var(--brand-text)]/5 opacity-20">
              {i + 1}
            </div>
            <div className="mt-12 space-y-8 flex-1">
              <h4 className="text-2xl font-bold opacity-90">{v.title}</h4>
              <p className="text-sm leading-relaxed opacity-60 transition-colors">{v.description}</p>
              {v.example && (
                <div className="p-4 rounded-xl border mt-auto bg-[var(--brand-text)]/[0.02] border-[var(--brand-text)]/5 shadow-inner">
                  <p className="text-xs font-medium leading-relaxed italic opacity-80">"{v.example}"</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface BrandColorsViewProps extends SectionCommonProps {
  searchTerm?: string;
  onColorClick?: (hex: string, item: { name?: string; role?: string }) => void;
}

export const BrandColorsView: React.FC<BrandColorsViewProps> = ({ guideline, compact, searchTerm, onColorClick }) => {
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
      navigator.clipboard.writeText(hex);
      toast.success(`Copied ${hex}`);
    },
    [onColorClick]
  );

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
                <p className="text-xs font-bold truncate uppercase tracking-tight opacity-90">{color.name || 'Untitled'}</p>
                <p className="text-[10px] font-mono opacity-40 uppercase flex items-center gap-2">
                  {color.hex}
                  <div className="w-1 h-1 rounded-full bg-current opacity-20" />
                  {color.role || 'Accent'}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
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
              <span className="font-bold text-neutral-300 truncate" style={{ fontFamily: t.family }}>
                {t.family}
              </span>
              <span className="text-[9px] font-mono uppercase text-neutral-600 tracking-widest shrink-0">{t.role}</span>
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
                <p className="text-4xl md:text-5xl tracking-tight leading-none opacity-80" style={{ fontFamily: font.family }}>
                  The quick brown fox jumps over the lazy dog.
                </p>
                <div className="flex items-center gap-6 pt-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-30">Style</span>
                    <p className="text-sm font-bold opacity-70">{font.style || 'Regular'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-30">Base Size</span>
                    <p className="text-sm font-bold opacity-70">{font.size || '16'}PX</p>
                  </div>
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
          !searchTerm ||
          l.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.variant.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [logos, searchTerm]
  );

  const handleClick = useCallback(
    (logo: any) => {
      if (onAssetClick) return onAssetClick(logo.url, 'logo', logo);
      triggerAssetDownload(logo.url, `${safeFileName(logo.label || logo.variant)}.${extFromUrl(logo.url)}`);
    },
    [onAssetClick]
  );

  if (filtered.length === 0) return null;

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
              onDragStart={(e) => onAssetDragStart?.(e as unknown as React.DragEvent, logo.url, 'logo')}
              title={logo.label || logo.variant}
            >
              <img src={logo.url} alt={logo.label || logo.variant} className="w-full h-full object-contain p-2" loading="lazy" />
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
              onClick={() => onBatchDownload(filtered)}
            >
              <Download size={12} />
              Export {filtered.length} Assets
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((logo) => (
            <motion.div
              key={logo.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group relative flex flex-col gap-4"
              draggable={!!onAssetDragStart}
              onDragStart={(e) => onAssetDragStart?.(e as unknown as React.DragEvent, logo.url, 'logo')}
            >
              <div className="relative aspect-[4/3] rounded-3xl p-8 flex items-center justify-center overflow-hidden transition-all duration-500 border bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 group-hover:bg-[var(--brand-surface)]/40 group-hover:border-[var(--brand-text)]/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                <img
                  src={logo.url}
                  alt={logo.label || 'Logo'}
                  className="w-3/4 h-3/4 object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_15px_25px_rgba(0,0,0,0.2)]"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <Button
                    className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-2 shadow-lg transition-all bg-[var(--accent)] text-[var(--accent-text)] hover:scale-[1.02]"
                    onClick={() => handleClick(logo)}
                  >
                    {onAssetClick ? <MousePointerClick size={14} /> : <Download size={14} />}
                    {onAssetClick ? 'Use' : 'Download'}
                  </Button>
                </div>
              </div>
              <div className="px-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-90">{logo.label || 'Untitled Asset'}</p>
                <p className="text-[10px] font-mono uppercase tracking-widest mt-1 opacity-40">{logo.variant} Variant</p>
              </div>
            </motion.div>
          ))}
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

export const BrandMediaView: React.FC<BrandMediaViewProps> = ({
  guideline,
  compact,
  searchTerm,
  onAssetClick,
  onAssetDragStart,
}) => {
  const media = guideline.media || [];
  const filtered = useMemo(
    () => media.filter((m) => !searchTerm || m.label?.toLowerCase().includes(searchTerm.toLowerCase())),
    [media, searchTerm]
  );

  const handleClick = useCallback(
    (item: any) => {
      if (onAssetClick) return onAssetClick(item.url, 'media', item);
      triggerAssetDownload(item.url, `${safeFileName(item.label || 'media')}.${extFromUrl(item.url)}`);
    },
    [onAssetClick]
  );

  if (filtered.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/5">
        <CompactSectionHeader label="Media" />
        <div className="grid grid-cols-3 gap-2">
          {filtered.slice(0, 9).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item)}
              draggable={!!onAssetDragStart}
              onDragStart={(e) => onAssetDragStart?.(e as unknown as React.DragEvent, item.url, 'media')}
              className="aspect-square rounded-md overflow-hidden border border-white/5 bg-neutral-900/40 hover:border-brand-cyan/30 transition-colors"
              title={item.label || 'Media'}
            >
              <img src={item.url} alt={item.label || 'Media'} className="w-full h-full object-cover" loading="lazy" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group relative flex flex-col gap-4"
              draggable={!!onAssetDragStart}
              onDragStart={(e) => onAssetDragStart?.(e as unknown as React.DragEvent, item.url, 'media')}
            >
              <div className="relative aspect-[16/10] rounded-3xl overflow-hidden border border-white/[0.04] shadow-2xl transition-all group-hover:scale-[1.02] group-hover:border-white/10">
                <img
                  src={item.url}
                  alt={item.label || 'Media'}
                  className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <Button
                    size="icon"
                    className="w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-text)] shadow-[0_0_30px_rgba(var(--accent-rgb),0.5)] active:scale-90 transition-all"
                    onClick={() => handleClick(item)}
                  >
                    {onAssetClick ? <MousePointerClick size={24} /> : <Download size={24} />}
                  </Button>
                </div>

                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white tracking-tight">{item.label || 'Production File'}</p>
                    <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Asset // 0{i + 1}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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
        {g.voice && <p className="text-[11px] text-neutral-400 italic leading-snug mb-2">"{g.voice}"</p>}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
        <div className="space-y-8">
          <FullSectionHeader label="Guidelines" />
          {g.voice && (
            <div className="p-8 rounded-3xl bg-[var(--brand-text)]/[0.03] border border-[var(--brand-text)]/[0.05]">
              <p className="text-lg md:text-xl font-serif italic leading-relaxed opacity-60">"{g.voice}"</p>
            </div>
          )}
        </div>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
          {g.dos && g.dos.length > 0 && (
            <div className="space-y-6">
              <ul className="space-y-4 pt-12">
                {g.dos.map((item, i) => (
                  <li key={i} className="flex gap-4 group">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" />
                    <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g.donts && g.donts.length > 0 && (
            <div className="space-y-6">
              <ul className="space-y-4 pt-12">
                {g.donts.map((item, i) => (
                  <li key={i} className="flex gap-4 group">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                    <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">{item}</span>
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
  className,
}) => {
  if (!guideline) return null;

  const enabled = new Set(sections);
  const wrapperCls = compact ? 'flex flex-col' : 'flex flex-col gap-24';

  return (
    <div className={cn(wrapperCls, className)}>
      {enabled.has('identity') && <BrandIdentityView guideline={guideline} compact={compact} />}
      {enabled.has('manifesto') && <BrandManifestoView guideline={guideline} compact={compact} />}
      {enabled.has('archetypes') && <BrandArchetypesView guideline={guideline} compact={compact} />}
      {enabled.has('personas') && <BrandPersonasView guideline={guideline} compact={compact} />}
      {enabled.has('voiceValues') && <BrandVoiceValuesView guideline={guideline} compact={compact} />}
      {enabled.has('colors') && (
        <BrandColorsView guideline={guideline} compact={compact} searchTerm={searchTerm} onColorClick={onColorClick} />
      )}
      {enabled.has('typography') && <BrandTypographyView guideline={guideline} compact={compact} />}
      {enabled.has('logos') && (
        <BrandLogosView
          guideline={guideline}
          compact={compact}
          searchTerm={searchTerm}
          onAssetClick={onAssetClick}
          onAssetDragStart={onAssetDragStart}
        />
      )}
      {enabled.has('media') && (
        <BrandMediaView
          guideline={guideline}
          compact={compact}
          searchTerm={searchTerm}
          onAssetClick={onAssetClick}
          onAssetDragStart={onAssetDragStart}
        />
      )}
      {enabled.has('guidelines') && <BrandGuidelinesView guideline={guideline} compact={compact} />}
    </div>
  );
};
