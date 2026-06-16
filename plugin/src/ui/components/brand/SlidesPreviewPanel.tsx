import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Check, ChevronLeft, X } from 'lucide-react';
import type { SlidesPreview } from '../../hooks/useSlidesAnalyze';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'identity' | 'colors' | 'typography' | 'strategy' | 'tags' | 'assets';

interface Selection {
  identity: Set<number>;
  colors: Set<number>;
  typography: Set<number>;
  strategy: Set<number>;
  tags: Set<number>;
  assets: Set<number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIdentityItems(ext: any): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const id = ext?.identity || {};
  if (id.name) items.push({ label: 'Name', value: id.name });
  if (id.tagline) items.push({ label: 'Tagline', value: id.tagline });
  if (id.description) items.push({ label: 'Description', value: id.description });
  return items;
}

function getStrategyItems(ext: any): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const s = ext?.strategy || {};
  if (s.manifesto) items.push({ label: 'Manifesto', value: s.manifesto });
  (s.positioning || []).forEach((p: string) => items.push({ label: 'Positioning', value: p }));
  (s.archetypes || []).forEach((a: any) =>
    items.push({ label: `Archetype · ${a.role || ''}`, value: a.name || JSON.stringify(a) })
  );
  (s.personas || []).forEach((p: any) =>
    items.push({ label: `Persona`, value: `${p.name}${p.occupation ? ` · ${p.occupation}` : ''}` })
  );
  (s.voiceValues || []).forEach((v: any) =>
    items.push({ label: 'Voice', value: v.title || JSON.stringify(v) })
  );
  const g = ext?.guidelines || {};
  if (g.voice) items.push({ label: 'Voice', value: g.voice });
  return items;
}

function getTagItems(ext: any): string[] {
  const t = ext?.tags || {};
  return [
    ...(t.brand_values || []),
    ...(t.tone || []),
    ...(t.aesthetic || []),
  ];
}

function getAssetItems(ext: any): Array<{ category: string; label?: string }> {
  return (ext?.assetClassifications || []).map((a: any) => ({
    category: a.category,
    label: a.label || a.category,
  }));
}

function initSelection(ext: any): Selection {
  const make = (len: number) => new Set(Array.from({ length: len }, (_, i) => i));
  return {
    identity: make(getIdentityItems(ext).length),
    colors: make((ext?.colors || []).length),
    typography: make((ext?.typography || []).length),
    strategy: make(getStrategyItems(ext).length),
    tags: make(getTagItems(ext).length),
    assets: make(getAssetItems(ext).length),
  };
}

function totalSelected(sel: Selection) {
  return Object.values(sel).reduce((sum, s) => sum + s.size, 0);
}

// ─── Item checkbox ────────────────────────────────────────────────────────────

const ItemCheck: React.FC<{
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ checked, onToggle, children }) => (
  <div
    className={`flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-white/[0.04] transition-all ${!checked ? 'opacity-35' : ''}`}
    onClick={onToggle}
  >
    <div
      className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-white/15 border-white/30' : 'border-white/15'}`}
    >
      {checked && <Check size={8} className="text-neutral-200" />}
    </div>
    {children}
  </div>
);

// ─── Section ──────────────────────────────────────────────────────────────────

const Section: React.FC<{
  label: string;
  count: number;
  selectedCount: number;
  onToggleAll: () => void;
  children: React.ReactNode;
}> = ({ label, count, selectedCount, onToggleAll, children }) => {
  if (count === 0) return null;
  const allChecked = selectedCount === count;
  const someChecked = selectedCount > 0;
  return (
    <div className={`rounded-md border transition-colors ${someChecked ? 'border-white/10 bg-white/[0.02]' : 'border-neutral-800'}`}>
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none"
        onClick={onToggleAll}
      >
        <div
          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${allChecked ? 'bg-white/10 border-white/20' : someChecked ? 'bg-white/5 border-white/15' : 'border-white/10'}`}
        >
          {allChecked ? (
            <Check size={9} className="text-neutral-300" />
          ) : someChecked ? (
            <div className="w-1.5 h-0.5 bg-neutral-400 rounded" />
          ) : null}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 flex-1">
          {label}
        </span>
        <span className="text-[9px] font-mono text-neutral-700">{selectedCount}/{count}</span>
      </div>
      <div className="px-2 pb-2">{children}</div>
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  preview: SlidesPreview;
  isApplying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function SlidesPreviewPanel({ preview, isApplying, onApply, onDismiss }: Props) {
  const ext = preview.extracted;
  const [sel, setSel] = useState<Selection>(() => initSelection(ext));

  useEffect(() => {
    setSel(initSelection(ext));
  }, [ext]);

  const toggle = useCallback((cat: Category, i: number) => {
    setSel((prev) => {
      const next = { ...prev, [cat]: new Set(prev[cat]) };
      if (next[cat].has(i)) next[cat].delete(i);
      else next[cat].add(i);
      return next;
    });
  }, []);

  const toggleAll = useCallback((cat: Category, total: number) => {
    setSel((prev) => {
      const allOn = prev[cat].size === total;
      return { ...prev, [cat]: allOn ? new Set() : new Set(Array.from({ length: total }, (_, i) => i)) };
    });
  }, []);

  const colors: any[] = ext?.colors || [];
  const typography: any[] = ext?.typography || [];
  const identityItems = getIdentityItems(ext);
  const strategyItems = getStrategyItems(ext);
  const tagItems = getTagItems(ext);
  const assetItems = getAssetItems(ext);

  const total = totalSelected(sel);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <button onClick={onDismiss} className="text-neutral-600 hover:text-neutral-400 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">Preview da Extração</p>
          <p className="text-[9px] text-neutral-600 font-mono">
            {preview.totalFrames} slides · {preview.pages} páginas
          </p>
        </div>
        <button onClick={onDismiss} className="text-neutral-700 hover:text-neutral-500 transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {/* Identity */}
        <Section
          label="Identidade"
          count={identityItems.length}
          selectedCount={sel.identity.size}
          onToggleAll={() => toggleAll('identity', identityItems.length)}
        >
          {identityItems.map((item, i) => (
            <ItemCheck key={i} checked={sel.identity.has(i)} onToggle={() => toggle('identity', i)}>
              <span className="text-[9px] font-mono text-neutral-600 w-16 flex-shrink-0">{item.label}</span>
              <span className="text-[10px] text-neutral-300 truncate">{item.value}</span>
            </ItemCheck>
          ))}
        </Section>

        {/* Colors */}
        <Section
          label="Cores"
          count={colors.length}
          selectedCount={sel.colors.size}
          onToggleAll={() => toggleAll('colors', colors.length)}
        >
          <div className="grid grid-cols-2 gap-0.5">
            {colors.map((c, i) => (
              <ItemCheck key={i} checked={sel.colors.has(i)} onToggle={() => toggle('colors', i)}>
                <div
                  className="w-4 h-4 rounded border border-white/10 flex-shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-[10px] text-neutral-300 truncate flex-1">{c.name || c.hex}</span>
                <span className="text-[9px] font-mono text-neutral-700">{c.role}</span>
              </ItemCheck>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section
          label="Tipografia"
          count={typography.length}
          selectedCount={sel.typography.size}
          onToggleAll={() => toggleAll('typography', typography.length)}
        >
          {typography.map((f, i) => (
            <ItemCheck key={i} checked={sel.typography.has(i)} onToggle={() => toggle('typography', i)}>
              <span className="text-[10px] text-neutral-200 flex-shrink-0 w-28 truncate">{f.family}</span>
              <span className="text-[9px] font-mono text-neutral-600">{f.style} · {f.role}</span>
            </ItemCheck>
          ))}
        </Section>

        {/* Strategy */}
        <Section
          label="Estratégia"
          count={strategyItems.length}
          selectedCount={sel.strategy.size}
          onToggleAll={() => toggleAll('strategy', strategyItems.length)}
        >
          {strategyItems.map((item, i) => (
            <ItemCheck key={i} checked={sel.strategy.has(i)} onToggle={() => toggle('strategy', i)}>
              <span className="text-[9px] font-mono text-neutral-600 w-20 flex-shrink-0 truncate">{item.label}</span>
              <span className="text-[10px] text-neutral-400 truncate italic">"{item.value}"</span>
            </ItemCheck>
          ))}
        </Section>

        {/* Tags */}
        <Section
          label="Tags & Valores"
          count={tagItems.length}
          selectedCount={sel.tags.size}
          onToggleAll={() => toggleAll('tags', tagItems.length)}
        >
          <div className="flex flex-wrap gap-1 pt-0.5">
            {tagItems.map((tag, i) => (
              <div
                key={i}
                onClick={() => toggle('tags', i)}
                className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${sel.tags.has(i) ? 'border-white/20 text-neutral-300 bg-white/5' : 'border-white/5 text-neutral-700'}`}
              >
                {tag}
              </div>
            ))}
          </div>
        </Section>

        {/* Assets */}
        <Section
          label="Assets Detectados"
          count={assetItems.length}
          selectedCount={sel.assets.size}
          onToggleAll={() => toggleAll('assets', assetItems.length)}
        >
          <div className="space-y-0.5">
            {assetItems.map((a, i) => (
              <ItemCheck key={i} checked={sel.assets.has(i)} onToggle={() => toggle('assets', i)}>
                <span className={`text-[9px] font-mono px-1 rounded ${
                  a.category === 'logo' ? 'text-amber-400/80' :
                  a.category === 'photo' ? 'text-blue-400/80' :
                  a.category === 'mockup' ? 'text-purple-400/80' :
                  'text-neutral-600'
                }`}>{a.category}</span>
                <span className="text-[10px] text-neutral-400 truncate">{a.label}</span>
              </ItemCheck>
            ))}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 p-2 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={isApplying}
          className="h-7 px-3 text-[10px] text-neutral-600 border border-white/5"
        >
          Descartar
        </Button>
        <Button
          variant="brand"
          size="sm"
          onClick={onApply}
          disabled={isApplying || total === 0}
          className="flex-1 h-7 text-[10px] font-bold uppercase tracking-wider"
        >
          {isApplying ? <GlitchLoader size={11} className="mr-1.5" /> : <Check size={11} className="mr-1.5" />}
          {isApplying ? 'Aplicando…' : `Aplicar (${total} itens)`}
        </Button>
      </div>
    </div>
  );
}
