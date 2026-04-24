export type AnimationPreset = 'zoom-in' | 'zoom-out' | 'pan-lr' | 'pan-rl' | 'fade-in';
export type TransitionType = 'fade' | 'slide' | 'wipe' | 'none';
export type RenderJobStatus = 'queued' | 'rendering' | 'completed' | 'downloaded' | 'cancelled' | 'error';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CroppedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  upscaledUrl?: string;
  isUpscaling: boolean;
  upscaleStartTime?: number;
  regeneratedUrl?: string;
  videoUrl?: string;
  isAnimating: boolean;
  animationStartTime?: number;
  animationPrompt?: string;
  suggestedPreset?: AnimationPreset;
}

export interface AnimationSuggestion {
  id: string;
  preset: string;
  prompt: string;
}

export interface RenderSlide {
  imageUrl: string;
  preset: AnimationPreset;
  durationInSeconds: number;
  width: number;
  height: number;
  zoomScale?: number;
  panAmount?: number;
  speed?: number;
}

export interface RenderComposition {
  id: string;
  name?: string;
  thumbnailUrl?: string;
  slides: RenderSlide[];
  fps: number;
  transition: TransitionType;
  transitionDurationFrames: number;
}

export interface RenderJob {
  id: string;
  composition: RenderComposition;
  status: RenderJobStatus;
  progress: number;
  blob: Blob | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface MoodboardProject {
  id: string;
  name: string;
  sourceUrl?: string;
  brandGuidelineId?: string;
  createdAt: string;
  updatedAt: string;
}
