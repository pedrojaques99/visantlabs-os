import { create } from 'zustand';
import type { MaterialPreset } from '3dsvg';

type AnimationType = 'none' | 'spin' | 'float' | 'pulse' | 'wobble' | 'spinFloat' | 'swing';
type ExportFormat = 'png' | 'mp4' | 'gif';
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

export const MATERIAL_PRESETS: { id: MaterialPreset; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'plastic', label: 'Plastic' },
  { id: 'metal', label: 'Metal' },
  { id: 'glass', label: 'Glass' },
  { id: 'rubber', label: 'Rubber' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'gold', label: 'Gold' },
  { id: 'clay', label: 'Clay' },
  { id: 'emissive', label: 'Emissive' },
  { id: 'holographic', label: 'Holographic' },
];

export const ANIMATION_PRESETS: { id: AnimationType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'spin', label: 'Spin' },
  { id: 'float', label: 'Float' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'wobble', label: 'Wobble' },
  { id: 'swing', label: 'Swing' },
  { id: 'spinFloat', label: 'Spin + Float' },
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
  depth: number;
  smoothness: number;

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

  // Lighting
  lightPosition: [number, number, number];
  lightIntensity: number;
  ambientIntensity: number;
  shadow: boolean;

  // Environment
  environment: string;
  background: string;
  transparentBg: boolean;

  // Animation
  animate: AnimationType;
  animateSpeed: number;
  animateReverse: boolean;

  // Camera
  rotationX: number;
  rotationY: number;
  zoom: number;
  interactive: boolean;

  // Export
  exportFormat: ExportFormat;
  aspectRatio: AspectRatio;
  exportResolution: 'hd' | '2k' | '4k';
  videoDuration: number;
  isExporting: boolean;

  // UI
  panelVisible: boolean;
  activeTab: 'geometry' | 'material' | 'scene' | 'animation' | 'export';
  isLoading: boolean;
  resetKey: number;

  // Actions
  setSvgData: (svg: string, fileName?: string) => void;
  setText: (text: string) => void;
  setFont: (font: string) => void;
  setInputMode: (mode: 'svg' | 'text') => void;
  setDepth: (v: number) => void;
  setSmoothness: (v: number) => void;
  setMaterial: (m: MaterialPreset) => void;
  setColor: (c: string) => void;
  setMetalness: (v: number) => void;
  setRoughness: (v: number) => void;
  setOpacity: (v: number) => void;
  setWireframe: (v: boolean) => void;
  setTexture: (url: string) => void;
  setTextureRepeat: (v: number) => void;
  setTextureRotation: (v: number) => void;
  setLightPosition: (p: [number, number, number]) => void;
  setLightIntensity: (v: number) => void;
  setAmbientIntensity: (v: number) => void;
  setShadow: (v: boolean) => void;
  setEnvironment: (e: string) => void;
  setBackground: (c: string) => void;
  setTransparentBg: (v: boolean) => void;
  setAnimate: (a: AnimationType) => void;
  setAnimateSpeed: (v: number) => void;
  setAnimateReverse: (v: boolean) => void;
  setInteractive: (v: boolean) => void;
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
  resetScene: () => void;
}

const INITIAL_STATE = {
  svgData: '',
  inputMode: 'svg' as const,
  text: '',
  font: 'DM Sans',
  fileName: '',
  depth: 3,
  smoothness: 1,
  material: 'default' as MaterialPreset,
  color: '#00e5ff',
  metalness: 0.5,
  roughness: 0.5,
  opacity: 1,
  wireframe: false,
  texture: '',
  textureRepeat: 1,
  textureRotation: 0,
  lightPosition: [5, 5, 5] as [number, number, number],
  lightIntensity: 1,
  ambientIntensity: 0.4,
  shadow: true,
  environment: 'studio',
  background: '#0a0a0a',
  transparentBg: false,
  animate: 'spin' as AnimationType,
  animateSpeed: 1,
  animateReverse: false,
  rotationX: 0,
  rotationY: 0,
  zoom: 8,
  interactive: false,
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

export const useStudio3DStore = create<Studio3DState>((set) => ({
  ...INITIAL_STATE,

  setSvgData: (svg, fileName) => set({ svgData: svg, fileName: fileName || '', inputMode: 'svg' }),
  setText: (text) => set({ text }),
  setFont: (font) => set({ font }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setDepth: (depth) => set({ depth }),
  setSmoothness: (smoothness) => set({ smoothness }),
  setMaterial: (material) => set({ material }),
  setColor: (color) => set({ color }),
  setMetalness: (metalness) => set({ metalness }),
  setRoughness: (roughness) => set({ roughness }),
  setOpacity: (opacity) => set({ opacity }),
  setWireframe: (wireframe) => set({ wireframe }),
  setTexture: (texture) => set({ texture }),
  setTextureRepeat: (textureRepeat) => set({ textureRepeat }),
  setTextureRotation: (textureRotation) => set({ textureRotation }),
  setLightPosition: (lightPosition) => set({ lightPosition }),
  setLightIntensity: (lightIntensity) => set({ lightIntensity }),
  setAmbientIntensity: (ambientIntensity) => set({ ambientIntensity }),
  setShadow: (shadow) => set({ shadow }),
  setEnvironment: (environment) => set({ environment }),
  setBackground: (background) => set({ background }),
  setTransparentBg: (transparentBg) => set({ transparentBg }),
  setAnimate: (animate) => set({ animate }),
  setAnimateSpeed: (animateSpeed) => set({ animateSpeed }),
  setAnimateReverse: (animateReverse) => set({ animateReverse }),
  setInteractive: (interactive) => set({ interactive }),
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
      depth: preset.depth,
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

  resetScene: () => set({ ...INITIAL_STATE, resetKey: Date.now() }),
}));
