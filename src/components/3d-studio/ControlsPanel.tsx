import React, { useCallback, useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  MATERIAL_PRESETS,
  ANIMATION_PRESETS,
  SCENE_PRESETS,
  ENVIRONMENT_PRESETS,
  ASPECT_RATIOS,
  EXPORT_RESOLUTIONS,
  getSavedScenes,
  saveScene,
  loadScene,
  deleteScene,
  type SavedScene,
} from '@/stores/studio3dStore';
import {
  Upload, FileText, Type, ChevronRight, Diamond, Download, Save, FolderOpen, Trash2,
} from 'lucide-react';
import { ShaderControls } from '@/components/shared/ShaderControls';
import {
  ToolPanel, ToolPanelContent, ToolPanelSection,
  ToolPanelDisclosure, ToolPanelActions, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { HexColorPicker } from 'react-colorful';
import { setCameraView, resetCamera } from './CameraBridge';

const MATERIAL_CATEGORIES = ['basic', 'metals', 'surfaces', 'glass', 'special'] as const;

const FONT_OPTIONS = [
  'DM Sans', 'Bebas Neue', 'Playfair Display', 'Righteous', 'Black Ops One',
  'Permanent Marker', 'Rubik Mono One', 'Pacifico', 'Oswald', 'Archivo Black',
];

interface ControlsPanelProps {
  onExport: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo(({ onExport }) => {
  const { t } = useTranslation();
  const store = useStudio3DStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [depth, setDepth] = useDebouncedSlider(store.depth, store.setDepth);
  const [smoothness, setSmoothness] = useDebouncedSlider(store.smoothness, store.setSmoothness);
  const [bevelThickness, setBevelThickness] = useDebouncedSlider(store.bevelThickness, store.setBevelThickness);
  const [bevelSize, setBevelSize] = useDebouncedSlider(store.bevelSize, store.setBevelSize);
  const [metalness, setMetalness] = useDebouncedSlider(store.metalness, store.setMetalness);
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, store.setRoughness);
  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, store.setOpacity);
  const [lightIntensity, setLightIntensity] = useDebouncedSlider(store.lightIntensity, store.setLightIntensity);
  const [ambientIntensity, setAmbientIntensity] = useDebouncedSlider(store.ambientIntensity, store.setAmbientIntensity);
  const [animateSpeed, setAnimateSpeed] = useDebouncedSlider(store.animateSpeed, store.setAnimateSpeed);
  const [videoDuration, setVideoDuration] = useDebouncedSlider(store.videoDuration, store.setVideoDuration);
  const [textureOpacity, setTextureOpacity] = useDebouncedSlider(store.textureOpacity, store.setTextureOpacity);
  const [bgAngle, setBgAngle] = useDebouncedSlider(store.bgGradient.angle, (v) => store.setBgGradient({ angle: v }));
  const [physicsCount, setPhysicsCount] = useDebouncedSlider(store.physicsCount, store.setPhysicsCount);
  const [physicsGravity, setPhysicsGravity] = useDebouncedSlider(store.physicsGravity, store.setPhysicsGravity);
  const [physicsBounciness, setPhysicsBounciness] = useDebouncedSlider(store.physicsBounciness, store.setPhysicsBounciness);
  const [physicsFriction, setPhysicsFriction] = useDebouncedSlider(store.physicsFriction, store.setPhysicsFriction);
  const [physicsSize, setPhysicsSize] = useDebouncedSlider(store.physicsSize, store.setPhysicsSize);
  const [fillLightIntensity, setFillLightIntensity] = useDebouncedSlider(store.fillLightIntensity, store.setFillLightIntensity);
  const [bounceLightIntensity, setBounceLightIntensity] = useDebouncedSlider(store.bounceLightIntensity, store.setBounceLightIntensity);
  const [pointLightIntensity, setPointLightIntensity] = useDebouncedSlider(store.pointLightIntensity, store.setPointLightIntensity);
  const [bloomIntensity, setBloomIntensity] = useDebouncedSlider(store.bloomIntensity, store.setBloomIntensity);
  const [bloomThreshold, setBloomThreshold] = useDebouncedSlider(store.bloomThreshold, store.setBloomThreshold);
  const [dofFocusDistance, setDofFocusDistance] = useDebouncedSlider(store.dofFocusDistance, store.setDofFocusDistance);
  const [dofBokehScale, setDofBokehScale] = useDebouncedSlider(store.dofBokehScale, store.setDofBokehScale);
  const [vignetteIntensity, setVignetteIntensity] = useDebouncedSlider(store.vignetteIntensity, store.setVignetteIntensity);
  const hdriInputRef = useRef<HTMLInputElement>(null);
  const [savedScenes, setSavedScenes] = useState<SavedScene[]>(() => getSavedScenes());
  const [sceneName, setSceneName] = useState('');

  const processFile = useCallback(async (file: File) => {
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const text = await file.text();
      store.setSvgData(text, file.name);
      toast.success(t('studio3d.input.loaded', { fileName: file.name }));
    } else if (file.type.startsWith('image/')) {
      store.setIsLoading(true);
      try {
        const { pngToSvg } = await import('./PngToSvgConverter');
        const svg = await pngToSvg(file);
        store.setSvgData(svg, file.name);
        toast.success(t('studio3d.input.converted', { fileName: file.name }));
      } catch {
        toast.error(t('studio3d.input.processFailed'));
      } finally {
        store.setIsLoading(false);
      }
    }
  }, [store]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  return (
    <ToolPanel>
      {/* Scrollable content */}
      <ToolPanelContent>

        {/* Input — always visible */}
        <ToolPanelSection title={t('studio3d.input.title')}>
          <ToolPanelGrid>
            <ToolPanelChip active={store.inputMode === 'svg'} onClick={() => store.setInputMode('svg')}>
              <span className="flex items-center justify-center gap-1"><FileText size={12} /> {t('studio3d.input.svgPng')}</span>
            </ToolPanelChip>
            <ToolPanelChip active={store.inputMode === 'text'} onClick={() => store.setInputMode('text')}>
              <span className="flex items-center justify-center gap-1"><Type size={12} /> {t('studio3d.input.text')}</span>
            </ToolPanelChip>
          </ToolPanelGrid>

          {store.inputMode === 'svg' ? (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center gap-2 p-4 border border-dashed rounded-lg cursor-pointer transition-all',
                isDragging ? 'border-white/30 bg-white/5 scale-[1.02]' : 'border-white/10 hover:border-white/20'
              )}
            >
              <Upload size={20} className={cn('transition-colors', isDragging ? 'text-white' : 'text-neutral-500')} />
              <span className={cn('text-[10px] uppercase tracking-wider transition-colors text-center', isDragging ? 'text-white' : 'text-neutral-500')}>
                {store.isLoading ? <GlitchLoader size={12} /> : store.fileName || t('studio3d.input.dropZone')}
              </span>
              <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} className="hidden" />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={store.text}
                onChange={(e) => store.setText(e.target.value)}
                placeholder={t('studio3d.input.textPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
              />
              <select
                value={store.font}
                onChange={(e) => store.setFont(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
              >
                {FONT_OPTIONS.map((f) => <option key={f} value={f} className="bg-neutral-900">{f}</option>)}
              </select>
            </div>
          )}
        </ToolPanelSection>

        {/* Scene Save/Load */}
        <ToolPanelDisclosure label="Scenes">
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="Scene name..."
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[10px]"
                disabled={!sceneName.trim()}
                onClick={() => {
                  saveScene(sceneName.trim());
                  setSavedScenes(getSavedScenes());
                  setSceneName('');
                  toast.success('Scene saved');
                }}
              >
                <Save size={12} />
              </Button>
            </div>
            {savedScenes.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700">
                {savedScenes.map((scene) => (
                  <div key={scene.id} className="flex items-center gap-1.5 group">
                    <button
                      onClick={() => {
                        loadScene(scene.id);
                        toast.success(`Loaded "${scene.name}"`);
                      }}
                      className="flex-1 text-left px-2 py-1 rounded text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors truncate"
                    >
                      <FolderOpen size={10} className="inline mr-1.5 opacity-50" />
                      {scene.name}
                    </button>
                    <button
                      onClick={() => {
                        deleteScene(scene.id);
                        setSavedScenes(getSavedScenes());
                        toast.success('Scene deleted');
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ToolPanelDisclosure>

        {/* Geometry — always visible basics */}
        <ToolPanelSection title={t('studio3d.geometry.title')}>
          <ToolPanelGrid>
            {(['standard', 'coin'] as const).map((type) => (
              <ToolPanelChip key={type} active={store.shapeType === type} onClick={() => store.setShapeType(type)}>
                {t(type === 'standard' ? 'studio3d.geometry.shapeStandard' : 'studio3d.geometry.shapeCoin')}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          <NodeSlider label={t('studio3d.geometry.depth')} value={depth} min={0.5} max={10} step={0.1} onChange={setDepth} />
          <ToolPanelRow label={t('studio3d.geometry.bevel')}>
            <Switch checked={store.bevelEnabled} onCheckedChange={store.setBevelEnabled} />
          </ToolPanelRow>
          {store.bevelEnabled && (
            <>
              <NodeSlider label={t('studio3d.geometry.smoothness')} value={smoothness} min={0} max={8} step={0.1} onChange={setSmoothness} />
              <NodeSlider label={t('studio3d.geometry.thickness')} value={bevelThickness} min={0} max={2} step={0.01} onChange={setBevelThickness} />
              <NodeSlider label={t('studio3d.geometry.size')} value={bevelSize} min={0} max={2} step={0.01} onChange={setBevelSize} />
            </>
          )}
        </ToolPanelSection>

        {/* Scene Presets — always visible */}
        <ToolPanelSection title={t('studio3d.scenePresets.title')}>
          <ToolPanelGrid>
            {Object.keys(SCENE_PRESETS).map((name) => (
              <ToolPanelChip key={name} onClick={() => store.applyScenePreset(name)}>
                {name}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>

        {/* Material — collapsed */}
        <ToolPanelDisclosure label={t('studio3d.material.title')} defaultOpen>
          <MaterialContent
            store={store}
            metalness={metalness} setMetalness={setMetalness}
            roughness={roughness} setRoughness={setRoughness}
            opacity={opacity} setOpacity={setOpacity}
            textureOpacity={textureOpacity} setTextureOpacity={setTextureOpacity}
          />
        </ToolPanelDisclosure>

        {/* Lighting — collapsed */}
        <ToolPanelDisclosure label={t('studio3d.lighting.title')}>
          <NodeSlider label={t('studio3d.lighting.keyLight')} value={lightIntensity} min={0} max={3} step={0.05} onChange={setLightIntensity} />
          <NodeSlider label={t('studio3d.lighting.ambient')} value={ambientIntensity} min={0} max={2} step={0.05} onChange={setAmbientIntensity} />
          <NodeSlider label="Fill Light" value={fillLightIntensity} min={0} max={2} step={0.05} onChange={setFillLightIntensity} />
          <NodeSlider label="Bounce Light" value={bounceLightIntensity} min={0} max={2} step={0.05} onChange={setBounceLightIntensity} />
          <NodeSlider label="Top Light" value={pointLightIntensity} min={0} max={2} step={0.05} onChange={setPointLightIntensity} />
          <ToolPanelRow label={t('studio3d.lighting.shadows')}>
            <Switch checked={store.shadow} onCheckedChange={store.setShadow} />
          </ToolPanelRow>
          <ToolPanelRow label={t('studio3d.lighting.grid')}>
            <Switch checked={store.showGrid} onCheckedChange={store.setShowGrid} />
          </ToolPanelRow>
        </ToolPanelDisclosure>

        {/* Environment / HDRI */}
        <ToolPanelDisclosure label="Environment">
          <ToolPanelGrid cols={3}>
            {ENVIRONMENT_PRESETS.map((env) => (
              <ToolPanelChip key={env.id} active={store.environment === env.id && !store.customHdriUrl} onClick={() => store.setEnvironment(env.id)}>
                {env.label}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          <button
            onClick={() => hdriInputRef.current?.click()}
            className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
          >
            {store.customHdriUrl ? 'Custom HDRI loaded' : 'Upload .HDR'}
          </button>
          <input
            ref={hdriInputRef}
            type="file"
            accept=".hdr,.exr"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                store.setCustomHdriUrl(url);
                toast.success('HDRI loaded');
              }
              e.target.value = '';
            }}
            className="hidden"
          />
          {store.customHdriUrl && (
            <button onClick={() => store.setEnvironment('studio')} className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors">
              Remove custom HDRI
            </button>
          )}
        </ToolPanelDisclosure>

        {/* Camera — collapsed */}
        <ToolPanelDisclosure label={t('studio3d.camera.title')}>
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
        </ToolPanelDisclosure>

        {/* Background — collapsed */}
        <ToolPanelDisclosure label={t('studio3d.background.title')}>
          <div className="space-y-3">
            <ToolPanelGrid cols={3}>
              {(['solid', 'linear', 'radial'] as const).map((type) => (
                <ToolPanelChip key={type} active={store.bgType === type} onClick={() => store.setBgType(type)}>
                  {t(`studio3d.background.types.${type}`)}
                </ToolPanelChip>
              ))}
            </ToolPanelGrid>

            {store.bgType === 'solid' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border border-white/10 shrink-0" style={{ backgroundColor: store.background }} />
                  <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-1">
                    <span className="text-[10px] text-neutral-500 mr-1">#</span>
                    <input
                      type="text"
                      value={store.background.replace('#', '').toUpperCase()}
                      onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setBackground(`#${v}`); }}
                      onBlur={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setBackground(`#${v}`); }}
                      maxLength={6}
                      className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
                      placeholder="0A0A0A"
                    />
                  </div>
                </div>
                <div className="custom-color-picker"><HexColorPicker color={store.background} onChange={store.setBackground} /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{t('studio3d.background.color1')}</span>
                      <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: store.bgGradient.color1 }} />
                    </div>
                    <div className="custom-color-picker-mini"><HexColorPicker color={store.bgGradient.color1} onChange={(c) => store.setBgGradient({ color1: c })} /></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{t('studio3d.background.color2')}</span>
                      <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: store.bgGradient.color2 }} />
                    </div>
                    <div className="custom-color-picker-mini"><HexColorPicker color={store.bgGradient.color2} onChange={(c) => store.setBgGradient({ color2: c })} /></div>
                  </div>
                </div>
                {store.bgType === 'linear' && (
                  <NodeSlider label={t('studio3d.background.angle')} value={bgAngle} min={0} max={360} step={1} onChange={setBgAngle} />
                )}
              </div>
            )}

            <ToolPanelRow label={t('studio3d.background.transparent')}>
              <Switch checked={store.transparentBg} onCheckedChange={store.setTransparentBg} />
            </ToolPanelRow>
          </div>
        </ToolPanelDisclosure>

        {/* Animation — collapsed */}
        <ToolPanelDisclosure label={t('studio3d.animation.type')}>
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
                <NodeSlider label={t('studio3d.animation.physics.count')} value={physicsCount} min={5} max={50} step={1} onChange={setPhysicsCount} />
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
                  <Switch checked={store.animateReverse} onCheckedChange={store.setAnimateReverse} />
                </ToolPanelRow>
              </div>
            ) : null}
          </div>
        </ToolPanelDisclosure>

        {/* Effects — collapsed */}
        <ToolPanelDisclosure label="Effects">
          <div className="space-y-3">
            <ToolPanelRow label="Bloom">
              <Switch checked={store.bloomEnabled} onCheckedChange={store.setBloomEnabled} />
            </ToolPanelRow>
            {store.bloomEnabled && (
              <>
                <NodeSlider label="Intensity" value={bloomIntensity} min={0} max={5} step={0.1} onChange={setBloomIntensity} />
                <NodeSlider label="Threshold" value={bloomThreshold} min={0} max={1} step={0.01} onChange={setBloomThreshold} />
              </>
            )}
            <ToolPanelRow label="Depth of Field">
              <Switch checked={store.dofEnabled} onCheckedChange={store.setDofEnabled} />
            </ToolPanelRow>
            {store.dofEnabled && (
              <>
                <NodeSlider label="Focus Distance" value={dofFocusDistance} min={0} max={0.1} step={0.001} onChange={setDofFocusDistance} />
                <NodeSlider label="Bokeh Scale" value={dofBokehScale} min={0} max={10} step={0.1} onChange={setDofBokehScale} />
              </>
            )}
            <ToolPanelRow label="Vignette">
              <Switch checked={store.vignetteEnabled} onCheckedChange={store.setVignetteEnabled} />
            </ToolPanelRow>
            {store.vignetteEnabled && (
              <NodeSlider label="Darkness" value={vignetteIntensity} min={0} max={1} step={0.01} onChange={setVignetteIntensity} />
            )}
          </div>
        </ToolPanelDisclosure>

        {/* Shader Post-Processing — collapsed */}
        <ToolPanelDisclosure label="Shader FX">
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
          />
        </ToolPanelDisclosure>
      </ToolPanelContent>

      {/* Sticky bottom — Export */}
      <ExportPanel store={store} videoDuration={videoDuration} setVideoDuration={setVideoDuration} onExport={onExport} />
    </ToolPanel>
  );
});

/* ── Export Panel (collapsible, pinned bottom) ─────────── */

type StoreState = ReturnType<typeof useStudio3DStore.getState>;

const ExportPanel: React.FC<{
  store: StoreState;
  videoDuration: number;
  setVideoDuration: (v: number) => void;
  onExport: () => void;
}> = React.memo(({ store, videoDuration, setVideoDuration, onExport }) => {
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

          <ToolPanelGrid cols={5}>
            {(['png', 'mp4', 'gif', 'glb', 'obj'] as const).map((f) => (
              <ToolPanelChip key={f} active={store.exportFormat === f} onClick={() => store.setExportFormat(f)}>
                {f}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>

          {store.exportFormat !== 'glb' && store.exportFormat !== 'obj' && (
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

          {(store.exportFormat === 'mp4' || store.exportFormat === 'gif') && (
            <div className="space-y-2">
              <NodeSlider label={t('studio3d.export.duration')} value={videoDuration} min={1} max={10} step={0.5} onChange={setVideoDuration} />
              {store.animate !== 'none' && (() => {
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

          <Button onClick={onExport} disabled={store.isExporting} className="w-full bg-white hover:bg-neutral-200 text-black font-medium text-xs h-8">
            {store.isExporting ? t('studio3d.export.exporting') : t('studio3d.export.exportFormat', { format: store.exportFormat.toUpperCase() })}
          </Button>
        </div>
      )}
    </div>
  );
});

/* ── Material Content ────────────────────────────────── */

interface MaterialContentProps {
  store: StoreState;
  metalness: number; setMetalness: (v: number) => void;
  roughness: number; setRoughness: (v: number) => void;
  opacity: number; setOpacity: (v: number) => void;
  textureOpacity: number; setTextureOpacity: (v: number) => void;
}

const MaterialContent: React.FC<MaterialContentProps> = React.memo(({
  store, metalness, setMetalness, roughness, setRoughness, opacity, setOpacity,
  textureOpacity, setTextureOpacity,
}) => {
  const { t } = useTranslation();
  const activeCat = useMemo(
    () => MATERIAL_PRESETS.find((m) => m.id === store.material)?.category ?? 'basic',
    [store.material],
  );

  return (
    <div className="space-y-4">
      <MaterialCategoryTabs activeCat={activeCat} store={store} />

      {/* Color */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-white/10 shrink-0" style={{ backgroundColor: store.color }} />
          <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-1">
            <span className="text-[10px] text-neutral-500 mr-1">#</span>
            <input
              type="text"
              value={store.color.replace('#', '').toUpperCase()}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setColor(`#${v}`); }}
              onBlur={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setColor(`#${v}`); }}
              maxLength={6}
              className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
              placeholder="00E5FF"
            />
          </div>
        </div>
        <div className="custom-color-picker"><HexColorPicker color={store.color} onChange={store.setColor} /></div>
      </div>

      {/* Texture */}
      <TextureControls store={store} textureOpacity={textureOpacity} setTextureOpacity={setTextureOpacity} />

      {/* Properties */}
      <div className="space-y-3">
        <NodeSlider label={t('studio3d.properties.metalness')} value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} />
        <NodeSlider label={t('studio3d.properties.roughness')} value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} />
        <NodeSlider label={t('studio3d.properties.opacity')} value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
        <ToolPanelRow label={t('studio3d.properties.wireframe')}>
          <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} />
        </ToolPanelRow>
      </div>
    </div>
  );
});

const MaterialCategoryTabs: React.FC<{ activeCat: string; store: StoreState }> = React.memo(({ activeCat, store }) => {
  const { t } = useTranslation();
  const [openCat, setOpenCat] = useState(activeCat);

  const handleCat = useCallback((cat: string) => {
    setOpenCat((prev) => (prev === cat ? '' : cat));
  }, []);

  return (
    <div className="space-y-1.5">
      <ToolPanelGrid cols={3}>
        {MATERIAL_CATEGORIES.map((cat) => (
          <ToolPanelChip key={cat} active={openCat === cat} onClick={() => handleCat(cat)}>
            {t(`studio3d.material.categories.${cat}`)}
          </ToolPanelChip>
        ))}
      </ToolPanelGrid>
      {openCat && (
        <ToolPanelGrid cols={3}>
          {MATERIAL_PRESETS.filter((m) => m.category === openCat).map((m) => (
            <ToolPanelChip key={m.id} active={store.material === m.id} onClick={() => store.setMaterial(m.id)}>
              <span className="flex flex-col items-center gap-1">
                <span className={cn('w-5 h-5 rounded-full border flex-shrink-0', store.material === m.id ? 'border-white/40' : 'border-white/10')} style={{ backgroundColor: m.color || '#666' }} />
                <span className="text-[8px] uppercase tracking-wider leading-tight text-center truncate w-full">{m.label}</span>
              </span>
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
      )}
    </div>
  );
});

/* ── Procedural textures ──────────────────────────────── */

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return { canvas: c, ctx: c.getContext('2d')! };
}

function perlinNoise(ctx: CanvasRenderingContext2D, size: number, scale: number, intensity: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / scale, ny = y / scale;
      const v1 = Math.sin(nx * 1.2 + ny * 0.8) * 0.5;
      const v2 = Math.sin(nx * 2.5 - ny * 1.7) * 0.25;
      const v3 = Math.sin(nx * 5.1 + ny * 4.3) * 0.125;
      const fine = (Math.random() - 0.5) * 0.3;
      const n = (v1 + v2 + v3 + fine) * intensity;
      const base = d[i];
      const v = Math.max(0, Math.min(255, base + n * 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function generateGrainTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 80, 0.6);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const fine = (Math.random() - 0.5) * 40;
    d[i] = Math.max(0, Math.min(255, d[i] + fine));
    d[i + 1] = d[i + 2] = d[i];
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function generateScratchTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let layer = 0; layer < 3; layer++) {
    const count = [400, 200, 80][layer];
    const alpha = [0.12, 0.2, 0.35][layer];
    const width = [0.3, 0.6, 1.0][layer];
    const maxLen = [40, 80, 120][layer];
    ctx.lineWidth = width;
    for (let i = 0; i < count; i++) {
      const bright = 128 + (Math.random() - 0.5) * 80;
      ctx.strokeStyle = `rgba(${bright},${bright},${bright},${alpha})`;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 5 + Math.random() * maxLen;
      const angle = (Math.random() - 0.5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segments = 3 + Math.floor(Math.random() * 4);
      let cx = x, cy = y;
      for (let s = 0; s < segments; s++) {
        const drift = (Math.random() - 0.5) * 4;
        cx += Math.cos(angle) * (len / segments);
        cy += Math.sin(angle) * (len / segments) + drift;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  return canvas.toDataURL('image/png');
}

function generateNoiseTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 40, 1.0);
  return canvas.toDataURL('image/png');
}

function generateStuccoTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 60, 0.8);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    const bright = 100 + Math.random() * 60;
    ctx.fillStyle = `rgba(${bright},${bright},${bright},0.15)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}

const PROCEDURAL_TEXTURES = [
  { id: 'grain', label: 'Grain', generate: generateGrainTexture },
  { id: 'scratch', label: 'Scratch', generate: generateScratchTexture },
  { id: 'noise', label: 'Noise', generate: generateNoiseTexture },
  { id: 'stucco', label: 'Stucco', generate: generateStuccoTexture },
] as const;

/* ── Texture Controls ─────────────────────────────────── */

const TextureControls: React.FC<{
  store: StoreState;
  textureOpacity: number;
  setTextureOpacity: (v: number) => void;
}> = React.memo(({ store, textureOpacity, setTextureOpacity }) => {
  const { t } = useTranslation();
  const textureInputRef = useRef<HTMLInputElement>(null);
  const [activeProc, setActiveProc] = useState<string | null>(null);

  const handleTextureUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    store.setTexture(url);
    setActiveProc(null);
    e.target.value = '';
  }, [store]);

  const applyProcedural = useCallback((pt: typeof PROCEDURAL_TEXTURES[number]) => {
    store.setTexture(pt.generate());
    setActiveProc(pt.id);
  }, [store]);

  const hasTexture = !!store.texture;

  return (
    <div className="space-y-2">
      <ToolPanelGrid>
        {PROCEDURAL_TEXTURES.map((pt) => (
          <ToolPanelChip key={pt.id} active={activeProc === pt.id} onClick={() => applyProcedural(pt)}>
            {pt.label}
          </ToolPanelChip>
        ))}
      </ToolPanelGrid>
      <button onClick={() => textureInputRef.current?.click()} className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10">
        {t('studio3d.texture.upload')}
      </button>
      <input ref={textureInputRef} type="file" accept="image/*" onChange={handleTextureUpload} className="hidden" />
      {hasTexture && (
        <div className="pt-2 space-y-3">
          <NodeSlider label={t('studio3d.texture.opacity')} value={textureOpacity} min={0} max={1} step={0.01} onChange={setTextureOpacity} />
          <NodeSlider label={t('studio3d.texture.repeat')} value={store.textureRepeat} min={0.5} max={10} step={0.5} onChange={store.setTextureRepeat} />
          {activeProc && (
            <button onClick={() => applyProcedural(PROCEDURAL_TEXTURES.find(p => p.id === activeProc)!)} className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors">
              {t('studio3d.texture.regenerate')}
            </button>
          )}
          <button onClick={() => { store.setTexture(''); setActiveProc(null); }} className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors">
            {t('studio3d.texture.remove')}
          </button>
        </div>
      )}
    </div>
  );
});
