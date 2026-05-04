import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import type { FigStreamState, FigCategory } from '@/hooks/useExtractFigStream';
import type { BrandGuideline } from '@/lib/figma-types';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// ─── Section order ────────────────────────────────────────────────────────────
const SECTION_ORDER: Array<{ key: FigCategory; label: string }> = [
  { key: 'colors',     label: 'Colors' },
  { key: 'typography', label: 'Typography' },
  { key: 'borders',    label: 'Borders' },
  { key: 'radii',      label: 'Border Radius' },
  { key: 'shadows',    label: 'Shadows' },
  { key: 'gradients',  label: 'Gradients' },
  { key: 'strategy',   label: 'Brand Copy' },
  { key: 'components', label: 'Components' },
  { key: 'images',     label: 'Assets' },
];

// ─── Item selection state ─────────────────────────────────────────────────────
type ItemSel = Map<FigCategory, Set<number>>;

function initSel(state: FigStreamState): ItemSel {
  const m: ItemSel = new Map();
  for (const { key } of SECTION_ORDER) {
    const data = getItems(state, key);
    if (data.length) m.set(key, new Set(data.map((_, i) => i)));
  }
  return m;
}

function getItems(state: FigStreamState, key: FigCategory): any[] {
  if (key === 'strategy') {
    const s = state.strategy;
    if (!s) return [];
    return [
      s.tagline && { label: 'Tagline', value: s.tagline, field: 'tagline' },
      s.manifesto && { label: 'Manifesto', value: s.manifesto, field: 'manifesto' },
      s.description && { label: 'Description', value: s.description, field: 'description' },
      ...(s.claims || []).map(c => ({ label: 'Claim', value: c, field: 'claim' })),
    ].filter(Boolean);
  }
  if (key === 'typography') {
    // Dedupe by family — one entry per font family (pick most prominent style)
    const arr = (state.typography || []) as any[];
    const seen = new Map<string, any>();
    for (const f of arr) {
      if (!seen.has(f.family)) seen.set(f.family, f);
    }
    return Array.from(seen.values());
  }
  return (state[key as keyof FigStreamState] as any[] | undefined) || [];
}

// ─── Shared item checkbox ─────────────────────────────────────────────────────
const ItemCheck: React.FC<{
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  dim?: boolean;
}> = ({ checked, onToggle, children, dim }) => (
  <div
    className={`flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-white/[0.03] transition-all ${dim && !checked ? 'opacity-30' : ''}`}
    onClick={onToggle}
  >
    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-white/[0.15] border-white/30' : 'border-white/[0.15]'}`}>
      {checked && <Check size={9} className="text-neutral-200" />}
    </div>
    {children}
  </div>
);

// ─── Section shell ────────────────────────────────────────────────────────────
const SectionShell: React.FC<{
  label: string;
  loading?: boolean;
  allChecked: boolean;
  someChecked: boolean;
  onToggleAll: () => void;
  children?: React.ReactNode;
}> = ({ label, loading, allChecked, someChecked, onToggleAll, children }) => (
  <div className={`rounded-md border transition-colors ${someChecked ? 'border-white/[0.10] bg-white/[0.02]' : 'border-white/[0.04]'}`}>
    <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none" role="button" tabIndex={0} onClick={onToggleAll} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleAll(); } }}>
      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${allChecked ? 'bg-white/[0.12] border-white/20' : someChecked ? 'bg-white/[0.06] border-white/15' : 'border-white/10'}`}>
        {allChecked ? <Check size={10} className="text-neutral-300" /> : someChecked ? <div className="w-2 h-0.5 bg-neutral-400 rounded" /> : null}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex-1">{label}</span>
      {loading && <Loader2 size={11} className="text-neutral-600 animate-spin flex-shrink-0" />}
    </div>
    {children && <div className="px-2 pb-2.5">{children}</div>}
  </div>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`rounded bg-white/[0.04] animate-pulse ${className}`} />
);

// ─── Content renderers ────────────────────────────────────────────────────────

const ColorsSection: React.FC<{ data: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="grid grid-cols-2 gap-0.5">
    {data.map((c, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <div className="w-5 h-5 rounded border border-white/10 flex-shrink-0" style={{ backgroundColor: c.hex }} />
        <span className="text-xs text-neutral-300 truncate">{c.name || c.hex}</span>
        <span className="text-[10px] font-mono text-neutral-600 ml-auto">{c.hex}</span>
      </ItemCheck>
    ))}
  </div>
);

const TypographySection: React.FC<{ data: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="space-y-0">
    {data.map((f, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <span className="text-xs text-neutral-200 flex-shrink-0" style={{ fontFamily: f.family, minWidth: '8rem' }}>{f.family}</span>
        <span className="text-[10px] font-mono text-neutral-600">{f.style} · {f.size}px</span>
      </ItemCheck>
    ))}
  </div>
);

const GradientsSection: React.FC<{ data: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="space-y-0">
    {data.map((g, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <div className="w-12 h-4 rounded border border-white/[0.06] flex-shrink-0" style={{ background: g.css }} />
        <span className="text-xs text-neutral-400 truncate">{g.name}</span>
      </ItemCheck>
    ))}
  </div>
);

const ShadowsSection: React.FC<{ data: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="space-y-0">
    {data.map((s, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <div className="w-5 h-5 rounded bg-neutral-800 flex-shrink-0" style={{ boxShadow: s.css }} />
        <span className="text-xs text-neutral-400">{s.name}</span>
        <span className="text-[10px] font-mono text-neutral-700 ml-auto truncate max-w-[140px]">{s.css}</span>
      </ItemCheck>
    ))}
  </div>
);

const BordersSection: React.FC<{ data: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="space-y-0">
    {data.map((b, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <div className="w-10 h-4 rounded flex-shrink-0 bg-neutral-900" style={{ border: `${b.width}px solid ${b.color}` }} />
        <span className="text-xs text-neutral-400">{b.name}</span>
        <span className="text-[10px] font-mono text-neutral-700 ml-auto">{b.color} {b.width}px</span>
      </ItemCheck>
    ))}
  </div>
);

const RadiiSection: React.FC<{ data: number[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="flex flex-wrap gap-0.5">
    {data.map((r, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <div className="w-5 h-5 bg-neutral-700/40 border border-white/[0.06] flex-shrink-0" style={{ borderRadius: `${r}px` }} />
        <span className="text-[10px] font-mono text-neutral-500">{r}px</span>
      </ItemCheck>
    ))}
  </div>
);

const StrategySection: React.FC<{ items: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ items, sel, toggle }) => (
  <div className="space-y-0">
    {items.map((item, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <span className="text-[10px] font-mono text-neutral-600 flex-shrink-0 w-16">{item.label}</span>
        <span className="text-xs text-neutral-400 truncate italic">"{item.value}"</span>
      </ItemCheck>
    ))}
  </div>
);

const ComponentsSection: React.FC<{ data: any[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="flex flex-wrap gap-0.5">
    {data.slice(0, 20).map((c, i) => (
      <ItemCheck key={i} checked={sel.has(i)} onToggle={() => toggle(i)} dim>
        <span className="text-[10px] font-mono text-neutral-500 max-w-[100px] truncate">{c.name}</span>
      </ItemCheck>
    ))}
    {data.length > 20 && <span className="text-[10px] text-neutral-700 font-mono px-2 py-1">+{data.length - 20}</span>}
  </div>
);

const AssetsSection: React.FC<{ data: string[]; sel: Set<number>; toggle: (i: number) => void }> = ({ data, sel, toggle }) => (
  <div className="grid grid-cols-6 gap-1">
    {data.map((src, i) => (
      <div
        key={i}
        className={`relative aspect-square rounded border overflow-hidden cursor-pointer transition-all ${sel.has(i) ? 'border-white/20' : 'border-white/[0.04] opacity-30'}`}
        onClick={() => toggle(i)}
      >
        <img src={src} alt="" className="w-full h-full object-contain bg-neutral-900/60 p-0.5" />
        {sel.has(i) && (
          <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
            <Check size={8} className="text-white" />
          </div>
        )}
      </div>
    ))}
  </div>
);

// ─── Main modal ───────────────────────────────────────────────────────────────

interface BrandIngestModalProps {
  state: FigStreamState;
  guideline: BrandGuideline;
  onSuccess: () => void;
  onClose: () => void;
  title?: string;
  /** Source identifier for audit trail — defaults to 'manual' if omitted */
  source?: 'pdf' | 'fig_file' | 'images' | 'image' | 'url' | 'json' | 'manual';
}

export const BrandIngestModal: React.FC<BrandIngestModalProps> = ({
  state, guideline, onSuccess, onClose, title = 'Review extraction', source = 'manual',
}) => {
  const [itemSel, setItemSel] = useState<ItemSel>(new Map());
  const [applying, setApplying] = useState(false);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const queryClient = useQueryClient();

  // Auto-select all items when each category arrives
  useEffect(() => {
    setItemSel(prev => {
      const next = new Map(prev);
      for (const { key } of SECTION_ORDER) {
        if (!next.has(key)) {
          const items = getItems(state, key);
          if (items.length) next.set(key, new Set(items.map((_, i) => i)));
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.colors?.length, state.typography?.length, state.gradients?.length,
      state.shadows?.length, state.borders?.length, state.radii?.length,
      state.components?.length, state.images?.length, state.strategy]);

  const toggleItem = useCallback((key: FigCategory, i: number) => {
    setItemSel(prev => {
      const next = new Map(prev);
      const s = new Set(next.get(key) || []);
      s.has(i) ? s.delete(i) : s.add(i);
      next.set(key, s);
      return next;
    });
  }, []);

  const toggleSection = useCallback((key: FigCategory) => {
    const items = getItems(state, key);
    setItemSel(prev => {
      const next = new Map(prev);
      const cur = next.get(key) || new Set();
      const allOn = cur.size === items.length;
      next.set(key, allOn ? new Set() : new Set(items.map((_, i) => i)));
      return next;
    });
  }, [state]);

  const apply = async () => {
    setApplying(true);
    try {
      if (!guideline.id) { toast.error('Guideline ID missing'); return; }
      const payload: any = { replace: mode === 'replace', source };

      const pick = <T,>(key: FigCategory, arr: T[] | undefined) =>
        arr?.filter((_, i) => itemSel.get(key)?.has(i)) ?? [];

      const colors = pick('colors', state.colors);
      // Typography uses deduped list in UI — must pick from deduped, not raw state
      const typoItems = getItems(state, 'typography');
      const typographySel = typoItems.filter((_, i) => itemSel.get('typography')?.has(i));
      const typography = typographySel.length ? typographySel : pick('typography', state.typography);
      const gradients = pick('gradients', state.gradients);
      const shadows = pick('shadows', state.shadows);
      const borders = pick('borders', state.borders);
      const radiiPicked = (state.radii || []).filter((_, i) => itemSel.get('radii')?.has(i));
      const images = pick('images', state.images);

      // Send raw extractor shapes — server-side normalizer (brand-normalize.ts)
      // is the single source of truth for converting these into BrandGuideline
      // schema. No client-side defaults, no hardcoded values.
      if (colors.length)       payload.colors = colors;
      if (typography.length)   payload.typography = typography;
      if (gradients.length)    payload.gradients = gradients;
      if (shadows.length)      payload.shadows = shadows;
      if (borders.length)      payload.borders = borders;
      if (radiiPicked.length)  payload.radii = radiiPicked;
      if (images.length) {
        payload.images = images;
        // Pre-computed classifications skip the duplicate Gemini call server-side.
        // Remap indices to the SELECTED subset so they line up with payload.images.
        if (state.assetClassifications?.length) {
          const selectedIdx = (state.images || [])
            .map((_, i) => i)
            .filter(i => itemSel.get('images')?.has(i));
          const remapped = state.assetClassifications
            .map(c => {
              const newIdx = selectedIdx.indexOf(c.index);
              return newIdx >= 0 ? { ...c, index: newIdx } : null;
            })
            .filter(Boolean);
          if (remapped.length) payload.assetClassifications = remapped;
        }
      }

      console.log('[apply-fig] sending payload', {
        id: guideline.id,
        keys: Object.keys(payload),
        colors: payload.colors?.length,
        typography: payload.typography?.length,
        gradients: payload.gradients?.length,
        shadows: payload.shadows?.length,
        borders: payload.borders?.length,
        images: payload.images?.length,
        replace: payload.replace,
      });

      const result = await brandGuidelineApi.applyFigTokens(guideline.id!, payload);
      console.log('[apply-fig] success', result);

      // Start with the guideline returned by applyFigTokens
      let latestGuideline = result.guideline;

      // Strategy items — apply via PUT and merge into latestGuideline
      const stratItems = getItems(state, 'strategy');
      const selStrat = stratItems.filter((_: any, i: number) => itemSel.get('strategy')?.has(i));
      if (selStrat.length) {
        const ex = latestGuideline as any;
        const update: any = {};
        const manifesto    = selStrat.find((s: any) => s.field === 'manifesto')?.value;
        const tagline      = selStrat.find((s: any) => s.field === 'tagline')?.value;
        const description  = selStrat.find((s: any) => s.field === 'description')?.value;
        const claims       = selStrat.filter((s: any) => s.field === 'claim').map((s: any) => s.value);

        if (tagline)     update.identity  = { ...(ex.identity  || {}), tagline };
        if (description) update.identity  = { ...(update.identity || ex.identity || {}), description };
        if (manifesto)   update.strategy  = { ...(ex.strategy  || {}), manifesto };
        if (claims.length) {
          const existingDos = ex.guidelines?.dos || [];
          const newDos = claims.filter((c: string) => !existingDos.includes(c));
          if (newDos.length) update.guidelines = { ...(ex.guidelines || {}), dos: [...existingDos, ...newDos] };
        }
        if (Object.keys(update).length) {
          console.log('[apply-fig] strategy update', Object.keys(update));
          const stratResult = await brandGuidelineApi.update(guideline.id!, update as any);
          latestGuideline = stratResult;
        }
      }

      // Update React Query cache directly with the fully-updated guideline
      queryClient.setQueryData(['brand-guidelines'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((g: any) => g.id === latestGuideline.id ? { ...latestGuideline, _id: latestGuideline.id } : g);
      });

      toast.success('Brand tokens applied');
      onSuccess();
    } catch (err: any) {
      console.error('[apply-fig] error', err);
      toast.error(err?.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const isDone = state.status === 'done';
  const isStreaming = state.status === 'streaming';

  const totalSelected = Array.from(itemSel.values()).reduce((sum, s) => sum + s.size, 0);
  const totalLoaded = SECTION_ORDER.filter(({ key }) => getItems(state, key).length > 0).length;

  const renderContent = (key: FigCategory) => {
    const items = getItems(state, key);
    const sel = itemSel.get(key) || new Set<number>();
    const toggle = (i: number) => toggleItem(key, i);
    if (!items.length) return null;
    switch (key) {
      case 'colors':     return <ColorsSection     data={items} sel={sel} toggle={toggle} />;
      case 'typography': return <TypographySection data={items} sel={sel} toggle={toggle} />;
      case 'gradients':  return <GradientsSection  data={items} sel={sel} toggle={toggle} />;
      case 'shadows':    return <ShadowsSection    data={items} sel={sel} toggle={toggle} />;
      case 'borders':    return <BordersSection    data={items} sel={sel} toggle={toggle} />;
      case 'radii':      return <RadiiSection      data={items} sel={sel} toggle={toggle} />;
      case 'strategy':   return <StrategySection   items={items} sel={sel} toggle={toggle} />;
      case 'components': return <ComponentsSection data={items} sel={sel} toggle={toggle} />;
      case 'images':     return <AssetsSection     data={items} sel={sel} toggle={toggle} />;
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      description={
        isStreaming ? `${state.statusMessage || 'Parsing…'} · ${totalLoaded} categories`
        : isDone    ? `${totalLoaded} categories · ${totalSelected} items selected`
        : state.error || ''
      }
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-1 rounded border border-white/[0.08] p-0.5">
            {(['merge', 'replace'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                title={m === 'merge' ? 'Add selected tokens, keep existing' : 'Replace tokens with selected data'}
                className={`px-2.5 h-6 rounded text-[10px] font-mono uppercase transition-all ${mode === m ? 'bg-white/[0.08] text-neutral-200' : 'text-neutral-600 hover:text-neutral-400'}`}
              >{m}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="h-8 px-4 gap-1.5 border border-white/10 text-xs">
              <X size={12} /> Discard
            </Button>
            <Button onClick={apply} disabled={applying || totalSelected === 0}
              className="h-8 px-4 gap-1.5 bg-white/[0.08] border border-white/15 text-neutral-200 hover:bg-white/[0.12] text-xs">
              {applying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {applying ? 'Applying…' : `Apply (${totalSelected})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {state.error && <p className="text-sm text-red-400 font-mono py-4 text-center">{state.error}</p>}

        {SECTION_ORDER.map(({ key, label }) => {
          const items = getItems(state, key);
          const content = renderContent(key);
          const isLoading = isStreaming && !items.length;
          if (!items.length && !isLoading) return null;
          const sel = itemSel.get(key) || new Set<number>();
          return (
            <SectionShell
              key={key}
              label={label}
              loading={isLoading}
              allChecked={sel.size === items.length && items.length > 0}
              someChecked={sel.size > 0}
              onToggleAll={() => toggleSection(key)}
            >
              {isLoading ? (
                <div className="space-y-1.5 pt-1">
                  <Skeleton className="h-6 w-3/4" /><Skeleton className="h-6 w-1/2" />
                </div>
              ) : content}
            </SectionShell>
          );
        })}

        {isStreaming && totalLoaded < SECTION_ORDER.length && (
          <div className="opacity-30 space-y-2">
            {SECTION_ORDER.slice(totalLoaded, totalLoaded + 2).map(({ key, label }) => (
              <SectionShell key={key} label={label} loading allChecked={false} someChecked={false} onToggleAll={() => {}}>
                <Skeleton className="h-6 w-2/3 mt-1" />
              </SectionShell>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
