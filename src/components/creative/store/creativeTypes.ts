export type CreativeFormat = '1:1' | '9:16' | '16:9' | '4:5';

export interface TextLayerData {
  type: 'text';
  content: string;        // supports <accent>word</accent>
  role: 'headline' | 'subheadline' | 'body' | 'custom';
  position: { x: number; y: number };  // 0-1 normalized (top-left origin)
  size: { w: number; h: number };      // 0-1 normalized
  align: 'left' | 'center' | 'right';
  fontSize: number;       // px at preview resolution
  fontFamily: string;     // resolved family name
  color: string;          // hex
  bold: boolean;
}

export interface LogoLayerData {
  type: 'logo';
  url: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export interface ShapeLayerData {
  type: 'shape';
  shape: 'rect';
  color: string;          // hex
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export interface GroupLayerData {
  type: 'group';
  children: string[];      // IDs of child layers
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export type CreativeLayerData = TextLayerData | LogoLayerData | ShapeLayerData | GroupLayerData;

export interface CreativeLayer {
  id: string;
  visible: boolean;
  zIndex: number;
  data: CreativeLayerData;
}

export interface CreativeOverlay {
  type: 'gradient' | 'solid';
  direction?: 'top' | 'bottom' | 'left' | 'right';
  opacity: number;
  color?: string;
}

export interface CreativeAIResponse {
  background?: { prompt: string };
  overlay?: CreativeOverlay;
  layers: CreativeLayerData[];
}

export type CreativeStatus = 'setup' | 'generating' | 'editing';

export type CreativeTool = 'select' | 'lasso';

export type BackgroundLayerData = {
  type: 'background';
  url: string | null;
};
