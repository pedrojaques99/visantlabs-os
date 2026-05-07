import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useClient } from '../../lib/ClientProvider';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { ArrowRight, RefreshCw, Check, AlertTriangle, Search, ChevronDown } from 'lucide-react';
import type { FontGroup } from '@shared/protocol';

// --- Font preview dropdown ---

const loadedFonts = new Set<string>();

function loadGoogleFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap&text=${encodeURIComponent(family)}`;
  document.head.appendChild(link);
}

function FontFamilyPicker({
  families,
  value,
  onChange,
}: {
  families: string[];
  value: string;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? families.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : families;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Preload visible fonts when dropdown opens
  useEffect(() => {
    if (!open) return;
    const visible = filtered.slice(0, 20);
    visible.forEach(loadGoogleFont);
  }, [open, filtered]);

  const handleSelect = (family: string) => {
    onChange(family);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
          }
          setOpen(!open);
        }}
        className="w-full h-6 text-[10px] bg-card border border-border rounded px-1.5 text-foreground flex items-center justify-between gap-1 hover:border-brand-cyan/40 transition-colors"
      >
        <span
          className="truncate"
          style={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
        >
          {value || 'Família…'}
        </span>
        <ChevronDown size={10} className="shrink-0 text-muted-foreground" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-card border border-border rounded-md shadow-xl overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
        >
          <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border/50">
            <Search size={10} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar fonte…"
              className="flex-1 bg-transparent text-[10px] text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div
            ref={listRef}
            className="max-h-[300px] overflow-y-auto"
            onScroll={() => {
              if (!listRef.current) return;
              const { scrollTop, clientHeight } = listRef.current;
              const itemHeight = 28;
              const startIdx = Math.floor(scrollTop / itemHeight);
              const endIdx = Math.min(startIdx + Math.ceil(clientHeight / itemHeight) + 2, filtered.length);
              for (let i = startIdx; i < endIdx; i++) {
                loadGoogleFont(filtered[i]);
              }
            }}
          >
            {filtered.length === 0 ? (
              <div className="text-[10px] text-muted-foreground text-center py-3">
                Nenhuma fonte
              </div>
            ) : (
              filtered.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleSelect(f)}
                  className={`w-full text-left px-2 py-1 text-[11px] hover:bg-accent/60 transition-colors truncate ${
                    f === value ? 'bg-accent text-accent-foreground' : 'text-foreground'
                  }`}
                  style={{ fontFamily: `"${f}", sans-serif`, height: 28 }}
                >
                  {f}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// --- Main component ---

interface SwapTarget {
  family: string;
  style: string;
}

export function FontSwapSection() {
  const client = useClient();
  const showToast = usePluginStore(s => s.showToast);

  const [groups, setGroups] = useState<FontGroup[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [stylesCache, setStylesCache] = useState<Record<string, string[]>>({});
  const [targets, setTargets] = useState<Record<string, SwapTarget>>({});
  const [scanning, setScanning] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [result, setResult] = useState<{ swapped: number; failed: string[] } | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setResult(null);
    try {
      const [fontResult, familyResult] = await Promise.all([
        client.request('text.scanFonts', {}),
        client.request('variables.getFontFamilies', {}),
      ]);
      setGroups((fontResult as any).groups ?? []);
      setFamilies(familyResult as any ?? []);
      setTargets({});
    } catch {
      showToast('Selecione camadas com texto', 'error');
    } finally {
      setScanning(false);
    }
  }, [client, showToast]);

  useEffect(() => { scan(); }, []);

  const loadStyles = useCallback(async (family: string) => {
    if (stylesCache[family]) return stylesCache[family];
    const { styles } = await client.request('text.getStyles', { family });
    setStylesCache(prev => ({ ...prev, [family]: styles }));
    return styles;
  }, [client, stylesCache]);

  const handleFamilyChange = useCallback(async (groupKey: string, family: string) => {
    const styles = await loadStyles(family);
    setTargets(prev => ({
      ...prev,
      [groupKey]: { family, style: styles.includes('Regular') ? 'Regular' : styles[0] ?? 'Regular' },
    }));
  }, [loadStyles]);

  const handleStyleChange = useCallback((groupKey: string, style: string) => {
    setTargets(prev => ({
      ...prev,
      [groupKey]: { ...prev[groupKey], style },
    }));
  }, []);

  const swapsReady = Object.keys(targets).length > 0;

  const applySwaps = useCallback(async () => {
    setSwapping(true);
    setResult(null);
    try {
      const swaps = Object.entries(targets).map(([key, target]) => {
        const group = groups.find(g => g.key === key)!;
        return {
          nodeIds: group.nodeIds,
          oldFamily: group.family,
          oldStyle: group.style,
          newFamily: target.family,
          newStyle: target.style,
        };
      });
      const res = await client.request('text.swapFonts', { swaps });
      setResult(res);
      showToast(`${res.swapped} layers atualizados`, 'success');
      scan();
    } catch (err) {
      showToast('Erro ao trocar fontes', 'error');
    } finally {
      setSwapping(false);
    }
  }, [targets, groups, client, showToast, scan]);

  if (scanning) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
        <GlitchLoader size={12} /> Escaneando fontes…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground text-center py-4">
          Selecione frames com texto e escaneie.
        </p>
        <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={scan}>
          <RefreshCw size={10} className="mr-1.5" /> Escanear Seleção
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Font groups */}
      <div className="space-y-2">
        {groups.map(group => {
          const target = targets[group.key];
          const availableStyles = target ? stylesCache[target.family] ?? [] : [];

          return (
            <div key={group.key} className="rounded-md border border-border/50 bg-background/40 p-2 space-y-1.5">
              {/* Current font */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-medium text-foreground truncate">
                    {group.family}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{group.style}</span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0 ml-2">
                  {group.count}×
                </span>
              </div>

              {/* Arrow + target selects */}
              <div className="flex items-center gap-1.5">
                <ArrowRight size={10} className="text-brand-cyan shrink-0" />
                <FontFamilyPicker
                  families={families}
                  value={target?.family ?? ''}
                  onChange={family => handleFamilyChange(group.key, family)}
                />
                {target && availableStyles.length > 0 && (
                  <select
                    value={target.style}
                    onChange={e => handleStyleChange(group.key, e.target.value)}
                    className="w-24 h-6 text-[10px] bg-card border border-border rounded px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan/30"
                  >
                    {availableStyles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Result feedback */}
      {result && result.failed.length > 0 && (
        <div className="flex items-start gap-1.5 text-[9px] text-amber-400 px-1">
          <AlertTriangle size={10} className="shrink-0 mt-0.5" />
          <span>{result.failed.length} layers falharam</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={scan} disabled={swapping}>
          <RefreshCw size={10} className="mr-1.5" /> Re-scan
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-1 h-7 text-[10px] bg-brand-cyan text-black hover:bg-brand-cyan/90"
          disabled={!swapsReady || swapping}
          onClick={applySwaps}
        >
          {swapping ? <GlitchLoader size={12} className="mr-1.5" /> : <Check size={10} className="mr-1.5" />}
          {swapping ? 'Aplicando…' : 'Aplicar Swap'}
        </Button>
      </div>
    </div>
  );
}
