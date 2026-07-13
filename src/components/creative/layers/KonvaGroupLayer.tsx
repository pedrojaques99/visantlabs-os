import React, { useRef, useEffect } from 'react';
import { Group } from 'react-konva';
import type Konva from 'konva';
import { useCreativeStore } from '../store/creativeStore';
import { normalizePoint, normalizeSize } from '@/lib/pixel';
import type { CreativeLayer, TextLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer; // grupo (data.type === 'group')
  canvasWidth: number;
  canvasHeight: number;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, extend: boolean) => void;
  onDragStart?: (id: string) => void;
  onSmartClear?: () => void;
  children: React.ReactNode; // os nós dos layers-filho (renderizados com inGroup)
}

/**
 * Grupo como um `<Group>` Konva real: os filhos são renderizados DENTRO dele
 * (não-arrastáveis individualmente), então arrastar/transformar o grupo move e
 * escala todos juntos. No fim de cada gesto a transformação do grupo é "folded"
 * de volta em cada filho (posição/tamanho/rotação absolutos) e o grupo volta à
 * identidade — mantendo o modelo flat de layers coeso com o store.
 */
const KonvaGroupLayerImpl: React.FC<Props> = ({
  layer,
  canvasWidth,
  canvasHeight,
  registerNode,
  onSelect,
  onDragStart,
  onSmartClear,
  children,
}) => {
  const updateLayer = useCreativeStore((s) => s.updateLayer);
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    registerNode(layer.id, groupRef.current);
    return () => registerNode(layer.id, null);
  }, [layer.id, registerNode]);

  const commit = () => {
    const g = groupRef.current;
    if (!g) return;
    const dims = { w: canvasWidth, h: canvasHeight };
    const byId = new Map(useCreativeStore.getState().layers.map((l) => [l.id, l]));

    g.getChildren().forEach((child) => {
      const id = child.id();
      if (!id) return;
      const src = byId.get(id);
      if (!src) return;

      const absPos = child.getAbsolutePosition();
      const absScale = child.getAbsoluteScale();
      const absRot = child.getAbsoluteRotation();
      const sx = Math.abs(absScale.x) || 1;
      const sy = Math.abs(absScale.y) || 1;
      // Zera o scale local do nó pra o re-render (que usa width/height) sair limpo.
      child.scaleX(1);
      child.scaleY(1);

      const position = normalizePoint(absPos, dims);
      if (src.data.type === 'text') {
        // Texto escala a fonte, nunca a caixa (mesma regra do resize individual).
        const fontScale = (sx + sy) / 2;
        updateLayer(id, {
          position,
          rotation: absRot,
          fontSize: Math.max(8, (src.data as TextLayerData).fontSize * fontScale),
          size: normalizeSize(
            { w: child.width() * sx, h: child.height() * sy },
            dims
          ),
        } as Partial<TextLayerData>);
      } else {
        updateLayer(id, {
          position,
          rotation: absRot,
          size: normalizeSize(
            { w: Math.max(1, child.width() * sx), h: Math.max(1, child.height() * sy) },
            dims
          ),
        });
      }
    });

    // Grupo volta à identidade — os filhos já carregam a transformação absoluta.
    g.scaleX(1);
    g.scaleY(1);
    g.rotation(0);
    g.position({ x: 0, y: 0 });
  };

  return (
    <Group
      ref={groupRef}
      draggable={!layer.locked}
      onMouseEnter={(e) => {
        const s = e.target.getStage();
        if (s) s.container().style.cursor = 'move';
      }}
      onMouseLeave={(e) => {
        const s = e.target.getStage();
        if (s) s.container().style.cursor = '';
      }}
      onClick={(e) => onSelect(layer.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(layer.id, e.evt.shiftKey)}
      onDragStart={() => onDragStart?.(layer.id)}
      onDragEnd={() => {
        onSmartClear?.();
        commit();
      }}
      onTransformEnd={() => {
        onSmartClear?.();
        commit();
      }}
    >
      {children}
    </Group>
  );
};

export const KonvaGroupLayer = React.memo(KonvaGroupLayerImpl);
