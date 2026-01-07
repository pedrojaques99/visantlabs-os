import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { PdfFieldMapping } from '../../types';

interface VariableThumbnailProps {
  fieldId: string;
  label: string;
  icon?: React.ReactNode;
  status: 'available' | 'added' | 'positioned';
  onClick: () => void;
  mapping?: PdfFieldMapping;
  instanceCount?: number;
}

export const VariableThumbnail: React.FC<VariableThumbnailProps> = ({
  fieldId,
  label,
  icon,
  status,
  onClick,
  mapping,
  instanceCount = 0,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `variable-${fieldId}`,
    data: {
      type: 'variable',
      fieldId,
      label,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusStyles = () => {
    switch (status) {
      case 'available':
        return 'border-zinc-700 bg-black/20 hover:bg-black/40 text-zinc-400';
      case 'added':
        return 'border-[brand-cyan]/50 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan';
      case 'positioned':
        return 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-400';
      default:
        return 'border-zinc-700 bg-black/20 text-zinc-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'positioned':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'added':
        return <Circle size={16} className="text-brand-cyan" />;
      default:
        return null;
    }
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`relative p-4 rounded-md border-2 transition-all duration-200 flex flex-col items-center gap-2 min-h-[100px] w-full cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 ${getStatusStyles()}`}
      aria-label={`Variável ${label}${instanceCount > 0 ? `, ${instanceCount} instância${instanceCount > 1 ? 's' : ''}` : ''}`}
      role="button"
    >
      {icon && <div className="text-2xl">{icon}</div>}
      <span className="text-xs font-mono text-center font-medium">{label}</span>
      {instanceCount > 0 && (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-brand-cyan/20 text-brand-cyan border border-[brand-cyan]/30">
          {instanceCount} {instanceCount === 1 ? 'instância' : 'instâncias'}
        </span>
      )}
      {mapping && !instanceCount && (
        <span className="text-[10px] font-mono opacity-60">
          {mapping.page ? `Página ${mapping.page}` : 'Clique para adicionar'}
        </span>
      )}
      {getStatusIcon() && (
        <div className="absolute top-2 right-2">
          {getStatusIcon()}
        </div>
      )}
    </button>
  );
};

