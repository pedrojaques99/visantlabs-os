import React from 'react';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  ANIMATION_PRESETS,
  TONE_MAPPING_OPTIONS,
} from '@/stores/studio3dStore';
import { Camera, SlidersHorizontal, Play } from 'lucide-react';
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
  const [animateSpeed, setAnimateSpeed] = useDebouncedSlider(store.animateSpeed, store.setAnimateSpeed);
  const [physicsCount, setPhysicsCount] = useDebouncedSlider(store.physicsCount, store.setPhysicsCount);
  const [physicsGravity, setPhysicsGravity] = useDebouncedSlider(store.physicsGravity, store.setPhysicsGravity);
  const [physicsBounciness, setPhysicsBounciness] = useDebouncedSlider(store.physicsBounciness, store.setPhysicsBounciness);
  const [physicsFriction, setPhysicsFriction] = useDebouncedSlider(store.physicsFriction, store.setPhysicsFriction);
  const [physicsSize, setPhysicsSize] = useDebouncedSlider(store.physicsSize, (v: number) => {
    store.setPhysicsSize(v);
    const maxCount = Math.max(1, Math.round(100 - (v - 0.2) * (92 / 1.5)));
    if (store.physicsCount > maxCount) store.setPhysicsCount(maxCount);
  });

  return (
    <>
      {/* Camera */}
      <ToolPanelDisclosure label={t('studio3d.camera.title')} icon={<Camera size={13} />} id="sec-camera" defaultOpen>
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
        <ToolPanelRow label="Projection">
          <ToolPanelGrid cols={2}>
            <ToolPanelChip active={!store.orthographic} onClick={() => store.setOrthographic(false)}>Perspective</ToolPanelChip>
            <ToolPanelChip active={store.orthographic} onClick={() => store.setOrthographic(true)}>Orthographic</ToolPanelChip>
          </ToolPanelGrid>
        </ToolPanelRow>
        {!store.orthographic && (
          <NodeSlider label={t('studio3d.camera.fov')} value={fov} min={15} max={120} step={1} onChange={setFov} />
        )}
      </ToolPanelDisclosure>

      {/* Rendering */}
      <ToolPanelDisclosure label="Rendering" icon={<SlidersHorizontal size={13} />} id="sec-rendering">
        <ToolPanelSection title={t('studio3d.geometry.renderQuality')}>
          <ToolPanelGrid cols={3}>
            {(['performance', 'balanced', 'quality'] as const).map((q) => (
              <ToolPanelChip key={q} active={store.renderQuality === q} onClick={() => store.setRenderQuality(q)}>
                {t(`studio3d.geometry.quality${q.charAt(0).toUpperCase() + q.slice(1)}`)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>
        <ToolPanelSection title="Tone Mapping">
          <ToolPanelGrid cols={3}>
            {TONE_MAPPING_OPTIONS.map((tm) => (
              <ToolPanelChip key={tm.id} active={store.toneMapping === tm.id} onClick={() => store.setToneMapping(tm.id)}>
                {tm.label}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          <NodeSlider label="Exposure" value={toneMappingExposure} min={0.1} max={3} step={0.05} onChange={setToneMappingExposure} />
        </ToolPanelSection>
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
          <NodeSlider label="Reflection" value={groundReflection} min={0} max={1} step={0.05} onChange={setGroundReflection} />
        )}
        <ToolPanelRow label={t('studio3d.lighting.grid')}>
          <Switch checked={store.showGrid} onCheckedChange={store.setShowGrid} aria-label="Grid" />
        </ToolPanelRow>
      </ToolPanelDisclosure>

      {/* Animation */}
      <ToolPanelDisclosure label={t('studio3d.animation.type')} icon={<Play size={13} />} id="sec-animation">
        <div className="space-y-3">
          <ToolPanelGrid>
            {ANIMATION_PRESETS.map((a) => (
              <ToolPanelChip key={a.id} active={store.animate === a.id} onClick={() => store.setAnimate(a.id)}>
                {a.label}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>

          {store.animate === 'physicsFall' ? (
            <div className="space-y-3 pt-2">
              <NodeSlider label={t('studio3d.animation.physics.count')} value={physicsCount} min={1} max={Math.max(1, Math.round(100 - (store.physicsSize - 0.2) * (92 / 1.5)))} step={1} onChange={setPhysicsCount} />
              <NodeSlider label={t('studio3d.animation.physics.gravity')} value={physicsGravity} min={0} max={30} step={0.5} onChange={setPhysicsGravity} />
              <NodeSlider label={t('studio3d.animation.physics.bounciness')} value={physicsBounciness} min={0} max={1} step={0.05} onChange={setPhysicsBounciness} />
              <NodeSlider label={t('studio3d.animation.physics.friction')} value={physicsFriction} min={0} max={1} step={0.05} onChange={setPhysicsFriction} />
              <NodeSlider label={t('studio3d.animation.physics.size')} value={physicsSize} min={0.2} max={2} step={0.05} onChange={setPhysicsSize} />
              <Button variant="outline" size="sm" className="w-full text-[10px] uppercase tracking-wider h-8" onClick={() => useStudio3DStore.setState({ resetKey: Date.now() })}>
                {t('studio3d.animation.physics.reset')}
              </Button>
            </div>
          ) : store.animate !== 'none' ? (
            <div className="space-y-3 pt-2">
              <NodeSlider label={t('studio3d.animation.speed')} value={animateSpeed} min={0.1} max={5} step={0.1} onChange={setAnimateSpeed} />
              <ToolPanelSection title={t('studio3d.animation.easing')}>
                <ToolPanelGrid>
                  {(['linear', 'easeIn', 'easeOut', 'easeInOut'] as const).map((e) => (
                    <ToolPanelChip key={e} active={store.animateEasing === e} onClick={() => store.setAnimateEasing(e)}>
                      {t(`studio3d.animation.easings.${e}`)}
                    </ToolPanelChip>
                  ))}
                </ToolPanelGrid>
              </ToolPanelSection>
              <ToolPanelRow label={t('studio3d.animation.reverse')}>
                <Switch checked={store.animateReverse} onCheckedChange={store.setAnimateReverse} aria-label="Reverse animation" />
              </ToolPanelRow>
            </div>
          ) : null}
        </div>
      </ToolPanelDisclosure>
    </>
  );
});
