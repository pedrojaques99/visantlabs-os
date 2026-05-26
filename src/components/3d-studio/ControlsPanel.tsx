import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Button } from '@/components/ui/button';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { SendToButton } from '@/components/shared/SendToButton';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  ASPECT_RATIOS,
  EXPORT_RESOLUTIONS,
} from '@/stores/studio3dStore';
import { ChevronRight, Diamond, Download } from 'lucide-react';
import {
  ToolPanel, ToolPanelContent, ToolPanelGrid, ToolPanelChip,
} from '@/components/shared/ToolPanel';
import { SceneTab } from './panels/SceneTab';
import { LookTab } from './panels/LookTab';
import { CameraTab } from './panels/CameraTab';
import { EffectsTab } from './panels/EffectsTab';

type StoreState = ReturnType<typeof useStudio3DStore.getState>;

const TABS = [
  { id: 'scene', label: 'Scene' },
  { id: 'look', label: 'Look' },
  { id: 'camera', label: 'Camera' },
  { id: 'effects', label: 'FX' },
] as const;

type TabId = typeof TABS[number]['id'];

interface ControlsPanelProps {
  onExport: () => void;
  onBatchExport?: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo(({ onExport, onBatchExport }) => {
  const store = useStudio3DStore();
  const [activeTab, setActiveTab] = useState<TabId>('scene');
  const [videoDuration, setVideoDuration] = useDebouncedSlider(store.videoDuration, store.setVideoDuration);

  return (
    <ToolPanel>
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-neutral-800/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors',
              activeTab === tab.id
                ? 'text-white border-b border-white'
                : 'text-neutral-600 hover:text-neutral-400'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ToolPanelContent>
        {activeTab === 'scene' && <SceneTab />}
        {activeTab === 'look' && <LookTab />}
        {activeTab === 'camera' && <CameraTab />}
        {activeTab === 'effects' && <EffectsTab />}
      </ToolPanelContent>

      {/* Sticky bottom — Export */}
      <ExportPanel store={store} videoDuration={videoDuration} setVideoDuration={setVideoDuration} onExport={onExport} onBatchExport={onBatchExport} />
    </ToolPanel>
  );
});

/* ── Export Panel (collapsible, pinned bottom) ─────────── */

const ExportPanel: React.FC<{
  store: StoreState;
  videoDuration: number;
  setVideoDuration: (v: number) => void;
  onExport: () => void;
  onBatchExport?: () => void;
}> = React.memo(({ store, videoDuration, setVideoDuration, onExport, onBatchExport }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="shrink-0 border-t border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Download size={12} className="text-neutral-500" />
          <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">{t('studio3d.export.title')}</span>
        </div>
        <ChevronRight size={10} className={cn('text-neutral-600 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {store.shaderEnabled && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[9px] text-cyan-400 uppercase tracking-wider">
              <Diamond size={10} />
              {t('studio3d.export.shaderActive', { shader: store.shaderType })}
            </div>
          )}

          <ToolPanelGrid cols={3}>
            {(['png', 'webm', 'turntable', 'glb', 'obj'] as const).map((f) => (
              <ToolPanelChip key={f} active={store.exportFormat === f} onClick={() => store.setExportFormat(f)}>
                {f === 'turntable' ? '360°' : f}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>

          {store.exportFormat !== 'glb' && store.exportFormat !== 'obj' && store.exportFormat !== 'turntable' && (
            <ToolPanelGrid cols={4}>
              {(Object.keys(ASPECT_RATIOS) as Array<keyof typeof ASPECT_RATIOS>).map((r) => (
                <ToolPanelChip key={r} active={store.aspectRatio === r} onClick={() => store.setAspectRatio(r)}>
                  {r}
                </ToolPanelChip>
              ))}
            </ToolPanelGrid>
          )}

          {(store.exportFormat === 'glb' || store.exportFormat === 'obj') && (
            <div className="px-2 py-1.5 rounded bg-white/5 text-[9px] text-neutral-400 uppercase tracking-wider">
              {store.exportFormat === 'glb' ? t('studio3d.export.glbDesc') : t('studio3d.export.objDesc')}
            </div>
          )}

          {store.exportFormat === 'png' && (
            <ToolPanelGrid cols={3}>
              {EXPORT_RESOLUTIONS.map((r) => (
                <ToolPanelChip key={r.id} active={store.exportResolution === r.id} onClick={() => store.setExportResolution(r.id)}>
                  {r.label}
                </ToolPanelChip>
              ))}
            </ToolPanelGrid>
          )}

          {(store.exportFormat === 'webm' || store.exportFormat === 'turntable') && (
            <div className="space-y-2">
              <NodeSlider label={t('studio3d.export.duration')} value={videoDuration} min={1} max={10} step={0.5} onChange={setVideoDuration} />
              {store.exportFormat === 'turntable' && (
                <div className="px-2 py-1.5 rounded bg-white/5 text-[9px] text-neutral-400 uppercase tracking-wider">
                  {t('studio3d.export.turntableDesc')}
                </div>
              )}
              {store.exportFormat === 'webm' && store.animate !== 'none' && (() => {
                const loopPeriod = Math.round((2 * Math.PI / store.animateSpeed) * 2) / 2;
                const clamped = Math.min(Math.max(loopPeriod, 1), 10);
                return (
                  <button onClick={() => setVideoDuration(clamped)} className={cn('w-full py-1 rounded text-[9px] uppercase tracking-wider transition-colors', videoDuration === clamped ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20' : 'bg-white/5 text-neutral-400 hover:bg-white/10')}>
                    {t('studio3d.export.perfectLoop', { duration: String(clamped) })}
                  </button>
                );
              })()}
            </div>
          )}

          {store.isExporting && store.exportProgress > 0 && (
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-200" style={{ width: `${Math.round(store.exportProgress * 100)}%` }} />
            </div>
          )}

          <div className="flex gap-2 w-full">
            <Button onClick={onExport} disabled={store.isExporting} aria-label="Export" className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium text-xs h-8">
              {store.isExporting
                ? (store.exportProgress > 0 ? `${Math.round(store.exportProgress * 100)}%` : t('studio3d.export.exporting'))
                : t('studio3d.export.exportFormat', { format: store.exportFormat.toUpperCase() })}
            </Button>
            <SendToButton source="3d-studio" />
          </div>
          {store.exportFormat === 'png' && onBatchExport && (
            <button
              onClick={onBatchExport}
              disabled={store.isExporting}
              className="w-full py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors disabled:opacity-40"
            >
              Export All Views (ZIP)
            </button>
          )}
        </div>
      )}
    </div>
  );
});
