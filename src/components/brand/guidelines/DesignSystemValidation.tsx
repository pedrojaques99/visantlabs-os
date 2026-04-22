import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Palette, Type, Layers2, Blend, Zap, Frame, FileText, Shapes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ComponentPreviewCard, type ValidationState } from './ComponentPreviewCard';
import type { BrandGuideline } from '@/lib/figma-types';

// ─── Visual Preview Renderers ────────────────────────────────────────────────

const ColorsPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const colors = guideline.colors || [];
  if (colors.length === 0) return <p className="text-[10px] text-neutral-600 font-mono">No colors defined yet</p>;
  return (
    <div className="grid grid-cols-4 gap-2">
      {colors.slice(0, 8).map((c, i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-white/5">
          <div className="h-12" style={{ backgroundColor: c.hex }} />
          <div className="px-2 py-1.5 bg-neutral-900/60">
            <p className="text-[9px] font-bold text-white truncate">{c.name}</p>
            <p className="text-[9px] font-mono text-neutral-500 uppercase">{c.hex}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const TypographyPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const fonts = guideline.typography || [];
  if (fonts.length === 0) return <p className="text-[10px] text-neutral-600 font-mono">No typography defined yet</p>;
  const primary = fonts[0];
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-neutral-900/40 border border-white/[0.03]">
        <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-1">{primary.role}</p>
        <p
          className="text-3xl leading-tight text-white"
          style={{ fontFamily: primary.family, fontWeight: 300, letterSpacing: primary.letterSpacing || '-0.03em' }}
        >
          {guideline.identity?.name || 'Brand Name'}
        </p>
        <p className="text-[9px] font-mono text-neutral-500 mt-1">{primary.family} · {primary.style || 'Regular'} · {primary.size || 16}px</p>
      </div>
      {fonts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {fonts.slice(1).map((f, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[10px] text-neutral-400" style={{ fontFamily: f.family }}>
              {f.family} <span className="text-neutral-600">· {f.role}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const ButtonsPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const colors = guideline.colors || [];
  const primary = colors.find(c => c.role?.toLowerCase().includes('primary') || c.role?.toLowerCase().includes('fill')) || colors[1];
  const accent = colors.find(c => c.role?.toLowerCase().includes('accent') || c.role?.toLowerCase().includes('highlight')) || colors[2];
  const primaryHex = primary?.hex || '#1F7878';
  const accentHex = accent?.hex || '#52DDEB';
  const radius = guideline.tokens?.radius?.md || 10;
  const fontFamily = guideline.typography?.[0]?.family || 'inherit';

  const btnBase: React.CSSProperties = {
    height: 38,
    borderRadius: radius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    padding: '0 16px',
    cursor: 'default',
    border: 'none',
    flex: 1,
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div style={{ ...btnBase, background: primaryHex, color: '#F3E9E9' }}>PRIMARY</div>
        <div style={{ ...btnBase, background: 'transparent', border: `1.5px solid ${accentHex}`, color: accentHex }}>OUTLINE</div>
        <div style={{ ...btnBase, background: `linear-gradient(135deg, ${accentHex}, ${primaryHex})`, color: '#0D0D0D' }}>GRADIENT</div>
      </div>
      <div className="flex gap-2">
        <div style={{ ...btnBase, background: '#1E1E1E', border: `1.5px solid ${accentHex}`, color: accentHex, boxShadow: `0 0 18px ${accentHex}40` }}>GLOW</div>
        <div style={{ ...btnBase, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.15)', color: '#F3E9E9' }}>GHOST</div>
      </div>
    </div>
  );
};

const CardsPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const colors = guideline.colors || [];
  const bg = colors.find(c => c.role?.toLowerCase().includes('background'))?.hex || '#1E1E1E';
  const fg = colors.find(c => c.role?.toLowerCase().includes('foreground') || c.role?.toLowerCase().includes('text'))?.hex || '#F3E9E9';
  const accent = colors.find(c => c.role?.toLowerCase().includes('accent'))?.hex || '#52DDEB';
  const radius = guideline.tokens?.radius?.lg || 15;
  const fontFamily = guideline.typography?.[0]?.family || 'inherit';
  const shadow = guideline.shadows?.find(s => s.type === 'outer')?.css || '0 6px 18px rgba(0,0,0,0.25)';

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Dark card */}
      <div style={{ borderRadius: radius, background: bg, border: '1px solid rgba(255,255,255,0.08)', padding: 12, fontFamily, boxShadow: shadow, minHeight: 80 }}>
        <p style={{ fontSize: 9, color: accent, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>DARK</p>
        <p style={{ fontSize: 12, color: fg, fontWeight: 600 }}>{guideline.name || 'Brand'}</p>
      </div>
      {/* Light card */}
      <div style={{ borderRadius: radius, background: fg, border: `1px solid ${bg}20`, padding: 12, fontFamily, minHeight: 80 }}>
        <p style={{ fontSize: 9, color: bg, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>LIGHT</p>
        <p style={{ fontSize: 12, color: bg, fontWeight: 600 }}>Component</p>
      </div>
      {/* Glass card */}
      <div style={{ borderRadius: radius, background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}30`, padding: 12, fontFamily, backdropFilter: 'blur(8px)', minHeight: 80 }}>
        <p style={{ fontSize: 9, color: accent, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>GLASS</p>
        <p style={{ fontSize: 12, color: fg, fontWeight: 600 }}>Premium</p>
      </div>
    </div>
  );
};

const GradientsPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const grads = guideline.gradients || [];
  if (grads.length === 0) return <p className="text-[10px] text-neutral-600 font-mono">No gradients defined</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {grads.slice(0, 6).map(g => (
        <div key={g.id} className="rounded-xl overflow-hidden border border-white/5">
          <div className="h-14" style={{ background: g.css || `linear-gradient(${g.angle}deg, ${g.stops.map(s => `${s.color} ${s.position}%`).join(', ')})` }} />
          <div className="px-2 py-1 bg-neutral-900/60">
            <p className="text-[9px] font-mono text-neutral-400 truncate">{g.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const ShadowsPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const shadows = guideline.shadows || [];
  if (shadows.length === 0) return <p className="text-[10px] text-neutral-600 font-mono">No shadows defined</p>;
  const fontFamily = guideline.typography?.[0]?.family || 'inherit';
  const radius = guideline.tokens?.radius?.md || 10;
  return (
    <div className="flex gap-4 flex-wrap">
      {shadows.map(s => (
        <div key={s.id} className="flex flex-col items-center gap-2">
          <div style={{ width: 48, height: 48, borderRadius: radius, background: '#252525', boxShadow: s.css || `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px rgba(0,0,0,${s.opacity})`, border: '1px solid rgba(255,255,255,0.05)' }} />
          <p style={{ fontFamily, fontSize: 9, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.name}</p>
        </div>
      ))}
    </div>
  );
};

const MotionPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const m = guideline.motion;
  if (!m?.easing && !m?.durations) return <p className="text-[10px] text-neutral-600 font-mono">No motion tokens defined</p>;
  return (
    <div className="space-y-2">
      {m.easing && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-neutral-600 uppercase">Easing</span>
          <span className="text-[10px] font-mono text-neutral-300 bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/5">{m.easing}</span>
        </div>
      )}
      {m.durations && (
        <div className="flex gap-2">
          {(['fast', 'medium', 'slow'] as const).map(k => m.durations?.[k] !== undefined && (
            <div key={k} className="flex-1 text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-[9px] font-mono text-neutral-600 uppercase">{k}</p>
              <p className="text-[12px] font-mono text-white font-bold">{m.durations[k]}ms</p>
            </div>
          ))}
        </div>
      )}
      {m.philosophy && (
        <span className="inline-flex px-2 py-1 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 text-[9px] font-mono text-brand-cyan uppercase tracking-wider">{m.philosophy}</span>
      )}
    </div>
  );
};

const EditorialPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const g = guideline.guidelines;
  const fontFamily = guideline.typography?.[0]?.family || 'inherit';
  if (!g?.voice && !g?.dos?.length && !g?.person) return <p className="text-[10px] text-neutral-600 font-mono">No editorial rules defined</p>;
  return (
    <div className="space-y-3">
      {g?.voice && (
        <p style={{ fontFamily, fontSize: 14, color: '#F3E9E9', fontStyle: 'italic', opacity: 0.9 }}>"{g.voice}"</p>
      )}
      <div className="flex gap-2 flex-wrap">
        {g?.person && <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-[9px] font-mono text-neutral-400">2nd person: you/você</span>}
        {g?.emojiPolicy === 'none' && <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-[9px] font-mono text-neutral-400">No emoji</span>}
      </div>
      {g?.dos && g.dos.length > 0 && (
        <div className="space-y-1">
          {g.dos.slice(0, 3).map((d, i) => (
            <p key={i} className="text-[10px] text-neutral-400 flex items-center gap-1.5">
              <span className="text-brand-cyan/60">✓</span> {d}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const LogosPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const logos = guideline.logos || [];
  if (logos.length === 0) return <p className="text-[10px] text-neutral-600 font-mono">No logos uploaded</p>;
  return (
    <div className="flex gap-3 flex-wrap">
      {logos.slice(0, 4).map((l, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-20 h-14 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center overflow-hidden">
            <img src={l.url} alt={l.label || l.variant} className="max-w-full max-h-full object-contain p-2" />
          </div>
          <p className="text-[8px] font-mono text-neutral-600 uppercase">{l.variant}</p>
        </div>
      ))}
    </div>
  );
};

const StrategyPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const s = guideline.strategy;
  const fontFamily = guideline.typography?.[0]?.family || 'inherit';
  if (!s?.manifesto && !s?.archetypes?.length) return <p className="text-[10px] text-neutral-600 font-mono">No strategy defined</p>;
  return (
    <div className="space-y-3">
      {s?.manifesto && (
        <p style={{ fontFamily, fontSize: 13, lineHeight: 1.6, color: 'rgba(243,233,233,0.8)' }}>
          {s.manifesto.slice(0, 160)}{s.manifesto.length > 160 ? '...' : ''}
        </p>
      )}
      {s?.archetypes && s.archetypes.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {s.archetypes.map((a, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-[9px] font-mono text-neutral-400">{a.name}</span>
          ))}
        </div>
      )}
    </div>
  );
};

const TokensPreview: React.FC<{ guideline: BrandGuideline }> = ({ guideline }) => {
  const radius = guideline.tokens?.radius;
  const spacing = guideline.tokens?.spacing;
  if (!radius && !spacing) return <p className="text-[10px] text-neutral-600 font-mono">No tokens defined</p>;
  const accent = guideline.colors?.find(c => c.role?.toLowerCase().includes('accent'))?.hex || '#52DDEB';
  return (
    <div className="space-y-2">
      {radius && (
        <div className="flex gap-2 flex-wrap items-end">
          {Object.entries(radius).slice(0, 6).map(([k, v]) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <div style={{ width: 32, height: 32, borderRadius: v === 999 ? '50%' : v, background: `${accent}20`, border: `1px solid ${accent}40` }} />
              <p className="text-[8px] font-mono text-neutral-600">{k}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Section Definitions ─────────────────────────────────────────────────────

interface ValidationSection {
  id: string;
  title: string;
  getSubtitle: (g: BrandGuideline) => string;
  isAvailable: (g: BrandGuideline) => boolean;
  preview: React.FC<{ guideline: BrandGuideline }>;
  icon: React.FC<{ size?: number; className?: string }>;
}

const VALIDATION_SECTIONS: ValidationSection[] = [
  {
    id: 'colors',
    title: 'Color · Palette',
    getSubtitle: (g) => `${g.colors?.length || 0} colors defined`,
    isAvailable: (g) => (g.colors?.length || 0) > 0,
    preview: ColorsPreview,
    icon: Palette,
  },
  {
    id: 'typography',
    title: 'Typography · Scale',
    getSubtitle: (g) => g.typography?.map(t => t.family).join(' · ') || '',
    isAvailable: (g) => (g.typography?.length || 0) > 0,
    preview: TypographyPreview,
    icon: Type,
  },
  {
    id: 'buttons',
    title: 'Components · Buttons',
    getSubtitle: (g) => `Primary · Outline · Gradient · Glow · Ghost`,
    isAvailable: (g) => (g.colors?.length || 0) >= 2,
    preview: ButtonsPreview,
    icon: Shapes,
  },
  {
    id: 'cards',
    title: 'Components · Cards',
    getSubtitle: (g) => `Dark · Light · Glass`,
    isAvailable: (g) => (g.colors?.length || 0) >= 1,
    preview: CardsPreview,
    icon: Layers2,
  },
  {
    id: 'logos',
    title: 'Brand · Logos',
    getSubtitle: (g) => `${g.logos?.length || 0} variants uploaded`,
    isAvailable: (g) => (g.logos?.length || 0) > 0,
    preview: LogosPreview,
    icon: Palette,
  },
  {
    id: 'gradients',
    title: 'Color · Gradients',
    getSubtitle: (g) => `${g.gradients?.length || 0} gradients`,
    isAvailable: (g) => (g.gradients?.length || 0) > 0,
    preview: GradientsPreview,
    icon: Blend,
  },
  {
    id: 'shadows',
    title: 'Elevation · Shadows',
    getSubtitle: (g) => `${g.shadows?.length || 0} shadow tokens`,
    isAvailable: (g) => (g.shadows?.length || 0) > 0,
    preview: ShadowsPreview,
    icon: Layers2,
  },
  {
    id: 'tokens',
    title: 'Tokens · Radii & Spacing',
    getSubtitle: (g) => [
      g.tokens?.radius ? `${Object.keys(g.tokens.radius).length} radii` : '',
      g.tokens?.spacing ? `${Object.keys(g.tokens.spacing).length} spacing` : '',
    ].filter(Boolean).join(' · ') || 'Design tokens',
    isAvailable: (g) => !!(g.tokens?.radius || g.tokens?.spacing),
    preview: TokensPreview,
    icon: Frame,
  },
  {
    id: 'motion',
    title: 'Motion · Tokens',
    getSubtitle: (g) => g.motion?.easing || 'Easing & duration scale',
    isAvailable: (g) => !!(g.motion?.easing || g.motion?.durations),
    preview: MotionPreview,
    icon: Zap,
  },
  {
    id: 'editorial',
    title: 'Editorial · Voice',
    getSubtitle: (g) => g.guidelines?.voice ? `"${g.guidelines.voice.slice(0, 50)}"` : 'Tone & rules',
    isAvailable: (g) => !!(g.guidelines?.voice || g.guidelines?.dos?.length),
    preview: EditorialPreview,
    icon: FileText,
  },
  {
    id: 'strategy',
    title: 'Strategy · Brand',
    getSubtitle: (g) => g.strategy?.archetypes?.map(a => a.name).join(' · ') || 'Manifesto & archetypes',
    isAvailable: (g) => !!(g.strategy?.manifesto || g.strategy?.archetypes?.length),
    preview: StrategyPreview,
    icon: FileText,
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface DesignSystemValidationProps {
  guideline: BrandGuideline;
  onUpdate: (patch: Partial<BrandGuideline>) => void;
  onComplete: () => void;
  onEditSection: (sectionId: string) => void;
}

export const DesignSystemValidation: React.FC<DesignSystemValidationProps> = ({
  guideline,
  onUpdate,
  onComplete,
  onEditSection,
}) => {
  const validation = guideline.validation || {};
  const primaryFont = guideline.typography?.[0]?.family;
  const primaryColor = guideline.colors?.find(c => c.role?.toLowerCase().includes('accent'))?.hex || '#52DDEB';

  const availableSections = useMemo(
    () => VALIDATION_SECTIONS.filter(s => s.isAvailable(guideline)),
    [guideline]
  );

  const approvedCount = availableSections.filter(s => validation[s.id] === 'approved').length;
  const total = availableSections.length;
  const progress = total > 0 ? (approvedCount / total) * 100 : 0;
  const allDone = approvedCount === total;

  const getState = (id: string): ValidationState => (validation[id] as ValidationState) || 'pending';

  const handleApprove = (id: string) => {
    onUpdate({ validation: { ...validation, [id]: 'approved' } });
  };

  const handleNeedsWork = (id: string) => {
    onUpdate({ validation: { ...validation, [id]: 'needs_work' } });
    onEditSection(id);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-1">Design System Review</p>
            <h2
              className="text-2xl font-bold text-white"
              style={{ fontFamily: primaryFont }}
            >
              {guideline.name || 'Brand'}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-neutral-600">{approvedCount}/{total} approved</p>
            {allDone && (
              <p className="text-[10px] font-mono text-brand-cyan">All done ✓</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: primaryColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        <p className="text-[11px] text-neutral-500">
          Review each component rendered with your brand tokens. Approve or request changes — you can always edit and re-review later.
        </p>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {availableSections.map((section) => {
          const Preview = section.preview;
          return (
            <ComponentPreviewCard
              key={section.id}
              id={section.id}
              title={section.title}
              subtitle={section.getSubtitle(guideline)}
              state={getState(section.id)}
              onApprove={handleApprove}
              onNeedsWork={handleNeedsWork}
            >
              <Preview guideline={guideline} />
            </ComponentPreviewCard>
          );
        })}
      </div>

      {/* Empty state if no sections available */}
      {availableSections.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <p className="text-[11px] font-mono text-neutral-600 uppercase tracking-widest">No sections to review yet</p>
          <p className="text-[11px] text-neutral-500">Add colors, typography, and other brand tokens to start the review.</p>
        </div>
      )}

      {/* Complete CTA */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
        <div className="flex gap-2">
          {availableSections.filter(s => getState(s.id) === 'needs_work').length > 0 && (
            <p className="text-[10px] font-mono text-amber-400">
              {availableSections.filter(s => getState(s.id) === 'needs_work').length} section(s) need attention
            </p>
          )}
        </div>
        <Button
          onClick={onComplete}
          className={cn(
            'h-10 px-6 gap-2 text-[11px] font-mono uppercase tracking-wider transition-all rounded-full',
            allDone
              ? 'bg-brand-cyan text-black hover:bg-brand-cyan/90 shadow-lg shadow-brand-cyan/20'
              : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-white/10'
          )}
        >
          {allDone ? 'Complete Review' : 'Skip to Detail View'}
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
};
