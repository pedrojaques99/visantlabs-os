import React, { useState, useEffect } from 'react';
import { X, Bold, AlignLeft, AlignCenter, AlignRight, Trash2, Type, Check } from 'lucide-react';
import { FormInput } from '../ui/form-input';
import { Select } from '../ui/select';
import type { PdfFieldMapping } from '../../types';

interface FieldPropertiesPanelProps {
  mapping: PdfFieldMapping;
  onUpdate: (updates: Partial<PdfFieldMapping>) => void;
  onRemove: () => void;
  onClose?: () => void;
  currentPage: number;
  totalPages: number;
}

export const FieldPropertiesPanel: React.FC<FieldPropertiesPanelProps> = ({
  mapping,
  onUpdate,
  onRemove,
  onClose,
  currentPage,
  totalPages,
}) => {
  // Guard against undefined/null mapping
  if (!mapping) {
    return (
      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
        <p className="text-sm text-zinc-400 font-mono">Nenhum campo selecionado</p>
      </div>
    );
  }

  // Local state for temporary changes
  const [localChanges, setLocalChanges] = useState<Partial<PdfFieldMapping>>({});
  const [fontSizeError, setFontSizeError] = useState<string | null>(null);
  const [xError, setXError] = useState<string | null>(null);
  const [yError, setYError] = useState<string | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  // Reset local changes when mapping changes
  useEffect(() => {
    setLocalChanges({});
  }, [mapping.id || mapping.fieldId]);

  // Get current value (local change or original mapping value)
  const getValue = <K extends keyof PdfFieldMapping>(key: K): PdfFieldMapping[K] => {
    return localChanges[key] !== undefined ? localChanges[key] as PdfFieldMapping[K] : mapping[key];
  };

  // Update local changes
  const updateLocal = (updates: Partial<PdfFieldMapping>) => {
    setLocalChanges(prev => ({ ...prev, ...updates }));
  };

  // Apply changes
  const handleApply = () => {
    if (Object.keys(localChanges).length > 0) {
      onUpdate(localChanges);
      setLocalChanges({});
    }
  };

  // Dismiss changes
  const handleDismiss = () => {
    setLocalChanges({});
    setFontSizeError(null);
    setXError(null);
    setYError(null);
  };

  const isBold = getValue('bold') || false;
  const hasChanges = Object.keys(localChanges).length > 0;

  // Handle ESC key to close panel (only if no pending changes)
  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        // Only close if there are no pending changes
        if (!hasChanges) {
          e.preventDefault();
          onClose();
        } else {
          // Show warning if there are pending changes
          e.preventDefault();
          setShowCloseWarning(true);
          setTimeout(() => setShowCloseWarning(false), 2000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasChanges]);

  // Validation helpers
  const validateFontSize = (value: number): boolean => {
    if (isNaN(value) || value < 6 || value > 144) {
      setFontSizeError('Tamanho deve estar entre 6 e 144');
      return false;
    }
    setFontSizeError(null);
    return true;
  };

  const validatePosition = (value: number, axis: 'x' | 'y'): boolean => {
    if (isNaN(value) || value < 0) {
      if (axis === 'x') {
        setXError('Valor deve ser maior ou igual a 0');
      } else {
        setYError('Valor deve ser maior ou igual a 0');
      }
      return false;
    }
    if (axis === 'x') {
      setXError(null);
    } else {
      setYError(null);
    }
    return true;
  };

  return (
    <div className="w-full h-full bg-zinc-900 flex flex-col relative">
      {/* Warning message when trying to close with pending changes */}
      {showCloseWarning && (
        <div className="absolute top-2 left-2 right-2 z-50 px-3 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-md text-yellow-400 text-xs font-mono animate-pulse">
          Aplique ou descarte as mudanças antes de fechar
        </div>
      )}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold font-mono text-zinc-200">
            Propriedades
          </h3>
        </div>
        <p className="text-xs text-zinc-400 font-mono mb-3">
          {mapping.label || mapping.fieldId}
        </p>
        <button
          onClick={onRemove}
          className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-md text-red-400 font-mono text-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          title="Remover campo (Delete)"
          aria-label="Remover campo"
        >
          <Trash2 size={16} />
          Remover Campo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Fonte */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            Fonte
          </label>
          <Select
            value={getValue('fontFamily') || 'geist'}
            onChange={(value) => updateLocal({ fontFamily: value as 'geist' | 'manrope' | 'redhatmono' | 'barlow' })}
            options={[
              { value: 'geist', label: 'Geist' },
              { value: 'manrope', label: 'Manrope' },
              { value: 'redhatmono', label: 'Red Hat Mono' },
              { value: 'barlow', label: 'Barlow' },
            ]}
            aria-label="Selecionar família da fonte"
          />
        </div>

        {/* Tamanho da Fonte */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            Tamanho da Fonte
          </label>
          <div className="flex items-center gap-2">
            <Type size={16} className="text-zinc-500" />
            <FormInput
              type="number"
              min={6}
              max={144}
              step={1}
              value={getValue('fontSize') || 12}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (validateFontSize(value)) {
                  updateLocal({ fontSize: value });
                }
              }}
              onBlur={(e) => {
                const value = parseFloat(e.target.value);
                if (!validateFontSize(value)) {
                  // Reset to valid value if invalid
                  updateLocal({ fontSize: Math.max(6, Math.min(144, value || 12)) });
                }
              }}
              className={`flex-1 text-sm font-mono ${fontSizeError ? 'border-red-500' : ''}`}
              placeholder="12"
            />
            <span className="text-xs text-zinc-500 font-mono">pt</span>
          </div>
          {fontSizeError && (
            <p className="text-xs text-red-400 font-mono mt-1">{fontSizeError}</p>
          )}
        </div>

        {/* Bold */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            Estilo
          </label>
          <button
            onClick={() => updateLocal({ bold: !isBold })}
            className={`w-full px-3 py-2 rounded-md border transition-colors flex items-center justify-center gap-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 ${isBold
              ? 'bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            aria-label={isBold ? 'Desativar negrito' : 'Ativar negrito'}
            aria-pressed={isBold}
          >
            <Bold size={16} />
            {isBold ? 'Negrito' : 'Normal'}
          </button>
        </div>

        {/* Cor */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            Cor
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={getValue('color') || '#000000'}
              onChange={(e) => updateLocal({ color: e.target.value })}
              className="w-12 h-10 rounded border border-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50"
              aria-label="Selecionar cor do texto"
            />
            <FormInput
              type="text"
              value={getValue('color') || '#000000'}
              onChange={(e) => updateLocal({ color: e.target.value })}
              className="flex-1 text-sm font-mono"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Alinhamento */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            Alinhamento
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => updateLocal({ align: 'left' })}
              className={`flex-1 px-3 py-2 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 ${(getValue('align') || 'left') === 'left'
                ? 'bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              title="Esquerda"
              aria-label="Alinhar à esquerda"
              aria-pressed={(getValue('align') || 'left') === 'left'}
            >
              <AlignLeft size={18} className="mx-auto" />
            </button>
            <button
              onClick={() => updateLocal({ align: 'center' })}
              className={`flex-1 px-3 py-2 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 ${getValue('align') === 'center'
                ? 'bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              title="Centro"
              aria-label="Alinhar ao centro"
              aria-pressed={getValue('align') === 'center'}
            >
              <AlignCenter size={18} className="mx-auto" />
            </button>
            <button
              onClick={() => updateLocal({ align: 'right' })}
              className={`flex-1 px-3 py-2 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 ${getValue('align') === 'right'
                ? 'bg-brand-cyan/20 border-[brand-cyan]/50 text-brand-cyan'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              title="Direita"
              aria-label="Alinhar à direita"
              aria-pressed={getValue('align') === 'right'}
            >
              <AlignRight size={18} className="mx-auto" />
            </button>
          </div>
        </div>

        {/* Posição */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            Posição (pontos)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-zinc-500 font-mono">X:</span>
              <FormInput
                type="number"
                min={0}
                step={1}
                value={Math.round(getValue('x') || 0)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (validatePosition(value, 'x')) {
                    updateLocal({ x: value });
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (!validatePosition(value, 'x')) {
                    updateLocal({ x: Math.max(0, value) });
                  }
                }}
                className={`text-sm mt-1 ${xError ? 'border-red-500' : ''}`}
              />
              {xError && (
                <p className="text-xs text-red-400 font-mono mt-0.5">{xError}</p>
              )}
            </div>
            <div>
              <span className="text-xs text-zinc-500 font-mono">Y:</span>
              <FormInput
                type="number"
                min={0}
                step={1}
                value={Math.round(getValue('y') || 0)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (validatePosition(value, 'y')) {
                    updateLocal({ y: value });
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (!validatePosition(value, 'y')) {
                    updateLocal({ y: Math.max(0, value) });
                  }
                }}
                className={`text-sm mt-1 ${yError ? 'border-red-500' : ''}`}
              />
              {yError && (
                <p className="text-xs text-red-400 font-mono mt-0.5">{yError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apply/Dismiss buttons */}
      {hasChanges && (
        <div className="p-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={handleApply}
            className="flex-1 px-3 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded-md text-brand-cyan font-mono text-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50"
            title="Aplicar mudanças"
            aria-label="Aplicar mudanças"
          >
            <Check size={16} />
            Aplicar
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 font-mono text-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            title="Descartar mudanças"
            aria-label="Descartar mudanças"
          >
            <X size={16} />
            Descartar
          </button>
        </div>
      )}
    </div>
  );
};

