import React, { useRef, useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useCreativeStore } from '../store/creativeStore';
import { parseAccent, stripAccent } from '../lib/parseAccent';
import type { CreativeLayer, TextLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer & { data: TextLayerData };
  canvasWidth: number;
  canvasHeight: number;
  accentColor: string;
}

export const TextLayer: React.FC<Props> = ({ layer, canvasWidth, canvasHeight, accentColor }) => {
  const { selectLayer, updateLayer, selectedLayerId } = useCreativeStore();
  const isSelected = selectedLayerId === layer.id;
  const [editing, setEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);

  const { data } = layer;
  const px = {
    x: data.position.x * canvasWidth,
    y: data.position.y * canvasHeight,
    w: data.size.w * canvasWidth,
    h: data.size.h * canvasHeight,
  };

  // Scale fontSize relative to current canvas (data.fontSize is at 1080px reference)
  const scaledFontSize = (data.fontSize / 1080) * canvasHeight;

  useEffect(() => {
    if (editing && editableRef.current) {
      editableRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editableRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const handleBlur = () => {
    if (!editableRef.current) return;
    const text = editableRef.current.innerText;
    updateLayer(layer.id, { content: text } as Partial<TextLayerData>);
    setEditing(false);
  };

  return (
    <Rnd
      size={{ width: px.w, height: px.h }}
      position={{ x: px.x, y: px.y }}
      onDragStop={(_, d) =>
        updateLayer(layer.id, {
          position: { x: d.x / canvasWidth, y: d.y / canvasHeight },
        } as Partial<TextLayerData>)
      }
      onResizeStop={(_, __, ref, ___, position) =>
        updateLayer(layer.id, {
          position: { x: position.x / canvasWidth, y: position.y / canvasHeight },
          size: {
            w: ref.offsetWidth / canvasWidth,
            h: ref.offsetHeight / canvasHeight,
          },
        } as Partial<TextLayerData>)
      }
      bounds="parent"
      disableDragging={editing}
      enableResizing={!editing}
      style={{
        zIndex: layer.zIndex,
        outline: isSelected ? '1px dashed rgba(0, 229, 255, 0.8)' : 'none',
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        selectLayer(layer.id);
      }}
      onDoubleClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <div
        ref={editableRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={handleBlur}
        style={{
          width: '100%',
          height: '100%',
          fontFamily: data.fontFamily,
          fontSize: `${scaledFontSize}px`,
          fontWeight: data.bold ? 700 : 400,
          color: data.color,
          textAlign: data.align,
          lineHeight: 1.05,
          outline: 'none',
          cursor: editing ? 'text' : 'move',
          userSelect: editing ? 'text' : 'none',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
        }}
      >
        {editing ? stripAccent(data.content) : parseAccent(data.content, accentColor)}
      </div>
    </Rnd>
  );
};
