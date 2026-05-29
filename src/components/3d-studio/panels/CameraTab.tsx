import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  TONE_MAPPING_OPTIONS,
} from '@/stores/studio3dStore';
import {
  ToolPanelSection, ToolPanelDisclosure, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { setCameraView, resetCamera } from '../CameraBridge';

export const CameraTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();

  const [fov, setFov] = useDebouncedSlider(store.fov, store.setFov);
  const [toneMappingExposure, setToneMappingExposure] = useDebouncedSlider(store.toneMappingExposure, store.setToneMappingExposure);
  const [groundReflection, setGroundReflection] = useDebouncedSlider(store.groundReflection, store.setGroundReflection);

  return (
    <>
      {/* Camera Views — always visible */}
      <ToolPanelSection title={t('studio3d.camera.title')}>
        <ToolPanelGrid cols={3}>
          {(['front', 'top', 'right', 'back', 'iso'] as const).map((view) => (
            <ToolPanelChip key={view} active={store._cameraInfo?.view === view} onClick={() => setCameraView(view)}>
              {t(`studio3d.camera.${view}`)}
            </ToolPanelChip>
          ))}
          <ToolPanelChip onClick={() => resetCamera()}>
            {t('studio3d.camera.reset')}
          </ToolPanelChip>
        </ToolPanelGrid>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolPanelChip active={!store.orthographic} onClick={() => store.setOrthographic(false)}>Perspective</ToolPanelChip>
          <ToolPanelChip active={store.orthographic} onClick={() => store.setOrthographic(true)}>Orthographic</ToolPanelChip>
        </div>
        {!store.orthographic && (
          <ScrubInput label="FOV" value={fov} min={15} max={120} step={1} suffix="°" onChange={setFov} />
        )}
      </ToolPanelSection>

      {/* Rendering — always visible */}
      <ToolPanelSection title="RENDERING">
        <ToolPanelGrid cols={3}>
          {(['performance', 'balanced', 'quality'] as const).map((q) => (
            <ToolPanelChip key={q} active={store.renderQuality === q} onClick={() => store.setRenderQuality(q)}>
              {t(`studio3d.geometry.quality${q.charAt(0).toUpperCase() + q.slice(1)}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <ScrubInput label="Exposure" value={toneMappingExposure} min={0.1} max={3} step={0.05} onChange={setToneMappingExposure} />
      </ToolPanelSection>

      {/* Tone Mapping — collapsible */}
      <ToolPanelDisclosure label="Tone Mapping">
        <ToolPanelGrid cols={3}>
          {TONE_MAPPING_OPTIONS.map((tm) => (
            <ToolPanelChip key={tm.id} active={store.toneMapping === tm.id} onClick={() => store.setToneMapping(tm.id)}>
              {tm.label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
      </ToolPanelDisclosure>

      {/* Scene Options — collapsible */}
      <ToolPanelDisclosure label="Scene Options">
        <ToolPanelRow label={t('studio3d.lighting.shadows')}>
          <Switch checked={store.shadow} onCheckedChange={store.setShadow} aria-label="Shadow" />
        </ToolPanelRow>
        {store.shadow && (
          <ToolPanelGrid cols={3}>
            {(['low', 'medium', 'high'] as const).map((q) => (
              <ToolPanelChip key={q} active={store.shadowQuality === q} onClick={() => store.setShadowQuality(q)}>
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        )}
        <ToolPanelRow label="Ground Plane">
          <Switch checked={store.groundPlane} onCheckedChange={store.setGroundPlane} aria-label="Ground plane" />
        </ToolPanelRow>
        {store.groundPlane && (
          <ScrubInput label="Reflection" value={groundReflection} min={0} max={1} step={0.05} onChange={setGroundReflection} />
        )}
        <ToolPanelRow label={t('studio3d.lighting.grid')}>
          <Switch checked={store.showGrid} onCheckedChange={store.setShowGrid} aria-label="Grid" />
        </ToolPanelRow>
      </ToolPanelDisclosure>
    </>
  );
});
