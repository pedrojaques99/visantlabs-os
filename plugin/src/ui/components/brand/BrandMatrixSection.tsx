import React, { useState, useEffect, useCallback } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Button } from '@/components/ui/button';
import { Layers, Plus, X, ScanLine } from 'lucide-react';

interface ColorToken {
  id: string;
  name: string;
  r: number;
  g: number;
  b: number;
  selected: boolean;
}

interface ScannedAsset {
  nodeId: string;
  nodeName: string;
  section: string;
}

const SECTION_OPTIONS = [
  { key: 'horizontal', label: 'Horizontal' },
  { key: 'vertical', label: 'Vertical' },
  { key: 'icon', label: 'Icon' },
  { key: 'identity', label: 'Identidade Visual' },
];

function hexFromRGB(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

export function BrandMatrixSection() {
  const { send, subscribe } = useFigmaMessages();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

  const [colors, setColors] = useState<ColorToken[]>([]);
  const [customHex, setCustomHex] = useState('');
  const [assets, setAssets] = useState<ScannedAsset[]>([]);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const unsub = subscribe((msg: any) => {
      if (msg.type === 'PAINT_STYLES_RESULT') {
        const tokens = (msg.tokens || []).map((t: any) => ({ ...t, selected: true }));
        setColors(tokens);
        setScanned(true);
      }
      if (msg.type === 'SMART_SCAN_RESULT') {
        const items = (msg.items || []) as any[];
        const mapped: ScannedAsset[] = items
          .filter((i: any) => i.category === 'logo' || i.category === 'component')
          .map((i: any) => {
            const nameLower = i.name.toLowerCase();
            let section = 'horizontal';
            if (/\b(icon|icone|ícone)\b/.test(nameLower)) section = 'icon';
            else if (/\b(vertical|vert)\b/.test(nameLower)) section = 'vertical';
            else if (/\b(identidade|identity|visual|iv)\b/.test(nameLower)) section = 'identity';
            return { nodeId: i.id, nodeName: i.name, section };
          });
        setAssets(mapped);
      }
    });
    return unsub;
  }, [subscribe]);

  const handleScanColors = useCallback(() => {
    send({ type: 'SCAN_PAINT_STYLES' });
  }, [send]);

  const handleScanSelection = useCallback(() => {
    send({ type: 'SMART_SCAN_SELECTION' });
  }, [send]);

  const toggleColor = (id: string) => {
    setColors(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const addCustomColor = () => {
    const parsed = parseHex(customHex);
    if (!parsed) return;
    const id = `custom_${Date.now()}`;
    setColors(prev => [...prev, { id, name: customHex.toUpperCase(), ...parsed, selected: true }]);
    setCustomHex('');
  };

  const removeAsset = (nodeId: string) => {
    setAssets(prev => prev.filter(a => a.nodeId !== nodeId));
  };

  const updateAssetSection = (nodeId: string, section: string) => {
    setAssets(prev => prev.map(a => a.nodeId === nodeId ? { ...a, section } : a));
  };

  const selectedColors = colors.filter(c => c.selected);
  const canGenerate = selectedColors.length > 0 && assets.length > 0;

  return (
    <div className="space-y-4 p-1">
      <div className="space-y-3 bg-neutral-900/40 p-3 rounded-lg border border-border/60 shadow-sm">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/40">
          <Layers size={12} />
          Brand Matrix
        </h3>

        {/* Step 1: Scan Colors */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">1. Cores</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleScanColors}>
              <ScanLine size={10} className="mr-1" /> Scan Styles
            </Button>
          </div>

          {colors.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {colors.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800/40 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={c.selected}
                    onChange={() => toggleColor(c.id)}
                    className="w-3 h-3 rounded border-border"
                  />
                  <span
                    className="w-4 h-4 rounded-sm border border-border/60 flex-shrink-0"
                    style={{ backgroundColor: hexFromRGB(c.r, c.g, c.b) }}
                  />
                  <span className="text-[10px] truncate">{c.name}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{hexFromRGB(c.r, c.g, c.b)}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-1">
            <input
              type="text"
              placeholder="#FF6000"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              className="flex-1 h-6 px-2 text-[10px] bg-neutral-900 border border-border/60 rounded"
              onKeyDown={(e) => e.key === 'Enter' && addCustomColor()}
            />
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addCustomColor} disabled={!parseHex(customHex)}>
              <Plus size={10} />
            </Button>
          </div>
        </div>

        {/* Step 2: Assets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">2. Assets (selecione no canvas)</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleScanSelection}>
              <ScanLine size={10} className="mr-1" /> Scan Selection
            </Button>
          </div>

          {assets.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {assets.map(a => (
                <div key={a.nodeId} className="flex items-center gap-2 text-[10px] hover:bg-neutral-800/40 rounded px-1 py-0.5">
                  <span className="truncate flex-1">{a.nodeName}</span>
                  <select
                    value={a.section}
                    onChange={(e) => updateAssetSection(a.nodeId, e.target.value)}
                    className="h-5 text-[9px] bg-neutral-900 border border-border/60 rounded px-1"
                  >
                    {SECTION_OPTIONS.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <button onClick={() => removeAsset(a.nodeId)} className="text-muted-foreground hover:text-red-400">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {assets.length === 0 && scanned && (
            <p className="text-[9px] text-muted-foreground italic">Selecione logos/elementos no canvas e clique em Scan Selection</p>
          )}
        </div>

        {/* Step 3: Generate */}
        <OpButton
          opId="brandMatrix"
          runner={runner}
          message={{
            type: 'GENERATE_ASSETS',
            colors: selectedColors.map(({ id, name, r, g, b }) => ({ id, name, r, g, b })),
            assets: assets.map(({ nodeId, nodeName, section }) => ({ nodeId, nodeName, section })),
          }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="Gerando matriz…"
          variant="brand"
          size="sm"
          className="w-full"
          disabled={!canGenerate}
        >
          <Layers size={12} className="mr-2" />
          Gerar Matriz de Assets ({selectedColors.length} cores × {assets.length} assets)
        </OpButton>
      </div>
    </div>
  );
}
