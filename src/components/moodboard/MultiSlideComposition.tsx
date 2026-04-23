import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { AnimatedSlide } from './AnimatedSlide';
import { RenderSlide, TransitionType } from '../../types/moodboard';

function getPresentation(transition: TransitionType): any {
  switch (transition) {
    case 'fade':  return fade();
    case 'slide': return slide({ direction: 'from-right' });
    case 'wipe':  return wipe();
    default:      return fade();
  }
}

export interface MultiSlideCompositionProps {
  slides: RenderSlide[];
  transition: TransitionType;
  transitionDurationFrames: number;
  fps: number;
}

export const MultiSlideComposition: React.FC<MultiSlideCompositionProps> = ({
  slides, transition, transitionDurationFrames, fps,
}) => {
  if (slides.length === 1) {
    const s = slides[0];
    return <AnimatedSlide imageUrl={s.imageUrl} preset={s.preset} zoomScale={s.zoomScale} panAmount={s.panAmount} speed={s.speed} />;
  }

  return (
    <TransitionSeries>
      {slides.map((s, i) => (
        <React.Fragment key={i}>
          <TransitionSeries.Sequence durationInFrames={Math.round(s.durationInSeconds * fps)}>
            <AnimatedSlide imageUrl={s.imageUrl} preset={s.preset} zoomScale={s.zoomScale} panAmount={s.panAmount} speed={s.speed} />
          </TransitionSeries.Sequence>
          {i < slides.length - 1 && transition !== 'none' && (
            <TransitionSeries.Transition
              presentation={getPresentation(transition)}
              timing={linearTiming({ durationInFrames: transitionDurationFrames })}
            />
          )}
        </React.Fragment>
      ))}
    </TransitionSeries>
  );
};
