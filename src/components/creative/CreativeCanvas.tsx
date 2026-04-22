import React, { forwardRef, useRef } from 'react';
import { useCreativeStore } from './store/creativeStore';
import { TextLayer } from './layers/TextLayer';
import { LogoLayer } from './layers/LogoLayer';
import { ShapeLayer } from './layers/ShapeLayer';
import { CreativeMoveable } from './CreativeMoveable';
import { LassoTool } from './LassoTool';
import { getProxiedUrl } from '@/utils/proxyUtils';

interface Props {
  width: number;
  height: number;
  accentColor: string;
  defaultFont: string;
}

export const CreativeCanvas = forwardRef<HTMLDivElement, Props>(
  ({ width, height, accentColor, defaultFont }, ref) => {
    const { backgroundUrl, overlay, layers, addLayer, setSelectedLayerIds, setBackgroundSelected } = useCreativeStore();
    const fallbackRef = useRef<HTMLDivElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLDivElement>) || fallbackRef;
    
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const url = e.dataTransfer.getData('application/vsn-asset-url');
        const type = e.dataTransfer.getData('application/vsn-asset-type') as 'logo' | 'image' | 'text' | 'shape';
        
        if (!canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / width;
        const y = (e.clientY - rect.top) / height;
        
        if (type === 'text') {
            addLayer({
                type: 'text',
                content: 'Novo texto',
                role: 'body',
                position: { x: x - 0.2, y: y - 0.04 },
                size: { w: 0.4, h: 0.08 },
                align: 'left',
                fontSize: 48,
                fontFamily: defaultFont,
                color: '#ffffff',
                bold: false,
            });
        } else if (type === 'shape') {
            addLayer({
                type: 'shape',
                shape: 'rect',
                color: accentColor,
                position: { x: x - 0.075, y: y - 0.075 },
                size: { w: 0.15, h: 0.15 },
            });
        } else if (url) {
            addLayer({
                type: 'logo',
                url,
                position: { x: x - 0.1, y: y - 0.05 },
                size: type === 'logo' ? { w: 0.2, h: 0.1 } : { w: 0.4, h: 0.3 },
            });
        }
    };

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
        className="relative shadow-2xl bg-black overflow-visible selection-none"
        style={{ width, height }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div
          ref={ref}
          className="w-full h-full relative overflow-hidden bg-neutral-900"
          onClick={(e) => {
             if (e.target === e.currentTarget) {
               setBackgroundSelected(true);
             }
          }}
        >
          {backgroundUrl && (
            <img
              src={getProxiedUrl(backgroundUrl)}
              crossOrigin="anonymous"
              alt="background"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
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

        {/* Lasso selection tool */}
        <LassoTool canvasWidth={width} canvasHeight={height} />

        {/* The Moveable Engine handles drawing handles/lines on top of DOM elements */}
        <CreativeMoveable
          canvasWidth={width}
          canvasHeight={height}
          containerRef={ref as React.RefObject<HTMLDivElement>}
        />
      </div>
    );
  }
);

CreativeCanvas.displayName = 'CreativeCanvas';
