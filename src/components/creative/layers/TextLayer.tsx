import React, { useRef, useState, useEffect } from 'react';
import { useCreativeStore } from '../store/creativeStore';
import { parseAccent, stripAccent } from '../lib/parseAccent';
import { getLayerStyle } from '../lib/layerUtils';
import type { CreativeLayer, TextLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer & { data: TextLayerData };
  canvasWidth: number;
  canvasHeight: number;
  accentColor: string;
}

export const TextLayer: React.FC<Props> = ({ layer, canvasWidth, canvasHeight, accentColor }) => {
  const { updateLayer } = useCreativeStore();
  const [editing, setEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);
  const { data } = layer;

  // fontSize is stored at 1080px reference height
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
    updateLayer(layer.id, { content: editableRef.current.innerText } as Partial<TextLayerData>);
    setEditing(false);
  };

  return (
    <div
      className="creative-layer absolute select-none"
      data-layer-id={layer.id}
      style={{
        ...getLayerStyle(layer, canvasWidth, canvasHeight),
        cursor: editing ? 'text' : 'move',
      }}
      onDoubleClick={(e) => {
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
          cursor: 'inherit',
          userSelect: editing ? 'text' : 'none',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          transform: 'translateZ(0)',
        }}
      >
        {editing ? stripAccent(data.content) : parseAccent(data.content, accentColor)}
      </div>
    </div>
  );
};
