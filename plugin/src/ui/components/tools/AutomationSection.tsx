import React, { useState, useEffect, useCallback } from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Zap, LayoutGrid, Palette, Stamp, ArrowRightLeft, Scan } from 'lucide-react';

const LINEAR_PROJECT_ID = 'c634d506-3d84-4e27-8265-2ed445c5fe16';

function LinearBridgePanel() {
  const [apiKey, setApiKey] = useState('');
  const [formats, setFormats] = useState<string[]>(['Story']);
  const [strategy, setStrategy] = useState('random');
  const [presets, setPresets] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'GET_LINEAR_CONFIG' } }, '*');

    const handler = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === 'LINEAR_CONFIG_LOADED') {
        if (msg.apiKey) setApiKey(msg.apiKey);
      }
      if (msg.type === 'PRESETS_SCANNED') {
        setPresets(msg.presets);
        const total = Object.values(msg.presets as Record<string, string[]>).reduce((s, v) => s + v.length, 0);
        setStatus(`${total} presets found`);
        setBusy(false);
      }
      if (msg.type === 'BRIDGE_PROGRESS') {
        setStatus(msg.message);
      }
      if (msg.type === 'BRIDGE_DONE') {
        if (msg.dryRun) {
          setStatus(`Dry run: ${msg.operations?.length || 0} ops from ${msg.issueCount} issues`);
        } else {
          setStatus(`✓ ${msg.created} frames created`);
        }
        setBusy(false);
      }
      if (msg.type === 'ERROR') {
        setStatus(`✗ ${msg.message}`);
        setBusy(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const saveKey = useCallback(() => {
    parent.postMessage({
      pluginMessage: { type: 'SAVE_LINEAR_CONFIG', apiKey, projectId: LINEAR_PROJECT_ID },
    }, '*');
  }, [apiKey]);

  const handleScan = () => {
    setBusy(true);
    setStatus('Scanning...');
    parent.postMessage({ pluginMessage: { type: 'SCAN_PRESETS' } }, '*');
  };

  const handleRun = (dryRun: boolean) => {
    if (!apiKey) { setStatus('Set Linear API key first'); return; }
    setBusy(true);
    setStatus(dryRun ? 'Dry run...' : 'Running pipeline...');
    parent.postMessage({
      pluginMessage: {
        type: 'LINEAR_TO_FIGMA',
        linearApiKey: apiKey,
        projectId: LINEAR_PROJECT_ID,
        strategy,
        formats,
        dryRun,
      },
    }, '*');
  };

  const toggleFormat = (f: string) => {
    setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  return (
    <div className="space-y-2 border border-white/10 rounded-md p-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
        Linear → Figma Bridge
      </div>

      {/* API Key */}
      <input
        type="password"
        placeholder="Linear API Key (lin_api_...)"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        onBlur={saveKey}
        className="w-full h-7 px-2 text-[10px] bg-white/5 border border-white/10 rounded"
      />

      {/* Format toggles */}
      <div className="flex gap-1">
        {['Story', 'Feed'].map(f => (
          <button
            key={f}
            onClick={() => toggleFormat(f)}
            className={`flex-1 h-6 text-[9px] font-bold uppercase rounded border ${
              formats.includes(f)
                ? 'bg-white/15 border-white/30 text-white'
                : 'bg-transparent border-white/10 text-white/40'
            }`}
          >
            {f}
          </button>
        ))}
        <select
          value={strategy}
          onChange={e => setStrategy(e.target.value)}
          className="h-6 px-1 text-[9px] bg-white/5 border border-white/10 rounded text-white"
        >
          <option value="random">Random</option>
          <option value="rotate">Rotate</option>
        </select>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1">
        <button
          onClick={handleScan}
          disabled={busy}
          className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center justify-center gap-1 disabled:opacity-40"
        >
          <Scan size={10} /> Scan
        </button>
        <button
          onClick={() => handleRun(true)}
          disabled={busy || !apiKey}
          className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center justify-center gap-1 disabled:opacity-40"
        >
          Dry Run
        </button>
        <button
          onClick={() => handleRun(false)}
          disabled={busy || !apiKey}
          className="flex-2 h-7 text-[9px] font-bold uppercase tracking-wider bg-teal-600 hover:bg-teal-500 rounded flex items-center justify-center gap-1 disabled:opacity-40 px-3"
        >
          <ArrowRightLeft size={10} /> Generate
        </button>
      </div>

      {/* Preset summary */}
      {presets && (
        <div className="text-[9px] text-white/40 leading-tight">
          {Object.entries(presets).map(([fmt, vars]) => (
            <span key={fmt} className="mr-2">{fmt}: {vars.length}</span>
          ))}
        </div>
      )}

      {/* Status */}
      {status && (
        <div className={`text-[9px] leading-tight ${status.startsWith('✗') ? 'text-red-400' : status.startsWith('✓') ? 'text-green-400' : 'text-white/50'}`}>
          {status}
        </div>
      )}
    </div>
  );
}

export function AutomationSection() {
  const store = usePluginStore();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

  const brandColorHexes = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => c.hex)
    : undefined;

  const brandColorsArray = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => ({ hex: c.hex, name: c.role }))
    : [];

  return (
    <div className="space-y-2">
      <OpButton
        opId="varyColors"
        runner={runner}
        message={{ type: 'VARY_SELECTION_COLORS', brandColors: brandColorHexes }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Varying colors…"
        variant="brand"
        size="sm"
        title="Generate color variations of the selection using brand palette"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Zap size={12} className="mr-2" />
        Smart Color Variations
      </OpButton>

      <OpButton
        opId="generateVariants"
        runner={runner}
        message={{ type: 'GENERATE_VARIANTS' }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Generating variants…"
        variant="outline"
        size="sm"
        title="Clone selection into Lava, Off-White and Terra color variants"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Palette size={12} className="mr-2" />
        Generate Variants
      </OpButton>

      <OpButton
        opId="convertToPreset"
        runner={runner}
        message={{ type: 'CONVERT_TO_PRESET', format: 'Story' }}
        responseTypes={['PRESET_CREATED']}
        busyLabel="Converting…"
        variant="outline"
        size="sm"
        title="Convert selected frame into a template preset with auto-mapped text placeholders"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Stamp size={12} className="mr-2" />
        Convert to Preset
      </OpButton>

      <LinearBridgePanel />

      <OpButton
        opId="socialFrames"
        runner={runner}
        message={{ type: 'GENERATE_SOCIAL_FRAMES', brandColors: brandColorsArray }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Creating frames…"
        variant="outline"
        size="sm"
        title="Create pre-sized frames for Instagram, Stories, LinkedIn, etc."
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <LayoutGrid size={12} className="mr-2" />
        Social Frames
      </OpButton>
    </div>
  );
}
