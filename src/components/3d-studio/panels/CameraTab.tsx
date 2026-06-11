import React, { useRef } from 'react';
import { toast } from 'sonner';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  TONE_MAPPING_OPTIONS,
  ENVIRONMENT_PRESETS,
  LIGHTING_PRESETS,
} from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import {
  ToolPanelDisclosure,
  ToolPanelGrid,
  ToolPanelChip,
  ToolPanelRow,
  ExpandableColorPicker,
} from '@/components/shared/ToolPanel';
import { setCameraView, resetCamera } from '../CameraBridge';
import { LightPositionSliders, type StoreState } from './_shared';

// Fine-grained subscription: the camera / lighting / environment / background /
// scene-options slice this tab renders (was a full-store subscription). It does
// read `_cameraInfo` for the active camera-view chip, so a camera-view click
// still re-renders this panel — that is intended.
const cameraPanelSelector = (s: StoreState) => ({
  fov: s.fov,
  orthographic: s.orthographic,
  toneMapping: s.toneMapping,
  toneMappingExposure: s.toneMappingExposure,
  renderQuality: s.renderQuality,
  _cameraInfo: s._cameraInfo,
  lightIntensity: s.lightIntensity,
  ambientIntensity: s.ambientIntensity,
  fillLightIntensity: s.fillLightIntensity,
  bounceLightIntensity: s.bounceLightIntensity,
  pointLightIntensity: s.pointLightIntensity,
  lightPosition: s.lightPosition,
  fillLightPosition: s.fillLightPosition,
  bounceLightPosition: s.bounceLightPosition,
  pointLightPosition: s.pointLightPosition,
  environment: s.environment,
  customHdriUrl: s.customHdriUrl,
  hdriBackground: s.hdriBackground,
  hdriBlur: s.hdriBlur,
  hdriIntensity: s.hdriIntensity,
  hdriRotation: s.hdriRotation,
  bgType: s.bgType,
  background: s.background,
  bgGradient: s.bgGradient,
  backgroundImageUrl: s.backgroundImageUrl,
  transparentBg: s.transparentBg,
  fogEnabled: s.fogEnabled,
  fogColor: s.fogColor,
  fogNear: s.fogNear,
  fogFar: s.fogFar,
  shadow: s.shadow,
  shadowQuality: s.shadowQuality,
  groundPlane: s.groundPlane,
  groundReflection: s.groundReflection,
  showGrid: s.showGrid,
  setFov: s.setFov,
  setOrthographic: s.setOrthographic,
  setToneMapping: s.setToneMapping,
  setToneMappingExposure: s.setToneMappingExposure,
  setRenderQuality: s.setRenderQuality,
  applyLightingPreset: s.applyLightingPreset,
  setLightIntensity: s.setLightIntensity,
  setAmbientIntensity: s.setAmbientIntensity,
  setFillLightIntensity: s.setFillLightIntensity,
  setBounceLightIntensity: s.setBounceLightIntensity,
  setPointLightIntensity: s.setPointLightIntensity,
  setLightPosition: s.setLightPosition,
  setFillLightPosition: s.setFillLightPosition,
  setBounceLightPosition: s.setBounceLightPosition,
  setPointLightPosition: s.setPointLightPosition,
  setEnvironment: s.setEnvironment,
  setCustomHdriUrl: s.setCustomHdriUrl,
  setHdriBackground: s.setHdriBackground,
  setHdriBlur: s.setHdriBlur,
  setHdriIntensity: s.setHdriIntensity,
  setHdriRotation: s.setHdriRotation,
  setBgType: s.setBgType,
  setBackground: s.setBackground,
  setBgGradient: s.setBgGradient,
  setBackgroundImageUrl: s.setBackgroundImageUrl,
  setTransparentBg: s.setTransparentBg,
  setFogEnabled: s.setFogEnabled,
  setFogColor: s.setFogColor,
  setFogNear: s.setFogNear,
  setFogFar: s.setFogFar,
  setShadow: s.setShadow,
  setShadowQuality: s.setShadowQuality,
  setGroundPlane: s.setGroundPlane,
  setGroundReflection: s.setGroundReflection,
  setShowGrid: s.setShowGrid,
});

export const CameraTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore(useShallow(cameraPanelSelector));
  const hdriInputRef = useRef<HTMLInputElement>(null);

  const [fov, setFov] = useDebouncedSlider(store.fov, store.setFov);
  const [toneMappingExposure, setToneMappingExposure] = useDebouncedSlider(
    store.toneMappingExposure,
    store.setToneMappingExposure
  );
  const [groundReflection, setGroundReflection] = useDebouncedSlider(
    store.groundReflection,
    store.setGroundReflection
  );
  const [lightIntensity, setLightIntensity] = useDebouncedSlider(
    store.lightIntensity,
    store.setLightIntensity
  );
  const [ambientIntensity, setAmbientIntensity] = useDebouncedSlider(
    store.ambientIntensity,
    store.setAmbientIntensity
  );
  const [fillLightIntensity, setFillLightIntensity] = useDebouncedSlider(
    store.fillLightIntensity,
    store.setFillLightIntensity
  );
  const [bounceLightIntensity, setBounceLightIntensity] = useDebouncedSlider(
    store.bounceLightIntensity,
    store.setBounceLightIntensity
  );
  const [pointLightIntensity, setPointLightIntensity] = useDebouncedSlider(
    store.pointLightIntensity,
    store.setPointLightIntensity
  );
  const [bgAngle, setBgAngle] = useDebouncedSlider(store.bgGradient.angle, (v) =>
    store.setBgGradient({ angle: v })
  );
  const [hdriBlur, setHdriBlur] = useDebouncedSlider(store.hdriBlur, store.setHdriBlur);
  const [hdriIntensity, setHdriIntensity] = useDebouncedSlider(
    store.hdriIntensity,
    store.setHdriIntensity
  );
  const [hdriRotation, setHdriRotation] = useDebouncedSlider(
    store.hdriRotation,
    store.setHdriRotation
  );
  const [fogNear, setFogNear] = useDebouncedSlider(store.fogNear, store.setFogNear);
  const [fogFar, setFogFar] = useDebouncedSlider(store.fogFar, store.setFogFar);

  return (
    <>
      {/* Camera Views */}
      <ToolPanelDisclosure label={t('studio3d.camera.title')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {(['front', 'top', 'right', 'back', 'iso'] as const).map((view) => (
            <ToolPanelChip
              key={view}
              active={store._cameraInfo?.view === view}
              onClick={() => setCameraView(view)}
            >
              {t(`studio3d.camera.${view}`)}
            </ToolPanelChip>
          ))}
          <ToolPanelChip onClick={() => resetCamera()}>{t('studio3d.camera.reset')}</ToolPanelChip>
        </ToolPanelGrid>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolPanelChip active={!store.orthographic} onClick={() => store.setOrthographic(false)}>
            {t('studio3d.panels.perspective')}
          </ToolPanelChip>
          <ToolPanelChip active={store.orthographic} onClick={() => store.setOrthographic(true)}>
            {t('studio3d.panels.orthographic')}
          </ToolPanelChip>
        </div>
        {!store.orthographic && (
          <ScrubInput
            label="FOV"
            value={fov}
            min={15}
            max={120}
            step={1}
            suffix="°"
            onChange={setFov}
            hint="Field of View — lower = telephoto, higher = wide-angle"
          />
        )}
      </ToolPanelDisclosure>

      {/* Lighting */}
      <ToolPanelDisclosure label={t('studio3d.lighting.title')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {Object.keys(LIGHTING_PRESETS).map((name) => (
            <ToolPanelChip key={name} onClick={() => store.applyLightingPreset(name)}>
              {LIGHTING_PRESETS[name].label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <div className="grid grid-cols-2 gap-1.5">
          <ScrubInput
            label="Key"
            value={lightIntensity}
            min={0}
            max={3}
            step={0.05}
            onChange={setLightIntensity}
          />
          <ScrubInput
            label="Ambient"
            value={ambientIntensity}
            min={0}
            max={2}
            step={0.05}
            onChange={setAmbientIntensity}
          />
          <ScrubInput
            label="Fill"
            value={fillLightIntensity}
            min={0}
            max={2}
            step={0.05}
            onChange={setFillLightIntensity}
          />
          <ScrubInput
            label="Bounce"
            value={bounceLightIntensity}
            min={0}
            max={2}
            step={0.05}
            onChange={setBounceLightIntensity}
          />
        </div>
        <ScrubInput
          label="Top Light"
          value={pointLightIntensity}
          min={0}
          max={2}
          step={0.05}
          onChange={setPointLightIntensity}
        />
      </ToolPanelDisclosure>

      {/* Light Positions */}
      <ToolPanelDisclosure
        label={t('studio3d.panels.lightPositions')}
        badge={<span className="text-[9px] font-mono text-neutral-600">4 lights</span>}
      >
        <LightPositionSliders
          label="Key Position"
          position={store.lightPosition}
          onChange={store.setLightPosition}
        />
        <LightPositionSliders
          label="Fill Position"
          position={store.fillLightPosition}
          onChange={store.setFillLightPosition}
        />
        <LightPositionSliders
          label="Bounce Position"
          position={store.bounceLightPosition}
          onChange={store.setBounceLightPosition}
        />
        <LightPositionSliders
          label="Top Position"
          position={store.pointLightPosition}
          onChange={store.setPointLightPosition}
        />
      </ToolPanelDisclosure>

      {/* Rendering & Tone Mapping */}
      <ToolPanelDisclosure label={t('studio3d.panels.rendering')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {(['performance', 'balanced', 'quality'] as const).map((q) => (
            <ToolPanelChip
              key={q}
              active={store.renderQuality === q}
              onClick={() => store.setRenderQuality(q)}
            >
              {t(`studio3d.geometry.quality${q.charAt(0).toUpperCase() + q.slice(1)}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <ScrubInput
          label="Exposure"
          value={toneMappingExposure}
          min={0.1}
          max={3}
          step={0.05}
          onChange={setToneMappingExposure}
          hint="Scene brightness — adjust to match your lighting"
        />
        <ToolPanelGrid cols={3}>
          {TONE_MAPPING_OPTIONS.map((tm) => (
            <ToolPanelChip
              key={tm.id}
              active={store.toneMapping === tm.id}
              onClick={() => store.setToneMapping(tm.id)}
            >
              {tm.label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
      </ToolPanelDisclosure>

      {/* Environment / HDRI — flattened to single disclosure */}
      <ToolPanelDisclosure
        label="HDRI"
        badge={
          <span className="text-[9px] font-mono text-neutral-500">
            {store.customHdriUrl ? 'custom' : store.environment}
          </span>
        }
      >
        <ToolPanelGrid cols={3}>
          {ENVIRONMENT_PRESETS.map((env) => (
            <ToolPanelChip
              key={env.id}
              active={store.environment === env.id && !store.customHdriUrl}
              onClick={() => store.setEnvironment(env.id)}
            >
              {env.label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <button
          onClick={() => hdriInputRef.current?.click()}
          className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
        >
          {store.customHdriUrl
            ? t('studio3d.environment.customLoaded')
            : t('studio3d.environment.uploadHdr')}
        </button>
        <input
          ref={hdriInputRef}
          type="file"
          accept=".hdr,.exr"
          aria-label="Upload custom HDRI"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const maxSizeMB = 50;
              if (file.size > maxSizeMB * 1024 * 1024) {
                toast.error(
                  `HDRI too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max ${maxSizeMB}MB.`
                );
                e.target.value = '';
                return;
              }
              toast.loading('Loading HDRI...', { id: 'hdri-load', duration: 5000 });
              const url = URL.createObjectURL(file);
              store.setCustomHdriUrl(url);
              toast.success('HDRI loaded', { id: 'hdri-load' });
            }
            e.target.value = '';
          }}
          className="hidden"
        />
        <ToolPanelRow label={t('studio3d.environment.hdriBackground')}>
          <Switch
            checked={store.hdriBackground}
            onCheckedChange={store.setHdriBackground}
            aria-label="HDRI as background"
          />
        </ToolPanelRow>
        <ScrubInput
          label="Rotation"
          value={hdriRotation}
          min={0}
          max={360}
          step={1}
          suffix="°"
          onChange={setHdriRotation}
        />
        {store.hdriBackground && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="Blur"
              value={hdriBlur}
              min={0}
              max={1}
              step={0.01}
              onChange={setHdriBlur}
            />
            <ScrubInput
              label="Intensity"
              value={hdriIntensity}
              min={0}
              max={3}
              step={0.05}
              onChange={setHdriIntensity}
            />
          </div>
        )}
        {store.customHdriUrl && (
          <button
            onClick={() => store.setEnvironment('studio')}
            className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors"
          >
            {t('studio3d.environment.removeCustom')}
          </button>
        )}
      </ToolPanelDisclosure>

      {/* Background — promoted to top-level for quick access */}
      <ToolPanelDisclosure label={t('studio3d.background.title')} defaultOpen>
        <ToolPanelGrid cols={4}>
          {(['solid', 'linear', 'radial', 'image'] as const).map((type) => (
            <ToolPanelChip
              key={type}
              active={store.bgType === type}
              onClick={() => store.setBgType(type)}
            >
              {type === 'image' ? 'Image' : t(`studio3d.background.types.${type}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        {store.bgType === 'solid' ? (
          <ExpandableColorPicker
            color={store.background}
            onChange={store.setBackground}
            label="Background color"
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest">
                  {t('studio3d.background.color1')}
                </span>
                <ExpandableColorPicker
                  color={store.bgGradient.color1}
                  onChange={(c) => store.setBgGradient({ color1: c })}
                  label="Gradient color 1"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest">
                  {t('studio3d.background.color2')}
                </span>
                <ExpandableColorPicker
                  color={store.bgGradient.color2}
                  onChange={(c) => store.setBgGradient({ color2: c })}
                  label="Gradient color 2"
                />
              </div>
            </div>
            {store.bgType === 'linear' && (
              <ScrubInput
                label={t('studio3d.background.angle')}
                value={bgAngle}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={setBgAngle}
              />
            )}
          </div>
        )}
        {store.bgType === 'image' && (
          <div className="space-y-2">
            {store.backgroundImageUrl ? (
              <div className="relative rounded-md overflow-hidden border border-white/10">
                <img
                  src={store.backgroundImageUrl}
                  alt="Background"
                  className="w-full h-20 object-cover"
                />
                <button
                  onClick={() => store.setBackgroundImageUrl('')}
                  className="absolute top-1 right-1 w-5 h-5 rounded bg-black/60 flex items-center justify-center text-neutral-400 hover:text-white transition-colors text-[10px]"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-1 p-3 border border-dashed border-white/10 hover:border-white/20 rounded-lg cursor-pointer transition-all">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                  Upload image
                </span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error('Max 10MB');
                      return;
                    }
                    store.setBackgroundImageUrl(URL.createObjectURL(file));
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        )}
        <ToolPanelRow label={t('studio3d.background.transparent')}>
          <Switch
            checked={store.transparentBg}
            onCheckedChange={store.setTransparentBg}
            aria-label="Transparent background"
          />
        </ToolPanelRow>
      </ToolPanelDisclosure>

      {/* Atmosphere */}
      <ToolPanelDisclosure label={t('studio3d.panels.atmosphere')}>
        <ToolPanelRow label={t('studio3d.panels.fog')}>
          <Switch
            checked={store.fogEnabled}
            onCheckedChange={store.setFogEnabled}
            aria-label="Fog"
          />
        </ToolPanelRow>
        {store.fogEnabled && (
          <>
            <ExpandableColorPicker
              color={store.fogColor}
              onChange={store.setFogColor}
              label="Fog color"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Near"
                value={fogNear}
                min={1}
                max={50}
                step={0.5}
                onChange={setFogNear}
              />
              <ScrubInput
                label="Far"
                value={fogFar}
                min={5}
                max={100}
                step={0.5}
                onChange={setFogFar}
              />
            </div>
          </>
        )}
      </ToolPanelDisclosure>

      {/* Scene Options */}
      <ToolPanelDisclosure label={t('studio3d.panels.sceneOptions')} defaultOpen>
        <ToolPanelRow label={t('studio3d.lighting.shadows')}>
          <Switch checked={store.shadow} onCheckedChange={store.setShadow} aria-label="Shadow" />
        </ToolPanelRow>
        {store.shadow && (
          <ToolPanelGrid cols={3}>
            {(['low', 'medium', 'high'] as const).map((q) => (
              <ToolPanelChip
                key={q}
                active={store.shadowQuality === q}
                onClick={() => store.setShadowQuality(q)}
              >
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        )}
        <ToolPanelRow label={t('studio3d.panels.groundPlane')}>
          <Switch
            checked={store.groundPlane}
            onCheckedChange={store.setGroundPlane}
            aria-label="Ground plane"
          />
        </ToolPanelRow>
        {store.groundPlane && (
          <ScrubInput
            label="Reflection"
            value={groundReflection}
            min={0}
            max={1}
            step={0.05}
            onChange={setGroundReflection}
          />
        )}
        <ToolPanelRow label={t('studio3d.lighting.grid')}>
          <Switch checked={store.showGrid} onCheckedChange={store.setShowGrid} aria-label="Grid" />
        </ToolPanelRow>
      </ToolPanelDisclosure>
    </>
  );
});
