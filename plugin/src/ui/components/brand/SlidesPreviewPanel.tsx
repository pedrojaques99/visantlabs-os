import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
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

type TFn = (key: string, params?: Record<string, any>) => string;

function getIdentityItems(ext: any, t: TFn): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const id = ext?.identity || {};
  if (id.name) items.push({ label: t('plugin.brand.slidesPreview.name'), value: id.name });
  if (id.tagline) items.push({ label: t('plugin.brand.slidesPreview.tagline'), value: id.tagline });
  if (id.description)
    items.push({ label: t('plugin.brand.slidesPreview.description'), value: id.description });
  return items;
}

function getStrategyItems(ext: any, t: TFn): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const s = ext?.strategy || {};
  if (s.manifesto)
    items.push({ label: t('plugin.brand.slidesPreview.manifesto'), value: s.manifesto });
  (s.positioning || []).forEach((p: string) =>
    items.push({ label: t('plugin.brand.slidesPreview.positioning'), value: p })
  );
  (s.archetypes || []).forEach((a: any) =>
    items.push({
      label: t('plugin.brand.slidesPreview.archetype', { role: a.role || '' }),
      value: a.name || JSON.stringify(a),
    })
  );
  (s.personas || []).forEach((p: any) =>
    items.push({
      label: t('plugin.brand.slidesPreview.persona'),
      value: `${p.name}${p.occupation ? ` · ${p.occupation}` : ''}`,
    })
  );
  (s.voiceValues || []).forEach((v: any) =>
    items.push({
      label: t('plugin.brand.slidesPreview.voice'),
      value: v.title || JSON.stringify(v),
    })
  );
  const g = ext?.guidelines || {};
  if (g.voice) items.push({ label: t('plugin.brand.slidesPreview.voice'), value: g.voice });
  return items;
}

function getTagItems(ext: any): string[] {
  const t = ext?.tags || {};
  return [...(t.brand_values || []), ...(t.tone || []), ...(t.aesthetic || [])];
}

function getAssetItems(ext: any): Array<{ category: string; label?: string }> {
  return (ext?.assetClassifications || []).map((a: any) => ({
    category: a.category,
    label: a.label || a.category,
  }));
}

function initSelection(ext: any, t: TFn): Selection {
  const make = (len: number) => new Set(Array.from({ length: len }, (_, i) => i));
  return {
    identity: make(getIdentityItems(ext, t).length),
    colors: make((ext?.colors || []).length),
    typography: make((ext?.typography || []).length),
    strategy: make(getStrategyItems(ext, t).length),
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
    className={`flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-foreground/[0.04] transition-all ${!checked ? 'opacity-35' : ''}`}
    onClick={onToggle}
  >
    <div
      className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-foreground/15 border-foreground/30' : 'border-foreground/15'}`}
    >
      {checked && <Check size={8} className="text-foreground" />}
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
    <div
      className={`rounded-md border transition-colors ${someChecked ? 'border-border bg-muted/30' : 'border-border'}`}
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none"
        onClick={onToggleAll}
      >
        <div
          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${allChecked ? 'bg-muted border-foreground/20' : someChecked ? 'bg-muted border-foreground/15' : 'border-border'}`}
        >
          {allChecked ? (
            <Check size={9} className="text-foreground/70" />
          ) : someChecked ? (
            <div className="w-1.5 h-0.5 bg-muted-foreground rounded" />
          ) : null}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground flex-1">
          {label}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {selectedCount}/{count}
        </span>
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
  const { t } = useTranslation();
  const ext = preview.extracted;
  const [sel, setSel] = useState<Selection>(() => initSelection(ext, t));

  useEffect(() => {
    setSel(initSelection(ext, t));
  }, [ext, t]);

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
      return {
        ...prev,
        [cat]: allOn ? new Set() : new Set(Array.from({ length: total }, (_, i) => i)),
      };
    });
  }, []);

  const colors: any[] = ext?.colors || [];
  const typography: any[] = ext?.typography || [];
  const identityItems = getIdentityItems(ext, t);
  const strategyItems = getStrategyItems(ext, t);
  const tagItems = getTagItems(ext);
  const assetItems = getAssetItems(ext);

  const total = totalSelected(sel);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <button
          onClick={onDismiss}
          className="text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
            {t('plugin.brand.slidesPreview.extractionPreview')}
          </p>
          <p className="text-[9px] text-muted-foreground/70 font-mono">
            {t('plugin.brand.slidesPreview.slidesPages', {
              slides: preview.totalFrames,
              pages: preview.pages,
            })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {/* Identity */}
        <Section
          label={t('plugin.brand.slidesPreview.identity')}
          count={identityItems.length}
          selectedCount={sel.identity.size}
          onToggleAll={() => toggleAll('identity', identityItems.length)}
        >
          {identityItems.map((item, i) => (
            <ItemCheck key={i} checked={sel.identity.has(i)} onToggle={() => toggle('identity', i)}>
              <span className="text-[9px] font-mono text-muted-foreground/70 w-16 flex-shrink-0">
                {item.label}
              </span>
              <span className="text-[10px] text-foreground/70 truncate">{item.value}</span>
            </ItemCheck>
          ))}
        </Section>

        {/* Colors */}
        <Section
          label={t('plugin.brand.slidesPreview.colors')}
          count={colors.length}
          selectedCount={sel.colors.size}
          onToggleAll={() => toggleAll('colors', colors.length)}
        >
          <div className="grid grid-cols-2 gap-0.5">
            {colors.map((c, i) => (
              <ItemCheck key={i} checked={sel.colors.has(i)} onToggle={() => toggle('colors', i)}>
                <div
                  className="w-4 h-4 rounded border border-border flex-shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-[10px] text-foreground/70 truncate flex-1">
                  {c.name || c.hex}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/50">{c.role}</span>
              </ItemCheck>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section
          label={t('plugin.brand.slidesPreview.typography')}
          count={typography.length}
          selectedCount={sel.typography.size}
          onToggleAll={() => toggleAll('typography', typography.length)}
        >
          {typography.map((f, i) => (
            <ItemCheck
              key={i}
              checked={sel.typography.has(i)}
              onToggle={() => toggle('typography', i)}
            >
              <span className="text-[10px] text-foreground flex-shrink-0 w-28 truncate">
                {f.family}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/70">
                {f.style} · {f.role}
              </span>
            </ItemCheck>
          ))}
        </Section>

        {/* Strategy */}
        <Section
          label={t('plugin.brand.slidesPreview.strategy')}
          count={strategyItems.length}
          selectedCount={sel.strategy.size}
          onToggleAll={() => toggleAll('strategy', strategyItems.length)}
        >
          {strategyItems.map((item, i) => (
            <ItemCheck key={i} checked={sel.strategy.has(i)} onToggle={() => toggle('strategy', i)}>
              <span className="text-[9px] font-mono text-muted-foreground/70 w-20 flex-shrink-0 truncate">
                {item.label}
              </span>
              <span className="text-[10px] text-muted-foreground truncate italic">
                "{item.value}"
              </span>
            </ItemCheck>
          ))}
        </Section>

        {/* Tags */}
        <Section
          label={t('plugin.brand.slidesPreview.tagsValues')}
          count={tagItems.length}
          selectedCount={sel.tags.size}
          onToggleAll={() => toggleAll('tags', tagItems.length)}
        >
          <div className="flex flex-wrap gap-1 pt-0.5">
            {tagItems.map((tag, i) => (
              <div
                key={i}
                onClick={() => toggle('tags', i)}
                className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${sel.tags.has(i) ? 'border-foreground/20 text-foreground/70 bg-muted' : 'border-border/50 text-muted-foreground/50'}`}
              >
                {tag}
              </div>
            ))}
          </div>
        </Section>

        {/* Assets */}
        <Section
          label={t('plugin.brand.slidesPreview.detectedAssets')}
          count={assetItems.length}
          selectedCount={sel.assets.size}
          onToggleAll={() => toggleAll('assets', assetItems.length)}
        >
          <div className="space-y-0.5">
            {assetItems.map((a, i) => (
              <ItemCheck key={i} checked={sel.assets.has(i)} onToggle={() => toggle('assets', i)}>
                <span
                  className={`text-[9px] font-mono px-1 rounded ${
                    a.category === 'logo'
                      ? 'text-amber-400/80'
                      : a.category === 'photo'
                        ? 'text-blue-400/80'
                        : a.category === 'mockup'
                          ? 'text-purple-400/80'
                          : 'text-muted-foreground/70'
                  }`}
                >
                  {a.category}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">{a.label}</span>
              </ItemCheck>
            ))}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 p-2 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={isApplying}
          className="h-7 px-3 text-[10px] text-muted-foreground/70 border border-border/50"
        >
          {t('plugin.brand.slidesPreview.discard')}
        </Button>
        <Button
          variant="brand"
          size="sm"
          onClick={onApply}
          disabled={isApplying || total === 0}
          className="flex-1 h-7 text-[10px] font-bold uppercase tracking-wider"
        >
          {isApplying ? (
            <GlitchLoader size={11} className="mr-1.5" />
          ) : (
            <Check size={11} className="mr-1.5" />
          )}
          {isApplying
            ? t('plugin.brand.slidesPreview.applying')
            : t('plugin.brand.slidesPreview.apply', { count: total })}
        </Button>
      </div>
    </div>
  );
}
