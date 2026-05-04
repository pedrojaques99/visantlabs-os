import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Type, Square, Download, ArrowLeft, Trash2, Undo2, Redo2, Briefcase, Save, FolderOpen, Check, AlertTriangle, Circle, Image, Palette, Lock, Unlock } from 'lucide-react';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { Button } from '@/components/ui/button';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import type { CreativeFormat, CreativeLayerData } from './store/creativeTypes';
import {
  useSaveCreativeProject,
  useUpdateCreativeProject,
} from '@/hooks/queries/useCreativeProjects';
import { snapshotCreativeFromStore } from './lib/persistCreative';
import { isPersistedId } from './lib/layerUtils';

import { GlitchLoader } from '@/components/ui/GlitchLoader'
const FORMATS: CreativeFormat[] = ['1:1', '9:16', '16:9', '4:5'];

interface Props {
  onExport: () => void;
  /**
   * Returns a thumbnail data URL for the current canvas (or null).
   * Provided by CreativeStudio which owns the canvas ref.
   */
  onCaptureThumbnail?: () => Promise<string | null>;
  autoSaveStatus?: AutoSaveStatus;
  lastSavedAt?: number | null;
}

const AUTO_SAVE_LABEL: Record<AutoSaveStatus, string> = {
  idle: 'Não salvo',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Falha',
};

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 10_000) return 'agora';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m atrás`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const CreativeEditorSidebar: React.FC<Props> = ({
  onExport,
  onCaptureThumbnail,
  autoSaveStatus = 'idle',
  lastSavedAt = null,
}) => {
  const navigate = useNavigate();
  const brandId = useCreativeStore((s) => s.brandId);
  const layers = useCreativeStore((s) => s.layers);
  const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
  const format = useCreativeStore((s) => s.format);
  const creativeId = useCreativeStore((s) => s.creativeId);
  const projectName = useCreativeStore((s) => s.projectName);
  const backgroundUrl = useCreativeStore((s) => s.backgroundUrl);
  const overlay = useCreativeStore((s) => s.overlay);
  const backgroundSelected = useCreativeStore((s) => s.backgroundSelected);

  const setFormat = useCreativeStore((s) => s.setFormat);
  const setSelectedLayerIds = useCreativeStore((s) => s.setSelectedLayerIds);
  const updateLayerMeta = useCreativeStore((s) => s.updateLayerMeta);
  const removeLayer = useCreativeStore((s) => s.removeLayer);
  const addLayer = useCreativeStore((s) => s.addLayer);
  const setProjectName = useCreativeStore((s) => s.setProjectName);
  const setCreativeId = useCreativeStore((s) => s.setCreativeId);
  const reset = useCreativeStore((s) => s.reset);
  const setBackgroundSelected = useCreativeStore((s) => s.setBackgroundSelected);
  const { undo, redo, pastStates, futureStates } = useCreativeStore.temporal.getState();
  const { colors, activeGuideline, allGuidelines } = useBrandKit();

  const saveMutation = useSaveCreativeProject();
  const updateProjectMutation = useUpdateCreativeProject();
  const [isEditingName, setIsEditingName] = useState(false);

  const isSaving = saveMutation.isPending || updateProjectMutation.isPending;

  const handleSave = async () => {
    const thumbnailUrl = (await onCaptureThumbnail?.()) ?? null;
    const snap = snapshotCreativeFromStore();
    try {
      if (isPersistedId(creativeId)) {
        await updateProjectMutation.mutateAsync({
          id: creativeId,
          input: { ...snap, thumbnailUrl },
        });
      } else {
        const project = await saveMutation.mutateAsync({ ...snap, thumbnailUrl });
        setCreativeId(project.id);
      }
    } catch {
      /* toast handled inside mutation */
    }
  };
  
  const guideline = allGuidelines.find(g => g.id === brandId) ?? activeGuideline;
  const accentColor = guideline?.colors?.[0]?.hex ?? colors[0]?.hex ?? '#00e5ff';
  const defaultFont = guideline?.typography?.[0]?.family ?? 'Inter, sans-serif';

  const handleAddText = () => {
    const newLayer: CreativeLayerData = {
      type: 'text',
      content: 'Novo texto',
      role: 'custom',
      position: { x: 0.1, y: 0.1 },
      size: { w: 0.8, h: 0.1 },
      align: 'left',
      fontSize: 64,
      fontFamily: defaultFont,
      color: '#ffffff',
      bold: false,
    };
    addLayer(newLayer);
  };

  const handleAddShape = () => {
    const newLayer: CreativeLayerData = {
      type: 'shape',
      shape: 'rect',
      color: accentColor,
      position: { x: 0.1, y: 0.1 },
      size: { w: 0.3, h: 0.05 },
    };
    addLayer(newLayer);
  };

  const handleAddAsset = (asset: { url: string; type: 'logo' | 'image' }) => {
    const newLayer: CreativeLayerData = asset.type === 'logo' ? {
      type: 'logo',
      url: asset.url,
      position: { x: 0.3, y: 0.3 },
      size: { w: 0.2, h: 0.1 },
    } : {
      type: 'logo', // We reuse LogoLayer for images for now as it handles 'contain' nicely
      url: asset.url,
      position: { x: 0.2, y: 0.2 },
      size: { w: 0.4, h: 0.3 },
    };
    addLayer(newLayer);
  };

  return (
    <aside 
      role="region"
      aria-label="Creative Editor"
      className="w-[360px] h-full bg-neutral-950 border-r border-white/5 flex flex-col p-5 gap-5 overflow-y-auto custom-scrollbar"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            reset();
            navigate('/create');
          }}
          className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 hover:text-white transition-colors"
        >
          <ArrowLeft size={12} /> Novo
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/create/projects')}
            className="p-1.5 rounded bg-neutral-900 border border-white/5 text-neutral-400 hover:text-brand-cyan transition-colors"
            title="My Creatives"
          >
            <FolderOpen size={13} />
          </button>
          <button
            onClick={() => undo()}
            disabled={pastStates.length === 0}
            className="p-1.5 rounded bg-neutral-900 border border-white/5 text-neutral-400 hover:text-brand-cyan disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={() => redo()}
            disabled={futureStates.length === 0}
            className="p-1.5 rounded bg-neutral-900 border border-white/5 text-neutral-400 hover:text-brand-cyan disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Refazer (Ctrl+Shift+Z)"
          >
            <Redo2 size={13} />
          </button>
        </div>
      </div>

      {/* Project name (editable) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Projeto
        </label>
        {isEditingName ? (
          <input
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full bg-neutral-900/60 border border-white/10 focus:border-brand-cyan/50 rounded px-2 py-1.5 text-sm font-manrope text-neutral-200 outline-none"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-left truncate text-sm font-manrope text-neutral-200 hover:text-brand-cyan px-2 py-1.5 border border-transparent hover:border-white/5 rounded transition-colors"
            title="Click to rename"
          >
            {projectName || 'Untitled Creative'}
          </button>
        )}
      </div>

      {/* Brand Kit Section */}
      {guideline && (
        <div className="flex flex-col gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Briefcase size={12} className="text-brand-cyan" />
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-300">
              Brand Vault
            </label>
          </div>
          <div className="max-h-[240px] overflow-y-auto pr-1">
            <MediaKitGallery 
              guidelineId={brandId || guideline.id}
              media={guideline.media || []}
              logos={guideline.logos || []}
              onMediaChange={() => {}} // Read only in editor for now
              onLogosChange={() => {}}
              compact={true}
              readOnly={true}
              // We'll add this feature to MediaKitGallery next
              onAssetClick={(url, type) => handleAddAsset({ url, type })}
              onAssetDragStart={(e, url, type) => {
                e.dataTransfer.setData('application/vsn-asset-url', url);
                e.dataTransfer.setData('application/vsn-asset-type', type);
                e.dataTransfer.dropEffect = 'copy';
              }}
            />
          </div>
        </div>
      )}

      {/* Add layers */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Adicionar Estáticos
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={handleAddText}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/vsn-asset-type', 'text');
              e.dataTransfer.dropEffect = 'copy';
            }}
            className="px-2 py-2.5 rounded text-[11px] font-mono border bg-neutral-900/60 border-white/10 text-neutral-400 hover:text-white hover:border-brand-cyan/30 transition-all flex items-center justify-center gap-1.5"
          >
            <Type size={12} /> Texto
          </button>
          <button
            onClick={handleAddShape}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/vsn-asset-type', 'shape');
              e.dataTransfer.dropEffect = 'copy';
            }}
            className="px-2 py-2.5 rounded text-[11px] font-mono border bg-neutral-900/60 border-white/10 text-neutral-400 hover:text-white hover:border-brand-cyan/30 transition-all flex items-center justify-center gap-1.5"
          >
            <Square size={12} /> Shape
          </button>
        </div>
      </div>

      {/* Layers list */}
      <div className="flex flex-col gap-1.5 overflow-hidden">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Layers ({layers.length})
        </label>
        <div className="flex flex-col gap-1 overflow-y-auto pr-1 max-h-[300px]">
          {layers.length === 0 && (
            <p className="text-[11px] text-neutral-600 px-2 py-2">Nenhuma camada ainda</p>
          )}
          {[...layers].reverse().map((layer) => {
            const label =
              layer.data.type === 'text'
                ? layer.data.content.replace(/<\/?accent>/g, '').slice(0, 20) || 'Texto'
                : layer.data.type === 'logo'
                ? 'Logo'
                : 'Shape';
            const isSelected = selectedLayerIds.includes(layer.id);
            return (
              <div
                key={layer.id}
                onClick={(e) => {
                  if (e.shiftKey) {
                    const next = isSelected 
                      ? selectedLayerIds.filter(id => id !== layer.id)
                      : [...selectedLayerIds, layer.id];
                    setSelectedLayerIds(next);
                  } else {
                    setSelectedLayerIds([layer.id]);
                  }
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan'
                    : 'text-neutral-400 hover:bg-white/5'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayerMeta(layer.id, { visible: !layer.visible });
                  }}
                  className="text-neutral-600 hover:text-white"
                  title={layer.visible ? 'Ocultar' : 'Mostrar'}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayerMeta(layer.id, { locked: !layer.locked });
                  }}
                  className={`hover:text-white ${layer.locked ? 'text-brand-cyan' : 'text-neutral-600'}`}
                  title={layer.locked ? 'Destravar' : 'Travar'}
                >
                  {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
                <span className="flex-1 truncate">{label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                  className="text-neutral-700 hover:text-red-400"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}

          {/* Background pseudo-layer — always at bottom like Figma's frame fill */}
          {(() => {
            const hasBg = !!backgroundUrl;
            const hasOverlay = !!overlay;
            const label = hasBg
              ? 'Imagem'
              : hasOverlay
              ? overlay.type === 'solid' ? 'Cor sólida' : 'Gradiente'
              : 'Fundo vazio';
            const Icon = hasBg ? Image : Palette;
            return (
              <div
                onClick={() => {
                  setSelectedLayerIds([]);
                  setBackgroundSelected(true);
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-colors border-t border-white/5 mt-1 pt-2 ${
                  backgroundSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan'
                    : 'text-neutral-500 hover:bg-white/5'
                }`}
              >
                <Icon size={12} className="shrink-0" />
                <span className="flex-1 truncate">Fundo · {label}</span>
                {hasOverlay && (
                  <span
                    className="w-3 h-3 rounded-sm shrink-0 border border-white/10"
                    style={{ background: overlay.color ?? `rgba(0,0,0,${overlay.opacity})` }}
                  />
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Format switcher */}
      <div className="mt-auto flex flex-col gap-4 border-t border-white/5 pt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            Formato
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-2 py-2 rounded text-[11px] font-mono border transition-all ${
                  format === f
                    ? 'bg-brand-cyan/10 border-brand-cyan/50 text-brand-cyan'
                    : 'bg-neutral-900/60 border-white/10 text-neutral-500 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-save indicator */}
        {isPersistedId(creativeId) && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500">
            {autoSaveStatus === 'saving' && <GlitchLoader size={10} />}
            {autoSaveStatus === 'saved' && <Check size={10} className="text-emerald-400" />}
            {autoSaveStatus === 'error' && <AlertTriangle size={10} className="text-red-400" />}
            {autoSaveStatus === 'idle' && <Circle size={10} className="text-neutral-600" />}
            <span>{AUTO_SAVE_LABEL[autoSaveStatus]}</span>
            {lastSavedAt && autoSaveStatus === 'saved' && (
              <span className="text-neutral-600">· {formatRelative(lastSavedAt)}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 font-mono text-xs font-bold flex items-center justify-center gap-2 bg-neutral-900/60 border border-white/10 hover:border-brand-cyan/40 text-neutral-200 hover:text-brand-cyan disabled:opacity-50"
          >
            {isSaving ? <GlitchLoader size={14} /> : <Save size={14} />}
            {isPersistedId(creativeId) ? 'Atualizar' : 'Salvar'}
          </Button>
          <Button
            variant="brand"
            onClick={onExport}
            className="flex-1 py-3 font-mono text-xs font-bold flex items-center justify-center gap-2"
          >
            <Download size={14} /> PNG
          </Button>
        </div>
      </div>
    </aside>
  );
};
