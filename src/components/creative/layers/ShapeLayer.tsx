import React from 'react';
import { Rnd } from 'react-rnd';
import { useCreativeStore } from '../store/creativeStore';
import type { CreativeLayer, ShapeLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer & { data: ShapeLayerData };
  canvasWidth: number;
  canvasHeight: number;
}

export const ShapeLayer: React.FC<Props> = ({ layer, canvasWidth, canvasHeight }) => {
  const { selectLayer, updateLayer, selectedLayerId } = useCreativeStore();
  const isSelected = selectedLayerId === layer.id;
  const { data } = layer;

  const px = {
    x: data.position.x * canvasWidth,
    y: data.position.y * canvasHeight,
    w: data.size.w * canvasWidth,
    h: data.size.h * canvasHeight,
  };

  return (
    <Rnd
      size={{ width: px.w, height: px.h }}
      position={{ x: px.x, y: px.y }}
      onDragStop={(_, d) =>
        updateLayer(layer.id, {
          position: { x: d.x / canvasWidth, y: d.y / canvasHeight },
        } as Partial<ShapeLayerData>)
      }
      onResizeStop={(_, __, ref, ___, position) =>
        updateLayer(layer.id, {
          position: { x: position.x / canvasWidth, y: position.y / canvasHeight },
          size: {
            w: ref.offsetWidth / canvasWidth,
            h: ref.offsetHeight / canvasHeight,
          },
        } as Partial<ShapeLayerData>)
      }
      bounds="parent"
      style={{
        zIndex: layer.zIndex,
        outline: isSelected ? '1px dashed rgba(0, 229, 255, 0.8)' : 'none',
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        selectLayer(layer.id);
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: data.color,
        }}
      />
    </Rnd>
  );
};
