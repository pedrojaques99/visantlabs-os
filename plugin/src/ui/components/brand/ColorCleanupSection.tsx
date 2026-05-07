import React, { useState } from 'react';
import { usePluginStore } from '../../store';
import { useOpRunner } from '../../hooks/useOpRunner';
import { OpButton } from '../common/OpButton';
import { Search, Check, X } from 'lucide-react';

interface ColorMatch {
  nodeId: string;
  nodeName: string;
  property: 'fill' | 'stroke';
  index: number;
  currentHex: string;
  matchedVariableName: string;
  matchedVariableId: string;
  matchedHex: string;
  distance: number;
}

export function ColorCleanupSection() {
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });
  const scanResults = usePluginStore((s) => s.colorScanResults);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [threshold, setThreshold] = useState(0.15);

  const toggle = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const matchKey = (m: ColorMatch) => `${m.nodeId}:${m.property}:${m.index}`;

  const selected = scanResults
    ? (scanResults as ColorMatch[]).filter((m) => !excluded.has(matchKey(m)))
    : [];

  const handleApply = () => {
    if (!selected.length) return;
    const bindings = selected.map((m) => ({
      nodeId: m.nodeId,
      property: m.property,
      index: m.index,
      variableId: m.matchedVariableId,
    }));
    parent.postMessage(
      { pluginMessage: { type: 'APPLY_COLOR_BINDINGS', bindings } },
      'https://www.figma.com'
    );
    usePluginStore.setState({ colorScanResults: null });
  };

  const clearResults = () => {
    usePluginStore.setState({ colorScanResults: null });
    setExcluded(new Set());
  };

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2">
        <OpButton
          opId="scanColors"
          runner={runner}
          message={{ type: 'SCAN_HARDCODED_COLORS', threshold }}
          responseTypes={['COLOR_SCAN_RESULTS']}
          busyLabel="Scanning…"
          variant="brand"
          size="sm"
          className="flex-1"
          icon={<Search size={14} />}
        >
          Scan Hardcoded Colors
        </OpButton>
        <select
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="h-8 rounded-md border border-border/60 bg-neutral-900/60 text-[10px] px-1.5 text-muted-foreground"
        >
          <option value={0.05}>Strict</option>
          <option value={0.15}>Normal</option>
          <option value={0.3}>Loose</option>
        </select>
      </div>

      {scanResults && (scanResults as ColorMatch[]).length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-2">
          No hardcoded colors found in selection.
        </p>
      )}

      {scanResults && (scanResults as ColorMatch[]).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {selected.length}/{(scanResults as ColorMatch[]).length} matches selected
            </span>
            <button
              type="button"
              onClick={clearResults}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="max-h-[240px] overflow-y-auto space-y-1 scrollbar-thin">
            {(scanResults as ColorMatch[]).map((match) => {
              const key = matchKey(match);
              const isExcluded = excluded.has(key);
              const pct = Math.round((1 - match.distance / 1.732) * 100);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                    isExcluded
                      ? 'opacity-40 bg-neutral-900/20'
                      : 'bg-neutral-900/40 hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      className="w-4 h-4 rounded-sm border border-white/10 shrink-0"
                      style={{ backgroundColor: match.currentHex }}
                    />
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <div
                      className="w-4 h-4 rounded-sm border border-white/10 shrink-0"
                      style={{ backgroundColor: match.matchedHex }}
                    />
                    <span className="text-[11px] truncate">{match.matchedVariableName}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{pct}%</span>
                  {isExcluded ? (
                    <X size={12} className="text-muted-foreground shrink-0" />
                  ) : (
                    <Check size={12} className="text-brand-cyan shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleApply}
            disabled={selected.length === 0}
            className="w-full h-8 rounded-md bg-brand-cyan/20 text-brand-cyan text-[11px] font-medium hover:bg-brand-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Apply {selected.length} bindings
          </button>
        </div>
      )}
    </div>
  );
}
