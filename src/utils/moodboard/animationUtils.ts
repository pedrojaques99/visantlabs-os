import { AnimationPreset } from '../../types/moodboard';

export interface AnimationParams {
  zoomScale: number;
  panAmount: number;
  speed: number;
  durationInSeconds: number;
}

export const defaultAnimationParams: AnimationParams = {
  zoomScale: 1.2,
  panAmount: 5,
  speed: 1,
  durationInSeconds: 5,
};

export const calculateAnimationStyles = (
  frame: number,
  totalFrames: number,
  preset: AnimationPreset,
  params: AnimationParams = defaultAnimationParams
) => {
  const { zoomScale, panAmount, speed } = params;
  const progress = (frame * speed) / totalFrames;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  let scale = 1;
  let translateX = 0;
  let opacity = 1;

  switch (preset) {
    case 'zoom-in':
      scale = 1 + (zoomScale - 1) * clampedProgress;
      break;
    case 'zoom-out':
      scale = zoomScale - (zoomScale - 1) * clampedProgress;
      break;
    case 'pan-lr':
      scale = zoomScale;
      translateX = -panAmount + (panAmount * 2 * clampedProgress);
      break;
    case 'pan-rl':
      scale = zoomScale;
      translateX = panAmount - (panAmount * 2 * clampedProgress);
      break;
    case 'fade-in':
      opacity = Math.min(frame * speed / 15, 1);
      break;
  }

  return { scale, translateX, opacity };
};
