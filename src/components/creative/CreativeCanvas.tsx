import React, { forwardRef } from 'react';
import { useCreativeStore } from './store/creativeStore';
import { TextLayer } from './layers/TextLayer';
import { LogoLayer } from './layers/LogoLayer';
import { ShapeLayer } from './layers/ShapeLayer';

interface Props {
  width: number;
  height: number;
  accentColor: string;
}

export const CreativeCanvas = forwardRef<HTMLDivElement, Props>(
  ({ width, height, accentColor }, ref) => {
    const { backgroundUrl, overlay, layers, selectLayer } = useCreativeStore();

    const overlayBg = (() => {
      if (!overlay) return undefined;
      if (overlay.type === 'solid') {
        return overlay.color ?? `rgba(0,0,0,${overlay.opacity})`;
      }
      // gradient
      const dir = overlay.direction ?? 'bottom';
      const angles: Record<string, string> = {
        bottom: 'to top',
        top: 'to bottom',
        left: 'to right',
        right: 'to left',
      };
      const stop = overlay.color ?? '#000000';
      return `linear-gradient(${angles[dir]}, ${stop}${Math.round(overlay.opacity * 255)
        .toString(16)
        .padStart(2, '0')}, transparent)`;
    })();

    return (
      <div
        ref={ref}
        onClick={() => selectLayer(null)}
        style={{
          position: 'relative',
          width,
          height,
          backgroundColor: '#0a0a0a',
          overflow: 'hidden',
        }}
      >
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            crossOrigin="anonymous"
            alt="background"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        )}
        {overlayBg && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: overlayBg,
              pointerEvents: 'none',
            }}
          />
        )}
        {layers
          .filter((l) => l.visible)
          .map((layer) => {
            if (layer.data.type === 'text') {
              return (
                <TextLayer
                  key={layer.id}
                  layer={layer as any}
                  canvasWidth={width}
                  canvasHeight={height}
                  accentColor={accentColor}
                />
              );
            }
            if (layer.data.type === 'logo') {
              return (
                <LogoLayer
                  key={layer.id}
                  layer={layer as any}
                  canvasWidth={width}
                  canvasHeight={height}
                />
              );
            }
            return (
              <ShapeLayer
                key={layer.id}
                layer={layer as any}
                canvasWidth={width}
                canvasHeight={height}
              />
            );
          })}
      </div>
    );
  }
);

CreativeCanvas.displayName = 'CreativeCanvas';
