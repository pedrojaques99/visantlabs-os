import React, { useCallback, useEffect, useState } from 'react';
import { Save, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/config/api';
import { authService } from '@/services/authService';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useTextureFilterStore } from '@/stores/textureFilterStore';
import { useRisoStore } from '@/stores/risoStore';
import { useShaderLabStore } from '@/stores/shaderLabStore';

interface SavedPreset {
  id: string;
  name: string;
  data: { mode: ImageLabMode; settings: Record<string, any>; layers?: any[] };
}

const CACHE_KEY = 'imagelab-saved-presets';

function getCached(): SavedPreset[] {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; }
}

function headers(): Record<string, string> {
  const t = authService.getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function collectSettings(mode: ImageLabMode) {
  if (mode === 'halftone') return { settings: useHalftoneStore.getState().getSettings() };
  if (mode === 'texture') return { settings: useTextureFilterStore.getState().getSettings() };
  if (mode === 'riso') {
    const s = useRisoStore.getState();
    return { settings: s.getSettings(), layers: s.layers };
  }
  const s = useShaderLabStore.getState();
  return { settings: s.shaderEnabled ? s.getShaderSettings() : {} };
}

function applyPreset(preset: SavedPreset) {
  const { mode, settings, layers } = preset.data;
  useImageLabStore.getState().setMode(mode);

  if (mode === 'halftone') {
    const store = useHalftoneStore.getState();
    Object.entries(settings).forEach(([k, v]) => store.updateSetting(k as any, v));
  } else if (mode === 'texture') {
    const store = useTextureFilterStore.getState();
    Object.entries(settings).forEach(([k, v]) => store.updateSetting(k as any, v));
  } else if (mode === 'riso') {
    const store = useRisoStore.getState();
    Object.entries(settings).forEach(([k, v]) => store.updateSetting(k as any, v));
    if (layers) store.setLayers(layers);
  } else if (mode === 'shaders') {
    const store = useShaderLabStore.getState();
    if (settings.shaderType) store.setShaderType(settings.shaderType);
    if (settings.values) Object.entries(settings.values).forEach(([k, v]) => store.setShaderValue(k, v as number));
  }
}

export const ImageLabSavePreset: React.FC = React.memo(() => {
  const [name, setName] = useState('');
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const mode = useImageLabStore((s) => s.mode);

  const fetchPresets = useCallback(async () => {
    if (!authService.getToken()) { setPresets(getCached()); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/community/presets/my?type=imagelab`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const list = (data.presets || data || []).map((p: any) => ({
          id: p._id || p.id, name: p.name, data: p.data,
        }));
        setPresets(list);
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      } else setPresets(getCached());
    } catch { setPresets(getCached()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    const { settings, layers } = collectSettings(mode);
    try {
      const res = await fetch(`${API_BASE}/community/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ name: name.trim(), type: 'imagelab', data: { mode, settings, layers } }),
      });
      if (res.ok) { toast.success('Preset saved'); setName(''); fetchPresets(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to save'); }
    } catch { toast.error('Failed to save preset'); }
  }, [name, mode, fetchPresets]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`${API_BASE}/community/presets/${id}`, { method: 'DELETE', headers: headers() });
      setPresets((p) => p.filter((x) => x.id !== id));
      toast.success('Preset deleted');
    } catch { toast.error('Failed to delete'); }
  }, []);

  return (
    <div className="space-y-2">
      {/* Save row */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Save preset..."
          aria-label="Preset name"
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
        <Button
          variant="outline" size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={!name.trim()}
          aria-label="Save preset"
          onClick={handleSave}
        >
          <Save size={12} />
        </Button>
      </div>

      {/* Empty state hint */}
      {presets.length === 0 && !loading && (
        <p className="text-[9px] text-neutral-600 text-center py-0.5">Name your settings and save for quick recall</p>
      )}

      {/* Saved presets toggle + list */}
      {(presets.length > 0 || loading) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 w-full text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <ChevronDown size={10} className={cn('transition-transform', expanded && 'rotate-180')} />
            <span className="font-mono uppercase tracking-wider">
              My presets{!loading && ` (${presets.length})`}
            </span>
            {loading && <Loader2 size={8} className="animate-spin" />}
          </button>

          {expanded && (
            <div className="space-y-0.5 max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => { applyPreset(p); toast.success(`Loaded "${p.name}"`); }}
                    className="flex-1 flex items-center gap-1.5 text-left px-1.5 py-1 rounded text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors min-w-0"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className={cn(
                      'text-[7px] font-mono uppercase shrink-0',
                      p.data.mode === 'halftone' && 'text-cyan-600',
                      p.data.mode === 'texture' && 'text-purple-600',
                      p.data.mode === 'riso' && 'text-amber-600',
                      p.data.mode === 'shaders' && 'text-emerald-600',
                    )}>{p.data.mode}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-600 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

ImageLabSavePreset.displayName = 'ImageLabSavePreset';
