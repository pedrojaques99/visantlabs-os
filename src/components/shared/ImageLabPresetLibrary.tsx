import React, { useEffect, useState, useCallback } from 'react';
import { X, Heart, Loader2, Upload, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/config/api';
import { authService } from '@/services/authService';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useTextureFilterStore } from '@/stores/textureFilterStore';
import { useRisoStore } from '@/stores/risoStore';

interface ImageLabPreset {
  _id: string;
  name: string;
  description?: string;
  type: 'imagelab';
  data: {
    mode: ImageLabMode;
    settings: Record<string, any>;
    layers?: any[];
  };
  likes: number;
  liked?: boolean;
  author?: { name: string };
  createdAt: string;
}

interface ImageLabPresetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

const PresetSwatch: React.FC<{ preset: ImageLabPreset }> = ({ preset }) => {
  const { mode, settings, layers } = preset.data;
  const colors: string[] = [];

  if (mode === 'riso' && layers?.length) {
    layers.forEach((l) => l.hex && colors.push(l.hex));
  } else if (mode === 'halftone') {
    if (settings.cyanInk) colors.push(settings.cyanInk);
    if (settings.magentaInk) colors.push(settings.magentaInk);
    if (settings.yellowInk) colors.push(settings.yellowInk);
    if (settings.blackInk) colors.push(settings.blackInk);
  }

  const bg = mode === 'halftone' ? 'bg-cyan-950/30' : mode === 'riso' ? 'bg-amber-950/30' : 'bg-purple-950/30';

  return (
    <div className={cn('w-10 h-10 rounded-md shrink-0 flex items-center justify-center overflow-hidden', bg)}>
      {colors.length > 0 ? (
        <div className="grid grid-cols-2 gap-0.5 p-1">
          {colors.slice(0, 4).map((c, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
      ) : (
        <span className="text-[9px] font-mono text-neutral-600 uppercase">{mode[0]}</span>
      )}
    </div>
  );
};

const PresetDetails: React.FC<{ preset: ImageLabPreset }> = ({ preset }) => {
  const { mode, settings } = preset.data;
  const tags: string[] = [];

  if (mode === 'halftone') {
    if (settings.frequency) tags.push(`${settings.frequency} lpi`);
    if (settings.blendMode != null) tags.push(['sub', 'add', 'norm'][settings.blendMode] || '');
  } else if (mode === 'texture') {
    if (settings.blendMode) tags.push(settings.blendMode);
    if (settings.opacity != null) tags.push(`${Math.round(settings.opacity * 100)}%`);
    if (settings.maskMode) tags.push('mask');
  } else if (mode === 'riso') {
    if (settings.frequency) tags.push(`${settings.frequency} lpi`);
    if (settings.misregistration) tags.push(`${settings.misregistration}px mis`);
  }

  const filtered = tags.filter(Boolean);
  if (!filtered.length) return null;

  return (
    <div className="flex gap-1.5 mt-0.5 flex-wrap">
      {filtered.map((t, i) => (
        <span key={i} className="text-[8px] font-mono text-neutral-600 bg-neutral-800/40 px-1 py-0.5 rounded">{t}</span>
      ))}
    </div>
  );
};

export const ImageLabPresetLibrary: React.FC<ImageLabPresetLibraryProps> = ({ isOpen, onClose }) => {
  const [presets, setPresets] = useState<ImageLabPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ImageLabMode | 'all'>('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const mode = useImageLabStore((s) => s.mode);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_BASE}/community/presets/public`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const imageLabPresets = (data['imagelab'] || []) as ImageLabPreset[];
        setPresets(imageLabPresets);
      }
    } catch {
      // silently fail — presets are optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchPresets();
  }, [isOpen, fetchPresets]);

  const applyPreset = useCallback((preset: ImageLabPreset) => {
    const { mode: presetMode, settings, layers } = preset.data;
    useImageLabStore.getState().setMode(presetMode);

    if (presetMode === 'halftone') {
      const store = useHalftoneStore.getState();
      Object.entries(settings).forEach(([k, v]) => store.updateSetting(k as any, v));
    } else if (presetMode === 'texture') {
      const store = useTextureFilterStore.getState();
      Object.entries(settings).forEach(([k, v]) => store.updateSetting(k as any, v));
    } else if (presetMode === 'riso') {
      const store = useRisoStore.getState();
      Object.entries(settings).forEach(([k, v]) => store.updateSetting(k as any, v));
      if (layers) store.setLayers(layers);
    }
    toast.success(`Applied "${preset.name}"`);
    onClose();
  }, [onClose]);

  const handleLike = useCallback(async (id: string) => {
    try {
      const token = authService.getToken();
      await fetch(`${API_BASE}/community/presets/${id}/like`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setPresets((prev) =>
        prev.map((p) =>
          p._id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
        )
      );
    } catch {
      // ignore
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      let settings: Record<string, any> = {};
      let layers: any[] | undefined;

      if (mode === 'halftone') settings = useHalftoneStore.getState().getSettings();
      else if (mode === 'texture') settings = useTextureFilterStore.getState().getSettings();
      else if (mode === 'riso') {
        const s = useRisoStore.getState();
        settings = s.getSettings();
        layers = s.layers;
      }

      const token = authService.getToken();
      const res = await fetch(`${API_BASE}/community/presets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: saveName.trim(),
          type: 'imagelab',
          data: { mode, settings, layers },
        }),
      });

      if (res.ok) {
        toast.success('Preset shared with community');
        setSaveName('');
        setShowSaveForm(false);
        fetchPresets();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save preset');
      }
    } catch {
      toast.error('Failed to save preset');
    } finally {
      setSaving(false);
    }
  }, [saveName, mode, fetchPresets]);

  const filtered = presets.filter((p) => {
    if (filter !== 'all' && p.data.mode !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[480px] mx-4 max-h-[80vh] bg-neutral-950 border border-neutral-800/50 rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50 shrink-0">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-300">Community Presets</span>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-neutral-800/50 space-y-3 shrink-0">
          <div className="flex gap-1.5">
            {(['all', 'halftone', 'texture', 'riso'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all border',
                  filter === f
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-neutral-500 border-neutral-800/50 hover:bg-neutral-800/30'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search presets..."
              className="w-full bg-neutral-900/50 border border-neutral-800/50 rounded-md pl-8 pr-3 py-1.5 text-[11px] text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-700"
            />
          </div>
        </div>

        {/* Preset List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 scrollbar-thin scrollbar-thumb-neutral-700">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-neutral-500">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[11px] text-neutral-600">No presets found</p>
              <p className="text-[10px] text-neutral-700 mt-1">Be the first to share one!</p>
            </div>
          ) : (
            filtered.map((preset) => (
              <button
                key={preset._id}
                onClick={() => applyPreset(preset)}
                className="w-full text-left px-3 py-3 rounded-md bg-neutral-900/30 border border-neutral-800/30 hover:bg-neutral-800/40 hover:border-neutral-700/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  {/* Visual preview swatch */}
                  <PresetSwatch preset={preset} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-300 truncate">{preset.name}</span>
                      <span className={cn(
                        'text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0',
                        preset.data.mode === 'halftone' && 'bg-cyan-400/10 text-cyan-400',
                        preset.data.mode === 'texture' && 'bg-purple-400/10 text-purple-400',
                        preset.data.mode === 'riso' && 'bg-amber-400/10 text-amber-400',
                      )}>
                        {preset.data.mode}
                      </span>
                    </div>
                    <PresetDetails preset={preset} />
                    {preset.author && (
                      <span className="text-[9px] text-neutral-600 font-mono">by {preset.author.name}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLike(preset._id); }}
                    className={cn(
                      'flex items-center gap-1 text-[10px] transition-colors p-1 shrink-0',
                      preset.liked ? 'text-red-400' : 'text-neutral-600 hover:text-red-400'
                    )}
                  >
                    <Heart size={12} fill={preset.liked ? 'currentColor' : 'none'} />
                    <span>{preset.likes}</span>
                  </button>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Save */}
        <div className="px-5 py-3 border-t border-neutral-800/50 shrink-0">
          {showSaveForm ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 bg-neutral-900/50 border border-neutral-800/50 rounded-md px-3 py-1.5 text-[11px] text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-700"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
              />
              <Button onClick={handleSave} disabled={saving || !saveName.trim()} className="bg-white hover:bg-neutral-200 text-black text-xs h-8 px-3">
                {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </Button>
              <Button onClick={() => setShowSaveForm(false)} variant="ghost" className="text-neutral-500 h-8 px-2 text-xs">
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowSaveForm(true)}
              variant="ghost"
              className="w-full text-neutral-400 hover:text-white h-9 text-xs gap-2"
            >
              <Upload size={14} /> Share Current Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
