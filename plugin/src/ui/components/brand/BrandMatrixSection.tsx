import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Button } from '@/components/ui/button';
import { Plus, Copy, Layers, X } from 'lucide-react';
import { SMART_SCAN_REQUESTER, isSmartScanFor } from '../../lib/smartScan';

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

const getSectionOptions = (t: (key: string) => string) => [
  { key: 'horizontal', label: t('plugin.brand.matrix.horizontal') },
  { key: 'vertical', label: t('plugin.brand.matrix.vertical') },
  { key: 'icon', label: t('plugin.brand.matrix.icon') },
  { key: 'identity', label: t('plugin.brand.matrix.idVisual') },
];

function hex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function parseHex(h: string): { r: number; g: number; b: number } | null {
  const c = h.replace('#', '');
  if (c.length !== 6) return null;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

function mergeColors(existing: ColorToken[], incoming: ColorToken[]): ColorToken[] {
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) {
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  return Array.from(byId.values());
}

function useFigmaSubscribe(handler: (msg: any) => void) {
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type) handler(msg);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handler]);
}

export function BrandMatrixSection() {
  const { t } = useTranslation();
  const SECTION_OPTIONS = getSectionOptions(t);
  const { send } = useFigmaMessages();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const colors = usePluginStore((s) => s.matrixColors);
  const setMatrixColors = usePluginStore((s) => s.setMatrixColors);
  const toggleMatrixColor = usePluginStore((s) => s.toggleMatrixColor);
  const addMatrixColor = usePluginStore((s) => s.addMatrixColor);
  const runner = useOpRunner({ globalBusy: isGenerating });

  const [customHex, setCustomHex] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [assets, setAssets] = useState<ScannedAsset[]>([]);
  const [showFull, setShowFull] = useState(false);
  const [createSections, setCreateSections] = useState(true);

  // Auto-scan on mount (merge with existing selections)
  useEffect(() => {
    send({ type: 'SCAN_PAINT_STYLES' } as any);
  }, [send]);

  const onMessage = useCallback(
    (msg: any) => {
      if (msg.type === 'PAINT_STYLES_RESULT') {
        const incoming: ColorToken[] = (msg.tokens || []).map((t: any) => ({
          ...t,
          selected: true,
        }));
        setMatrixColors(
          usePluginStore.getState().matrixColors.length === 0
            ? incoming
            : mergeColors(usePluginStore.getState().matrixColors, incoming)
        );
      }
      // Only our own scan — Tools › Extract fires this same round-trip for its result modal,
      // and without the check its scan would silently rewrite the assets picked here.
      if (msg.type === 'SMART_SCAN_RESULT' && isSmartScanFor(msg, SMART_SCAN_REQUESTER.brandMatrix)) {
        const items = (msg.items || []).filter(
          (i: any) => i.category === 'logo' || i.category === 'component'
        );
        setAssets(
          items.map((i: any) => {
            const n = i.name.toLowerCase();
            let section = 'horizontal';
            if (/\b(icon|icone|ícone)\b/.test(n)) section = 'icon';
            else if (/\b(vertical|vert)\b/.test(n)) section = 'vertical';
            else if (/\b(identidade|identity|visual|iv)\b/.test(n)) section = 'identity';
            return { nodeId: i.id, nodeName: i.name, section };
          })
        );
      }
    },
    [setMatrixColors]
  );
  useFigmaSubscribe(onMessage);

  const toggle = (id: string) => toggleMatrixColor(id);
  const addCustom = () => {
    const p = parseHex(customHex);
    if (!p) return;
    addMatrixColor({ id: `c_${Date.now()}`, name: customHex.toUpperCase(), ...p });
    setCustomHex('');
    setShowCustom(false);
  };

  const selected = colors.filter((c) => c.selected);

  return (
    <div className="space-y-3 bg-muted/40 p-3 rounded-lg border border-border/60 shadow-sm">
      {/* Color palette — compact dots */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          {colors.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              title={`${c.name} — ${hex(c.r, c.g, c.b)}`}
              className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                c.selected
                  ? 'border-foreground/80 shadow-[0_0_0_1px_rgba(255,255,255,0.3)] scale-105'
                  : 'border-transparent opacity-30 hover:opacity-60'
              }`}
              style={{ backgroundColor: hex(c.r, c.g, c.b) }}
            />
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="w-6 h-6 rounded-full border border-dashed border-border/60 flex items-center justify-center text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>

        {showCustom && (
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="#FF6000"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              className="flex-1 h-6 px-2 text-[10px] bg-card border border-border/60 rounded focus:border-foreground/40 outline-none"
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={addCustom}
              disabled={!parseHex(customHex)}
            >
              <Plus size={10} />
            </Button>
          </div>
        )}

        {selected.length > 0 && (
          <p className="text-[9px] text-muted-foreground">
            {selected.length === 1 ? t('plugin.brand.matrix.colorCountOne', { count: selected.length }) : t('plugin.brand.matrix.colorCountOther', { count: selected.length })}
          </p>
        )}
      </div>

      {/* Options */}
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={createSections}
          onChange={(e) => setCreateSections(e.target.checked)}
          className="w-3 h-3 rounded border-border/60 accent-brand-cyan"
        />
        <span className="text-[9px] text-muted-foreground">{t('plugin.brand.matrix.createSections')}</span>
      </label>

      {/* Actions */}
      <div className="space-y-2">
        <OpButton
          opId="logoMatrix"
          runner={runner}
          message={{
            type: 'LOGO_MATRIX',
            colors: selected.map(({ id, name, r, g, b }) => ({ id, name, r, g, b })),
            createSections,
          }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel={t('plugin.brand.matrix.cloning')}
          variant="brand"
          size="sm"
          className="w-full"
          disabled={selected.length === 0}
        >
          <Copy size={12} className="mr-2" />
          {t('plugin.brand.matrix.logoMatrix')}
        </OpButton>

        {!showFull ? (
          <button
            onClick={() => {
              setShowFull(true);
              send({
                type: 'SMART_SCAN_SELECTION',
                requester: SMART_SCAN_REQUESTER.brandMatrix,
              } as any);
            }}
            className="w-full text-[9px] text-muted-foreground hover:text-foreground py-1 transition-colors"
          >
            {t('plugin.brand.matrix.fullMatrixSections')}
          </button>
        ) : (
          <div className="space-y-2 pt-1 border-t border-border/30">
            {assets.length > 0 ? (
              <div className="space-y-1">
                {assets.map((a) => (
                  <div key={a.nodeId} className="flex items-center gap-1.5 text-[10px] group">
                    <span className="truncate flex-1 text-muted-foreground group-hover:text-foreground">
                      {a.nodeName}
                    </span>
                    <select
                      value={a.section}
                      onChange={(e) =>
                        setAssets((p) =>
                          p.map((x) =>
                            x.nodeId === a.nodeId ? { ...x, section: e.target.value } : x
                          )
                        )
                      }
                      className="h-5 text-[9px] bg-card border border-border/40 rounded px-1"
                    >
                      {SECTION_OPTIONS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setAssets((p) => p.filter((x) => x.nodeId !== a.nodeId))}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-muted-foreground italic">
                {t('plugin.brand.matrix.selectElements')}
              </p>
            )}

            <OpButton
              opId="brandMatrix"
              runner={runner}
              message={{
                type: 'GENERATE_ASSETS',
                colors: selected.map(({ id, name, r, g, b }) => ({ id, name, r, g, b })),
                assets: assets.map(({ nodeId, nodeName, section }) => ({
                  nodeId,
                  nodeName,
                  section,
                })),
                createSections,
              }}
              responseTypes={['OPERATIONS_DONE']}
              busyLabel={t('plugin.brand.matrix.generating')}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={selected.length === 0 || assets.length === 0}
            >
              <Layers size={12} className="mr-2" />
              {t('plugin.brand.matrix.fullMatrix')}
            </OpButton>
          </div>
        )}
      </div>
    </div>
  );
}
