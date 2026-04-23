import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimationPreset } from '../../types/moodboard';
import { calculateAnimationStyles } from '../../utils/moodboard/animationUtils';

interface AnimatedSlideProps {
  imageUrl: string;
  preset: AnimationPreset;
  zoomScale?: number;
  panAmount?: number;
  speed?: number;
}

export const AnimatedSlide: React.FC<AnimatedSlideProps> = ({
  imageUrl, preset, zoomScale = 1.2, panAmount = 5, speed = 1
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { scale, translateX, opacity } = calculateAnimationStyles(
    frame, durationInFrames, preset,
    { zoomScale, panAmount, speed, durationInSeconds: durationInFrames / 30 }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <Img
        src={imageUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translateX(${translateX}%)`, opacity }}
      />
    </AbsoluteFill>
  );
};
