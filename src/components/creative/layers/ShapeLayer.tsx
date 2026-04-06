import React from 'react';
import type { CreativeLayer, ShapeLayerData } from '../store/creativeTypes';
import { getLayerStyle } from '../lib/layerUtils';

interface Props {
  layer: CreativeLayer & { data: ShapeLayerData };
  canvasWidth: number;
  canvasHeight: number;
}

export const ShapeLayer: React.FC<Props> = ({ layer, canvasWidth, canvasHeight }) => {
  const { data } = layer;

  return (
    <div
      className="creative-layer absolute select-none"
      data-layer-id={layer.id}
      style={getLayerStyle(layer, canvasWidth, canvasHeight)}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: data.color,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
