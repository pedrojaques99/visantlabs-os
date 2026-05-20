import { create } from 'zustand';
import { temporal } from 'zundo';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';

type MaterialPreset = 'default' | 'plastic' | 'metal' | 'glass' | 'rubber' | 'chrome' | 'gold' | 'clay' | 'emissive' | 'holographic' | 'brushedSteel' | 'aluminum' | 'copper' | 'roseGold' | 'platinum' | 'ceramic' | 'marble' | 'concrete' | 'wood' | 'velvet' | 'leather' | 'frostedGlass' | 'diamond' | 'pearl' | 'carbonFiber' | 'carPaint' | 'ice' | 'obsidian' | 'wax' | 'mattePaint';

type AnimationType = 'none' | 'spin' | 'float' | 'pulse' | 'wobble' | 'spinFloat' | 'swing' | 'physicsFall';
type ExportFormat = 'png' | 'mp4' | 'gif' | 'glb' | 'obj';
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:5';

interface ScenePreset {
  label: string;
  material: MaterialPreset;
  color: string;
  depth: number;
  roughness: number;
  metalness: number;
  animate: AnimationType;
  background: string;
  lightIntensity: number;
  ambientIntensity: number;
  environment: string;
}

export const SCENE_PRESETS: Record<string, ScenePreset> = {
  'Product Shot': {
    label: 'Product Shot',
    material: 'plastic',
    color: '#ffffff',
    depth: 3,
    roughness: 0.3,
    metalness: 0.1,
    animate: 'spin',
    background: '#0a0a0a',
    lightIntensity: 1.2,
    ambientIntensity: 0.5,
    environment: 'studio',
  },
  'Hero Banner': {
    label: 'Hero Banner',
    material: 'chrome',
    color: '#00e5ff',
    depth: 4,
    roughness: 0.1,
    metalness: 0.9,
    animate: 'float',
    background: '#050510',
    lightIntensity: 1.5,
    ambientIntensity: 0.3,
    environment: 'city',
  },
  'Social Media': {
    label: 'Social Media',
    material: 'gold',
    color: '#ffd700',
    depth: 2.5,
    roughness: 0.2,
    metalness: 0.8,
    animate: 'spinFloat',
    background: '#0d0d0d',
    lightIntensity: 1.3,
    ambientIntensity: 0.4,
    environment: 'sunset',
  },
  'Dark Studio': {
    label: 'Dark Studio',
    material: 'glass',
    color: '#8b5cf6',
    depth: 3,
    roughness: 0.05,
    metalness: 0.1,
    animate: 'wobble',
    background: '#000000',
    lightIntensity: 0.8,
    ambientIntensity: 0.2,
    environment: 'night',
  },
  'Neon': {
    label: 'Neon',
    material: 'emissive',
    color: '#ff00ff',
    depth: 2,
    roughness: 0.1,
    metalness: 0.3,
    animate: 'pulse',
    background: '#050005',
    lightIntensity: 0.6,
    ambientIntensity: 0.15,
    environment: 'night',
  },
  'Clay Render': {
    label: 'Clay Render',
    material: 'clay',
    color: '#e8ddd3',
    depth: 3.5,
    roughness: 0.9,
    metalness: 0,
    animate: 'spin',
    background: '#f5f0eb',
    lightIntensity: 1.4,
    ambientIntensity: 0.6,
    environment: 'studio',
  },
};

export const ENVIRONMENT_PRESETS = [
  { id: 'studio', label: 'Studio' },
  { id: 'city', label: 'City' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'night', label: 'Night' },
  { id: 'forest', label: 'Forest' },
  { id: 'apartment', label: 'Apartment' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'park', label: 'Park' },
  { id: 'lobby', label: 'Lobby' },
] as const;

export interface MaterialPresetDef {
  id: MaterialPreset;
  label: string;
  category: 'basic' | 'metals' | 'surfaces' | 'glass' | 'special';
  color?: string;
}

export const MATERIAL_PRESETS: MaterialPresetDef[] = [
  // Basic
  { id: 'default', label: 'Default', category: 'basic' },
  { id: 'plastic', label: 'Plastic', category: 'basic' },
  { id: 'clay', label: 'Clay', category: 'basic', color: '#e8ddd3' },
  { id: 'emissive', label: 'Emissive', category: 'basic' },
  // Metals
  { id: 'chrome', label: 'Chrome', category: 'metals', color: '#cccccc' },
  { id: 'brushedSteel', label: 'Brushed Steel', category: 'metals', color: '#c0c0c0' },
  { id: 'gold', label: 'Gold', category: 'metals', color: '#ffd891' },
  { id: 'roseGold', label: 'Rose Gold', category: 'metals', color: '#e8a090' },
  { id: 'copper', label: 'Copper', category: 'metals', color: '#f7bc9e' },
  // Surfaces
  { id: 'marble', label: 'Marble', category: 'surfaces', color: '#e8e0d8' },
  { id: 'wood', label: 'Wood', category: 'surfaces', color: '#8b6a4a' },
  { id: 'leather', label: 'Leather', category: 'surfaces', color: '#6b4226' },
  { id: 'carbonFiber', label: 'Carbon Fiber', category: 'surfaces', color: '#222222' },
  { id: 'carPaint', label: 'Car Paint', category: 'surfaces' },
  // Glass & Gem
  { id: 'glass', label: 'Glass', category: 'glass' },
  { id: 'frostedGlass', label: 'Frosted', category: 'glass' },
  { id: 'diamond', label: 'Diamond', category: 'glass', color: '#ffffff' },
  // Special
  { id: 'pearl', label: 'Pearl', category: 'special', color: '#fef0e0' },
  { id: 'obsidian', label: 'Obsidian', category: 'special', color: '#1a1a1a' },
  { id: 'holographic', label: 'Holo', category: 'special' },
];

export const ANIMATION_PRESETS: { id: AnimationType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'spin', label: 'Spin' },
  { id: 'float', label: 'Float' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'wobble', label: 'Wobble' },
  { id: 'swing', label: 'Swing' },
  { id: 'spinFloat', label: 'Spin + Float' },
  { id: 'physicsFall', label: 'Physics Fall' },
];

export const ASPECT_RATIOS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  '1:1': { w: 1080, h: 1080, label: '1:1' },
  '16:9': { w: 1920, h: 1080, label: '16:9' },
  '9:16': { w: 1080, h: 1920, label: '9:16' },
  '4:5': { w: 1080, h: 1350, label: '4:5' },
};

export const EXPORT_RESOLUTIONS = [
  { id: 'hd', label: 'HD', scale: 1 },
  { id: '2k', label: '2K', scale: 2 },
  { id: '4k', label: '4K', scale: 4 },
] as const;

export const TEXTURE_PRESETS = [
  { id: 'none', label: 'None', url: '' },
] as const;

interface Studio3DState {
  // Input
  svgData: string;
  inputMode: 'svg' | 'text';
  text: string;
  font: string;
  fileName: string;

  // Geometry
  shapeType: 'standard' | 'coin';
  depth: number;
  smoothness: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;

  // Material
  material: MaterialPreset;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  wireframe: boolean;

  // Texture
  texture: string;
  textureRepeat: number;
  textureRotation: number;
  textureOpacity: number;

  // Lighting
  lightPosition: [number, number, number];
  lightIntensity: number;
  ambientIntensity: number;
  fillLightIntensity: number;
  bounceLightIntensity: number;
  pointLightIntensity: number;
  shadow: boolean;
  showGrid: boolean;

  // Environment
  environment: string;
  customHdriUrl: string;
  background: string;
  bgType: 'solid' | 'linear' | 'radial';
  bgGradient: { color1: string; color2: string; angle: number };
  transparentBg: boolean;

  // Post-processing effects
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  dofEnabled: boolean;
  dofFocusDistance: number;
  dofBokehScale: number;
  vignetteEnabled: boolean;
  vignetteIntensity: number;

  // Animation
  animate: AnimationType;
  animateSpeed: number;
  animateReverse: boolean;
  animateEasing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

  // Physics falling simulation settings
  physicsCount: number;
  physicsGravity: number;
  physicsBounciness: number;
  physicsFriction: number;
  physicsSize: number;

  // Camera
  rotationX: number;
  rotationY: number;
  zoom: number;
  _cameraControlsRef: { current: any } | null;
  _cameraInfo: { polar: number; azimuth: number; distance: number; view: string | null } | null;

  // Export
  exportFormat: ExportFormat;
  aspectRatio: AspectRatio;
  exportResolution: 'hd' | '2k' | '4k';
  videoDuration: number;
  isExporting: boolean;

  // UI
  panelVisible: boolean;
  activeTab: 'geometry' | 'material' | 'scene' | 'animation' | 'shader' | 'export';
  isLoading: boolean;
  resetKey: number;

  // Actions
  setSvgData: (svg: string, fileName?: string) => void;
  setText: (text: string) => void;
  setFont: (font: string) => void;
  setInputMode: (mode: 'svg' | 'text') => void;
  setShapeType: (v: 'standard' | 'coin') => void;
  setDepth: (v: number) => void;
  setSmoothness: (v: number) => void;
  setBevelEnabled: (v: boolean) => void;
  setBevelThickness: (v: number) => void;
  setBevelSize: (v: number) => void;
  setMaterial: (m: MaterialPreset) => void;
  setColor: (c: string) => void;
  setMetalness: (v: number) => void;
  setRoughness: (v: number) => void;
  setOpacity: (v: number) => void;
  setWireframe: (v: boolean) => void;
  setTexture: (url: string) => void;
  setTextureRepeat: (v: number) => void;
  setTextureRotation: (v: number) => void;
  setTextureOpacity: (v: number) => void;
  setLightPosition: (p: [number, number, number]) => void;
  setLightIntensity: (v: number) => void;
  setAmbientIntensity: (v: number) => void;
  setFillLightIntensity: (v: number) => void;
  setBounceLightIntensity: (v: number) => void;
  setPointLightIntensity: (v: number) => void;
  setShadow: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setEnvironment: (e: string) => void;
  setCustomHdriUrl: (url: string) => void;
  setBackground: (c: string) => void;
  setBgType: (type: 'solid' | 'linear' | 'radial') => void;
  setBgGradient: (g: Partial<{ color1: string; color2: string; angle: number }>) => void;
  setTransparentBg: (v: boolean) => void;
  setBloomEnabled: (v: boolean) => void;
  setBloomIntensity: (v: number) => void;
  setBloomThreshold: (v: number) => void;
  setDofEnabled: (v: boolean) => void;
  setDofFocusDistance: (v: number) => void;
  setDofBokehScale: (v: number) => void;
  setVignetteEnabled: (v: boolean) => void;
  setVignetteIntensity: (v: number) => void;
  setAnimate: (a: AnimationType) => void;
  setAnimateSpeed: (v: number) => void;
  setAnimateReverse: (v: boolean) => void;
  setAnimateEasing: (v: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut') => void;
  setPhysicsCount: (v: number) => void;
  setPhysicsGravity: (v: number) => void;
  setPhysicsBounciness: (v: number) => void;
  setPhysicsFriction: (v: number) => void;
  setPhysicsSize: (v: number) => void;
  setRotationX: (v: number) => void;
  setRotationY: (v: number) => void;
  setZoom: (v: number) => void;
  setExportFormat: (f: ExportFormat) => void;
  setAspectRatio: (r: AspectRatio) => void;
  setExportResolution: (r: 'hd' | '2k' | '4k') => void;
  setVideoDuration: (d: number) => void;
  setIsExporting: (v: boolean) => void;
  setPanelVisible: (v: boolean) => void;
  setActiveTab: (t: Studio3DState['activeTab']) => void;
  setIsLoading: (v: boolean) => void;
  applyScenePreset: (name: string) => void;
  applyConfig: (config: Partial<typeof INITIAL_STATE>) => void;
  resetScene: () => void;
}

const INITIAL_STATE = {
  svgData: '',
  inputMode: 'svg' as const,
  text: '',
  font: 'DM Sans',
  fileName: '',
  shapeType: 'standard' as const,
  depth: 0.9,
  smoothness: 0.2,
  bevelEnabled: true,
  bevelThickness: 0.5,
  bevelSize: 0.5,
  material: 'default' as MaterialPreset,
  color: '#00e5ff',
  metalness: 0.5,
  roughness: 0.5,
  opacity: 1,
  wireframe: false,
  texture: '',
  textureRepeat: 1,
  textureRotation: 0,
  textureOpacity: 1,
  lightPosition: [5, 5, 5] as [number, number, number],
  lightIntensity: 1,
  ambientIntensity: 0.4,
  fillLightIntensity: 0.4,
  bounceLightIntensity: 0.2,
  pointLightIntensity: 0.3,
  shadow: true,
  showGrid: false,
  environment: 'studio',
  customHdriUrl: '',
  background: '#0a0a0a',
  bgType: 'solid' as const,
  bgGradient: { color1: '#0a0a0a', color2: '#1a1a2e', angle: 45 },
  transparentBg: false,
  bloomEnabled: false,
  bloomIntensity: 1,
  bloomThreshold: 0.9,
  dofEnabled: false,
  dofFocusDistance: 0.02,
  dofBokehScale: 3,
  vignetteEnabled: false,
  vignetteIntensity: 0.5,
  animate: 'spin' as AnimationType,
  animateSpeed: 0.3,
  animateReverse: false,
  animateEasing: 'linear' as const,
  physicsCount: 25,
  physicsGravity: 9.8,
  physicsBounciness: 0.6,
  physicsFriction: 0.1,
  physicsSize: 0.8,
  rotationX: 0,
  rotationY: 0,
  zoom: 8,
  _cameraControlsRef: null as { current: any } | null,
  _cameraInfo: null as { polar: number; azimuth: number; distance: number; view: string | null } | null,
  exportFormat: 'png' as ExportFormat,
  aspectRatio: '1:1' as AspectRatio,
  exportResolution: '2k' as const,
  videoDuration: 3,
  isExporting: false,
  panelVisible: true,
  activeTab: 'geometry' as const,
  isLoading: false,
  resetKey: 0,
};

export const useStudio3DStore = create<Studio3DState & ShaderSlice>()(
  temporal(
  (set, get, api) => ({
  ...createShaderSlice(set as any, get as any, api as any),
  ...INITIAL_STATE,

  setSvgData: (svg: string, fileName?: string) => set({ svgData: svg, fileName: fileName || '', inputMode: 'svg' }),
  setText: (text) => set({ text }),
  setFont: (font) => set({ font }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setShapeType: (shapeType) => set({ shapeType }),
  setDepth: (depth) => set({ depth }),
  setSmoothness: (smoothness) => set({ smoothness }),
  setBevelEnabled: (bevelEnabled) => set({ bevelEnabled }),
  setBevelThickness: (bevelThickness) => set({ bevelThickness }),
  setBevelSize: (bevelSize) => set({ bevelSize }),
  setMaterial: (material) => set({ material }),
  setColor: (color) => set({ color }),
  setMetalness: (metalness) => set({ metalness }),
  setRoughness: (roughness) => set({ roughness }),
  setOpacity: (opacity) => set({ opacity }),
  setWireframe: (wireframe) => set({ wireframe }),
  setTexture: (texture) => set({ texture }),
  setTextureRepeat: (textureRepeat) => set({ textureRepeat }),
  setTextureRotation: (textureRotation) => set({ textureRotation }),
  setTextureOpacity: (textureOpacity) => set({ textureOpacity }),
  setLightPosition: (lightPosition) => set({ lightPosition }),
  setLightIntensity: (lightIntensity) => set({ lightIntensity }),
  setAmbientIntensity: (ambientIntensity) => set({ ambientIntensity }),
  setFillLightIntensity: (fillLightIntensity) => set({ fillLightIntensity }),
  setBounceLightIntensity: (bounceLightIntensity) => set({ bounceLightIntensity }),
  setPointLightIntensity: (pointLightIntensity) => set({ pointLightIntensity }),
  setShadow: (shadow) => set({ shadow }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setEnvironment: (environment) => set({ environment, customHdriUrl: '' }),
  setCustomHdriUrl: (customHdriUrl) => set({ customHdriUrl, environment: '' }),
  setBackground: (background) => set({ background }),
  setBgType: (bgType) => set({ bgType }),
  setBgGradient: (g) => set((s) => ({ bgGradient: { ...s.bgGradient, ...g } })),
  setTransparentBg: (transparentBg) => set({ transparentBg }),
  setBloomEnabled: (bloomEnabled) => set({ bloomEnabled }),
  setBloomIntensity: (bloomIntensity) => set({ bloomIntensity }),
  setBloomThreshold: (bloomThreshold) => set({ bloomThreshold }),
  setDofEnabled: (dofEnabled) => set({ dofEnabled }),
  setDofFocusDistance: (dofFocusDistance) => set({ dofFocusDistance }),
  setDofBokehScale: (dofBokehScale) => set({ dofBokehScale }),
  setVignetteEnabled: (vignetteEnabled) => set({ vignetteEnabled }),
  setVignetteIntensity: (vignetteIntensity) => set({ vignetteIntensity }),
  setAnimate: (animate) => set({ animate }),
  setAnimateSpeed: (animateSpeed) => set({ animateSpeed }),
  setAnimateReverse: (animateReverse) => set({ animateReverse }),
  setAnimateEasing: (animateEasing) => set({ animateEasing }),
  setPhysicsCount: (physicsCount) => set({ physicsCount }),
  setPhysicsGravity: (physicsGravity) => set({ physicsGravity }),
  setPhysicsBounciness: (physicsBounciness) => set({ physicsBounciness }),
  setPhysicsFriction: (physicsFriction) => set({ physicsFriction }),
  setPhysicsSize: (physicsSize) => set({ physicsSize }),
  setRotationX: (rotationX) => set({ rotationX }),
  setRotationY: (rotationY) => set({ rotationY }),
  setZoom: (zoom) => set({ zoom }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setExportResolution: (exportResolution) => set({ exportResolution }),
  setVideoDuration: (videoDuration) => set({ videoDuration }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsLoading: (isLoading) => set({ isLoading }),

  applyScenePreset: (name) => {
    const preset = SCENE_PRESETS[name];
    if (!preset) return;
    set({
      material: preset.material,
      color: preset.color,
      roughness: preset.roughness,
      metalness: preset.metalness,
      animate: preset.animate,
      background: preset.background,
      lightIntensity: preset.lightIntensity,
      ambientIntensity: preset.ambientIntensity,
      environment: preset.environment,
      resetKey: Date.now(),
    });
  },

  applyConfig: (config) => {
    const allowed = new Set(Object.keys(INITIAL_STATE));
    const patch: Record<string, any> = { resetKey: Date.now() };
    for (const [k, v] of Object.entries(config)) {
      if (allowed.has(k) && v !== undefined) patch[k] = v;
    }
    set(patch as any);
  },

  resetScene: () => {
    const { _cameraControlsRef } = get();
    set({ ...INITIAL_STATE, _cameraControlsRef, resetKey: Date.now(), shaderEnabled: false, shaderType: 'halftone' as any, shaderValues: {} });
  },
}),
  {
    partialize: (state) => {
      const { _cameraControlsRef, _cameraInfo, panelVisible, activeTab, isLoading, isExporting, resetKey, ...tracked } = state;
      return tracked;
    },
    limit: 50,
  },
));

// Scene save/load (localStorage)
const SCENES_KEY = 'visant-3d-scenes';

export interface SavedScene {
  id: string;
  name: string;
  savedAt: number;
  config: Record<string, any>;
}

export function getSavedScenes(): SavedScene[] {
  try {
    return JSON.parse(localStorage.getItem(SCENES_KEY) || '[]');
  } catch { return []; }
}

export function saveScene(name: string): SavedScene {
  const state = useStudio3DStore.getState();
  const exclude = new Set(['_cameraControlsRef', '_cameraInfo', 'panelVisible', 'activeTab', 'isLoading', 'isExporting', 'resetKey']);
  const config: Record<string, any> = {};
  for (const [k, v] of Object.entries(INITIAL_STATE)) {
    if (!exclude.has(k)) config[k] = (state as any)[k] ?? v;
  }
  config.shaderEnabled = state.shaderEnabled;
  config.shaderType = state.shaderType;
  config.shaderValues = state.shaderValues;

  const scene: SavedScene = { id: crypto.randomUUID(), name, savedAt: Date.now(), config };
  const scenes = getSavedScenes();
  scenes.unshift(scene);
  if (scenes.length > 50) scenes.length = 50;
  localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
  return scene;
}

export function loadScene(id: string) {
  const scene = getSavedScenes().find(s => s.id === id);
  if (!scene) return false;
  useStudio3DStore.getState().applyConfig(scene.config as any);
  if (scene.config.shaderEnabled !== undefined) {
    useStudio3DStore.setState({
      shaderEnabled: scene.config.shaderEnabled,
      shaderType: scene.config.shaderType,
      shaderValues: scene.config.shaderValues || {},
    });
  }
  return true;
}

export function deleteScene(id: string) {
  const scenes = getSavedScenes().filter(s => s.id !== id);
  localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
}
