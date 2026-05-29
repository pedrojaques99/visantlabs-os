import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';
import { materialPresets } from '@/components/3d-studio/engine/materials';
import { authService } from '@/services/authService';

type MaterialPreset =
  | 'default'
  | 'plastic'
  | 'metal'
  | 'glass'
  | 'rubber'
  | 'chrome'
  | 'gold'
  | 'clay'
  | 'emissive'
  | 'holographic'
  | 'brushedSteel'
  | 'aluminum'
  | 'copper'
  | 'roseGold'
  | 'platinum'
  | 'ceramic'
  | 'marble'
  | 'concrete'
  | 'wood'
  | 'velvet'
  | 'leather'
  | 'frostedGlass'
  | 'diamond'
  | 'pearl'
  | 'carbonFiber'
  | 'carPaint'
  | 'ice'
  | 'obsidian'
  | 'wax'
  | 'mattePaint';

type AnimationType =
  | 'none'
  | 'spin'
  | 'float'
  | 'pulse'
  | 'wobble'
  | 'spinFloat'
  | 'swing'
  | 'physicsFall';
type ToneMappingType = 'ACES' | 'AgX' | 'Neutral' | 'Reinhard' | 'Cineon' | 'Linear';
type ExportFormat = 'png' | 'webm' | 'glb' | 'obj' | 'turntable';
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
  Neon: {
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
  'Chrome Badge': {
    label: 'Chrome Badge',
    material: 'carPaint',
    color: '#f2a0b8',
    depth: 2.5,
    roughness: 0.15,
    metalness: 0.05,
    animate: 'none',
    background: '#f5dde3',
    lightIntensity: 1.6,
    ambientIntensity: 0.5,
    environment: 'studio',
  },
};

export const LIGHTING_PRESETS: Record<string, { label: string; values: Record<string, any> }> = {
  '3-Point Studio': {
    label: '3-Point Studio',
    values: {
      lightIntensity: 1.2,
      lightPosition: [5, 5, 5] as [number, number, number],
      fillLightIntensity: 0.5,
      fillLightPosition: [-5, 3, -3] as [number, number, number],
      bounceLightIntensity: 0.2,
      bounceLightPosition: [0, -4, 6] as [number, number, number],
      pointLightIntensity: 0.3,
      pointLightPosition: [0, 5, 0] as [number, number, number],
      ambientIntensity: 0.4,
    },
  },
  'Rim Light': {
    label: 'Rim Light',
    values: {
      lightIntensity: 0.3,
      lightPosition: [0, 2, -5] as [number, number, number],
      fillLightIntensity: 0.1,
      fillLightPosition: [-4, 1, -4] as [number, number, number],
      bounceLightIntensity: 1.2,
      bounceLightPosition: [0, 0, -6] as [number, number, number],
      pointLightIntensity: 0.8,
      pointLightPosition: [4, 1, -4] as [number, number, number],
      ambientIntensity: 0.15,
    },
  },
  Dramatic: {
    label: 'Dramatic',
    values: {
      lightIntensity: 2.0,
      lightPosition: [8, 8, 2] as [number, number, number],
      fillLightIntensity: 0.05,
      fillLightPosition: [-5, 0, -3] as [number, number, number],
      bounceLightIntensity: 0.0,
      bounceLightPosition: [0, -4, 6] as [number, number, number],
      pointLightIntensity: 0.0,
      pointLightPosition: [0, 5, 0] as [number, number, number],
      ambientIntensity: 0.05,
    },
  },
  Flat: {
    label: 'Flat',
    values: {
      lightIntensity: 0.6,
      lightPosition: [0, 5, 5] as [number, number, number],
      fillLightIntensity: 0.6,
      fillLightPosition: [-5, 3, -3] as [number, number, number],
      bounceLightIntensity: 0.6,
      bounceLightPosition: [5, -2, 3] as [number, number, number],
      pointLightIntensity: 0.4,
      pointLightPosition: [0, 5, 0] as [number, number, number],
      ambientIntensity: 0.8,
    },
  },
  Cinematic: {
    label: 'Cinematic',
    values: {
      lightIntensity: 1.5,
      lightPosition: [6, 4, 3] as [number, number, number],
      fillLightIntensity: 0.3,
      fillLightPosition: [-6, 2, -2] as [number, number, number],
      bounceLightIntensity: 0.1,
      bounceLightPosition: [0, -3, 5] as [number, number, number],
      pointLightIntensity: 0.6,
      pointLightPosition: [-2, 6, -1] as [number, number, number],
      ambientIntensity: 0.2,
    },
  },
};

const R2_HDRI_BASE = 'https://pub-0acbd500af3b4beaa8b93b07f6490d58.r2.dev/hdri';

export type { ToneMappingType };
export const TONE_MAPPING_OPTIONS: { id: ToneMappingType; label: string }[] = [
  { id: 'ACES', label: 'ACES Filmic' },
  { id: 'AgX', label: 'AgX' },
  { id: 'Neutral', label: 'Neutral' },
  { id: 'Reinhard', label: 'Reinhard' },
  { id: 'Cineon', label: 'Cineon' },
  { id: 'Linear', label: 'Linear' },
];

export const ENVIRONMENT_PRESETS = [
  { id: 'studio', label: 'Studio', file: `${R2_HDRI_BASE}/studio_small_03_1k.hdr` },
  { id: 'city', label: 'City', file: `${R2_HDRI_BASE}/potsdamer_platz_1k.hdr` },
  { id: 'sunset', label: 'Sunset', file: `${R2_HDRI_BASE}/venice_sunset_1k.hdr` },
  { id: 'dawn', label: 'Dawn', file: `${R2_HDRI_BASE}/kiara_1_dawn_1k.hdr` },
  { id: 'night', label: 'Night', file: `${R2_HDRI_BASE}/dikhololo_night_1k.hdr` },
  { id: 'forest', label: 'Forest', file: `${R2_HDRI_BASE}/forest_slope_1k.hdr` },
  { id: 'apartment', label: 'Apartment', file: `${R2_HDRI_BASE}/lebombo_1k.hdr` },
  { id: 'warehouse', label: 'Warehouse', file: `${R2_HDRI_BASE}/empty_warehouse_01_1k.hdr` },
  { id: 'park', label: 'Park', file: `${R2_HDRI_BASE}/rooitou_park_1k.hdr` },
  { id: 'lobby', label: 'Lobby', file: `${R2_HDRI_BASE}/st_fagans_interior_1k.hdr` },
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

export const TEXTURE_PRESETS = [{ id: 'none', label: 'None', url: '' }] as const;

export const RENDER_QUALITY_CONFIG = {
  performance: { dpr: 1, msaa: 0, shadowRes: 256 },
  balanced: { dpr: 1.5, msaa: 2, shadowRes: 512 },
  quality: { dpr: 2, msaa: 4, shadowRes: 1024 },
} as const;

interface Studio3DState {
  // Input
  svgData: string;
  inputMode: 'svg' | 'text' | 'model';
  text: string;
  font: string;
  fileName: string;
  modelUrl: string;
  traceTurdSize: number;
  traceOptTolerance: number;
  traceThreshold: number;
  shapeColor: string;

  // Geometry
  shapeType: 'standard' | 'coin' | 'badge' | 'stamp' | 'shield' | 'hexagon';

  depth: number;
  smoothness: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  objectScale: number;

  // Shape-specific params
  coinRadius: number;
  badgeWidth: number;
  badgeHeight: number;
  badgeRadius: number;
  stampRadius: number;
  stampTeeth: number;
  stampToothDepth: number;
  shieldWidth: number;
  shieldHeight: number;
  hexRadius: number;
  chainLinks: number;
  chainScale: number;
  showChain: boolean;
  bailSize: number;
  bailOffset: number;
  chainOffset: number;
  chainColor: string;
  reliefDepth: number;

  // Performance
  renderQuality: 'performance' | 'balanced' | 'quality';

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
  fillLightPosition: [number, number, number];
  bounceLightIntensity: number;
  bounceLightPosition: [number, number, number];
  pointLightIntensity: number;
  pointLightPosition: [number, number, number];
  shadow: boolean;
  shadowQuality: 'low' | 'medium' | 'high';
  showGrid: boolean;
  groundPlane: boolean;
  groundReflection: number;

  // Environment
  environment: string;
  customHdriUrl: string;
  hdriBackground: boolean;
  hdriBlur: number;
  hdriIntensity: number;
  hdriRotation: number;
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  background: string;
  bgType: 'solid' | 'linear' | 'radial' | 'image';
  bgGradient: { color1: string; color2: string; angle: number };
  backgroundImageUrl: string;
  transparentBg: boolean;

  // Tone mapping
  toneMapping: ToneMappingType;
  toneMappingExposure: number;

  // Post-processing effects
  effectsBypass: boolean;
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  dofEnabled: boolean;
  dofFocusDistance: number;
  dofBokehScale: number;
  vignetteEnabled: boolean;
  vignetteIntensity: number;
  ssaoEnabled: boolean;
  ssaoIntensity: number;
  chromaticAberrationEnabled: boolean;
  chromaticAberrationOffset: number;
  noiseEnabled: boolean;
  noiseOpacity: number;
  colorGradingEnabled: boolean;
  cgBrightness: number;
  cgContrast: number;
  cgHue: number;
  cgSaturation: number;

  // PBR texture maps
  normalMapUrl: string;
  roughnessMapUrl: string;
  metalnessMapUrl: string;

  // Camera mode
  orthographic: boolean;

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
  fov: number;
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
  videoFps: number;
  isExporting: boolean;
  exportProgress: number;

  // UI
  panelVisible: boolean;
  activeTab: 'geometry' | 'material' | 'scene' | 'animation' | 'shader' | 'export';
  showStats: boolean;
  isLoading: boolean;
  resetKey: number;

  // Scene persistence metadata (excluded from undo history)
  _sceneName: string;
  _lastSavedAt: number;

  // Actions
  setSvgData: (svg: string, fileName?: string) => void;
  setText: (text: string) => void;
  setFont: (font: string) => void;
  setInputMode: (mode: 'svg' | 'text' | 'model') => void;
  setModelUrl: (url: string, fileName?: string) => void;
  setTraceTurdSize: (v: number) => void;
  setTraceOptTolerance: (v: number) => void;
  setTraceThreshold: (v: number) => void;
  setShapeColor: (v: string) => void;
  setShapeType: (v: 'standard' | 'coin' | 'badge' | 'stamp' | 'shield' | 'hexagon') => void;

  setDepth: (v: number) => void;
  setObjectScale: (v: number) => void;
  setRenderQuality: (v: 'performance' | 'balanced' | 'quality') => void;
  setFov: (v: number) => void;
  setHdriBackground: (v: boolean) => void;
  setHdriBlur: (v: number) => void;
  setHdriIntensity: (v: number) => void;
  setHdriRotation: (v: number) => void;
  setFogEnabled: (v: boolean) => void;
  setFogColor: (v: string) => void;
  setFogNear: (v: number) => void;
  setFogFar: (v: number) => void;
  setSmoothness: (v: number) => void;
  setBevelEnabled: (v: boolean) => void;
  setBevelThickness: (v: number) => void;
  setBevelSize: (v: number) => void;
  setCoinRadius: (v: number) => void;
  setBadgeWidth: (v: number) => void;
  setBadgeHeight: (v: number) => void;
  setBadgeRadius: (v: number) => void;
  setStampRadius: (v: number) => void;
  setStampTeeth: (v: number) => void;
  setStampToothDepth: (v: number) => void;
  setShieldWidth: (v: number) => void;
  setShieldHeight: (v: number) => void;
  setHexRadius: (v: number) => void;
  setChainLinks: (v: number) => void;
  setChainScale: (v: number) => void;
  setBailSize: (v: number) => void;
  setBailOffset: (v: number) => void;
  setChainOffset: (v: number) => void;
  setChainColor: (v: string) => void;
  setShowChain: (v: boolean) => void;
  setReliefDepth: (v: number) => void;
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
  setFillLightPosition: (p: [number, number, number]) => void;
  setBounceLightIntensity: (v: number) => void;
  setBounceLightPosition: (p: [number, number, number]) => void;
  setPointLightIntensity: (v: number) => void;
  setPointLightPosition: (p: [number, number, number]) => void;
  setShadow: (v: boolean) => void;
  setShadowQuality: (v: 'low' | 'medium' | 'high') => void;
  setShowGrid: (v: boolean) => void;
  setGroundPlane: (v: boolean) => void;
  setGroundReflection: (v: number) => void;
  applyLightingPreset: (name: string) => void;
  setEnvironment: (e: string) => void;
  setCustomHdriUrl: (url: string) => void;
  setBackground: (c: string) => void;
  setBgType: (type: 'solid' | 'linear' | 'radial' | 'image') => void;
  setBgGradient: (g: Partial<{ color1: string; color2: string; angle: number }>) => void;
  setBackgroundImageUrl: (url: string) => void;
  setTransparentBg: (v: boolean) => void;
  setToneMapping: (v: ToneMappingType) => void;
  setToneMappingExposure: (v: number) => void;
  setEffectsBypass: (v: boolean) => void;
  setBloomEnabled: (v: boolean) => void;
  setBloomIntensity: (v: number) => void;
  setBloomThreshold: (v: number) => void;
  setDofEnabled: (v: boolean) => void;
  setDofFocusDistance: (v: number) => void;
  setDofBokehScale: (v: number) => void;
  setVignetteEnabled: (v: boolean) => void;
  setVignetteIntensity: (v: number) => void;
  setSsaoEnabled: (v: boolean) => void;
  setSsaoIntensity: (v: number) => void;
  setChromaticAberrationEnabled: (v: boolean) => void;
  setChromaticAberrationOffset: (v: number) => void;
  setNoiseEnabled: (v: boolean) => void;
  setNoiseOpacity: (v: number) => void;
  setColorGradingEnabled: (v: boolean) => void;
  setCgBrightness: (v: number) => void;
  setCgContrast: (v: number) => void;
  setCgHue: (v: number) => void;
  setCgSaturation: (v: number) => void;
  setNormalMapUrl: (v: string) => void;
  setRoughnessMapUrl: (v: string) => void;
  setMetalnessMapUrl: (v: string) => void;
  setOrthographic: (v: boolean) => void;
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
  setVideoFps: (fps: number) => void;
  setIsExporting: (v: boolean) => void;
  setExportProgress: (v: number) => void;
  setPanelVisible: (v: boolean) => void;
  setActiveTab: (t: Studio3DState['activeTab']) => void;
  setShowStats: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  setSceneName: (v: string) => void;
  setLastSavedAt: (v: number) => void;
  applyScenePreset: (name: string) => void;
  applyConfig: (config: Partial<typeof INITIAL_STATE>) => void;
  resetScene: () => void;
  randomize: () => void;
}

const INITIAL_STATE = {
  svgData: '',
  inputMode: 'svg' as const,
  text: '',
  font: 'DM Sans',
  fileName: '',
  modelUrl: '',
  traceTurdSize: 2,
  traceOptTolerance: 0.2,
  traceThreshold: 128,
  shapeColor: '',
  shapeType: 'standard' as const,

  depth: 0.9,
  smoothness: 0.2,
  bevelEnabled: true,
  bevelThickness: 0.5,
  bevelSize: 0.5,
  objectScale: 1,
  coinRadius: 2.2,
  badgeWidth: 3.6,
  badgeHeight: 2.4,
  badgeRadius: 0.4,
  stampRadius: 2.4,
  stampTeeth: 24,
  stampToothDepth: 0.25,
  shieldWidth: 2.2,
  shieldHeight: 2.8,
  hexRadius: 2.4,
  chainLinks: 10,
  chainScale: 1,
  showChain: false,
  bailSize: 0.25,
  bailOffset: 0.1,
  chainOffset: -0.3,
  chainColor: '',
  reliefDepth: 0.3,
  renderQuality: (typeof window !== 'undefined' && window.innerWidth < 768
    ? 'performance'
    : 'balanced') as 'performance' | 'balanced' | 'quality',
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
  fillLightPosition: [-5, 3, -3] as [number, number, number],
  bounceLightIntensity: 0.2,
  bounceLightPosition: [0, -4, 6] as [number, number, number],
  pointLightIntensity: 0.3,
  pointLightPosition: [0, 5, 0] as [number, number, number],
  shadow: true,
  shadowQuality: 'medium' as const,
  showGrid: false,
  groundPlane: false,
  groundReflection: 0.5,
  environment: 'studio',
  customHdriUrl: '',
  hdriBackground: false,
  hdriBlur: 0,
  hdriIntensity: 1,
  hdriRotation: 0,
  fogEnabled: false,
  fogColor: '#000000',
  fogNear: 1,
  fogFar: 15,
  background: '#0a0a0a',
  bgType: 'solid' as const,
  bgGradient: { color1: '#0a0a0a', color2: '#1a1a2e', angle: 45 },
  backgroundImageUrl: '',
  transparentBg: false,
  toneMapping: 'ACES' as ToneMappingType,
  toneMappingExposure: 1.2,
  effectsBypass: false,
  bloomEnabled: false,
  bloomIntensity: 1,
  bloomThreshold: 0.9,
  dofEnabled: false,
  dofFocusDistance: 0.1,
  dofBokehScale: 2,
  vignetteEnabled: false,
  vignetteIntensity: 0.5,
  ssaoEnabled: false,
  ssaoIntensity: 0.5,
  chromaticAberrationEnabled: false,
  chromaticAberrationOffset: 0.002,
  noiseEnabled: false,
  noiseOpacity: 0.15,
  colorGradingEnabled: false,
  cgBrightness: 0,
  cgContrast: 0,
  cgHue: 0,
  cgSaturation: 0,
  normalMapUrl: '',
  roughnessMapUrl: '',
  metalnessMapUrl: '',
  orthographic: false,
  animate: 'spin' as AnimationType,
  animateSpeed: 0.3,
  animateReverse: false,
  animateEasing: 'linear' as const,
  physicsCount: 25,
  physicsGravity: 9.8,
  physicsBounciness: 0.6,
  physicsFriction: 0.1,
  physicsSize: 0.8,
  fov: 50,
  rotationX: 0,
  rotationY: 0,
  zoom: 8,
  _cameraControlsRef: null as { current: any } | null,
  _cameraInfo: null as {
    polar: number;
    azimuth: number;
    distance: number;
    view: string | null;
  } | null,
  exportFormat: 'png' as ExportFormat,
  aspectRatio: '1:1' as AspectRatio,
  exportResolution: '2k' as const,
  videoDuration: 3,
  videoFps: 30,
  isExporting: false,
  exportProgress: 0,
  panelVisible: true,
  activeTab: 'geometry' as const,
  showStats: false,
  isLoading: false,
  resetKey: 0,
  _sceneName: '',
  _lastSavedAt: 0,
};

export const useStudio3DStore = create<Studio3DState & ShaderSlice>()(
  persist(
  temporal(
    (set, get, api) => ({
      ...createShaderSlice(set as any, get as any, api as any),
      ...INITIAL_STATE,

      setSvgData: (svg: string, fileName?: string) =>
        set({ svgData: svg, fileName: fileName || '', inputMode: 'svg' }),
      setText: (text) => set({ text }),
      setFont: (font) => set({ font }),
      setInputMode: (mode) => set({ inputMode: mode as 'svg' | 'text' | 'model' }),
      setModelUrl: (url, fileName) =>
        set({ modelUrl: url, fileName: fileName || '', inputMode: 'model' as const }),
      setTraceTurdSize: (traceTurdSize) => set({ traceTurdSize }),
      setTraceOptTolerance: (traceOptTolerance) => set({ traceOptTolerance }),
      setTraceThreshold: (traceThreshold) => set({ traceThreshold }),
      setShapeColor: (shapeColor) => set({ shapeColor }),
      setShapeType: (shapeType) => set({ shapeType }),

      setDepth: (depth) => set({ depth }),
      setObjectScale: (objectScale) => set({ objectScale }),
      setRenderQuality: (renderQuality) => set({ renderQuality }),
      setFov: (fov) => set({ fov }),
      setHdriBackground: (hdriBackground) => set({ hdriBackground }),
      setHdriBlur: (hdriBlur) => set({ hdriBlur }),
      setHdriIntensity: (hdriIntensity) => set({ hdriIntensity }),
      setHdriRotation: (hdriRotation) => set({ hdriRotation }),
      setFogEnabled: (fogEnabled) => set({ fogEnabled }),
      setFogColor: (fogColor) => set({ fogColor }),
      setFogNear: (fogNear) => set({ fogNear }),
      setFogFar: (fogFar) => set({ fogFar }),
      setSmoothness: (smoothness) => set({ smoothness }),
      setBevelEnabled: (bevelEnabled) => set({ bevelEnabled }),
      setBevelThickness: (bevelThickness) => set({ bevelThickness }),
      setBevelSize: (bevelSize) => set({ bevelSize }),
      setCoinRadius: (coinRadius) => set({ coinRadius }),
      setBadgeWidth: (badgeWidth) => set({ badgeWidth }),
      setBadgeHeight: (badgeHeight) => set({ badgeHeight }),
      setBadgeRadius: (badgeRadius) => set({ badgeRadius }),
      setStampRadius: (stampRadius) => set({ stampRadius }),
      setStampTeeth: (stampTeeth) => set({ stampTeeth }),
      setStampToothDepth: (stampToothDepth) => set({ stampToothDepth }),
      setShieldWidth: (shieldWidth) => set({ shieldWidth }),
      setShieldHeight: (shieldHeight) => set({ shieldHeight }),
      setHexRadius: (hexRadius) => set({ hexRadius }),
      setChainLinks: (chainLinks) => set({ chainLinks }),
      setChainScale: (chainScale) => set({ chainScale }),
      setBailSize: (bailSize) => set({ bailSize }),
      setBailOffset: (bailOffset) => set({ bailOffset }),
      setChainOffset: (chainOffset) => set({ chainOffset }),
      setChainColor: (chainColor) => set({ chainColor }),
      setShowChain: (showChain) => set({ showChain }),
      setReliefDepth: (reliefDepth) => set({ reliefDepth }),
      setMaterial: (material) => {
        const preset = materialPresets[material];
        const presetDef = MATERIAL_PRESETS.find((m) => m.id === material);
        const updates: Partial<Studio3DState> = { material };
        if (presetDef?.color) updates.color = presetDef.color;
        if (preset) {
          updates.metalness = preset.metalness;
          updates.roughness = preset.roughness;
          updates.opacity = preset.opacity;
        }
        set(updates);
      },
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
      setFillLightPosition: (fillLightPosition) => set({ fillLightPosition }),
      setBounceLightIntensity: (bounceLightIntensity) => set({ bounceLightIntensity }),
      setBounceLightPosition: (bounceLightPosition) => set({ bounceLightPosition }),
      setPointLightIntensity: (pointLightIntensity) => set({ pointLightIntensity }),
      setPointLightPosition: (pointLightPosition) => set({ pointLightPosition }),
      setShadow: (shadow) => set({ shadow }),
      setShadowQuality: (shadowQuality) => set({ shadowQuality }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setGroundPlane: (groundPlane) => set({ groundPlane }),
      setGroundReflection: (groundReflection) => set({ groundReflection }),
      applyLightingPreset: (name) => {
        const preset = LIGHTING_PRESETS[name];
        if (!preset) return;
        set(preset.values);
      },
      setEnvironment: (environment) => set({ environment, customHdriUrl: '' }),
      setCustomHdriUrl: (customHdriUrl) => set({ customHdriUrl, environment: '' }),
      setBackground: (background) => set({ background }),
      setBgType: (bgType) => set({ bgType }),
      setBgGradient: (g) => set((s) => ({ bgGradient: { ...s.bgGradient, ...g } })),
      setBackgroundImageUrl: (backgroundImageUrl: string) => set({ backgroundImageUrl }),
      setTransparentBg: (transparentBg) => set({ transparentBg }),
      setToneMapping: (toneMapping) => set({ toneMapping }),
      setToneMappingExposure: (toneMappingExposure) => set({ toneMappingExposure }),
      setEffectsBypass: (effectsBypass) => set({ effectsBypass }),
      setBloomEnabled: (bloomEnabled) => set({ bloomEnabled }),
      setBloomIntensity: (bloomIntensity) => set({ bloomIntensity }),
      setBloomThreshold: (bloomThreshold) => set({ bloomThreshold }),
      setDofEnabled: (dofEnabled) => set({ dofEnabled }),
      setDofFocusDistance: (dofFocusDistance) => set({ dofFocusDistance }),
      setDofBokehScale: (dofBokehScale) => set({ dofBokehScale }),
      setVignetteEnabled: (vignetteEnabled) => set({ vignetteEnabled }),
      setVignetteIntensity: (vignetteIntensity) => set({ vignetteIntensity }),
      setSsaoEnabled: (ssaoEnabled) => set({ ssaoEnabled }),
      setSsaoIntensity: (ssaoIntensity) => set({ ssaoIntensity }),
      setChromaticAberrationEnabled: (chromaticAberrationEnabled) =>
        set({ chromaticAberrationEnabled }),
      setChromaticAberrationOffset: (chromaticAberrationOffset) =>
        set({ chromaticAberrationOffset }),
      setNoiseEnabled: (noiseEnabled) => set({ noiseEnabled }),
      setNoiseOpacity: (noiseOpacity) => set({ noiseOpacity }),
      setColorGradingEnabled: (colorGradingEnabled) => set({ colorGradingEnabled }),
      setCgBrightness: (cgBrightness) => set({ cgBrightness }),
      setCgContrast: (cgContrast) => set({ cgContrast }),
      setCgHue: (cgHue) => set({ cgHue }),
      setCgSaturation: (cgSaturation) => set({ cgSaturation }),
      setNormalMapUrl: (normalMapUrl) => set({ normalMapUrl }),
      setRoughnessMapUrl: (roughnessMapUrl) => set({ roughnessMapUrl }),
      setMetalnessMapUrl: (metalnessMapUrl) => set({ metalnessMapUrl }),
      setOrthographic: (orthographic) => set({ orthographic }),
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
      setExportFormat: (exportFormat) => {
        const patch: Record<string, any> = { exportFormat };
        if ((exportFormat === 'webm' || exportFormat === 'turntable') && get().animate !== 'none') {
          const loopPeriod = Math.round(((2 * Math.PI) / get().animateSpeed) * 2) / 2;
          patch.videoDuration = Math.min(Math.max(loopPeriod, 1), 10);
        }
        if (exportFormat === 'turntable') {
          patch.videoDuration = 4;
        }
        set(patch as any);
      },
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setExportResolution: (exportResolution) => set({ exportResolution }),
      setVideoDuration: (videoDuration) => set({ videoDuration }),
      setVideoFps: (videoFps) => set({ videoFps }),
      setIsExporting: (isExporting) => set({ isExporting, exportProgress: isExporting ? 0 : 0 }),
      setExportProgress: (exportProgress) => set({ exportProgress }),
      setPanelVisible: (panelVisible) => set({ panelVisible }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setShowStats: (showStats) => set({ showStats }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setSceneName: (_sceneName) => set({ _sceneName }),
      setLastSavedAt: (_lastSavedAt) => set({ _lastSavedAt }),

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
          customHdriUrl: '',
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
        set({
          ...INITIAL_STATE,
          _cameraControlsRef,
          resetKey: Date.now(),
          shaderEnabled: false,
          shaderType: 'halftone' as any,
          shaderValues: {},
        });
      },

      randomize: () => {
        const r = (min: number, max: number, step = 0.01) => {
          const steps = Math.round((max - min) / step);
          return Math.round((min + Math.random() * steps * step) * 100) / 100;
        };
        const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
        const randHex = () =>
          '#' +
          Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, '0');
        const materials: MaterialPreset[] = [
          'default',
          'plastic',
          'metal',
          'glass',
          'rubber',
          'chrome',
          'gold',
          'clay',
          'emissive',
          'holographic',
          'brushedSteel',
          'aluminum',
          'copper',
          'roseGold',
          'platinum',
          'ceramic',
          'marble',
          'concrete',
          'wood',
          'velvet',
          'leather',
          'frostedGlass',
          'diamond',
          'pearl',
          'carbonFiber',
          'carPaint',
          'ice',
          'obsidian',
          'wax',
          'mattePaint',
        ];
        const animations: AnimationType[] = [
          'none',
          'spin',
          'float',
          'pulse',
          'wobble',
          'spinFloat',
          'swing',
        ];
        const envIds = ENVIRONMENT_PRESETS.map((e) => e.id);
        const toneMaps = TONE_MAPPING_OPTIONS.map((t) => t.id) as ToneMappingType[];
        const bgTypes = ['solid', 'linear', 'radial'] as const;

        set({
          material: pick(materials),
          color: randHex(),
          depth: r(0.1, 3, 0.1),
          objectScale: r(0.5, 2, 0.1),
          fov: pick([35, 50, 65, 75]),
          smoothness: r(0, 1, 0.1),
          bevelEnabled: Math.random() > 0.3,
          bevelThickness: r(0.1, 2, 0.1),
          bevelSize: r(0.1, 2, 0.1),
          metalness: r(0, 1, 0.05),
          roughness: r(0, 1, 0.05),
          opacity: r(0.5, 1, 0.05),
          lightIntensity: r(0.5, 3, 0.1),
          ambientIntensity: r(0.1, 2, 0.1),
          environment: pick(envIds),
          background: randHex(),
          bgType: pick([...bgTypes]),
          bgGradient: { color1: randHex(), color2: randHex(), angle: r(0, 360, 15) },
          animate: pick(animations),
          animateSpeed: r(0.3, 3, 0.1),
          toneMapping: pick(toneMaps),
          toneMappingExposure: r(0.5, 2.5, 0.1),
          bloomEnabled: Math.random() > 0.6,
          bloomIntensity: r(0.5, 3, 0.1),
          bloomThreshold: r(0.3, 1, 0.05),
          vignetteEnabled: Math.random() > 0.7,
          vignetteIntensity: r(0.2, 0.8, 0.05),
          ssaoEnabled: Math.random() > 0.5,
          ssaoIntensity: r(0.2, 1.5, 0.1),
          chromaticAberrationEnabled: Math.random() > 0.8,
          chromaticAberrationOffset: r(0.001, 0.008, 0.001),
          noiseEnabled: Math.random() > 0.7,
          noiseOpacity: r(0.05, 0.25, 0.01),
          shadow: Math.random() > 0.4,
          groundPlane: Math.random() > 0.5,
        });
      },
    }),
    {
      partialize: (state) => {
        const {
          _cameraControlsRef,
          _cameraInfo,
          _sceneName,
          _lastSavedAt,
          panelVisible,
          activeTab,
          isLoading,
          isExporting,
          exportProgress,
          resetKey,
          showStats,
          ...tracked
        } = state;
        return tracked;
      },
      limit: 50,
      handleSet: (handleSet) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        return (state) => {
          clearTimeout(timer);
          timer = setTimeout(() => handleSet(state), 300);
        };
      },
    }
  ),
  {
    name: 'vsn-studio3d-session',
    version: 1,
    storage: createJSONStorage(() => sessionStorage),
    partialize: (state) => {
      const {
        _cameraControlsRef,
        _cameraInfo,
        isLoading,
        isExporting,
        exportProgress,
        resetKey,
        showStats,
        modelUrl,
        customHdriUrl,
        backgroundImageUrl,
        ...rest
      } = state as any;
      return rest;
    },
  }
  )
);

// Scene save/load (cloud API with localStorage fallback)
const API_BASE = (() => {
  try {
    return (import.meta as any).env?.VITE_API_URL || '/api';
  } catch {
    return '/api';
  }
})();

const SCENES_KEY = 'visant-3d-scenes';

export interface SavedScene {
  id: string;
  name: string;
  savedAt: number;
  config: Record<string, any>;
  thumbnail?: string;
}

function getCachedScenes(): SavedScene[] {
  try {
    return JSON.parse(localStorage.getItem(SCENES_KEY) || '[]');
  } catch {
    return [];
  }
}

function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getSavedScenes(): Promise<SavedScene[]> {
  try {
    const token = authService.getToken();
    if (!token) return getCachedScenes();
    const res = await fetch(`${API_BASE}/studio3d`, { headers: authHeaders() });
    if (!res.ok) return getCachedScenes();
    const data = await res.json();
    const scenes: SavedScene[] = (data.scenes || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      savedAt: new Date(s.updatedAt || s.createdAt).getTime(),
      config: s.config || {},
    }));
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
    return scenes;
  } catch {
    return getCachedScenes();
  }
}

export async function saveScene(name: string, thumbnail?: string): Promise<SavedScene | null> {
  const state = useStudio3DStore.getState();
  const exclude = new Set([
    '_cameraControlsRef',
    '_cameraInfo',
    'panelVisible',
    'activeTab',
    'isLoading',
    'isExporting',
    'exportProgress',
    'resetKey',
  ]);
  const config: Record<string, any> = {};
  for (const [k, v] of Object.entries(INITIAL_STATE)) {
    if (!exclude.has(k) && typeof v !== 'function') config[k] = (state as any)[k] ?? v;
  }
  config.shaderEnabled = state.shaderEnabled;
  config.shaderType = state.shaderType;
  config.shaderValues = state.shaderValues;

  try {
    const res = await fetch(`${API_BASE}/studio3d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        name,
        config,
        svgData: state.svgData || undefined,
        inputMode: state.inputMode,
        text: state.text || undefined,
        font: state.font || undefined,
        thumbnailUrl: thumbnail || undefined,
      }),
    });
    if (!res.ok) throw new Error('save failed');
    const data = await res.json();
    const scene: SavedScene = {
      id: data.scene.id,
      name: data.scene.name,
      savedAt: new Date(data.scene.createdAt).getTime(),
      config,
      thumbnail,
    };
    const scenes = getCachedScenes();
    scenes.unshift(scene);
    if (scenes.length > 50) scenes.length = 50;
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
    useStudio3DStore.setState({ _sceneName: name, _lastSavedAt: Date.now() });
    return scene;
  } catch {
    // Fallback to localStorage only
    const scene: SavedScene = {
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      config,
      thumbnail,
    };
    const scenes = getCachedScenes();
    scenes.unshift(scene);
    if (scenes.length > 50) scenes.length = 50;
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
    useStudio3DStore.setState({ _sceneName: name, _lastSavedAt: Date.now() });
    return scene;
  }
}

export async function shareScene(name: string, thumbnail?: string): Promise<string | null> {
  const scene = await saveScene(name, thumbnail);
  if (!scene) return null;
  try {
    await fetch(`${API_BASE}/studio3d/${scene.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ isPublic: true }),
    });
    return `${window.location.origin}/3d-studio?sceneId=${scene.id}`;
  } catch {
    return null;
  }
}

export interface PublicScene {
  id: string;
  _id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  inputMode: string;
  config: { material?: string; background?: string; shapeType?: string };
  createdAt: string;
  user?: { name: string | null; avatar: string | null };
}

export async function getPublicScenes(opts?: { limit?: number; cursor?: string; tag?: string }): Promise<{ scenes: PublicScene[]; nextCursor: string | null }> {
  try {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.tag) params.set('tag', opts.tag);
    const res = await fetch(`${API_BASE}/studio3d/public?${params}`);
    if (!res.ok) return { scenes: [], nextCursor: null };
    return res.json();
  } catch {
    return { scenes: [], nextCursor: null };
  }
}

export async function forkScene(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/studio3d/${id}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.scene?.config) {
      useStudio3DStore.getState().applyConfig(data.scene.config);
      if (data.scene.svgData) {
        useStudio3DStore.getState().setSvgData(data.scene.svgData, data.scene.name || '');
      }
      useStudio3DStore.setState({ _sceneName: data.scene.name || '', _lastSavedAt: Date.now() });
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadScene(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/studio3d/${id}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.scene?.config) {
        useStudio3DStore.getState().applyConfig(data.scene.config);
        if (data.scene.config.shaderEnabled !== undefined) {
          useStudio3DStore.setState({
            shaderEnabled: data.scene.config.shaderEnabled,
            shaderType: data.scene.config.shaderType,
            shaderValues: data.scene.config.shaderValues || {},
          });
        }
        if (data.scene.svgData) {
          useStudio3DStore.getState().setSvgData(data.scene.svgData, data.scene.name || '');
        }
        useStudio3DStore.setState({ _sceneName: data.scene.name || '', _lastSavedAt: Date.now() });
        return true;
      }
    }
  } catch {}
  // Fallback to localStorage
  const scene = getCachedScenes().find((s) => s.id === id);
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

export async function deleteScene(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/studio3d/${id}`, { method: 'DELETE', headers: authHeaders() });
  } catch {}
  // Always clean local cache too
  const scenes = getCachedScenes().filter((s) => s.id !== id);
  localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
}
