import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandIngestApprovalProps {
  extracted: any;
  preview: BrandGuideline;
  existing: BrandGuideline;
  images?: string[];
  onApprove: (mode: 'merge' | 'replace') => void;
  onReject: () => void;
  isApplying?: boolean;
}

// ─── Diff helpers — only show what's actually new ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffBy(incoming: any[], existing: any[], key: (t: any) => string): any[] {
  const seen = new Set(existing.map(key));
  return incoming.filter(t => !seen.has(key(t)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section: React.FC<{
  label: string;
  count: number;
  children: React.ReactNode;
}> = ({ label, count, children }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-mono text-neutral-700">({count})</span>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
    {children}
  </div>
);

const ColorSwatch: React.FC<{ hex: string; name: string; isNew?: boolean }> = ({ hex, name, isNew = true }) => (
  <div className={`flex items-center gap-2 ${isNew ? '' : 'opacity-40'}`}>
    <div className="w-7 h-7 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: hex }} />
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-neutral-300 font-medium leading-tight truncate">{name || hex}</p>
        {!isNew && <span className="text-[9px] font-mono text-neutral-700 shrink-0">exists</span>}
      </div>
      <p className="text-[10px] font-mono text-neutral-600">{hex}</p>
    </div>
  </div>
);

const GradientBar: React.FC<{ name: string; css: string; stops: Array<{ hex: string; position: number }> }> = ({ name, css, stops }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-20 h-5 rounded border border-white/[0.06] shrink-0" style={{ background: css }} />
    <div className="min-w-0">
      <p className="text-xs text-neutral-400 truncate">{name}</p>
      <p className="text-[10px] font-mono text-neutral-700">{stops.map(s => `${s.hex}@${s.position}%`).join(' → ')}</p>
    </div>
  </div>
);

const ShadowPreview: React.FC<{ name: string; css: string }> = ({ name, css }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-7 h-7 rounded-md bg-neutral-800 shrink-0" style={{ boxShadow: css }} />
    <div className="min-w-0">
      <p className="text-xs text-neutral-400 truncate">{name}</p>
      <p className="text-[10px] font-mono text-neutral-700 truncate">{css}</p>
    </div>
  </div>
);

const BorderPreview: React.FC<{ name: string; width: number; color: string }> = ({ name, width, color }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-14 h-5 rounded shrink-0 bg-neutral-900" style={{ border: `${width}px solid ${color}` }} />
    <div className="min-w-0">
      <p className="text-xs text-neutral-400 truncate">{name}</p>
      <p className="text-[10px] font-mono text-neutral-700">{width}px · {color}</p>
    </div>
  </div>
);

const FontRow: React.FC<{
  family: string; style: string; size: number;
  lineHeight?: number; letterSpacing?: string;
}> = ({ family, style, size, lineHeight, letterSpacing }) => (
  <div className="flex items-baseline gap-3 py-1 border-b border-white/[0.03] last:border-0">
    <span className="text-sm text-neutral-200 shrink-0" style={{ fontFamily: family, minWidth: '8rem' }}>
      {family}
    </span>
    <span className="text-[10px] font-mono text-neutral-600 shrink-0">{style}</span>
    <span className="text-[10px] font-mono text-neutral-700 shrink-0">{size}px</span>
    {lineHeight && <span className="text-[10px] font-mono text-neutral-800">lh:{lineHeight}</span>}
    {letterSpacing && <span className="text-[10px] font-mono text-neutral-800">ls:{letterSpacing}</span>}
  </div>
);

const ImageThumb: React.FC<{ src: string; i: number }> = ({ src, i }) => (
  <div className="aspect-square rounded border border-white/[0.05] bg-neutral-900/60 overflow-hidden">
    <img src={src} alt={`asset-${i}`} className="w-full h-full object-contain p-0.5" />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const BrandIngestApproval: React.FC<BrandIngestApprovalProps> = ({
  preview, existing, images, onApprove, onReject, isApplying,
}) => {
  const [mode, setMode] = React.useState<'merge' | 'replace'>('merge');
  const p = preview as any;
  const e = existing as any;

  // Always show ALL extracted tokens — merge/replace only affects how they're applied
  const newColors  = p.colors || [];
  const newFonts   = p.typography || [];
  const newGrads   = p.gradients || [];
  const newShadows = p.shadows || [];
  const newBorders = p.borders || [];
  const newRadii   = p.tokens?.radius ? Object.values(p.tokens.radius as Record<string, number>) : [];
  const newLogos   = p.logos || [];
  const newMedia   = p.media || [];

  // Mark which tokens already exist (shown with dimmed indicator, not hidden)
  const existingColorHexes = new Set((e.colors || []).map((c: any) => c.hex?.toLowerCase()));
  const existingFontKeys   = new Set((e.typography || []).map((f: any) => `${f.family}::${f.style}`));

  const categories = [
    newColors.length, newFonts.length, newGrads.length,
    newShadows.length, newBorders.length, newRadii.length,
    newLogos.length, newMedia.length, images?.length ?? 0,
  ].filter(Boolean);
  const totalCategories = categories.length;

  const totalTokens = [
    newColors.length, newFonts.length, newGrads.length,
    newShadows.length, newBorders.length, newRadii.length,
    newLogos.length, newMedia.length, images?.length ?? 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <Modal
      isOpen
      onClose={onReject}
      title="Review extracted data"
      description={`${totalCategories} categor${totalCategories !== 1 ? 'ies' : 'y'} · ${totalTokens} tokens`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-md border border-white/[0.08] p-0.5">
            {(['merge', 'replace'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-2.5 h-6 rounded text-[10px] font-mono uppercase transition-all ${
                  mode === m ? 'bg-white/[0.08] text-neutral-200' : 'text-neutral-600 hover:text-neutral-400'
                }`}
                title={m === 'merge' ? 'Add new tokens, keep existing' : 'Replace all tokens with extracted data'}
              >{m}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onReject} className="h-8 px-4 gap-1.5 border border-white/10 text-xs">
              <X size={12} /> Discard
            </Button>
            <Button onClick={() => onApprove(mode)} disabled={isApplying || totalTokens === 0}
              className="h-8 px-4 gap-1.5 bg-white/[0.08] border border-white/15 text-neutral-200 hover:bg-white/[0.12] text-xs">
              <Check size={12} /> {isApplying ? 'Applying…' : mode === 'replace' ? 'Replace' : 'Merge'}
            </Button>
          </div>
        </div>
      }
    >
      {totalTokens === 0 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">No new tokens found.</p>
      ) : (
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">

          {newColors.length > 0 && (
            <Section label="Colors" count={newColors.length}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {newColors.map((c: any, i: number) => (
                  <ColorSwatch key={i} hex={c.hex} name={c.name || ''}
                    isNew={!existingColorHexes.has(c.hex?.toLowerCase())} />
                ))}
              </div>
            </Section>
          )}

          {newFonts.length > 0 && (
            <Section label="Typography" count={newFonts.length}>
              <div>
                {newFonts.map((f: any, i: number) => (
                  <div key={i} className={existingFontKeys.has(`${f.family}::${f.style}`) ? 'opacity-40' : ''}>
                    <FontRow family={f.family} style={f.style || 'Regular'}
                      size={f.size || 16} lineHeight={f.lineHeight} letterSpacing={f.letterSpacing} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {newGrads.length > 0 && (
            <Section label="Gradients" count={newGrads.length}>
              <div className="space-y-1.5">
                {newGrads.map((g: any, i: number) => <GradientBar key={i} name={g.name} css={g.css} stops={g.stops} />)}
              </div>
            </Section>
          )}

          {newShadows.length > 0 && (
            <Section label="Shadows" count={newShadows.length}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {newShadows.map((s: any, i: number) => <ShadowPreview key={i} name={s.name} css={s.css} />)}
              </div>
            </Section>
          )}

          {newBorders.length > 0 && (
            <Section label="Borders" count={newBorders.length}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {newBorders.map((b: any, i: number) => <BorderPreview key={i} name={b.name} width={b.width} color={b.color} />)}
              </div>
            </Section>
          )}

          {newRadii.length > 0 && (
            <Section label="Border Radius" count={newRadii.length}>
              <div className="flex flex-wrap gap-2">
                {(newRadii as number[]).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-6 h-6 bg-neutral-700/40 border border-white/[0.08]" style={{ borderRadius: `${r}px` }} />
                    <span className="text-[10px] font-mono text-neutral-500">{r}px</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {newLogos.length > 0 && (
            <Section label="Logos" count={newLogos.length}>
              <div className="flex flex-wrap gap-2">
                {newLogos.map((l: any, i: number) => (
                  <div key={i} className="w-14 h-14 rounded border border-white/[0.06] bg-neutral-900/60 flex items-center justify-center overflow-hidden p-1">
                    <img src={l.url} alt={l.label || ''} className="max-w-full max-h-full object-contain" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {newMedia.length > 0 && (
            <Section label="Media" count={newMedia.length}>
              <div className="grid grid-cols-6 gap-1.5">
                {newMedia.map((m: any, i: number) => (
                  <div key={i} className="aspect-square rounded border border-white/[0.06] bg-neutral-900/60 overflow-hidden">
                    <img src={m.url} alt={m.label || ''} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {images && images.length > 0 && (
            <Section label="Assets (will be classified on apply)" count={images.length}>
              <div className="grid grid-cols-6 gap-1.5">
                {images.slice(0, 24).map((src, i) => <ImageThumb key={i} src={src} i={i} />)}
                {images.length > 24 && (
                  <div className="aspect-square rounded border border-white/[0.05] bg-neutral-900/60 flex items-center justify-center">
                    <span className="text-[10px] text-neutral-600 font-mono">+{images.length - 24}</span>
                  </div>
                )}
              </div>
            </Section>
          )}

        </div>
      )}
    </Modal>
  );
};
