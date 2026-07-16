/**
 * PreviewTile — one template in the masonry, with its OWN color combo + text overrides
 * (per design). The tile shows the on-brand render; clicking it opens a focus overlay
 * (the "valorizado" big view) where you recolor / edit copy / export. State lives on the
 * tile so the focus edits the same design.
 *
 * Curation controls (public toggle 👁 / add-remove ✕) are Phase 2 (need the backend
 * library) — the tile exposes hooks (`onTogglePublic`, `onRemove`) for when they land.
 */
import React, { useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Shuffle, RotateCcw, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { MockTokens } from './mockTokens';
import { buildThemeCombos } from './mockTokens';
import { exportMockElement, EXPORT_FORMATS, type ExportFormat } from './exportMock';
import type { MockOverrides } from './BrandMocks';

export interface TileItem {
  id: string;
  label: string;
  Component: React.FC<{
    tokens: MockTokens;
    className?: string;
    exportRef?: React.Ref<HTMLDivElement>;
    variant?: number;
    overrides?: MockOverrides;
  }>;
}

const SWATCH_KEYS = ['bg', 'primary', 'accent', 'text'] as const;
const ICON_BTN =
  'flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--brand-surface)]/70 backdrop-blur border border-[var(--brand-text)]/10 text-[var(--brand-text)]/60 hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)] transition-colors';

export const PreviewTile: React.FC<{ item: TileItem; tokens: MockTokens; brandName: string }> = ({
  item,
  tokens,
  brandName,
}) => {
  const tileRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const combos = useMemo(() => buildThemeCombos(tokens), [tokens]);
  const [variant, setVariant] = useState(0);
  const [overrides, setOverrides] = useState<MockOverrides>({});
  const [focused, setFocused] = useState(false);
  const [exporting, setExporting] = useState(false);

  const idx = ((variant % combos.length) + combos.length) % combos.length;
  const combo = combos[idx];
  const hasOverrides = Object.values(overrides).some((v) => v && v.trim());
  const setField =
    (k: keyof MockOverrides) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setOverrides((o) => ({ ...o, [k]: e.target.value }));

  const doExport = useCallback(
    async (el: HTMLElement | null, format: ExportFormat) => {
      if (!el) return;
      setExporting(true);
      try {
        await exportMockElement(el, brandName, item.id, format);
        toast.success(`Exported ${item.label} · ${format.toUpperCase()}`);
      } catch {
        toast.error(`Export falhou`);
      } finally {
        setExporting(false);
      }
    },
    [brandName, item.id, item.label]
  );

  const Mock = item.Component;

  const label = 'text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/40';
  const input =
    'w-full rounded-lg border border-[var(--brand-text)]/12 bg-transparent px-3 py-2 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-text)]/30 focus:border-[var(--accent)]/50 focus:outline-none transition-colors';

  const swatches = (
    <span className="flex items-center gap-0.5">
      {SWATCH_KEYS.map((k) => (
        <span
          key={k}
          className="w-2.5 h-2.5 rounded-full border border-[var(--brand-text)]/15"
          style={{ background: combo[k] }}
        />
      ))}
    </span>
  );

  const exportMenu = (target: React.RefObject<HTMLDivElement>) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={ICON_BTN} disabled={exporting} title="Export">
          {exporting ? <GlitchLoader size={12} /> : <Download size={12} />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {EXPORT_FORMATS.map((f) => (
          <Button key={f.id} variant="menuItem" onClick={() => doExport(target.current, f.id)}>
            <Download size={12} /> {f.label}
          </Button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className="group relative rounded-2xl border border-[var(--brand-text)]/8 bg-[var(--brand-surface)]/10 p-3 cursor-zoom-in transition-colors hover:border-[var(--brand-text)]/20"
        onClick={() => setFocused(true)}
      >
        <div className="overflow-hidden rounded-xl">
          <Mock tokens={tokens} exportRef={tileRef} variant={variant} overrides={overrides} />
        </div>

        {/* Hover chrome — label + quick controls (stopPropagation so they don't open focus) */}
        <div
          className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              label,
              'pointer-events-auto rounded-md bg-[var(--brand-surface)]/70 px-2 py-1 backdrop-blur truncate'
            )}
          >
            {item.label}
          </span>
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              className={ICON_BTN}
              title="Trocar combinação de cores"
              onClick={() => setVariant((v) => v + 1)}
            >
              <Shuffle size={12} />
            </button>
            <button
              type="button"
              className={ICON_BTN}
              title="Expandir e editar"
              onClick={() => setFocused(true)}
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Focus overlay — the "valorizado" big view + editor */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm md:p-10"
                onClick={() => setFocused(false)}
              >
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  className="flex max-h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto rounded-3xl border border-[var(--brand-text)]/10 bg-[var(--brand-bg)] p-6 md:flex-row md:p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Stage */}
                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <div className="w-full max-w-3xl">
                      <Mock
                        tokens={tokens}
                        exportRef={focusRef}
                        variant={variant}
                        overrides={overrides}
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex w-full shrink-0 flex-col gap-4 md:w-72">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--brand-text)]/85">
                        {item.label}
                      </span>
                      <button
                        type="button"
                        className={ICON_BTN}
                        title="Fechar"
                        onClick={() => setFocused(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVariant((v) => v + 1)}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--brand-text)]/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/55 transition-colors hover:bg-[var(--brand-text)]/5 hover:text-[var(--brand-text)]"
                      >
                        {swatches}
                        <Shuffle size={11} /> {idx + 1}/{combos.length}
                      </button>
                      {exportMenu(focusRef)}
                    </div>

                    <div className="space-y-3">
                      {(['name', 'tagline', 'headline', 'body'] as const).map((k) => {
                        const meta = {
                          name: { label: 'Marca', ph: tokens.name },
                          tagline: { label: 'Tagline', ph: tokens.tagline || '—' },
                          headline: { label: 'Headline', ph: '1ª frase do manifesto' },
                          body: { label: 'Corpo', ph: 'Descrição da marca' },
                        }[k];
                        return (
                          <label key={k} className="block space-y-1.5">
                            <span className={label}>{meta.label}</span>
                            {k === 'body' ? (
                              <textarea
                                className={cn(input, 'resize-none')}
                                rows={2}
                                value={overrides[k] || ''}
                                placeholder={meta.ph}
                                onChange={setField(k)}
                              />
                            ) : (
                              <input
                                className={input}
                                value={overrides[k] || ''}
                                placeholder={meta.ph}
                                onChange={setField(k)}
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {hasOverrides && (
                      <button
                        type="button"
                        onClick={() => setOverrides({})}
                        className="flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/40 transition-colors hover:text-[var(--brand-text)]/80"
                      >
                        <RotateCcw size={11} /> Resetar textos
                      </button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
