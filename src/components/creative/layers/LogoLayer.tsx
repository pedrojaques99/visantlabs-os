import React from 'react';
import type { CreativeLayer, LogoLayerData } from '../store/creativeTypes';
import { getLayerStyle } from '../lib/layerUtils';
import { getProxiedUrl } from '@/utils/proxyUtils';

interface Props {
  layer: CreativeLayer & { data: LogoLayerData };
  canvasWidth: number;
  canvasHeight: number;
}

export const LogoLayer: React.FC<Props> = ({ layer, canvasWidth, canvasHeight }) => {
  const { data } = layer;

  return (
    <div
      className="creative-layer absolute select-none"
      data-layer-id={layer.id}
      style={getLayerStyle(layer, canvasWidth, canvasHeight)}
    >
      <img
        src={getProxiedUrl(data.url)}
        alt="logo"
        crossOrigin="anonymous"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
          ['WebkitUserDrag' as any]: 'none',
        }}
      />
    </div>
  );
};
